import { getChatGPTUser } from '@/app/chatgpt-auth';
import { db, files } from '@/db/storage';
import { classifyUpload, MAX_FILE_BYTES } from '@/lib/upload-policy';

export async function POST(req: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error:'로그인해 주세요.' }, { status:401 });
  if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return Response.json({ error:'요청 출처를 확인해 주세요.' }, { status:403 });
  if (Number(req.headers.get('content-length') || 0) > MAX_FILE_BYTES + 2_000_000) return Response.json({ error:'파일은 한 개당 20MB 이하로 올려 주세요.' }, { status:413 });
  let form:FormData;
  try { form = await req.formData(); }
  catch { return Response.json({ error:'파일을 선택해 다시 올려 주세요.' }, { status:400 }); }
  const file=form.get('file'), parentValue=form.get('parent'), categoryValue=form.get('category');
  const parent=typeof parentValue === 'string' ? parentValue : '';
  if (categoryValue !== null && typeof categoryValue !== 'string') return Response.json({error:'파일 분류를 확인해 주세요.'},{status:400});
  if (!(file instanceof File)) return Response.json({ error:'업로드할 파일을 선택해 주세요.' }, { status:400 });
  let info:ReturnType<typeof classifyUpload>;
  try { info=classifyUpload(file, categoryValue || ''); }
  catch(e) { return Response.json({ error:(e as Error).message }, { status:file.size > MAX_FILE_BYTES ? 413 : 400 }); }
  const site=await db().prepare('SELECT id FROM records WHERE id=? AND owner=? AND kind=?').bind(parent,user.userId,'site').first();
  if (!site) return Response.json({ error:'파일을 보관할 현장을 찾을 수 없어요.' }, { status:404 });
  let id=crypto.randomUUID();
  if(info.category==='receipt'){
    const bytes=await file.arrayBuffer();const contentHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    const scoped=new TextEncoder().encode(user.userId+'|'+parent+'|'+contentHash);id='receipt-'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',scoped)),b=>b.toString(16).padStart(2,'0')).join('');
    const previous=await db().prepare('SELECT kind,data,created FROM records WHERE id=? AND owner=?').bind(id,user.userId).first<{kind:string;data:string;created:string}>();
    if(previous?.kind==='deleted_receipt')return Response.json({error:'삭제한 영수증이에요. 아래 «삭제한 영수증»에서 복원해 주세요.'},{status:409});
    if(previous)return Response.json({id,...JSON.parse(previous.data),created:previous.created,duplicate:true});
  }
  const created=new Date().toISOString();
  const data={name:file.name, type:info.type, category:info.category, size:file.size};
  await files().put(id,file.stream(),{httpMetadata:{contentType:info.type}});
  try {
    await db().prepare('INSERT INTO records(id,owner,kind,parent,data,created) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,user.userId,'file',parent,JSON.stringify(data),created).run();
  } catch(e) { await files().delete(id); throw e; }
  return Response.json({id,...data,created});
}

export async function GET(req: Request) {
  const user=await getChatGPTUser();
  if (!user) return new Response('Unauthorized',{status:401});
  const url=new URL(req.url),id=url.searchParams.get('id') || '';
  const record=await db().prepare('SELECT data FROM records WHERE id=? AND owner=? AND kind=?').bind(id,user.userId,'file').first<{data:string}>();
  if (!record) return new Response('Not found',{status:404});
  const object=await files().get(id);
  if (!object) return new Response('Not found',{status:404});
  const data=JSON.parse(record.data) as {type:string;name:string};
  const downloadable=url.searchParams.get('download') === '1' || data.type.includes('spreadsheet') || data.type === 'application/vnd.ms-excel';
  const filename=encodeURIComponent(data.name || 'file').replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
  const headers:Record<string,string>={
    'Content-Type':data.type,
    'Content-Disposition':`${downloadable ? 'attachment' : 'inline'}; filename="file"; filename*=UTF-8''${filename}`,
    'Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff'
  };
  if (data.type === 'application/pdf') headers['Content-Security-Policy']='sandbox';
  return new Response(object.body,{headers});
}
