import type { RowDataPacket } from 'mysql2';
import { database } from '@/lib/db';
import type { StoreAction } from './StoreSchema';

interface ProductRow extends RowDataPacket {
  name: string;
  price: number;
}

export class StoreService {
  async load() {
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
  
      return {
        products: products[0],
        movements: movements[0],
        bills: bills[0],
      };  }

  async save(v: StoreAction) {
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
  
      return { ok: true, id };
    }
}

export const storeService = new StoreService();
