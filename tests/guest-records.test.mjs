import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../lib/guest-records.ts',import.meta.url),'utf8');
const guest=await import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
function storage(){const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};return data;}
test('guest site, quote and notes survive a reread and edit without duplicates',()=>{storage();const s=guest.saveGuestRecord('site',{name:'test'});guest.saveGuestRecord('quote',{items:[{qty:2,price:100}]},s.id);guest.saveGuestRecord('note',{text:'memo',attachments:[]},s.id);guest.saveGuestRecord('site',{name:'edited'},'',s.id);const r=guest.readGuestRecords();assert.equal(r.length,3);assert.equal(r[0].data.name,'edited');assert.equal(r[1].parent,s.id);});
test('guest quota rejects eleventh but allows editing existing site',()=>{storage();for(let i=0;i<10;i++)guest.saveGuestRecord('site',{name:String(i)});assert.throws(()=>guest.saveGuestRecord('site',{name:'eleven'}));const id=guest.readGuestRecords()[0].id;guest.saveGuestRecord('site',{name:'updated'},'',id);assert.equal(guest.readGuestRecords().length,10);});
test('storage errors never report successful save or overwrite corrupt records',()=>{const data=storage();data.set(guest.GUEST_KEY,'corrupt');assert.throws(()=>guest.saveGuestRecord('site',{name:'new'}));assert.equal(data.get(guest.GUEST_KEY),'corrupt');storage();localStorage.setItem=()=>{throw Error('quota');};assert.throws(()=>guest.saveGuestRecord('site',{name:'new'}),/저장/);});
