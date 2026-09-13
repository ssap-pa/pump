'use client';
import { useId, useRef, useState } from 'react';
import { Camera, Upload, FileText, Download, ExternalLink, LoaderCircle, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import { classifyUpload, photoAccept, quoteAccept } from '@/lib/upload-policy';
import type { Rec } from '@/lib/domain';
export type UploadKind='photo'|'quote';
type FileMeta={name:string;type:string;size?:number;category?:string};
type FilesProps={siteId:string;category:UploadKind;rows:Rec[];onRefresh:()=>Promise<boolean>;onBusyChange?:(busy:boolean)=>void};
const sizeLabel=(bytes?:number)=>bytes ? bytes>=1_000_000 ? (bytes/1_000_000).toFixed(1)+'MB' : Math.max(1,Math.round(bytes/1000))+'KB' : '';

function FileCard({record}:{record:Rec}) {
  const data=record.data as FileMeta, href='/api/files?id='+encodeURIComponent(record.id);
  const preview=/^image\/(jpeg|png|webp|gif)$/.test(data.type);
  return <article className={'uploaded-file '+(preview ? 'with-photo' : '')}>
    <a className="file-preview" href={href} target="_blank" rel="noreferrer" aria-label={data.name+' 열기'}>
      {/* eslint-disable-next-line next/no-img-element -- Private photos require authenticated same-origin requests. */}
      {preview ? <img src={href} alt={data.name} loading="lazy" /> : <FileText size={32}/>}
    </a>
    <div className="file-details"><strong title={data.name}>{data.name}</strong><p>{[sizeLabel(data.size),record.created.slice(0,10)].filter(Boolean).join(' · ')}</p></div>
    <div className="file-links"><a href={href} target="_blank" rel="noreferrer"><ExternalLink size={15}/>열기</a><a href={href+'&download=1'} download><Download size={15}/>다운로드</a></div>
  </article>;
}

export function SiteFiles({siteId,category,rows,onRefresh,onBusyChange}:FilesProps) {
  const inputId=useId(), fileInput=useRef<HTMLInputElement>(null), cameraInput=useRef<HTMLInputElement>(null), locked=useRef(false);
  const [uploading,setUploading]=useState(false),[progress,setProgress]=useState(''),[errors,setErrors]=useState<string[]>([]),[dragging,setDragging]=useState(false);
  const isQuote=category==='quote';
  const records=rows.filter(r=>r.kind==='file'&&r.parent===siteId&&(isQuote ? r.data.category==='quote' : r.data.category==='photo'||(!r.data.category&&r.data.type?.startsWith('image/'))));
  async function upload(selected:FileList|File[]|null) {
    const batch=Array.from(selected || []);
    if(!batch.length || locked.current) return;
    locked.current=true;setUploading(true);onBusyChange?.(true);setErrors([]);
    const failures:string[]=[];let completed=0;
    try {
      for(const [index,file] of batch.entries()) {
        setProgress(`${index+1}/${batch.length} · ${file.name}`);
        try {
          classifyUpload(file,category);
          const form=new FormData();form.append('parent',siteId);form.append('category',category);form.append('file',file);
          const response=await fetch('/api/files',{method:'POST',body:form});
          const data=await response.json().catch(()=>({error:'연결을 확인하고 다시 시도해 주세요.'})) as {error?:string};
          if(!response.ok) throw new Error(data.error || '업로드하지 못했어요.');
          completed++;
        } catch(e) { failures.push(`${file.name}: ${(e as Error).message}`); }
      }
      if(completed) {
        const refreshed=await onRefresh();
        if(refreshed) toast.success(`${completed}개 파일을 현장에 저장했어요.`);
        else toast.info('파일은 저장됐어요. 목록을 다시 불러와 주세요.');
      }
      setErrors(failures);
    } finally {setUploading(false);setProgress('');locked.current=false;onBusyChange?.(false);}
  }
  return <section className="panel file-library noprint" aria-label={isQuote?'견적서 파일':'현장 사진'}>
    <div className="row"><div><h2>{isQuote?'견적서 파일':'현장 사진'} <span className="count">{records.length}</span></h2><p className="muted">{isQuote?'받아둔 견적서를 이 현장에 보관하세요.':'촬영한 사진을 현장별로 모아두세요.'}</p></div></div>
    <div className={'upload-dropzone '+(dragging?'dragging':'')} onDragOver={e=>{e.preventDefault();if(!uploading)setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void upload(Array.from(e.dataTransfer.files));}}>
      <span className="upload-symbol">{uploading?<LoaderCircle className="spin" size={27}/>:isQuote?<FileText size={27}/>:<Camera size={27}/>}</span>
      <strong>{isQuote?'견적서 파일을 올려주세요':'현장 사진을 올려주세요'}</strong>
      <p id={inputId+'-help'}>{isQuote?'PDF · 이미지 · 엑셀(XLSX, XLS)':'JPG · PNG · WEBP · HEIC · GIF'} · 파일당 20MB<br/>여러 파일을 선택하거나 여기로 끌어다 놓으세요.</p>
      <div className="actions"><button className="btn primary" disabled={uploading} onClick={()=>fileInput.current?.click()}><Upload size={18}/>{isQuote?'견적서 선택':'사진 선택'}</button>{!isQuote&&<button className="btn" disabled={uploading} onClick={()=>cameraInput.current?.click()}><Camera size={18}/>사진 촬영</button>}</div>
      <input ref={fileInput} id={inputId} hidden type="file" multiple accept={isQuote?quoteAccept:photoAccept} disabled={uploading} aria-describedby={inputId+'-help'} onChange={e=>{void upload(Array.from(e.target.files||[]));e.target.value='';}}/>
      {!isQuote&&<input ref={cameraInput} hidden type="file" accept="image/*" capture="environment" disabled={uploading} onChange={e=>{void upload(Array.from(e.target.files||[]));e.target.value='';}}/>}
    </div>
    {uploading&&<output className="upload-progress" aria-live="polite">업로드 중 · {progress}</output>}
    {!!errors.length&&<div className="upload-errors" role="alert"><strong>올리지 못한 파일</strong>{errors.map((message,i)=><p key={i}>{message}</p>)}<p>저장된 파일은 유지돼요. 실패한 파일만 다시 선택해 주세요.</p></div>}
    <p className="file-save-hint"><CheckCircle2 size={16}/>파일 선택 후 바로 저장돼요. 작업 기록 저장을 따로 누르지 않아도 됩니다.</p>
    {records.length>0&&<div className="file-gallery">{records.map(record=><FileCard key={record.id} record={record}/>)}</div>}
  </section>;
}

type UploadDialogProps={category:UploadKind;initialSite:string;sites:Rec[];rows:Rec[];onClose:()=>void;onRefresh:()=>Promise<boolean>;onCreate:(name:string)=>Promise<string>};
export function UploadDialog({category,initialSite,sites,rows,onClose,onRefresh,onCreate}:UploadDialogProps) {
  const [selected,setSelected]=useState(initialSite||sites[0]?.id||''),[name,setName]=useState(''),[creating,setCreating]=useState(false),[uploading,setUploading]=useState(false),[newSite,setNewSite]=useState(sites.length===0),[error,setError]=useState('');
  const busy=creating||uploading;
  return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="entry-dialog upload-dialog" showCloseButton={!busy}>
    <DialogTitle>{category==='photo'?'현장 사진 올리기':'견적서 올리기'}</DialogTitle><DialogDescription>보관할 현장을 고른 뒤 파일을 선택해 주세요.</DialogDescription>
    {newSite?<form className="new-upload-site" onSubmit={async e=>{e.preventDefault();if(!name.trim()||creating)return;setCreating(true);setError('');try {const id=await onCreate(name.trim());setSelected(id);setNewSite(false);}catch(e){setError((e as Error).message);}finally{setCreating(false);}}}><label className="field">새 현장 이름<input required value={name} onChange={e=>setName(e.target.value)} placeholder="예: 역삼동 상가 급수배관" disabled={creating}/></label><div className="actions"><button className="btn primary" disabled={creating}>{creating?'현장 만드는 중…':'현장 만들고 파일 올리기'}</button>{sites.length>0&&<button className="btn" type="button" onClick={()=>setNewSite(false)} disabled={creating}>기존 현장 선택</button>}</div>{error&&<p className="upload-errors" role="alert">{error}</p>}</form>:<>
      <div className="upload-site-picker"><div className="field"><span id="upload-site-label">보관할 현장</span><Select value={selected} onValueChange={value=>{if(value)setSelected(value);}} disabled={busy}><SelectTrigger aria-labelledby="upload-site-label"><SelectValue/></SelectTrigger><SelectContent>{sites.map(site=><SelectItem key={site.id} value={site.id}>{site.data.name}</SelectItem>)}</SelectContent></Select></div><button className="linkbutton" disabled={busy} onClick={()=>setNewSite(true)}>새 현장 만들기</button></div>
      {selected&&<SiteFiles key={selected+category} siteId={selected} category={category} rows={rows} onRefresh={onRefresh} onBusyChange={setUploading}/>}
    </>}
  </DialogContent></Dialog>;
}
