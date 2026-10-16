/** `npm run virtual-panel` in web/: a virtual panel until Ctrl-C, its flags start()'s options (README.md). */
import { start, type Options } from "./panel";

const ports: Record<string, number> = {};
const options: Options = { ports };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  const [flag, value = ""] = [args[i], args[i + 1]];
  if (flag === "--features") options.features = value.split(",").filter(Boolean);
  else if (flag === "--pack" && (value === "origin" || value === "basics")) options.pack = value;
  else if (flag === "--clock" && (value === "real" || value === "manual")) options.clock = value;
  else if (flag === "--port" && /^[\w*]+=\d+$/.test(value)) ports[value.split("=")[0]] = Number(value.split("=")[1]);
  else throw new Error(`virtual-panel takes no ${flag} ${value}`);
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
