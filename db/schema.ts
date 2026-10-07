// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, check, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const products = sqliteTable('products', {id:text('id').primaryKey(),name:text('name').notNull(),barcode:text('barcode'),price:integer('price').notNull(),quantity:integer('quantity').notNull().default(0),minimum:integer('minimum').notNull().default(5)},t=>[uniqueIndex('products_barcode').on(t.barcode),check('stock_nonnegative',sql`${t.quantity} >= 0`),check('price_nonnegative',sql`${t.price} >= 0`)]);
export const movements = sqliteTable('movements',{id:text('id').primaryKey(),productId:text('product_id').notNull().references(()=>products.id),name:text('name').notNull(),kind:text('kind').notNull(),quantity:integer('quantity').notNull(),price:integer('price').notNull(),date:text('date').notNull(),saleId:text('sale_id'),note:text('note').notNull().default('')});
export const bills = sqliteTable('bills',{id:text('id').primaryKey(),kind:text('kind').notNull(),name:text('name').notNull(),company:text('company').notNull().default(''),mei:text('mei').notNull().default(''),date:text('date').notNull(),amount:integer('amount').notNull(),paid:integer('paid').notNull().default(0)});
