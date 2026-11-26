import { fileURLToPath } from "node:url";

await import("./sites-env.mjs");

const cli = new URL("../node_modules/vinext/dist/cli.js", import.meta.url);
process.argv = [
  process.execPath,
  fileURLToPath(cli),
  "start",
  ...process.argv.slice(2),
];

await import(cli.href);
