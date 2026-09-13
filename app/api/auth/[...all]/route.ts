import {getAuth} from '@/lib/auth';
function handler(req:Request){
 try{return getAuth().handler(req)}catch{return Response.json({error:'로그인 연결을 준비 중입니다. 잠시 후 다시 이용해 주세요.'},{status:503});}
}
export const GET=handler;
export const POST=handler;
