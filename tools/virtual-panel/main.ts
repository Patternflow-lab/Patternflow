/**
 * `npm run virtual-panel` in web/ starts a virtual panel and keeps it up until
 * Ctrl-C. The flags are start()'s options:
 *
 *   --features mqtt,osc   features by directory name; none is the default build
 *   --pack origin         Origin alone, where the Basics pack is the default
 *   --port http=8080      a port by name, as often as needed; *=0 binds each one free
 *   --clock manual        time moves only on /vp/advance?ms=
 */
import { start, type Options } from "./panel";

const ports: Record<string, number> = {};
const options: Options = { ports };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  const [flag, value = ""] = [args[i], args[i + 1]];
  const [name, port] = value.split("=");
  if (flag === "--features") options.features = value.split(",").filter(Boolean);
  else if (flag === "--pack" && (value === "origin" || value === "basics")) options.pack = value;
  else if (flag === "--clock" && (value === "real" || value === "manual")) options.clock = value;
  else if (flag === "--port" && /^[\w*]+=\d+$/.test(value)) ports[name] = Number(port);
  else {
    console.error(`virtual-panel: it takes no ${flag} ${value}`);
    process.exit(2);
  }
}

start(options).then(
  (panel) => {
    for (const [name, port] of Object.entries(panel.ports)) console.log(`${name.padEnd(8)} ${port}`);
    process.once("SIGINT", () => void panel.close());
  },
  (e: NodeJS.ErrnoException) => {
    console.error(`virtual-panel: ${e.message}`);
    if (e.code === "EACCES") console.error("Ports below 1024 need root on Linux. Move it: --port http=8080");
    process.exitCode = 1;
  },
);
