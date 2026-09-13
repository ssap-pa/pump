import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db,files} from '@/db/storage';
import {validPurchase} from '@/lib/receipt';
import {extractReceipt} from '@/lib/openai-receipt';
export async function POST(req:Request){return write(req,false)}
export async function PUT(req:Request){return write(req,true)}
async function write(req:Request,edit:boolean){
 const u=await getChatGPTUser();if(!u)return Response.json({error:'로그인해 주세요.'},{status:401});
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return new Response('Forbidden',{status:403});
 let b:any;try{const raw=await req.text();if(raw.length>100000)throw Error();b=JSON.parse(raw);}catch{return Response.json({error:'입력 내용을 확인해 주세요.'},{status:400});}
 if(typeof b?.fileId!=='string')return Response.json({error:'영수증을 선택해 주세요.'},{status:400});
 const f=await db().prepare('SELECT parent,data FROM records WHERE id=? AND owner=? AND kind=?').bind(b.fileId,u.userId,'file').first<{parent:string;data:string}>();
 if(!f||JSON.parse(f.data).category!=='receipt')return Response.json({error:'영수증을 찾을 수 없어요.'},{status:404});
 const id='purchase:'+b.fileId;const existing=await db().prepare('SELECT data FROM records WHERE id=? AND owner=?').bind(id,u.userId).first<{data:string}>();
 const old=existing?JSON.parse(existing.data):null;
 if(edit){
  if(!old||!validPurchase(b.data))return Response.json({error:'품목과 금액을 확인해 주세요.'},{status:400});
  const data={...old,vendor:b.data.vendor,date:b.data.date,total:b.data.total,supplyAmount:b.data.supplyAmount??null,vat:b.data.vat??null,discount:b.data.discount??null,items:b.data.items,status:b.data.status};
  await db().prepare('UPDATE records SET data=? WHERE id=? AND owner=?').bind(JSON.stringify(data),id,u.userId).run();return Response.json({id,data});
 }
 if(old&&(b.reprocess!==true||old.status==='confirmed'))return Response.json({id,data:old});
 const key=(env as unknown as {OPENAI_API_KEY?:string}).OPENAI_API_KEY;
 if(!key)return Response.json({error:'영수증 AI 연결 설정이 필요해요.'},{status:503});
 const lockId='ocr-lock:'+b.fileId,stamp=new Date().toISOString(),cutoff=new Date(Date.now()-120000).toISOString();
 const locked=await db().prepare('INSERT INTO records(id,owner,kind,parent,data,created) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET created=excluded.created WHERE records.created < ?').bind(lockId,u.userId,'ocr_lock',f.parent,'{}',stamp,cutoff).run();
 if(!locked.meta.changes)return Response.json({error:'이 영수증을 이미 인식하고 있어요. 잠시 후 확인해 주세요.'},{status:409});
 try{
  const active=await db().prepare('SELECT id FROM records WHERE id=? AND owner=? AND kind=?').bind(b.fileId,u.userId,'file').first();
  if(!active)return Response.json({error:'삭제한 영수증이에요. 복원 후 다시 인식해 주세요.'},{status:404});
  const object=await files().get(b.fileId);if(!object)return Response.json({error:'영수증 원본을 찾을 수 없어요.'},{status:404});
  if(object.size>12*1024*1024)return Response.json({error:'AI 인식용 사진은 12MB 이하로 줄여 다시 올려 주세요.'},{status:413});
  const data={...await extractReceipt(await object.arrayBuffer(),JSON.parse(f.data).type,key),fileId:b.fileId};
  if(existing){
   const changed=await db().prepare('UPDATE records SET data=? WHERE id=? AND owner=? AND data=?').bind(JSON.stringify(data),id,u.userId,existing.data).run();
   if(!changed.meta.changes)return Response.json({error:'인식 중 구매 내역이 수정되어 기존 내용을 유지했어요. 새로고침해 주세요.'},{status:409});
  }else await db().prepare('INSERT INTO records(id,owner,kind,parent,data,created) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,u.userId,'purchase',f.parent,JSON.stringify(data),stamp).run();
  return Response.json({id,data});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'인식에 실패했어요. 원본은 보관되어 있어요.'},{status:502});}
 finally{await db().prepare('DELETE FROM records WHERE id=? AND owner=? AND created=?').bind(lockId,u.userId,stamp).run();}
}
