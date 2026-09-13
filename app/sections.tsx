'use client';
import { useEffect, useRef, useState, type SetStateAction } from 'react';
import { useLocalDraft } from '@/lib/use-local-draft';
import { validQuote, validNote } from '@/lib/draft-validation';
import { DraftStatus } from './draft-status';
import { Plus, Camera, Mic, Square, Save, Printer, Trash2, Check, Upload } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { reusableItems, speechErrorMessage } from '@/lib/workflow';
import { Rec, Item, money, subtotal, total, today, blankItem, exampleItems } from '@/lib/domain';
import type { QuoteData, QuoteProps, Attachment, NotesProps, SpeechEngine, SpeechResultEvent, SpeechWindow } from '@/lib/models';
export function Field<T extends string|number>({ label, value, onChange, type = 'text', required = false, full = false }: {label:string;value?:T;onChange:(value:T)=>void;type?:string;required?:boolean;full?:boolean}) { return <label className={'field ' + (full ? 'full' : '')}>{label}<input type={type} required={required} value={value ?? ''} min={type === 'number' ? 0 : undefined} onChange={e => onChange((type === 'number' ? Number(e.target.value) : e.target.value) as T)}/></label>; }
export function Choice({ label, value, onChange, options }: {label:string;value?:string;onChange:(value:string)=>void;options:string[]}) { return <label className="field">{label}<Select value={value} onValueChange={v=>{if(v!==null)onChange(v);}}><SelectTrigger style={{ width: '100%', height: 44 }} aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map((x: string) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></label>; }
async function call<T>(url: string, init?: RequestInit) { const r = await fetch(url, init); let b: unknown; try {
    b = await r.json();
}
catch {
    throw new Error('서버 연결을 확인하고 다시 시도해 주세요.');
} if (!r.ok)
    throw new Error((b as {error?:string}).error || '저장하지 못했습니다. 다시 시도해 주세요.'); return b as T; }
export function Quote({ draftOwner, onBlockNavigation, site, existing, sources = [], profile, busy, onSave }: QuoteProps) { const draft=useLocalDraft<QuoteData>(draftOwner?`pump:draft:${draftOwner}:${site.id}:quote`:null,existing?.data || { title: site.data.name, date: today(), valid: 5, vat: true, items: [blankItem()], notes: '', footer: '견적 외 추가 공정 시공 시 추가 비용 발생', supplier: profile },validQuote); const {value:q,update:setQ}=draft; const [preview, setPreview] = useState(false);
useEffect(()=>{onBlockNavigation(draft.dirty&&draft.unavailable);return()=>onBlockNavigation(false);},[draft.dirty,draft.unavailable,onBlockNavigation]);
 const change = <K extends keyof QuoteData>(k: K, v: QuoteData[K]) => setQ((p) => ({ ...p, [k]: v })); const update = <K extends keyof Item>(n: number, k: K, v: Item[K]) => change('items', q.items.map((i: Item, j: number) => j === n ? { ...i, [k]: v } : i)); const p = q.supplier || profile; if(!draft.ready)return <output>견적을 준비하는 중…</output>; return <div className="stack"><DraftStatus {...draft}/><ol className="flow-steps noprint" aria-label="견적 작성 단계"><li className={!preview?'current':'done'}><span>1</span>항목 입력</li><li className={preview?'current':''}><span>2</span>견적 확인</li><li><span>3</span>저장 · PDF</li></ol><div className="row noprint"><div><h2>{preview ? '견적서 미리보기' : '견적 작성'}</h2><p className="muted" style={{ marginTop: 5 }}>단가는 직접 확인해 입력하세요. 금액은 원 단위로 계산합니다.</p></div><div className="actions"><button className="btn" onClick={() => setPreview(!preview)}>{preview ? '편집으로' : '미리보기'}</button><button className="btn primary" disabled={busy} onClick={async () => {if(await onSave(q))draft.saved(undefined,q);}}><Save size={17}/>견적 저장</button>{preview && <button className="btn" onClick={() => window.print()}><Printer size={17}/>인쇄 / PDF</button>}</div></div>{preview ? <div className="paper"><div className="quotehead"><div><h2>견적서</h2><p style={{ marginTop: 38, fontSize: 20 }}>{site.data.customer || '고객'} 귀하</p><p style={{ marginTop: 22 }}>{q.date}</p><p style={{ marginTop: 15 }}>아래와 같이 견적합니다.</p></div><table><tbody>{[['사업자번호', p.number], ['상호', p.company], ['대표자', p.ceo], ['소재지', p.address], ['업태 / 종목', [p.business, p.category].filter(Boolean).join(' / ')], ['담당자 / 연락처', [p.contact, p.phone].filter(Boolean).join(' / ')]].map(([k, v]) => <tr key={k}><th style={{ width: 110 }}>{k}</th><td>{v || '미입력'}</td></tr>)}</tbody></table></div><table><tbody><tr><th>견적명</th><td>{q.title}</td></tr><tr><th>견적 유효기간</th><td>견적 발송일로부터 {q.valid}일</td></tr><tr><th>합계금액<br />{q.vat ? '(VAT 포함)' : '(VAT 미포함)'}</th><td className="total">{money(total(q))} 원</td></tr></tbody></table><table style={{ marginTop: 22 }}><thead><tr>{['공사항목', '단위', '수량', '단가', '금액', '비고'].map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>{q.items.map((i: Item, n: number) => <tr key={n}><td>{i.name || '항목 미입력'}</td><td>{i.unit}</td><td>{i.qty}</td><td style={{ textAlign: 'right' }}>{money(i.price)}</td><td style={{ textAlign: 'right' }}>{money(i.qty * i.price)}</td><td>{i.memo}</td></tr>)}</tbody></table><table style={{ marginTop: 18 }}><tbody><tr><th>주요 확인사항</th></tr><tr><td style={{ height: 120, whiteSpace: 'pre-wrap', verticalAlign: 'top' }}>{q.notes || '—'}</td></tr></tbody></table><table style={{ marginTop: 18 }}><tbody><tr><th>합계 (VAT 별도)</th><td style={{ textAlign: 'right' }}>{money(subtotal(q.items))} 원</td></tr><tr><th>부가세 {q.vat ? '10%' : '미포함'}</th><td style={{ textAlign: 'right' }}>{money(q.vat ? Math.round(subtotal(q.items) * .1) : 0)} 원</td></tr><tr><th colSpan={2}>{q.footer}</th></tr></tbody></table></div> : <><div className="panel grid"><Field label="견적명" value={q.title} onChange={(v) => change('title', v)}/><Field label="견적일" type="date" value={q.date} onChange={(v) => change('date', v)}/><Field label="견적 유효기간 (일)" type="number" value={q.valid} onChange={(v) => change('valid', v)}/><div className="field">부가세<div className="actions" style={{ paddingTop: 9 }}><Switch checked={q.vat} onCheckedChange={v => change('vat', v)} aria-label="부가세 10% 포함"/><span>10% 포함</span></div></div><div className="full row"><span className="muted">공급자: {p.company || '사업자 정보를 먼저 등록하세요.'}</span><button className="linkbutton" onClick={() => change('supplier', profile)}>최신 사업자 정보 적용</button></div></div><div className="panel stack"><div className="reuse-quote"><label className="field" htmlFor="previous-quote">이전 견적 항목 가져오기<Select value={null} disabled={busy || !sources.length || q.items.some(i=>i.name || i.price !== 0)} onValueChange={value=>{const source=sources.find(r=>r.id===value);if(source){change('items',reusableItems(source.data.items));toast.success('공사 항목을 가져왔어요. 현재 현장의 물량과 단가를 확인해 주세요.');}}}><SelectTrigger id="previous-quote" aria-label="이전 견적 선택" style={{width:'100%',minHeight:48}}><SelectValue placeholder={sources.length?'사용할 이전 견적 선택':'저장한 다른 현장 견적이 아직 없어요'}/></SelectTrigger><SelectContent>{sources.map(r=><SelectItem key={r.id} value={r.id}>{r.data.title} · {r.data.date}</SelectItem>)}</SelectContent></Select></label><p className="muted">항목이 비어 있을 때 가져올 수 있어요. 고객·공급자 정보는 유지되며, 과거 단가는 현재 가격과 다를 수 있어요.</p></div><div className="row"><h2>공사 항목</h2><button className="linkbutton" onClick={() => { if (q.items.every((i: Item) => !i.name && i.price === 0))
    change('items', exampleItems);
else
    toast.info('현재 항목을 비운 뒤 예시를 불러올 수 있습니다.'); }}>첨부 예시 불러오기</button></div><div className="tablewrap quoteitems"><Table><TableHeader><TableRow>{['공사 항목', '단위', '수량', '단가 (원)', '금액 (원)', '비고', ''].map((t, n) => <TableHead key={n}>{t}</TableHead>)}</TableRow></TableHeader><TableBody>{q.items.map((i: Item, n: number) => <TableRow key={n}><TableCell><input className="itemname" aria-label={`${n + 1}번 공사 항목`} value={i.name} onChange={e => update(n, 'name', e.target.value)}/></TableCell><TableCell><input aria-label={`${n + 1}번 단위`} value={i.unit} onChange={e => update(n, 'unit', e.target.value)}/></TableCell><TableCell><input type="number" min="0" step="any" aria-label={`${n + 1}번 수량`} value={i.qty} onChange={e => update(n, 'qty', Math.max(0, Number(e.target.value)))}/></TableCell><TableCell><input type="number" min="0" aria-label={`${n + 1}번 단가`} value={i.price} onChange={e => update(n, 'price', Math.max(0, Number(e.target.value)))}/></TableCell><TableCell>{money(i.qty * i.price)}</TableCell><TableCell><input aria-label={`${n + 1}번 비고`} value={i.memo} onChange={e => update(n, 'memo', e.target.value)}/></TableCell><TableCell><button className="btn" aria-label={`${n + 1}번 항목 삭제`} onClick={() => change('items', q.items.filter((_: Item, j: number) => n !== j))}><Trash2 size={16}/></button></TableCell></TableRow>)}</TableBody></Table></div><div className="actions"><button className="btn" onClick={() => change('items', [...q.items, blankItem()])}><Plus size={16}/>항목 추가</button><button className="btn" onClick={() => change('items', [...q.items, { name: '급수배관 설치', unit: 'm', qty: 1, price: 0, memo: '재질·구경 확인' }])}>급수배관 항목 추가</button></div><div className="row" style={{ borderTop: '1px solid #dce3ed', paddingTop: 20 }}><div className="muted">공급가 {money(subtotal(q.items))}원 · 부가세 {money(q.vat ? Math.round(subtotal(q.items) * .1) : 0)}원</div><strong style={{ fontSize: 26, color: 'var(--primary)' }}>{money(total(q))}원</strong></div></div><div className="panel stack"><label className="field">주요 확인사항<textarea value={q.notes} onChange={e => change('notes', e.target.value)} placeholder="예: 철거 포함 / 마감 복구 별도 / 추가 공사는 금액 협의 후 진행"/></label><Field label="하단 안내 문구" value={q.footer} onChange={(v) => change('footer', v)}/></div><div className="quote-savebar noprint"><div><span className="muted">견적 합계</span><strong>{money(total(q))}원</strong></div><button className="btn" onClick={()=>setPreview(true)}>견적 확인</button><button className="btn primary" disabled={busy} onClick={async()=>{if(await onSave(q))draft.saved(undefined,q);}}>{busy?"저장 중…":"견적 저장"}</button></div></>}</div>; }
export function Notes({ draftOwner, onBlockNavigation, site, rows, busy, onSave, onRefresh }: NotesProps) {
    const draft=useLocalDraft(draftOwner?`pump:draft:${draftOwner}:${site.id}:note`:null,{text:'',date:today(),stage:'시공 중',attachments:[] as Attachment[]},validNote);
    const {text,date,stage,attachments}=draft.value;
    const setText=(value:SetStateAction<string>)=>draft.update(p=>({...p,text:typeof value==='function'?value(p.text):value}));
    const setDate=(date:string)=>draft.update(p=>({...p,date}));
    const setStage=(stage:string)=>draft.update(p=>({...p,stage}));
    const setAttachments=(value:SetStateAction<Attachment[]>)=>draft.update(p=>({...p,attachments:typeof value==='function'?value(p.attachments):value}));
    const [uploading, setUploading] = useState(false), [listening, setListening] = useState(false), [recording, setRecording] = useState(false), [audioDraft, setAudioDraft] = useState<File | null>(null), [review,setReview]=useState(false);
    const [speechHelp,setSpeechHelp]=useState('');
    useEffect(()=>{onBlockNavigation(uploading||recording||listening||!!audioDraft||(draft.dirty&&draft.unavailable));return()=>onBlockNavigation(false);},[uploading,recording,listening,audioDraft,draft.dirty,draft.unavailable,onBlockNavigation]);
    const rec = useRef<MediaRecorder|null>(null), speech = useRef<SpeechEngine|null>(null), stream = useRef<MediaStream | null>(null);
    useEffect(() => () => { speech.current?.abort(); if (rec.current?.state === 'recording')
        rec.current.stop(); stream.current?.getTracks().forEach(t => t.stop()); }, []);
    async function upload(file: File) { if (file.size > 20000000)
        throw new Error('파일은 20MB 이하로 올려 주세요.'); const form = new FormData(); form.append('file', file); form.append('parent', site.id); const result = await call<Attachment>('/api/files', { method: 'POST', body: form }); setAttachments(a => [...a, result]); return result; }
    async function uploadList(fs: FileList | null) { if (!fs)
        return; setUploading(true); try {
        for (const f of Array.from(fs))
            await upload(f);
        await onRefresh();
        toast.success('파일을 업로드했습니다. 기록 저장을 눌러 연결하세요.');
    }
    catch (e) {
        toast.error((e as Error).message);
    }
    finally {
        setUploading(false);
    } }
    function dictate() { if (listening) {
        speech.current?.stop();
        return;
    } const API = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition; if (!API) {
        setSpeechHelp('이 브라우저는 받아쓰기를 지원하지 않아요. 작업 내용 입력창을 누르고 키보드의 마이크로 입력해 주세요.');
        return;
    } setSpeechHelp(''); const s = new API(); s.lang = 'ko-KR'; s.continuous = true; s.interimResults = false; s.onresult = (e: SpeechResultEvent) => { let t = ''; for (let n = e.resultIndex; n < e.results.length; n++)
        if (e.results[n].isFinal)
            t += e.results[n][0].transcript + ' '; setText(v => v + (v ? '\n' : '') + t.trim()); }; s.onerror = (event) => { setListening(false); if(event.error !== 'aborted') setSpeechHelp(speechErrorMessage(event.error)); }; s.onend = () => setListening(false); speech.current = s; try {
        s.start();
        setListening(true);
    }
    catch {
        setListening(false); setSpeechHelp(speechErrorMessage('unknown'));
    } }
    async function record() { if (recording) {
        rec.current?.stop();
        return;
    } try {
        if (!navigator.mediaDevices || !window.MediaRecorder)
            throw new Error('이 브라우저에서는 음성 파일 첨부를 이용해 주세요.');
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.current = s;
        const r = new MediaRecorder(s);
        rec.current = r;
        const chunks: Blob[] = [];
        let size = 0;
        r.ondataavailable = e => { if (e.data.size) {
            chunks.push(e.data);
            size += e.data.size;
            if (size > 18000000 && r.state === 'recording')
                r.stop();
        } };
        r.onstop = () => { s.getTracks().forEach(t => t.stop()); setRecording(false); const ext = r.mimeType.includes('mp4') ? 'm4a' : 'webm'; setAudioDraft(new File(chunks, `음성메모-${Date.now()}.${ext}`, { type: r.mimeType || 'audio/webm' })); };
        r.start(1000);
        setRecording(true);
    }
    catch (e) {
        toast.error((e as Error).message || '마이크 권한을 확인해 주세요.');
    } }
    const linked = new Set(rows.filter((r: Rec) => r.kind === 'note' && r.parent === site.id).flatMap((r: Rec) => (r.data.attachments || []).map((a: Attachment) => a.id)));
    const loose = rows.filter((r: Rec) => r.kind === 'file' && r.parent === site.id && r.data.category !== 'quote' && r.data.category !== 'receipt' && /^(image|audio)\//.test(r.data.type || '') && !linked.has(r.id));
    // eslint-disable-next-line next/no-img-element, jsx-a11y/media-has-caption -- Private photos need authenticated same-origin requests; raw voice memos have no generated transcript.
    function media(a: Attachment) { return a.type?.startsWith('image/') ? <a href={'/api/files?id=' + a.id} target="_blank" rel="noreferrer"><img src={'/api/files?id=' + a.id} alt={a.name}/></a> : <div><p className="muted">{a.name}</p><audio controls preload="none" src={'/api/files?id=' + a.id}/></div>; }
    if(!draft.ready)return <output>작업 기록을 준비하는 중…</output>;
    return <div className="stack"><DraftStatus {...draft}/><ol className="flow-steps" aria-label="기록 작성 단계"><li className={!review?'current':'done'}><span>1</span>사진 · 음성 입력</li><li className={review?'current':''}><span>2</span>내용 확인</li><li><span>3</span>저장</li></ol><div className="panel stack"><div className="row"><h2>{review?'기록을 확인해 주세요':'오늘은 어떤 작업을 했나요?'}</h2><span className="tag">{site.data.name}</span></div><div className="stack compose-step" hidden={review}><div className="grid"><Field label="작업일" type="date" value={date} onChange={setDate}/><Choice label="사진 · 작업 구분" value={stage} options={['시공 전', '시공 중', '시공 후', '매립 전', '시험 결과', '추가 공사']} onChange={setStage}/></div><label className="field">작업 내용<textarea id="work-note-text" style={{ minHeight: 135 }} value={text} onChange={e => setText(e.target.value)} placeholder="오늘 한 작업, 사용한 자재, 추가 협의 사항과 다음 작업을 남겨 주세요."/></label><div className="voice-help"><strong>아이폰 Chrome에서는 키보드의 마이크를 이용해 보세요.</strong><p>작업 내용 입력창 → 키보드 마이크. 아래 받아쓰기 버튼은 브라우저에 따라 지원되지 않을 수 있어요.</p></div>{speechHelp&&<div className="notice" role="alert">{speechHelp}<button className="linkbutton" onClick={()=>document.getElementById('work-note-text')?.focus()}>작업 내용 입력하기</button></div>}<div className="actions voice-actions"><button className={'btn ' + (listening ? 'recording' : '')} disabled={recording} onClick={dictate}><Mic size={17}/>{listening ? '받아쓰기 종료' : '음성 받아쓰기'}</button><button className={'btn ' + (recording ? 'recording' : '')} disabled={listening || !!audioDraft} onClick={record}>{recording ? <Square size={17}/> : <Mic size={17}/>} {recording ? '녹음 종료' : '녹음 파일'}</button><label className="btn"><Camera size={17}/>사진 촬영<input hidden type="file" accept="image/*" capture="environment" disabled={uploading} onChange={e => { void uploadList(e.target.files); e.target.value = ''; }}/></label><label className="btn"><Upload size={17}/>파일 첨부<input hidden type="file" multiple accept="image/*,audio/*" disabled={uploading} onChange={e => { void uploadList(e.target.files); e.target.value = ''; }}/></label></div><p className="muted">받아쓰기는 글자로 입력하고, 녹음 파일은 음성 원본으로 보관해요. 녹음 파일은 자동으로 글자로 변환되지 않아요. 파일당 최대 20MB.</p>{audioDraft && <div className="intro"><p>녹음 완료 · {(audioDraft.size / 1024).toFixed(0)}KB</p><button className="btn" disabled={uploading} onClick={async () => { setUploading(true); try {
        await upload(audioDraft);
        setAudioDraft(null);
        await onRefresh();
    }
    catch (e) {
        toast.error((e as Error).message);
    }
    finally {
        setUploading(false);
    } }}>녹음 업로드</button><button className="linkbutton" disabled={uploading} onClick={()=>{if(window.confirm('이 녹음을 버릴까요? 업로드하지 않은 녹음은 복구할 수 없어요.'))setAudioDraft(null);}}>녹음 버리기</button></div>}{uploading && <output>파일을 업로드하는 중입니다…</output>}{attachments.length > 0 && <div className="photos">{attachments.map(a => <div key={a.id}>{media(a)}<p className="muted"><Check size={13} style={{ display: 'inline' }}/>첨부 준비 완료</p></div>)}</div>}</div>{review&&<div className="record-review"><div className="row"><strong>{date}</strong><span className="tag">{stage}</span></div><p>{text||'텍스트 없이 첨부파일만 저장합니다.'}</p><div className="photos">{attachments.map(a=><div key={a.id}>{media(a)}</div>)}</div><p className="muted">현장명, 작업 내용, 추가 협의 사항이 맞는지 확인하세요.</p></div>}{!review?<button className="btn primary record-next" disabled={busy||uploading||recording||listening||!!audioDraft||(!text.trim()&&!attachments.length)} onClick={()=>setReview(true)}>입력한 내용 확인하기 <Check size={18}/></button>:<div className="actions review-actions"><button className="btn" disabled={busy} onClick={()=>setReview(false)}>수정하기</button><button className="btn primary" disabled={busy || uploading || recording || listening || !!audioDraft || (!text.trim() && !attachments.length)} onClick={async () => { const submitted=draft.value; const ok = await onSave(submitted); if (ok) {
        draft.saved({date,stage,text:'',attachments:[]},submitted);setReview(false);
    } }}><Save size={17}/>작업 기록 저장</button></div>}</div><div className="panel stack"><h2>작업 기록</h2>{rows.filter((r: Rec) => r.parent === site.id && r.kind === 'note').length === 0 ? <div className="empty">등록된 작업 기록이 없습니다.</div> : rows.filter((r: Rec) => r.parent === site.id && r.kind === 'note').map((r: Rec) => <article className="note" key={r.id}><div className="row"><strong>{r.data.date}</strong><span className="tag">{r.data.stage}</span></div><p>{r.data.text}</p><div className="photos">{(r.data.attachments || []).map((a: Attachment) => <div key={a.id}>{media(a)}</div>)}</div></article>)}</div>{loose.length > 0 && <div className="panel stack"><h2>업로드한 파일</h2><p className="muted">아직 작업 기록에 연결하지 않은 파일입니다.</p><div className="photos">{loose.map((r: Rec) => <div key={r.id}>{media({ id: r.id, ...r.data })}<button className="linkbutton" disabled={attachments.some(a => a.id === r.id)} onClick={() => setAttachments(a => [...a, { id: r.id, ...r.data }])}>기록에 첨부</button></div>)}</div></div>}</div>;
}


