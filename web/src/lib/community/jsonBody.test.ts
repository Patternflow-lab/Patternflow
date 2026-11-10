// readJsonObject is the one place the community's write routes turn a body
// into fields. `null`, an array, a number and a string all parse as JSON, and
// none of them has fields to read. The routes themselves are driven with
// `null` in app/api/community/nullBody.test.ts.

import { describe, expect, it } from "vitest";
import { readJsonObject } from "./jsonBody";

const post = (body?: string) =>
  new Request("http://localhost:3000/api/community/patterns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

async function refusal(body?: string) {
  const result = await readJsonObject(post(body));
  if (!(result instanceof Response)) throw new Error(`${body} was read as an object`);
  return { status: result.status, payload: await result.json() };
}

describe("readJsonObject", () => {
  it("hands back an object's fields", async () => {
    expect(await readJsonObject(post('{"title":"Tide","knobs":[1,2]}'))).toEqual({
      title: "Tide",
      knobs: [1, 2],
    });
  });

  it("hands back an empty object, which the partial edits treat as nothing to change", async () => {
    expect(await readJsonObject(post("{}"))).toEqual({});
  });

  it.each(["null", "[]", '[{"title":"Tide"}]', "1", '"Tide"', "true"])(
    "answers %s with a 400 that says an object was expected",
    async (body) => {
      expect(await refusal(body)).toEqual({ status: 400, payload: { error: "Expected a JSON object." } });
    },
  );

  it.each([["no body", undefined], ["an empty body", ""], ["a cut-off object", '{"title":']])(
    "answers %s with a 400 that says the JSON is invalid",
    async (_label, body) => {
      expect(await refusal(body)).toEqual({ status: 400, payload: { error: "Invalid JSON body." } });
    },
  );
});
