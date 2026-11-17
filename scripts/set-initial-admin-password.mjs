
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

await import("./sites-env.mjs");
const { hashPassword } = await import("../lib/password.ts");

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

try {
  const password = await rl.question(
    "Digite a senha inicial (mínimo 6 caracteres): "
  );

  const confirmation = await rl.question(
    "Digite novamente para confirmar: "
  );

  if (password.length < 6) {
    throw new Error("A senha precisa ter pelo menos 6 caracteres.");
  }

  if (password !== confirmation) {
    throw new Error("As senhas não coincidem.");
  }

  if (!process.env.AUTH_PEPPER) {
    throw new Error("AUTH_PEPPER não está configurado.");
  }

  const hash = await hashPassword(password, process.env.AUTH_PEPPER);
  const envPath = new URL("../.env", import.meta.url);
  let content = readFileSync(envPath, "utf8");

  const backupPath = new URL(
    `../.env.backup-admin-${Date.now()}`,
    import.meta.url
  );

  copyFileSync(envPath, backupPath);

  if (/^INITIAL_ADMIN_HASH=.*$/m.test(content)) {
    content = content.replace(
      /^INITIAL_ADMIN_HASH=.*$/m,
      `INITIAL_ADMIN_HASH=${hash}`
    );
  } else {
    content = content.replace(/\s*$/, "") +
      `\nINITIAL_ADMIN_HASH=${hash}\n`;
  }

  writeFileSync(envPath, content);

  console.log("Hash da senha inicial configurado com sucesso no .env.");
  console.log("A senha não foi armazenada em texto puro.");
} catch (error) {
  console.error("Não foi possível configurar a senha:", error.message);
  process.exitCode = 1;
} finally {
  rl.close();
}
