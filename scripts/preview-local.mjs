import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const root=path.resolve('.');
const built=path.join(root,'dist/server');
const config=JSON.parse(fs.readFileSync(path.join(built,'wrangler.json'),'utf8'));
config.main=path.resolve(built,config.main);
config.base_dir=path.resolve(built,config.base_dir||'.');
if(config.assets?.directory)config.assets.directory=path.resolve(built,config.assets.directory);
const raw=fs.readFileSync('.env','utf8');config.vars={...config.vars};
for(const key of ['AUTH_PEPPER','INITIAL_ADMIN_HASH']){const line=raw.split(/\r?\n/).find(s=>s.startsWith(key+'='));if(!line)throw new Error('Configure '+key+' na .env local.');let value=line.slice(key.length+1).trim();if((value.startsWith("'")&&value.endsWith("'"))||(value.startsWith('"')&&value.endsWith('"')))value=value.slice(1,-1);config.vars[key]=value;}
const dir=path.join(root,'.sites-runtime','preview');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'wrangler.json');fs.writeFileSync(file,JSON.stringify(config));
const child=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config',file,'--local','--persist-to',path.join(root,'.wrangler/state'),'--ip','127.0.0.1','--inspector-port','0','--port','5173','--log-level','warn'],{stdio:'inherit'});
child.on('exit',code=>process.exit(code??1));
