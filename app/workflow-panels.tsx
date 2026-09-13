'use client';
import type { Rec } from '@/lib/domain';
import { ArrowRight, Check, FileText, ReceiptText, FolderOpen } from 'lucide-react';

export function WorkflowPanel({rows,onCreate,onEnter}:{rows:Rec[];onCreate:()=>void;onEnter:(id:string,tab:string)=>void}) {
  const sites=rows.filter(r=>r.kind==='site');
  const quotes=rows.filter(r=>r.kind==='quote');
  const pending=rows.filter(r=>r.kind==='purchase'&&r.data.status!=='confirmed'&&sites.some(s=>s.id===r.parent));
  const first=sites[0];
  const hasNotes=rows.some(r=>r.kind==='note');
  const completed=Number(sites.length>0)+Number(quotes.length>0)+Number(hasNotes);
  if(completed===3&&!pending.length)return null;
  return <section className="workflow-panel noprint" aria-label="다음으로 할 일">
    <div className="row"><div><p className="eyebrow">현장 업무를 한곳에서</p><h2>{sites.length?'다음으로 챙길 일':'첫 현장부터 시작해 보세요'}</h2></div><span className="tag">{completed===3?'기본 준비 완료':`${completed} / 3 시작 단계`}</span></div>
    {completed<3&&<div className="workflow-steps">
      <button onClick={onCreate}><FolderOpen size={21}/><span><strong>{sites.length?'새 현장 등록':'1. 현장명만 등록'}</strong><small>고객·주소는 나중에 추가해도 돼요</small></span>{sites.length>0&&<Check size={18}/>}</button>
      <button disabled={!first} onClick={()=>first&&onEnter(first.id,'quote')}><FileText size={21}/><span><strong>{quotes.length?'견적 확인·작성':'2. 견적 초안 작성'}</strong><small>{first?first.data.name:'현장을 등록하면 시작할 수 있어요'}</small></span>{quotes.length>0&&<Check size={18}/>}</button>
      <button disabled={!first} onClick={()=>first&&onEnter(first.id,'notes')}><ReceiptText size={21}/><span><strong>{hasNotes?'작업 기록 남기기':'3. 첫 작업 기록'}</strong><small>{first?first.data.name:'사진과 메모로 진행 상황을 남겨요'}</small></span>{rows.some(r=>r.kind==='note')&&<Check size={18}/>}</button>
    </div>}
    {pending.length>0&&<div className="review-queue"><h3>확인할 영수증 <span className="count">{pending.length}</span></h3>{pending.slice(0,3).map(r=><button key={r.id} onClick={()=>onEnter(r.parent,'purchases')}><span>{sites.find(s=>s.id===r.parent)?.data.name}<small>{r.data.vendor||'판매처 확인 필요'} · 품목과 결제액을 확인해 주세요</small></span><ArrowRight size={18}/></button>)}</div>}
  </section>;
}
