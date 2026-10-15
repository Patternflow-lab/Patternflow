/**
 * The panel's one HTTP server, on the rules docs/rest-api.md gives every
 * route: one request at a time (line 18), parameters from the query or a form
 * body and never from JSON (26), and no-store on every JSON reply and on
 * the plain-text 404 that anything nobody routed gets (21).
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

export type Request = { method: string; path: string; args: URLSearchParams; headers: http.IncomingHttpHeaders };
/** A body that is not a string or a Buffer goes out as JSON. */
export type Reply = { status?: number; headers?: Record<string, string>; body?: unknown };
export type Handler = (req: Request) => Reply | Promise<Reply>;
/** Adds a route; method "*" takes any method the path has no route of its own for. */
export type Routes = (method: string, path: string, handler: Handler) => void;

const NOT_FOUND: Reply = { status: 404, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" }, body: "Not found" };

async function read(req: http.IncomingMessage): Promise<string> {
  let body = "";
  for await (const part of req) body += part;
  return body;
}

export async function serve(port: number) {
  const table = new Map<string, Handler>();
  const routes: Routes = (method, path, handler) => {
    if (table.has(`${method} ${path}`)) throw new Error(`${method} ${path} is routed twice`);
    table.set(`${method} ${path}`, handler);
  };

  async function answer(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? "/", "http://panel");
    const body = await read(req);
    const args = new URLSearchParams(url.search);
    if (req.headers["content-type"]?.startsWith("application/x-www-form-urlencoded")) {
      for (const [k, v] of new URLSearchParams(body)) args.append(k, v);
    }
    const method = req.method ?? "GET";
    const handler = table.get(`${method} ${url.pathname}`) ?? table.get(`* ${url.pathname}`);
    let reply: Reply;
    try {
      reply = handler ? await handler({ method, path: url.pathname, args, headers: req.headers }) : NOT_FOUND;
    } catch (e) {
      reply = { status: 500, headers: { "Content-Type": "text/plain" }, body: String((e as Error).stack ?? e) };
    }
    const json = !(typeof reply.body === "string" || Buffer.isBuffer(reply.body) || reply.body === undefined);
    const headers = json ? { "Content-Type": "application/json", "Cache-Control": "no-store", ...reply.headers } : reply.headers;
    res.writeHead(reply.status ?? 200, headers);
    await new Promise<void>((done) => res.end(json ? JSON.stringify(reply.body) : reply.body, done));
  }

  // Each request waits for the one before it to be answered, as on the device.
  let queue = Promise.resolve();
  const server = http.createServer((req, res) => {
    queue = queue.then(() => answer(req, res)).catch(() => void res.destroy());
  });
  await new Promise<void>((done, fail) => server.once("error", fail).listen(port, () => done()));
  return {
    routes,
    port: (server.address() as AddressInfo).port,
    close: () => new Promise<void>((done) => (server.closeAllConnections(), server.close(() => done()))),
  };
}
