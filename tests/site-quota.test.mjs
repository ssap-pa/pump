import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../lib/site-quota.ts',import.meta.url),'utf8');
const {insertSite}=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
function fixture(){const sql=new DatabaseSync(':memory:');for(const file of ['0000_records.sql','0001_magical_marvel_zombies.sql'])sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
const db={prepare(q){return{bind(...args){return{async run(){return {meta:{changes:sql.prepare(q).run(...args).changes}};}}}}}};
return {sql,db};}
test('10 free sites allowed; concurrent 11th and 12th denied; another owner unaffected',async()=>{const{sql,db}=fixture();try{for(let i=0;i<9;i++)assert.equal(await insertSite(db,'a','s'+i,{name:'site',status:'작업 완료'}),true);assert.deepEqual(await Promise.all([insertSite(db,'a','s9',{name:'ten'}),insertSite(db,'a','s10',{name:'eleven'}),insertSite(db,'a','s11',{name:'twelve'})]),[true,false,false]);assert.equal(await insertSite(db,'b','other',{name:'other owner'}),true);assert.equal(sql.prepare("SELECT count(*) n FROM records WHERE owner='a'").get().n,10);}finally{sql.close();}});
test('paid period permits additional sites, including cancellation until expiry',async()=>{for(const status of ['active','canceled','past_due']){const{sql,db}=fixture();try{for(let i=0;i<10;i++)await insertSite(db,'a','s'+i,{name:'site'});sql.prepare('INSERT INTO subscriptions(owner,data) VALUES(?,?)').run('a',JSON.stringify({status,periodEnd:Date.now()+60000}));assert.equal(await insertSite(db,'a','paid',{name:'paid'}),true);}finally{sql.close();}}});
test('expired, pending, and another owner subscription do not unlock quota',async()=>{for(const sub of [{status:'active',periodEnd:Date.now()-1},{status:'pending',periodEnd:Date.now()+60000}]){const{sql,db}=fixture();try{for(let i=0;i<10;i++)await insertSite(db,'a','s'+i,{name:'site'});sql.prepare('INSERT INTO subscriptions(owner,data) VALUES(?,?)').run('a',JSON.stringify(sub));sql.prepare('INSERT INTO subscriptions(owner,data) VALUES(?,?)').run('b',JSON.stringify({status:'active',periodEnd:Date.now()+60000}));assert.equal(await insertSite(db,'a','blocked',{name:'blocked'}),false);}finally{sql.close();}}});
