'use client';
/* eslint-disable next/no-html-link-for-pages -- Leave the payment callback with a top-level navigation. */
import {useEffect,useRef,useState} from 'react';
import {billingRequest} from '@/app/subscription/screen';
import '@/app/subscription/subscription.css';
export default function BillingReturn(){
  const started=useRef(false),[message,setMessage]=useState('카드 등록과 결제 결과를 확인하고 있어요…'),[done,setDone]=useState(false);
  useEffect(()=>{
    if(started.current)return;started.current=true;
    const p=new URLSearchParams(location.search);
    const payload={action:'complete',authKey:p.get('authKey'),customerKey:p.get('customerKey'),state:p.get('state')};
    const failed=p.has('failed');
    history.replaceState(null,'','/billing/return');
    // This effect consumes the external payment redirect once, then clears credentials from the URL.
    // eslint-disable-next-line react/react-compiler
    if(failed||!payload.authKey){setMessage('결제가 완료되지 않았어요. 구독 화면에서 다시 시작할 수 있어요.');setDone(true);return;}
    billingRequest(payload).then(()=>setMessage('테스트 구독 결제가 완료됐어요.')).catch(e=>setMessage(e.message)).finally(()=>setDone(true));
  },[]);
  return <main className="subscription-shell"><section className="panel stack"><span className="subscription-test">테스트 결제</span><h1>구독 결제 확인</h1><output>{message}</output>{done&&<a className="btn primary" href="/subscription">구독 내역 확인하기</a>}</section></main>;
}
