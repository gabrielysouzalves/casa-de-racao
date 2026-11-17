
import { createPool, type Pool } from "mysql2/promise";

let pool: Pool | null = null;

export function database(): Pool {
  if (pool) return pool;

  const {
    DB_HOST,
    DB_PORT,
    DB_USER,
    DB_PASSWORD,
    DB_NAME,
  } = process.env;

  if (!DB_HOST || !DB_PORT || !DB_USER ||
      DB_PASSWORD === undefined || !DB_NAME) {
    throw new Error(
      "Configurações do MySQL ausentes. Confira as variáveis do arquivo .env."
    );
  }

  const port = Number(DB_PORT);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Porta do MySQL inválida.");
  }

  pool = createPool({
    host: DB_HOST,
    port,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
    charset: "utf8mb4",
  });

  return pool;
}
