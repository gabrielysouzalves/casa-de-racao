export const dynamic='force-dynamic';
import { z } from 'zod';
import { database } from '@/lib/db';
import { hashPassword,verifyPassword,digest } from '@/lib/password';
import { authEnv,publicUser,currentUser,sessionToken,cookie,createSession,ensureOrigin,privateJson,AuthError,authFailure,type UserRow } from '@/lib/auth';
const username=z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,63}$/);
const password=z.string().min(12,'A senha precisa ter pelo menos 12 caracteres.').max(128);
const schema=z.discriminatedUnion('action',[z.object({action:z.literal('login'),username,password:z.string().min(1).max(128)}),z.object({action:z.literal('logout')}),z.object({action:z.literal('password'),currentPassword:z.string().min(1).max(128),newPassword:password})]);
export async function GET(request:Request){try{const u=await currentUser(request);return privateJson({user:u?publicUser(u):null});}catch(e){return authFailure(e,request);}}
async function rateLimit(request:Request,name:string){const db=database(),now=Date.now(),expires=now+15*60*1000;const keys=[['ip:'+ (request.headers.get('cf-connecting-ip')||'unknown'),60],['user:'+name,10]] as const;
 for(const [key,max] of keys){const row=await db.prepare('INSERT INTO login_limits(key,attempts,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires<=? THEN 1 ELSE attempts+1 END, expires=CASE WHEN expires<=? THEN ? ELSE expires END RETURNING attempts').bind(await digest(key),expires,now,now,expires).first<{attempts:number}>();if(!row||row.attempts>max)throw new AuthError('Muitas tentativas. Aguarde 15 minutos e tente novamente.',429);}
 await db.prepare('DELETE FROM login_limits WHERE key IN (SELECT key FROM login_limits WHERE expires<? LIMIT 100)').bind(now).run();
}
export async function POST(request:Request){try{ensureOrigin(request);const v=schema.parse(await request.json()),db=database();
 if(v.action==='logout'){const token=sessionToken(request);if(token)await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();return privateJson({ok:true},200,{'Set-Cookie':cookie(request,'',0)});}
 const config=authEnv();if(!config.AUTH_PEPPER||!config.INITIAL_ADMIN_HASH)throw new AuthError('Acesso ainda não configurado. Contate o administrador.',503);
 if(v.action==='login'){
 await rateLimit(request,v.username);let user=await db.prepare('SELECT * FROM users WHERE username=?').bind(v.username).first<UserRow>();let valid=await verifyPassword(v.password,user?.password_hash||config.INITIAL_ADMIN_HASH,config.AUTH_PEPPER);
 if(!user&&v.username==='admin'&&valid){const count=await db.prepare('SELECT COUNT(*) AS n FROM users').first<{n:number}>();if(count?.n===0){await db.prepare("INSERT OR IGNORE INTO users(id,name,username,password_hash,role,active,must_change) VALUES(?,'Administrador','admin',?,'admin',1,1)").bind(crypto.randomUUID(),config.INITIAL_ADMIN_HASH).run();user=await db.prepare("SELECT * FROM users WHERE username='admin'").first<UserRow>();if(user&&user.password_hash!==config.INITIAL_ADMIN_HASH)valid=await verifyPassword(v.password,user.password_hash,config.AUTH_PEPPER);}}
 if(user&&valid&&user.password_hash!==config.INITIAL_ADMIN_HASH&&!user.active)valid=false;
 if(!user||!user.active||!valid)throw new AuthError('Usuário ou senha inválidos.',401);
 await db.prepare('DELETE FROM login_limits WHERE key=?').bind(await digest('user:'+v.username)).run();return privateJson({user:publicUser(user)},200,{'Set-Cookie':await createSession(user.id,request)});
 }
 const user=await currentUser(request);if(!user)throw new AuthError('Entre para continuar.',401);await rateLimit(request,'password:'+user.id);if(!await verifyPassword(v.currentPassword,user.password_hash,config.AUTH_PEPPER))throw new AuthError('A senha atual está incorreta.',400);if(v.currentPassword===v.newPassword)throw new AuthError('Escolha uma senha diferente da atual.',400);
 const hashed=await hashPassword(v.newPassword,config.AUTH_PEPPER);await db.batch([db.prepare('UPDATE users SET password_hash=?,must_change=0 WHERE id=?').bind(hashed,user.id),db.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id)]);return privateJson({user:publicUser({...user,must_change:0})},200,{'Set-Cookie':await createSession(user.id,request)});
 }catch(e){if(e instanceof z.ZodError)return privateJson({error:e.issues[0]?.message||'Confira os campos.'},400);return authFailure(e,request);}}

