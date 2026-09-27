/**
 * Publish smoke test — `npm run check:publish`.
 *
 * What this guards (#455): one press of Publish makes one post. A
 * double-click, a bouncing mouse switch or a retry after a dropped response
 * sends the identical submission twice, and each used to become its own post
 * in the same second. The route now answers an identical submission from the
 * same account with the post it already made.
 *
 * Driven through the real route with real sessions and genuinely concurrent
 * requests, because the bug is a race: a version that looks first and inserts
 * after an await passes every sequential check and still doubles up here.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The database is a lazy singleton keyed off these variables, so they have to
// be set before anything imports it — hence the dynamic imports below.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pf-publish-"));
process.env.COMMUNITY_DB_PATH = path.join(tmp, "test.db");
process.env.COMMUNITY_ENABLED = "1";
// No Origin header is sent below, which is the "same-origin navigation" case
// originBlocked() lets through — the session check is the real gate.
process.env.BETTER_AUTH_SECRET = "smoke-test-secret-not-a-real-one";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? "  ok  " : "FAIL  "}${label}${ok ? "" : `\n        got ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`}`,
  );
}

const CODE = `export function setup(params) {}
export function update(dt, input, params) {}
export function draw(display, params, time) {
  display.setPixel(0, 0, 255, 0, 0);
}`;

async function main() {
  const { eq } = await import("drizzle-orm");
  const { getAuth } = await import("../src/lib/community/server/auth");
  const { getDb } = await import("../src/lib/community/server/db");
  const schema = await import("../src/lib/community/server/schema");
  const route = await import("../src/app/api/community/patterns/route");

  const db = getDb();
  const auth = getAuth();

  /** Signs somebody up and returns the Cookie header their browser would send. */
  const enrol = async (username: string): Promise<string> => {
    const response = await auth.api.signUpEmail({
      body: {
        email: `${username}@patternflow.local`,
        password: "smoke-test-password",
        name: username,
        username,
      },
      asResponse: true,
    });
    const setCookie = response.headers.get("set-cookie");
    if (!setCookie) throw new Error(`no session cookie for ${username}`);
    return setCookie.split(";")[0];
  };

  // Five publishes a minute each (the route's rate limit), so the cases are
  // spread over three people.
  const ada = await enrol("ada");
  const bea = await enrol("bea");
  const cyd = await enrol("cyd");

  const publish = async (cookie: string, body: Record<string, unknown>) => {
    const response = await route.POST(
      new Request("http://localhost:3000/api/community/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(body),
      }),
    );
    const payload = (await response.json()) as { id?: string; error?: string };
    return { status: response.status, id: payload.id ?? null, error: payload.error ?? null };
  };

  /**
   * Two identical publishes that reach the check in the same tick. Each body
   * is held back until BOTH handlers are waiting on it, then released
   * together — so the two requests run the rest of the route in lockstep,
   * which is the only arrangement where a check-then-insert with an await in
   * between lets both through. Without the gate the sessions' crypto spaces
   * the requests out and a naive version passes by luck.
   */
  const publishTwiceAtOnce = async (cookie: string, body: Record<string, unknown>) => {
    const held = [0, 1].map(() => {
      let open!: () => void;
      let reading!: () => void;
      const gate = new Promise<void>((resolve) => (open = resolve));
      const waiting = new Promise<void>((resolve) => (reading = resolve));
      const stream = new ReadableStream<Uint8Array>(
        {
          async pull(controller) {
            reading();
            await gate;
            controller.enqueue(new TextEncoder().encode(JSON.stringify(body)));
            controller.close();
          },
        },
        // Nothing is pulled until somebody reads — i.e. until request.json().
        { highWaterMark: 0 },
      );
      const request = new Request("http://localhost:3000/api/community/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: stream,
        duplex: "half",
      } as RequestInit & { duplex: "half" });
      return { request, open, waiting };
    });
    const responses = held.map(({ request }) => route.POST(request));
    await Promise.all(held.map(({ waiting }) => waiting));
    for (const { open } of held) open();
    return Promise.all(
      responses.map(async (pending) => {
        const response = await pending;
        const payload = (await response.json()) as { id?: string };
        return { status: response.status, id: payload.id ?? null };
      }),
    );
  };

  const rows = async (title: string) =>
    db.select().from(schema.patterns).where(eq(schema.patterns.title, title));

  const tower = {
    title: "Pentagrid Tower",
    description: "The one that was posted twice.",
    code: CODE,
    codeCpp: "#pragma once // the port",
    license: "CC-BY-SA-4.0",
    madeHow: "hand",
    visibility: "public",
  };

  console.log("\n── a double-click ──");
  // Both requests in flight at once, like the two clicks of #455.
  const [first, second] = await publishTwiceAtOnce(ada, tower);
  check("both are answered as a success", [first.status, second.status].sort(), [200, 201]);
  check("with the same post", first.id !== null && first.id === second.id, true);
  const made = await rows("Pentagrid Tower");
  check("and only one row exists", made.length, 1);
  check("which is the post both were told about", made[0]?.id, first.id);

  console.log("\n── a retry a moment later ──");
  const retry = await publish(ada, tower);
  check("is answered with the post already made", [retry.status, retry.id], [200, first.id]);
  check("still one row", (await rows("Pentagrid Tower")).length, 1);

  console.log("\n── anything different is a new post ──");
  const edited = await publish(ada, { ...tower, description: "Now with a different note." });
  check("a changed description posts", edited.status, 201);
  check("as its own row", edited.id !== first.id, true);
  check("two rows now", (await rows("Pentagrid Tower")).length, 2);

  // Somebody else's identical upload is theirs, not a repeat of Ada's.
  const other = await publish(bea, tower);
  check("another account's identical upload posts", other.status, 201);
  check("three rows now", (await rows("Pentagrid Tower")).length, 3);

  console.log("\n── only inside the window ──");
  // Age every copy of the first post past the window — the same submission
  // again is then a deliberate second post, and gets through.
  await db
    .update(schema.patterns)
    .set({ createdAt: new Date(Date.now() - 5 * 60_000) })
    .where(eq(schema.patterns.id, first.id!));
  const later = await publish(ada, tower);
  check("the same submission minutes later posts", later.status, 201);
  check("as a new row", later.id !== first.id, true);

  console.log("\n── a fork, double-clicked ──");
  const forkBody = { ...tower, title: "Tower, Remixed", parentId: first.id };
  const [forkA, forkB] = await publishTwiceAtOnce(cyd, forkBody);
  check("one fork", (await rows("Tower, Remixed")).length, 1);
  check("both clicks land on it", forkA.id === forkB.id, true);
  const forkAlerts = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.type, "fork"));
  // The repeat answers with the post and does nothing else — the fork was
  // announced when it was made.
  check("and the parent's author hears about it once", forkAlerts.length, 1);
}

main()
  .then(() => {
    console.log(failures === 0 ? "\nAll publish checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });
