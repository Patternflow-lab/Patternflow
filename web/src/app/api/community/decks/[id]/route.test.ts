import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";

// Sharing a deck and editing it used to count against the same five a minute.
// The visibility select sends a PATCH on every change, so somebody who shared
// a deck and then flipped it public and back a couple of times was refused on
// the fifth edit. Driven through the real routes with real sessions, on a
// database of its own.

const ENV_KEYS = ["COMMUNITY_DB_PATH", "COMMUNITY_ENABLED", "BETTER_AUTH_SECRET"] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
let tmp = "";

/** Signs somebody up with one public pattern and returns their Cookie header. */
let enrol: (username: string) => Promise<string>;
/** Shares a private deck holding that person's pattern. */
let share: (cookie: string, username: string) => Promise<{ status: number; id?: string }>;
let edit: (cookie: string, deckId: string, body: Record<string, unknown>) => Promise<number>;

beforeAll(async () => {
  // The database is a lazy singleton keyed off these variables, so they are
  // set before anything imports it.
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pf-deck-rate-"));
  process.env.COMMUNITY_DB_PATH = path.join(tmp, "test.db");
  process.env.COMMUNITY_ENABLED = "1";
  process.env.BETTER_AUTH_SECRET = "deck-rate-test-secret-not-a-real-one";

  const { eq } = await import("drizzle-orm");
  const { getAuth } = await import("@/lib/community/server/auth");
  const { getDb } = await import("@/lib/community/server/db");
  const schema = await import("@/lib/community/server/schema");
  const createRoute = await import("../route");
  const deckRoute = await import("./route");

  const db = getDb();
  const auth = getAuth();

  enrol = async (username) => {
    const response = await auth.api.signUpEmail({
      body: {
        email: `${username}@patternflow.local`,
        password: "deck-rate-test-password",
        name: username,
        username,
      },
      asResponse: true,
    });
    const setCookie = response.headers.get("set-cookie");
    if (!setCookie) throw new Error(`no session cookie for ${username}`);
    const [author] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.username, username))
      .limit(1);
    const now = new Date();
    await db.insert(schema.patterns).values({
      id: `p-${username}`,
      userId: author!.id,
      title: `${username}'s pattern`,
      code: "// js",
      license: "CC-BY-SA-4.0",
      visibility: "public",
      createdAt: now,
      updatedAt: now,
    });
    return setCookie.split(";")[0];
  };

  // No Origin header below, which is the same-origin case originBlocked()
  // lets through. The session is the gate under test.
  share = async (cookie, username) => {
    const response = await createRoute.POST(
      new Request("http://localhost:3000/api/community/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({
          title: `${username}'s running order`,
          visibility: "private",
          patternIds: [`p-${username}`],
        }),
      }),
    );
    const payload = (await response.json()) as { id?: string };
    return { status: response.status, id: payload.id };
  };

  edit = async (cookie, deckId, body) => {
    const response = await deckRoute.PATCH(
      new Request(`http://localhost:3000/api/community/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: deckId }) },
    );
    return response.status;
  };
}, 30_000);

afterAll(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

it("lets the owner edit a deck twenty times in the minute they shared it", async () => {
  const ada = await enrol("ada");
  const shared = await share(ada, "ada");
  expect(shared.status).toBe(201);
  const deckId = shared.id!;

  const statuses: number[] = [];
  for (let n = 0; n < 20; n += 1) {
    statuses.push(await edit(ada, deckId, { visibility: n % 2 === 0 ? "public" : "private" }));
  }
  expect(statuses).toEqual(Array(20).fill(200));

  // Edits still have a ceiling, the same twenty a minute a pattern's have.
  expect(await edit(ada, deckId, { title: "One too many" })).toBe(429);
  // And they never ate into sharing: a new deck still goes through.
  expect((await share(ada, "ada")).status).toBe(201);
}, 30_000);

it("keeps sharing new decks at five a minute", async () => {
  const bea = await enrol("bea");
  const statuses: number[] = [];
  for (let n = 0; n < 6; n += 1) statuses.push((await share(bea, "bea")).status);
  expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
}, 30_000);
