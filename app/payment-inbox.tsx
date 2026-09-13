'use client';
import { ArrowRight, Wallet } from 'lucide-react';
import { money, total, type Rec } from '@/lib/domain';

export function PaymentInbox({rows,onEnter}:{rows:Rec[];onEnter:(id:string,tab:string)=>void}) {
  const remaining=rows.filter(r=>r.kind==='site').map(site=>{
    const quote=rows.find(r=>r.kind==='quote'&&r.parent===site.id);
    const paid=rows.filter(r=>r.kind==='payment'&&r.parent===site.id).reduce((sum,r)=>sum+Number(r.data.amount||0),0);
    return {site,amount:Math.max(0,total(quote?.data)-paid)};
  }).filter(r=>r.amount>0).sort((a,b)=>b.amount-a.amount);
  if(!remaining.length)return null;
  return <section className="panel payment-inbox noprint" aria-label="받을 금액이 남은 현장">
    <div className="row"><div><p className="eyebrow"><Wallet size={16}/>수금 확인</p><h2>받을 금액이 남은 현장 <span className="count">{remaining.length}</span></h2></div></div>
    <p className="muted">견적과 입금 내역의 차액이에요. 지급 기한이 지난 금액을 뜻하지는 않아요.</p>
    {remaining.slice(0,3).map(({site,amount})=><button key={site.id} onClick={()=>onEnter(site.id,'payments')}><span><strong>{site.data.name}</strong><small>{site.data.customer||'고객 미등록'} · {site.data.status}</small></span><span className="inbox-amount">{money(amount)}원<ArrowRight size={18}/></span></button>)}
    {remaining.length>3&&<details><summary>나머지 {remaining.length-3}개 현장 보기</summary>{remaining.slice(3).map(({site,amount})=><button key={site.id} onClick={()=>onEnter(site.id,'payments')}><span>{site.data.name}</span><span className="inbox-amount">{money(amount)}원<ArrowRight size={18}/></span></button>)}</details>}
  </section>;
}
