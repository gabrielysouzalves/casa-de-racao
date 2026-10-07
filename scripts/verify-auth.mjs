import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createInterface} from 'node:readline';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const base=process.argv[2];assert.ok(base?.startsWith('http://127.0.0.1:'),'Teste apenas no servidor local');
console.log('Pronto para teste de acessos (credenciais via stdin).');
if(process.stdin.isTTY){process.stdin.setRawMode(true);process.stdin.on('data',chunk=>{if(chunk.includes(3))process.exit(130);});}
const rl=createInterface({input:process.stdin,terminal:false});const input=await new Promise(resolve=>rl.once('line',line=>{rl.close();if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();resolve(JSON.parse(line));}));
const initialPassword=input.password;
const adminPassword='AdminTeste-'+randomBytes(12).toString('hex');
const tempPassword='Temporaria-'+randomBytes(12).toString('hex');
const operatorPassword='Funcionario-'+randomBytes(12).toString('hex');
const resetPassword='Redefinida-'+randomBytes(12).toString('hex');
const finalPassword='FinalTeste-'+randomBytes(12).toString('hex');
async function call(path,body,cookie='',origin=base){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Connection:'close',Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const responseText=await r.text();let data;try{data=JSON.parse(responseText);}catch{throw new Error(`Resposta inválida em ${path} (${r.status}): ${responseText.slice(0,100)}`);}return {status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};}
assert.equal((await call('/api/data')).status,401);
assert.equal((await call('/api/users')).status,401);
assert.equal((await call('/api/data',{action:'product',name:'sem acesso',barcode:'',price:100,minimum:0})).status,401);
assert.equal((await call('/api/auth',{action:'login',username:'admin',password:initialPassword},'','https://outro-site.test')).status,403);
assert.equal((await call('/api/auth',{action:'login',username:'admin',password:'SenhaIncorretaTeste'})).status,401);
const first=await call('/api/auth',{action:'login',username:'admin',password:initialPassword});assert.equal(first.status,200);assert.equal(first.data.user.mustChange,true);assert.match(first.headers.get('set-cookie'),/HttpOnly/);assert.match(first.headers.get('set-cookie'),/SameSite=Lax/);
assert.equal((await call('/api/data',null,first.cookie)).status,403);
assert.equal((await call('/api/auth',{action:'password',currentPassword:initialPassword,newPassword:'curta'},first.cookie)).status,400);
const changed=await call('/api/auth',{action:'password',currentPassword:initialPassword,newPassword:adminPassword},first.cookie);assert.equal(changed.status,200);assert.equal(changed.data.user.mustChange,false);const adminCookie=changed.cookie;
assert.equal((await call('/api/data',null,first.cookie)).status,401);
const allowed=await call('/api/data',null,adminCookie);assert.equal(allowed.status,200);assert.match(allowed.headers.get('cache-control'),/no-store/);
const list=await call('/api/users',null,adminCookie);assert.equal(list.status,200);assert.equal(list.data.users.length,1,'O banco local de teste deve conter somente o administrador recém-criado.');assert.ok(!('password_hash' in list.data.users[0]));
const created=await call('/api/users',{action:'create',name:'Funcionário de verificação local',username:'teste-operador',password:tempPassword,role:'operator'},adminCookie);assert.equal(created.status,200);
assert.equal((await call('/api/users',{action:'create',name:'Duplicado',username:'teste-operador',password:tempPassword,role:'operator'},adminCookie)).status,400);
const accounts=await call('/api/users',null,adminCookie);const operator=accounts.data.users.find(u=>u.username==='teste-operador');
assert.equal((await call('/api/users',{action:'active',id:changed.data.user.id,active:false},adminCookie)).status,400);
const opFirst=await call('/api/auth',{action:'login',username:'teste-operador',password:tempPassword});assert.equal(opFirst.status,200);assert.equal((await call('/api/data',null,opFirst.cookie)).status,403);
const opChange=await call('/api/auth',{action:'password',currentPassword:tempPassword,newPassword:operatorPassword},opFirst.cookie);assert.equal(opChange.status,200);const opCookie=opChange.cookie;
assert.equal((await call('/api/data',null,opCookie)).status,200);
assert.equal((await call('/api/users',null,opCookie)).status,403);
assert.equal((await call('/api/users',{action:'create',name:'Indevido',username:'nao-permitido',password:tempPassword,role:'admin'},opCookie)).status,403);
execFileSync(process.execPath,['scripts/verify-api.mjs',base],{stdio:'inherit',env:{...process.env,TEST_COOKIE:opCookie}});
const reset=await call('/api/users',{action:'reset',id:operator.id,password:resetPassword},adminCookie);assert.equal(reset.status,200);assert.equal((await call('/api/data',null,opCookie)).status,401);
const resetLogin=await call('/api/auth',{action:'login',username:'teste-operador',password:resetPassword});assert.equal(resetLogin.status,200);assert.equal(resetLogin.data.user.mustChange,true);
const opFinal=await call('/api/auth',{action:'password',currentPassword:resetPassword,newPassword:finalPassword},resetLogin.cookie);assert.equal(opFinal.status,200);
assert.equal((await call('/api/users',{action:'active',id:operator.id,active:false},adminCookie)).status,200);assert.equal((await call('/api/data',null,opFinal.cookie)).status,401);
assert.equal((await call('/api/auth',{action:'login',username:'teste-operador',password:finalPassword})).status,401);
assert.equal((await call('/api/users',{action:'active',id:operator.id,active:true},adminCookie)).status,200);
const reLogin=await call('/api/auth',{action:'login',username:'teste-operador',password:finalPassword});assert.equal(reLogin.status,200);
assert.equal((await call('/api/auth',{action:'logout'},reLogin.cookie)).status,200);assert.equal((await call('/api/data',null,reLogin.cookie)).status,401);
for(let i=0;i<10;i++)assert.equal((await call('/api/auth',{action:'login',username:'teste-invalido',password:'SenhaTesteInvalida'})).status,401);
assert.equal((await call('/api/auth',{action:'login',username:'teste-invalido',password:'SenhaTesteInvalida'})).status,429);
fs.writeFileSync('.sites-runtime/cleanup-auth-test.sql',`DELETE FROM sessions WHERE user_id IN ('${changed.data.user.id}','${operator.id}');\nDELETE FROM users WHERE id IN ('${changed.data.user.id}','${operator.id}');\nDELETE FROM login_limits;\n`);
console.log('OK AUTH: anonimato bloqueado, CSRF, login, troca obrigatória, sessões revogadas, permissões, cadastro, bloqueio, redefinição, logout e limite de tentativas.');




