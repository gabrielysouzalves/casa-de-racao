import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));

try {
  process.loadEnvFile(path.join(projectRoot, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

process.chdir(projectRoot);
