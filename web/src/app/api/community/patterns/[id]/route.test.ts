import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";

// MIT and CC0 left the licence picker, and a pattern published under one keeps
// it. The edit route said it would refuse a change TO one of them, then looked
// the new value up in the list that still holds both, so a direct PATCH moved
// a CC BY-SA original to CC0 and rewrote the SPDX line in its source. Driven
// through the real route with real sessions, on a database of its own.

const ENV_KEYS = ["COMMUNITY_DB_PATH", "COMMUNITY_ENABLED", "BETTER_AUTH_SECRET"] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
let tmp = "";

/** Signs somebody up and returns their user id and Cookie header. */
let enrol: (username: string) => Promise<{ id: string; cookie: string }>;
/** Puts a pattern straight into the table, as a past publish left it. */
let seed: (row: { id: string; userId: string; license: string; parentId?: string }) => Promise<void>;
let edit: (
  cookie: string,
  patternId: string,
  body: Record<string, unknown>,
) => Promise<{ status: number; error?: string }>;
/** The licence column and the SPDX line baked into the stored source. */
let stored: (patternId: string) => Promise<{ license: string; spdx: string | undefined }>;

beforeAll(async () => {
  // The database is a lazy singleton keyed off these variables, so they are
  // set before anything imports it.
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pf-pattern-licence-"));
  process.env.COMMUNITY_DB_PATH = path.join(tmp, "test.db");
  process.env.COMMUNITY_ENABLED = "1";
  process.env.BETTER_AUTH_SECRET = "pattern-licence-test-secret-not-a-real-one";

  const { eq } = await import("drizzle-orm");
  const { getAuth } = await import("@/lib/community/server/auth");
  const { getDb } = await import("@/lib/community/server/db");
  const schema = await import("@/lib/community/server/schema");
  const patternRoute = await import("./route");

  const db = getDb();
  const auth = getAuth();

  enrol = async (username) => {
    const response = await auth.api.signUpEmail({
      body: {
        email: `${username}@patternflow.local`,
        password: "pattern-licence-test-password",
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
    return { id: author!.id, cookie: setCookie.split(";")[0] };
  };

  seed = async ({ id, userId, license, parentId }) => {
    const now = new Date();
    await db.insert(schema.patterns).values({
      id,
      userId,
      title: id,
      code: "function draw() {}",
      license,
      parentId: parentId ?? null,
      visibility: "public",
      createdAt: now,
      updatedAt: now,
    });
  };

  // No Origin header below, which is the same-origin case originBlocked()
  // lets through.
  edit = async (cookie, patternId, body) => {
    const response = await patternRoute.PATCH(
      new Request(`http://localhost:3000/api/community/patterns/${patternId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: patternId }) },
    );
    const payload = (await response.json()) as { error?: string };
    return { status: response.status, error: payload.error };
  };

  stored = async (patternId) => {
    const [row] = await db
      .select({ license: schema.patterns.license, code: schema.patterns.code })
      .from(schema.patterns)
      .where(eq(schema.patterns.id, patternId))
      .limit(1);
    return {
      license: row!.license,
      spdx: /SPDX-License-Identifier: (\S+)/.exec(row!.code)?.[1],
    };
  };
}, 30_000);

afterAll(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

it("refuses to move an original pattern to MIT or CC0", async () => {
  const ada = await enrol("ada");
  await seed({ id: "p-ada", userId: ada.id, license: "CC-BY-SA-4.0" });
  // One edit first, so the source carries a baked header to compare against.
  expect((await edit(ada.cookie, "p-ada", { title: "Tide" })).status).toBe(200);

  for (const license of ["CC0-1.0", "MIT"]) {
    const refused = await edit(ada.cookie, "p-ada", { license });
    expect(refused.status).toBe(400);
    expect(refused.error).toBe(
      `${license} is retired. A pattern published under it keeps it, but no pattern can change to it.`,
    );
  }
  expect(await stored("p-ada")).toEqual({ license: "CC-BY-SA-4.0", spdx: "CC-BY-SA-4.0" });
}, 30_000);

it("still moves an original between the two licences the picker offers", async () => {
  const bea = await enrol("bea");
  await seed({ id: "p-bea", userId: bea.id, license: "CC-BY-SA-4.0" });

  expect((await edit(bea.cookie, "p-bea", { license: "CC-BY-4.0" })).status).toBe(200);
  expect(await stored("p-bea")).toEqual({ license: "CC-BY-4.0", spdx: "CC-BY-4.0" });
  expect((await edit(bea.cookie, "p-bea", { license: "CC-BY-SA-4.0" })).status).toBe(200);
  expect(await stored("p-bea")).toEqual({ license: "CC-BY-SA-4.0", spdx: "CC-BY-SA-4.0" });
}, 30_000);

it("lets a pattern published under a retired licence keep it, or leave it for an offered one", async () => {
  const cal = await enrol("cal");
  await seed({ id: "p-cal", userId: cal.id, license: "MIT" });

  // The edit modal sends the current licence back with every save.
  expect((await edit(cal.cookie, "p-cal", { title: "Typo fixed", license: "MIT" })).status).toBe(200);
  expect(await stored("p-cal")).toEqual({ license: "MIT", spdx: "MIT" });

  // Retired to retired is still a change to a retired licence.
  expect((await edit(cal.cookie, "p-cal", { license: "CC0-1.0" })).status).toBe(400);
  expect(await stored("p-cal")).toEqual({ license: "MIT", spdx: "MIT" });

  expect((await edit(cal.cookie, "p-cal", { license: "CC-BY-SA-4.0" })).status).toBe(200);
  expect(await stored("p-cal")).toEqual({ license: "CC-BY-SA-4.0", spdx: "CC-BY-SA-4.0" });
}, 30_000);

it("refuses CC0 on a fork whose parent puts no limit on it", async () => {
  // An MIT parent lets a fork take any licence (forkLicenseAllowed), so the
  // fork check alone let this one through.
  const dee = await enrol("dee");
  const eli = await enrol("eli");
  await seed({ id: "p-dee", userId: dee.id, license: "MIT" });
  await seed({ id: "p-eli", userId: eli.id, license: "CC-BY-4.0", parentId: "p-dee" });

  expect((await edit(eli.cookie, "p-eli", { license: "CC0-1.0" })).status).toBe(400);
  expect((await edit(eli.cookie, "p-eli", { license: "CC-BY-SA-4.0" })).status).toBe(200);
  expect((await stored("p-eli")).license).toBe("CC-BY-SA-4.0");
}, 30_000);

it("refuses a licence it has never offered", async () => {
  const fay = await enrol("fay");
  await seed({ id: "p-fay", userId: fay.id, license: "CC-BY-SA-4.0" });

  expect(await edit(fay.cookie, "p-fay", { license: "GPL-3.0-only" })).toEqual({
    status: 400,
    error: "Unknown licence.",
  });
}, 30_000);
