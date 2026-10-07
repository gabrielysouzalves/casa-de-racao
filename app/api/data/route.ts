import { database } from '@/lib/db';
import { z } from 'zod';
const text=z.string().trim().min(1).max(180), date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T12:00:00Z');return !isNaN(+d)&&d.toISOString().slice(0,10)===v;}), qty=z.number().int().positive().max(1000000), money=z.number().int().min(0).max(1000000000);
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('product'),id:z.string().optional(),name:text,barcode:z.string().trim().max(80),price:money,minimum:z.number().int().min(0).max(1000000)}),
 z.object({action:z.literal('movement'),productId:text,kind:z.enum(['in','out']),quantity:qty,date,note:z.string().max(180)}),
 z.object({action:z.literal('sale'),date,items:z.array(z.object({productId:text,quantity:qty})).min(1).max(100)}),
 z.object({action:z.literal('bill'),kind:z.enum(['payment','expense']),name:text,company:z.string().trim().max(180),mei:z.string().trim().max(180),date,amount:money.refine(v=>v>0),paid:z.boolean()}),
 z.object({action:z.literal('paid'),id:text,paid:z.boolean()})]);
export async function GET(){try{const db=database();const [p,m,b]=await Promise.all([db.prepare('SELECT * FROM products ORDER BY name').all(),db.prepare('SELECT * FROM movements ORDER BY date DESC,rowid DESC').all(),db.prepare('SELECT * FROM bills ORDER BY date,rowid').all()]);return Response.json({products:p.results,movements:m.results,bills:b.results});}catch(e){console.error(e);return Response.json({error:'Não foi possível carregar os dados. Tente novamente.'},{status:503});}}
export async function POST(request:Request){try{
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Origem inválida'},{status:403});
 const v=schema.parse(await request.json()),db=database(),id=crypto.randomUUID();
 if(v.action==='product'){if(v.id)await db.prepare('UPDATE products SET name=?,barcode=?,price=?,minimum=? WHERE id=?').bind(v.name,v.barcode||null,v.price,v.minimum,v.id).run();else await db.prepare('INSERT INTO products(id,name,barcode,price,minimum) VALUES(?,?,?,?,?)').bind(id,v.name,v.barcode||null,v.price,v.minimum).run();}
 else if(v.action==='sale'||v.action==='movement'){
 const items=v.action==='sale'?v.items:[{productId:v.productId,quantity:v.quantity}],combined=new Map<string,number>();for(const i of items)combined.set(i.productId,(combined.get(i.productId)||0)+i.quantity);const statements=[];
 for(const [pid,q] of combined){const p=await db.prepare('SELECT name,price FROM products WHERE id=?').bind(pid).first<{name:string,price:number}>();if(!p)throw new Error('Produto não encontrado');const kind=v.action==='sale'?'sale':v.kind;statements.push(db.prepare('INSERT INTO movements(id,product_id,name,kind,quantity,price,date,sale_id,note) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),pid,p.name,kind,kind==='in'?q:-q,p.price,v.date,v.action==='sale'?id:null,v.action==='movement'?v.note:''));}await db.batch(statements);
 }else if(v.action==='bill'){if(v.kind==='expense'&&(!v.company||!v.mei))throw new Error('Preencha a razão social e o MEI');await db.prepare('INSERT INTO bills(id,kind,name,company,mei,date,amount,paid) VALUES(?,?,?,?,?,?,?,?)').bind(id,v.kind,v.name,v.company,v.mei,v.date,v.amount,Number(v.paid)).run();}
 else await db.prepare('UPDATE bills SET paid=? WHERE id=?').bind(Number(v.paid),v.id).run();return Response.json({ok:true,id});
 }catch(e){console.error(e);const s=String(e),error=e instanceof z.ZodError?'Confira os campos informados.':s.includes('stock_nonnegative')?'Estoque insuficiente. A operação não foi registrada.':s.includes('UNIQUE')?'Este código de barras já está cadastrado.':s.includes('Preencha')?'Preencha a razão social e o MEI.':'Não foi possível salvar. Confira os dados e tente novamente.';return Response.json({error},{status:400});}}
