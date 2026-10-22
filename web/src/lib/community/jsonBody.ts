// The community's write routes all take a JSON object. `request.json()` only
// says the body parsed, and `null` parses: until 22 October 2026 a body of
// `null` got past the `catch` in 22 handlers and threw a TypeError on the
// first field read. Next.js answered with a 500 that had no JSON and no CORS
// headers, so a Pattern Lab on another origin could not read why.

/** The request's body as an object, or the 400 that says why it is not one. */
export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Expected a JSON object." }, { status: 400 });
  }
  return body as Record<string, unknown>;
}
