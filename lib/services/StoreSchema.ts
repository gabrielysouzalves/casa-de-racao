import { z } from 'zod';

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

export const schema = z.discriminatedUnion("action", [
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


export type StoreAction = z.infer<typeof schema>;
