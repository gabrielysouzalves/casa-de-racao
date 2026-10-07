import assert from 'node:assert/strict';
const base=process.argv[2];if(!base)throw new Error('Informe a URL local de teste');
const headers={'Origin':base,...(process.env.TEST_COOKIE?{'Cookie':process.env.TEST_COOKIE}:{})};
async function post(body){const r=await fetch(base+'/api/data',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
const initial=await fetch(base+'/api/data',{headers});assert.equal(initial.status,200);
const bad=await post({action:'product',name:'Teste inválido',barcode:'',price:-1,minimum:0});assert.equal(bad.status,400);
const p=await post({action:'product',name:'Produto de verificação local',barcode:'0000000000001',price:1000,minimum:2});assert.equal(p.status,200);const id=p.data.id;
const entry=await post({action:'movement',productId:id,kind:'in',quantity:5,date:'2026-10-07',note:'Verificação local'});assert.equal(entry.status,200);
const sale=await post({action:'sale',date:'2026-10-07',items:[{productId:id,quantity:2}]});assert.equal(sale.status,200);
const fail=await post({action:'sale',date:'2026-10-07',items:[{productId:id,quantity:4}]});assert.equal(fail.status,400);assert.match(fail.data.error,/Estoque insuficiente/);
const dup=await post({action:'product',name:'Código duplicado',barcode:'0000000000001',price:1000,minimum:0});assert.equal(dup.status,400);
const b=await post({action:'bill',kind:'expense',name:'Compra de teste',company:'Fornecedor teste',mei:'MEI teste',date:'2026-10-07',amount:2000,paid:false});assert.equal(b.status,200);
assert.equal((await post({action:'paid',id:b.data.id,paid:true})).status,200);
const final=await(await fetch(base+'/api/data',{headers})).json();assert.equal(final.products.find(p=>p.id===id).quantity,3);assert.equal(final.bills.find(x=>x.id===b.data.id).paid,1);
console.log('OK API: cadastro, validação, entrada, venda, saldo insuficiente, código duplicado, gasto MEI e pagamento.');
