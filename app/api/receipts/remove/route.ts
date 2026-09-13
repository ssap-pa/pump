import {getChatGPTUser} from '@/app/chatgpt-auth';
import {db} from '@/db/storage';
export async function POST(req:Request){
 const u=await getChatGPTUser();if(!u)return Response.json({error:'로그인해 주세요.'},{status:401});
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return new Response('Forbidden',{status:403});
 let b:any;try{const raw=await req.text();if(raw.length>2048)throw Error();b=JSON.parse(raw);}catch{return Response.json({error:'요청을 확인해 주세요.'},{status:400});}
 if(typeof b?.fileId!=='string'||!['remove','restore'].includes(b.action))return Response.json({error:'요청을 확인해 주세요.'},{status:400});
 const f=await db().prepare('SELECT kind,parent,data FROM records WHERE id=? AND owner=?').bind(b.fileId,u.userId).first<{kind:string;parent:string;data:string}>();
 if(!f||!['file','deleted_receipt'].includes(f.kind)||JSON.parse(f.data).category!=='receipt')return Response.json({error:'영수증을 찾을 수 없어요.'},{status:404});
 const lockId='ocr-lock:'+b.fileId,stamp=new Date().toISOString(),cutoff=new Date(Date.now()-120000).toISOString();
 const lock=await db().prepare('INSERT INTO records(id,owner,kind,parent,data,created) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET created=excluded.created WHERE records.created < ?').bind(lockId,u.userId,'ocr_lock',f.parent,'{}',stamp,cutoff).run();
 if(!lock.meta.changes)return Response.json({error:'인식 중인 영수증은 완료 후 삭제·복원할 수 있어요.'},{status:409});
 try{
 const restore=b.action==='restore';
 await db().batch([
 db().prepare('UPDATE records SET kind=? WHERE id=? AND owner=? AND kind=?').bind(restore?'file':'deleted_receipt',b.fileId,u.userId,restore?'deleted_receipt':'file'),
 db().prepare('UPDATE records SET kind=? WHERE id=? AND owner=? AND kind=?').bind(restore?'purchase':'deleted_purchase','purchase:'+b.fileId,u.userId,restore?'deleted_purchase':'purchase')
 ]);
 return Response.json({ok:true});
 }finally{await db().prepare('DELETE FROM records WHERE id=? AND owner=? AND created=?').bind(lockId,u.userId,stamp).run();}
}
