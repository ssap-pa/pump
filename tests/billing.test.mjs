import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=await mkdtemp(join(tmpdir(),'seolbi-billing-'));
const path=join(dir,'billing.mjs');
await writeFile(path,ts.transpileModule(await readFile(new URL('../lib/billing.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
const {nextMonth,configured,startBilling,completeBilling,billingStatus,cancelBilling,retryBilling,renewSubscriptions}=await import(pathToFileURL(path));
const realFetch=global.fetch;
after(async()=>{global.fetch=realFetch;await rm(dir,{recursive:true,force:true});});
const schema=await readFile(new URL('../drizzle/0001_magical_marvel_zombies.sql',import.meta.url),'utf8');
function fixture(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(schema);
  let failBatch=false;
  const DB={prepare(sql){let args=[];return {bind(...v){args=v;return this;},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};}};},async batch(statements){if(failBatch){failBatch=false;throw new Error('simulated DB outage');}sqlite.exec('BEGIN');try{const r=[];for(const q of statements)r.push(await q.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
  const env={DB,TOSS_CLIENT_KEY:'test_ck_fixture',TOSS_SECRET_KEY:'test_sk_fixture',BILLING_ENCRYPTION_KEY:'ab'.repeat(32),BILLING_ORIGIN:'https://test.example',BILLING_RENEWALS_ENABLED:'true'};
  let calls=0;const orders=new Map();let behavior='ok';
  global.fetch=async(url,options)=>{
    assert.match(options.headers.Authorization,/^Basic /);
    const body=options.body?JSON.parse(options.body):{};
    if(url.endsWith('/authorizations/issue'))return Response.json({billingKey:'private-billing-key',customerKey:body.customerKey,card:{number:'1234-****-****-5678'}});
    if(options.method==='DELETE')return new Response(null,{status:200});
    if(options.method==='GET'){const result=orders.get(url.split('/').pop());return Response.json(result||{code:'NOT_FOUND_PAYMENT'},{status:result?200:404});}
    calls++;
    assert.equal(body.amount,9900);assert.equal(options.headers['Idempotency-Key'],body.orderId);
    if(behavior==='decline')return Response.json({code:'REJECT_CARD_COMPANY'},{status:400});
    const result={status:'DONE',orderId:body.orderId,totalAmount:behavior==='mismatch'?100:9900,currency:'KRW',paymentKey:'payment-secret',approvedAt:new Date().toISOString()};
    orders.set(body.orderId,result);
    if(behavior==='timeout')throw new Error('connection lost after approval');
    return Response.json(result);
  };
  async function intent(owner='alice'){const r=await startBilling(env,owner);return {customerKey:r.customerKey,state:new URL(r.successUrl).searchParams.get('state'),authKey:'test-auth'};}
  return {env,sqlite,intent,calls:()=>calls,behavior:v=>behavior=v,failBatch:()=>{failBatch=true;}};
}
test('billing calendar uses Korea time, clamps February and restores original day',()=>{
  const jan=Date.parse('2028-01-31T09:15:00+09:00');
  assert.equal(new Date(nextMonth(jan,1)).toISOString(),'2028-02-29T00:15:00.000Z');
  assert.equal(new Date(nextMonth(jan,2)).toISOString(),'2028-03-31T00:15:00.000Z');
});
test('live keys fail closed',async()=>{const f=fixture();f.env.TOSS_SECRET_KEY='live_sk_denied';assert.equal(configured(f.env),false);await assert.rejects(startBilling(f.env,'alice'));assert.equal(f.calls(),0);});
test('first charge, duplicate callback and owner isolation',async()=>{
  const f=fixture(),input=await f.intent();await completeBilling(f.env,'alice',input);await completeBilling(f.env,'alice',input);
  const status=await billingStatus(f.env,'alice');assert.equal(status.subscription.status,'active');assert.equal(f.calls(),1);
  assert.equal((await billingStatus(f.env,'bob')).payments.length,0);
  assert.doesNotMatch(JSON.stringify(status),/private-billing-key|encryptedKey|payment-secret|customerKey/);
  assert.doesNotMatch(f.sqlite.prepare('SELECT data FROM subscriptions').get().data,/private-billing-key/);
});
test('forged state and cross-account callback cannot charge',async()=>{const f=fixture(),input=await f.intent();await assert.rejects(completeBilling(f.env,'alice',{...input,state:'wrong'}));await assert.rejects(completeBilling(f.env,'bob',input));assert.equal(f.calls(),0);});
test('expired callback rejected',async()=>{const f=fixture(),input=await f.intent();f.sqlite.exec("UPDATE subscriptions SET data=json_set(data,'$.expires',1)");await assert.rejects(completeBilling(f.env,'alice',input));assert.equal(f.calls(),0);});
test('concurrent callback cannot duplicate a charge',async()=>{const f=fixture(),input=await f.intent();await Promise.allSettled([completeBilling(f.env,'alice',input),completeBilling(f.env,'alice',input)]);assert.equal(f.calls(),1);assert.equal((await billingStatus(f.env,'alice')).subscription.status,'active');});
test('lost provider response reconciles without a second charge',async()=>{const f=fixture(),input=await f.intent();f.behavior('timeout');await assert.rejects(completeBilling(f.env,'alice',input));await retryBilling(f.env,'alice');assert.equal(f.calls(),1);assert.equal((await billingStatus(f.env,'alice')).subscription.status,'active');});
test('lost database commit recovers the same billing cycle',async()=>{const f=fixture(),input=await f.intent();f.failBatch();await assert.rejects(completeBilling(f.env,'alice',input));await retryBilling(f.env,'alice');assert.equal(f.calls(),1);assert.equal((await billingStatus(f.env,'alice')).payments.length,1);});
test('amount mismatch never grants active subscription',async()=>{const f=fixture(),input=await f.intent();f.behavior('mismatch');await assert.rejects(completeBilling(f.env,'alice',input));assert.equal((await billingStatus(f.env,'alice')).subscription.status,'past_due');await assert.rejects(retryBilling(f.env,'alice'));assert.equal(f.calls(),1);});
test('declined charge remains unpaid and is not automatically retried',async()=>{const f=fixture(),input=await f.intent();f.behavior('decline');await assert.rejects(completeBilling(f.env,'alice',input));await renewSubscriptions(f.env);assert.equal(f.calls(),1);assert.equal((await billingStatus(f.env,'alice')).payments[0].status,'failed');});
test('cancel keeps paid period, blocks renewal and duplicate signup',async()=>{const f=fixture(),input=await f.intent();await completeBilling(f.env,'alice',input);await cancelBilling(f.env,'alice');const status=await billingStatus(f.env,'alice');assert.equal(status.subscription.status,'canceled');assert.ok(status.subscription.periodEnd>Date.now());await renewSubscriptions(f.env);await assert.rejects(startBilling(f.env,'alice'));assert.equal(f.calls(),1);});
test('two scheduler invocations renew a due period only once',async()=>{
  const f=fixture(),input=await f.intent();await completeBilling(f.env,'alice',input);
  const s=JSON.parse(f.sqlite.prepare('SELECT data FROM subscriptions').get().data);s.periodEnd=Date.now()-1000;
  f.sqlite.prepare('UPDATE subscriptions SET data=?,due_at=?').run(JSON.stringify(s),s.periodEnd);
  await Promise.all([renewSubscriptions(f.env),renewSubscriptions(f.env)]);
  assert.equal(f.calls(),2);assert.equal((await billingStatus(f.env,'alice')).payments.length,2);
});
test('disabled scheduler never charges due subscriptions',async()=>{
  const f=fixture(),input=await f.intent();await completeBilling(f.env,'alice',input);f.env.BILLING_RENEWALS_ENABLED='false';
  f.sqlite.exec("UPDATE subscriptions SET due_at=1,data=json_set(data,'$.periodEnd',1)");await renewSubscriptions(f.env);assert.equal(f.calls(),1);
});
