'use client';
import {useState} from 'react';
import {createAuthClient} from 'better-auth/react';
const auth=createAuthClient();
export default function Logout(){const [error,setError]=useState('');return <main className="panel stack"><h1>로그아웃</h1><button className="btn" onClick={async()=>{try{const r=await auth.signOut();if(r.error)throw Error();location.assign('/login')}catch{setError('로그아웃에 실패했습니다. 다시 시도해 주세요.')}}}>이 기기에서 로그아웃</button>{error&&<p role="alert">{error}</p>}</main>}
