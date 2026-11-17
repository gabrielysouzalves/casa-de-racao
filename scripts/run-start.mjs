
import { fileURLToPath } from "node:url";
import { readExecutionProfile } from "./execution-profile.mjs";

const managedLinux = readExecutionProfile() === "managed-linux";
const args = process.argv.slice(2);

// Carrega o .env e prepara o diretório do projeto.
await import("./sites-env.mjs");

const cli = new URL(
  managedLinux
    ? "../node_modules/wrangler/bin/wrangler.js"
    : "../node_modules/vinext/dist/cli.js",
  import.meta.url,
);

process.argv = [
  process.execPath,
  fileURLToPath(cli),
  ...(managedLinux
    ? [
        "dev",
        "--config", "dist/server/wrangler.json",
        "--local",
        "--persist-to", ".wrangler/state",
        "--ip", "127.0.0.1",
        "--inspector-port", "0",
      ]
    : ["start"]),
  ...args,
];

await import(cli.href);
