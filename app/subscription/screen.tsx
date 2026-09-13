'use client';
/* eslint-disable next/no-html-link-for-pages -- Billing pages need reliable top-level navigation; the deployed Vinext Link prefetch fails. */
import {useEffect,useState} from 'react';
import {ArrowLeft,Check,CreditCard,ShieldCheck} from 'lucide-react';
import './subscription.css';
type Status={configured:boolean;renewalsEnabled:boolean;subscription:null|{status:string;card?:string;periodEnd?:number;canRetry:boolean;paidThrough:boolean};payments:{orderId:string;amount:number;status:string;created:number}[]};
type TossFactory=(key:string)=>{payment:(options:{customerKey:string})=>{requestBillingAuth:(options:{method:'CARD';successUrl:string;failUrl:string})=>Promise<void>}};
declare global {interface Window{TossPayments?:TossFactory}}
let sdkPromise:Promise<void>|null=null;
async function loadSdk(){
  if(window.TossPayments)return;
  if(!sdkPromise)sdkPromise=new Promise<void>((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://js.tosspayments.com/v2/standard';
    script.onload=()=>resolve();script.onerror=()=>{script.remove();sdkPromise=null;reject(new Error('결제창을 불러오지 못했어요. 네트워크를 확인해 주세요.'));};document.head.appendChild(script);
  });
  await sdkPromise;
}
export async function billingRequest(body:unknown){
  const response=await fetch('/api/subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json() as {error?:string;clientKey:string;customerKey:string;successUrl:string;failUrl:string};if(!response.ok)throw new Error(data.error||'요청을 처리하지 못했어요.');return data;
}
const date=(n:number)=>new Date(n).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric'});
export function SubscriptionScreen(){
  const [data,setData]=useState<Status|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false),[cancelOpen,setCancelOpen]=useState(false);
  async function refresh(){const response=await fetch('/api/subscription',{cache:'no-store'});const result=await response.json() as Status&{error?:string};if(!response.ok)throw new Error(result.error);setData(result);}
  useEffect(()=>{fetch('/api/subscription',{cache:'no-store'}).then(async response=>{const result=await response.json() as Status&{error?:string};if(!response.ok)throw new Error(result.error);setData(result);}).catch(e=>setError(e.message));},[]);
  async function action(kind:string){
    setBusy(true);setError('');
    try{
      if(kind==='start'){
        await loadSdk();const result=await billingRequest({action:'start',consent});
        await window.TossPayments!(result.clientKey).payment({customerKey:result.customerKey}).requestBillingAuth({method:'CARD',successUrl:result.successUrl,failUrl:result.failUrl});
      }else{await billingRequest({action:kind});setCancelOpen(false);await refresh();}
    }catch(e){setError(e instanceof Error?e.message:'잠시 후 다시 시도해 주세요.');}
    finally{setBusy(false);}
  }
  const sub=data?.subscription;
  const paidThrough=!!sub?.paidThrough;
  const canStart=data?.configured&&(!sub||sub.status==='pending'||(sub.status==='canceled'&&!paidThrough));
  return <main className="subscription-shell">
    <a className="subscription-back" href="/?view=account"><ArrowLeft size={19}/> 내 정보로</a>
    <header><span className="subscription-test">테스트 결제 · 실제 청구 없음</span><h1>현장 일에 집중하세요</h1><p>현장 10개까지 무료로 시작하고, 11번째부터 구독하세요.</p></header>
    <section className="subscription-plan" aria-label="설비노트 구독">
      <div className="row"><h2>설비노트</h2><CreditCard size={26}/></div>
      <p className="subscription-price">9,900<span>원 / 월</span></p><p className="subscription-tax">부가세 포함</p>
      <ul>{['현장 개수 제한 없이 등록','현장 관리와 사진·음성 작업 기록','견적서 작성과 PDF 출력','영수증 인식과 자재 구매 내역 관리'].map(t=><li key={t}><Check size={20}/>{t}</li>)}</ul>
      <div className="subscription-terms"><p>무료 현장은 완료된 현장을 포함해 계정당 10개입니다. 구독이 끝나도 기존 현장 조회·수정은 가능하며, 10개 이상이면 새 현장 등록에 구독이 필요합니다.</p><p>첫 테스트 결제 후 매월 같은 날짜에 9,900원이 결제됩니다. 해당 날짜가 없는 달에는 말일에 결제됩니다.</p><p>언제든 자동결제를 해지할 수 있으며, 결제한 이용 기간은 유지됩니다.</p></div>
      {data&&!data.configured&&<p className="notice">테스트 결제 연결을 준비하고 있어요. 기존 현장 기능은 계속 사용할 수 있어요.</p>}
      {data?.configured&&!data.renewalsEnabled&&<p className="notice">현재 첫 결제 테스트 단계예요. 매월 자동 갱신은 서버 연결 후 활성화됩니다.</p>}
      {canStart&&<><label className="subscription-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={busy}/><span>월 9,900원과 정기결제·해지 안내를 확인했어요.</span></label><button className="btn primary" onClick={()=>action('start')} disabled={busy||!consent}>{busy?'결제창을 준비하고 있어요…':'월 9,900원 테스트 구독 시작'}</button></>}
      {!data&&!error&&<output>구독 정보를 불러오고 있어요…</output>}
    </section>
    {error&&<div className="subscription-error" role="alert">{error}<button className="btn secondary" disabled={busy} onClick={()=>{setError('');refresh().catch(e=>setError(e.message));}}>구독 정보 새로고침</button></div>}
    {sub&&sub.status!=='pending'&&<section className="panel stack"><h2>내 구독</h2><span className="tag">{{active:'테스트 구독 이용 중',past_due:'결제 확인 필요',canceled:paidThrough?'자동결제 해지됨':'구독 종료'}[sub.status]}</span>
      {sub.card&&<p>결제 수단: {sub.card}</p>}{sub.periodEnd&&<p>{sub.status==='canceled'?'이용 종료일':'현재 이용 기간 종료일'}: {date(sub.periodEnd)}</p>}
      {sub.status==='active'&&data?.renewalsEnabled&&sub.periodEnd&&<p>다음 결제: {date(sub.periodEnd)} · 9,900원</p>}
      {sub.canRetry&&<button className="btn primary" disabled={busy} onClick={()=>action('retry')}>{busy?'확인 중…':'결제 내역 확인 및 다시 시도'}</button>}
      {sub.status!=='canceled'&&!cancelOpen&&<button className="btn secondary" disabled={busy} onClick={()=>setCancelOpen(true)}>자동결제 해지</button>}
      {cancelOpen&&<div className="notice stack"><p>다음 자동결제를 중단할까요? 이미 결제한 기간은 유지되며 현장 자료는 삭제되지 않아요.</p><button className="btn secondary" disabled={busy} onClick={()=>action('cancel')}>{busy?'해지 처리 중…':'자동결제 해지하기'}</button><button className="btn secondary" disabled={busy} onClick={()=>setCancelOpen(false)}>계속 이용하기</button></div>}
    </section>}
    {!!data?.payments.length&&<section className="panel stack"><h2>테스트 결제 내역</h2><ul className="subscription-history">{data.payments.map(p=><li key={p.orderId}><div><strong>{p.amount.toLocaleString()}원</strong><span>{date(p.created)}</span></div><span>{{done:'결제 완료',pending:'확인 중',failed:'결제 실패',review:'확인 필요'}[p.status]||'확인 중'}</span></li>)}</ul></section>}
    <p className="subscription-foot"><ShieldCheck size={19}/> 카드 정보는 토스페이먼츠 결제창에서 입력합니다. 현재 결제는 테스트용이며 실제 요금이 청구되지 않습니다.</p>
  </main>;
}
