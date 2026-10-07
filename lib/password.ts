import { scryptAsync } from '@noble/hashes/scrypt.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
function equalBytes(a:Uint8Array,b:Uint8Array){if(a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;}
const settings={N:16384,r:8,p:5,dkLen:32,maxmem:24*1024*1024};
export class PasswordBusyError extends Error {}
let waiting=0,gate=Promise.resolve();
async function derive(input:Uint8Array,salt:Uint8Array){if(waiting>=5)throw new PasswordBusyError('Aguarde um instante e tente novamente.');waiting++;const previous=gate;let release!:()=>void;gate=new Promise<void>(r=>{release=r;});await previous;try{return await scryptAsync(input,salt,settings);}finally{waiting--;release();}}
async function peppered(password:string,pepper:string){if(pepper.length<32)throw new Error('Proteção de senha não configurada');const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(password)));}
export async function hashPassword(password:string,pepper:string){const salt=crypto.getRandomValues(new Uint8Array(16));const hash=await derive(await peppered(password,pepper),salt);return `scrypt$16384$8$5$${bytesToHex(salt)}$${bytesToHex(hash)}`;}
export async function verifyPassword(password:string,stored:string,pepper:string){const parts=stored.split('$');if(parts.length!==6||parts.slice(0,4).join('$')!=='scrypt$16384$8$5'||!/^[a-f0-9]{32}$/.test(parts[4])||!/^[a-f0-9]{64}$/.test(parts[5]))return false;const hash=await derive(await peppered(password,pepper),hexToBytes(parts[4]));return equalBytes(hash,hexToBytes(parts[5]));}
export async function digest(value:string){return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));}
