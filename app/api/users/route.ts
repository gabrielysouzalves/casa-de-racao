export const dynamic='force-dynamic';
import { z } from 'zod';
import { database } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { authEnv,requireUser,ensureOrigin,privateJson,AuthError,authFailure } from '@/lib/auth';
const password=z.string().min(12,'Use uma senha de pelo menos 12 caracteres.').max(128);
const schema=z.discriminatedUnion('action',[z.object({action:z.literal('create'),name:z.string().trim().min(1).max(180),username:z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,63}$/),password,role:z.enum(['admin','operator'])}),z.object({action:z.literal('active'),id:z.string().min(1),active:z.boolean()}),z.object({action:z.literal('reset'),id:z.string().min(1),password})]);
export async function GET(request:Request){try{await requireUser(request,true);const users=await database().prepare('SELECT id,name,username,role,active,must_change FROM users ORDER BY name').all();return privateJson({users:users.results});}catch(e){return authFailure(e,request);}}
export async function POST(request:Request){try{ensureOrigin(request);const admin=await requireUser(request,true),v=schema.parse(await request.json()),db=database();
 if(v.action==='create'){const pepper=authEnv().AUTH_PEPPER;if(!pepper)throw new AuthError('Acesso não configurado',503);await db.prepare('INSERT INTO users(id,name,username,password_hash,role,active,must_change) VALUES(?,?,?,?,?,1,1)').bind(crypto.randomUUID(),v.name,v.username,await hashPassword(v.password,pepper),v.role).run();}
 else{if(v.id===admin.id)throw new AuthError('Use Trocar senha para sua conta. Você não pode bloquear seu próprio acesso.',400);const target=await db.prepare('SELECT id FROM users WHERE id=?').bind(v.id).first();if(!target)throw new AuthError('Usuário não encontrado.',404);
 if(v.action==='reset'){const pepper=authEnv().AUTH_PEPPER;if(!pepper)throw new AuthError('Acesso não configurado',503);await db.batch([db.prepare('UPDATE users SET password_hash=?,must_change=1 WHERE id=?').bind(await hashPassword(v.password,pepper),v.id),db.prepare('DELETE FROM sessions WHERE user_id=?').bind(v.id)]);}
 else{const r=await db.prepare("UPDATE users SET active=? WHERE id=? AND (?=1 OR role!='admin' OR (SELECT COUNT(*) FROM users WHERE role='admin' AND active=1)>1)").bind(Number(v.active),v.id,Number(v.active)).run();if(!r.meta.changes)throw new AuthError('Mantenha pelo menos um administrador ativo.',400);await db.prepare('DELETE FROM sessions WHERE user_id=?').bind(v.id).run();}}
 return privateJson({ok:true});
 }catch(e){if(e instanceof z.ZodError)return privateJson({error:e.issues[0]?.message||'Confira os campos.'},400);if(String(e).includes('UNIQUE'))return privateJson({error:'Este usuário já está cadastrado.'},400);return authFailure(e,request);}}

