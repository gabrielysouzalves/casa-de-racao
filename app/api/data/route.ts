
import type { RowDataPacket } from "mysql2";
import { requireUser, ensureOrigin, AuthError, authFailure, privateJson } from "@/lib/auth";
import { database } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const text = z.string().trim().min(1).max(180);

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return !isNaN(+d) && d.toISOString().slice(0, 10) === v;
  });

const qty = z.number().int().positive().max(1000000);
const money = z.number().int().min(0).max(1000000000);

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("product"),
    id: z.string().optional(),
    name: text,
    barcode: z.string().trim().max(80),
    price: money,
    minimum: z.number().int().min(0).max(1000000),
  }),

  z.object({
    action: z.literal("movement"),
    productId: text,
    kind: z.enum(["in", "out"]),
    quantity: qty,
    date,
    note: z.string().max(180),
  }),

  z.object({
    action: z.literal("sale"),
    date,
    items: z
      .array(z.object({ productId: text, quantity: qty }))
      .min(1)
      .max(100),
  }),

  z.object({
    action: z.literal("bill"),
    kind: z.enum(["payment", "expense"]),
    name: text,
    company: z.string().trim().max(180),
    mei: z.string().trim().max(180),
    date,
    amount: money.refine((v) => v > 0),
    paid: z.boolean(),
  }),

  z.object({
    action: z.literal("paid"),
    id: text,
    paid: z.boolean(),
  }),
]);

interface ProductRow extends RowDataPacket {
  name: string;
  price: number;
}

export async function GET(request: Request) {
  try {
    await requireUser(request);

    const db = database();

    const [products, movements, bills] = await Promise.all([
      db.execute(
        `SELECT
          produto_cod AS id,
          nome AS name,
          codigo_barras AS barcode,
          preco AS price,
          quantidade AS quantity,
          estoque_minimo AS minimum
         FROM produtos
         ORDER BY nome`
      ),

      db.execute(
        `SELECT
          movimentacao_cod AS id,
          produto_cod AS product_id,
          nome_produto AS name,
          tipo AS kind,
          quantidade AS quantity,
          preco AS price,
          data AS date,
          venda_cod AS sale_id,
          observacao AS note
         FROM movimentacoes
         ORDER BY data DESC, movimentacao_cod DESC`
      ),

      db.execute(
        `SELECT
          conta_cod AS id,
          tipo AS kind,
          nome AS name,
          empresa AS company,
          mei,
          data AS date,
          valor AS amount,
          pago AS paid
         FROM contas_pagar
         ORDER BY data, conta_cod`
      ),
    ]);

    return privateJson({
      products: products[0],
      movements: movements[0],
      bills: bills[0],
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return authFailure(e, request);
    }

    console.error(e);

    return privateJson(
      { error: "Não foi possível carregar os dados. Tente novamente." },
      503
    );
  }
}

export async function POST(request: Request) {
  try {
    ensureOrigin(request);
    await requireUser(request);

    const v = schema.parse(await request.json());
    const db = database();
    const id = crypto.randomUUID();

    if (v.action === "product") {
      if (v.id) {
        await db.execute(
          `UPDATE produtos
           SET nome = ?, codigo_barras = ?, preco = ?, estoque_minimo = ?
           WHERE produto_cod = ?`,
          [v.name, v.barcode || null, v.price, v.minimum, v.id]
        );
      } else {
        await db.execute(
          `INSERT INTO produtos
            (produto_cod, nome, codigo_barras, preco, estoque_minimo)
           VALUES (?, ?, ?, ?, ?)`,
          [id, v.name, v.barcode || null, v.price, v.minimum]
        );
      }
    } else if (v.action === "sale" || v.action === "movement") {

      const items =
        v.action === "sale"
          ? v.items
          : [{ productId: v.productId, quantity: v.quantity }];

      const combined = new Map<string, number>();

      for (const item of items) {
        combined.set(
          item.productId,
          (combined.get(item.productId) || 0) + item.quantity
        );
      }

      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        for (const [productId, quantity] of combined) {
          const [products] = await connection.execute<ProductRow[]>(
            `SELECT nome AS name, preco AS price
             FROM produtos
             WHERE produto_cod = ?
             FOR UPDATE`,
            [productId]
          );

          const product = products[0];

          if (!product) {
            throw new Error("Produto não encontrado.");
          }

          const kind =
            v.action === "sale" ? "sale" : v.kind;

          const signedQuantity =
            kind === "in" ? quantity : -quantity;

          await connection.execute(
            `INSERT INTO movimentacoes
              (movimentacao_cod, produto_cod, nome_produto, tipo,
               quantidade, preco, data, venda_cod, observacao)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              crypto.randomUUID(),
              productId,
              product.name,
              kind,
              signedQuantity,
              product.price,
              v.date,
              v.action === "sale" ? id : null,
              v.action === "movement" ? v.note : "",
            ]
          );
        }

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } else if (v.action === "bill") {
      if (v.kind === "expense" && (!v.company || !v.mei)) {
        throw new Error("Preencha a razão social e o MEI.");
      }

      await db.execute(
        `INSERT INTO contas_pagar
          (conta_cod, tipo, nome, empresa, mei, data, valor, pago)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          v.kind,
          v.name,
          v.company,
          v.mei,
          v.date,
          v.amount,
          Number(v.paid),
        ]
      );
    } else {
      await db.execute(
        "UPDATE contas_pagar SET pago = ? WHERE conta_cod = ?",
        [Number(v.paid), v.id]
      );
    }

    return privateJson({ ok: true, id });
  } catch (e) {
    if (e instanceof AuthError) {
      return authFailure(e, request);
    }

    if (e instanceof z.ZodError) {
      return privateJson(
        { error: "Confira os campos informados." },
        400
      );
    }

    const code =
      typeof e === "object" && e !== null && "code" in e
        ? String(e.code)
        : "";

    const errno =
      typeof e === "object" && e !== null && "errno" in e
        ? Number(e.errno)
        : 0;

    if (code === "ER_DUP_ENTRY") {
      return privateJson(
        { error: "Este código de barras já está cadastrado." },
        400
      );
    }

    if (errno === 3819) {
      return privateJson(
        { error: "Estoque insuficiente. A operação não foi registrada." },
        400
      );
    }

    const message = e instanceof Error ? e.message : String(e);

    if (message.includes("Preencha")) {
      return privateJson(
        { error: "Preencha a razão social e o MEI." },
        400
      );
    }

    if (message.includes("Produto não encontrado")) {
      return privateJson(
        { error: "Produto não encontrado." },
        400
      );
    }

    console.error("Erro ao salvar dados:", e);

    return privateJson(
      { error: "Não foi possível salvar. Confira os dados e tente novamente." },
      400
    );
  }
}
