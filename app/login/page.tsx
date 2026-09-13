'use client';
import {useState} from 'react';
import {createAuthClient} from 'better-auth/react';
const auth=createAuthClient();
export default function Login(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <main style={{maxWidth:440,margin:'12vh auto',padding:24}}><section className="panel stack"><h1>설비노트</h1><p>현장부터 견적, 자재 구매까지 한곳에서 관리하세요.</p><button className="btn primary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const result=await auth.signIn.social({provider:'google',callbackURL:'/'});if(result.error){setError('Google 로그인에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');setBusy(false)}}catch{setError('네트워크 연결을 확인해 주세요.');setBusy(false)}}}>{busy?'Google로 연결 중…':'Google로 로그인'}</button>{error&&<p role="alert">{error}</p>}<p className="muted">로그인한 계정의 현장과 자료만 표시됩니다.</p></section></main>;
}
