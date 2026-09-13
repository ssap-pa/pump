import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { BillingError,billingStatus,startBilling,completeBilling,cancelBilling,retryBilling } from '@/lib/billing';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET() {
  const user=await getChatGPTUser();
  if(!user) return reply({error:'로그인 후 이용해 주세요.'},401);
  try {return reply(await billingStatus(env,user.userId));}
  catch {return reply({error:'구독 정보를 불러오지 못했어요.'},503);}
}
export async function POST(request:Request) {
  const user=await getChatGPTUser();
  if(!user) return reply({error:'로그인 후 이용해 주세요.'},401);
  const origin=new URL(request.url).origin;
  if(request.headers.get('origin')!==origin || origin!==env.BILLING_ORIGIN) return reply({error:'결제를 시작한 사이트에서 다시 요청해 주세요.'},403);
  try {
    const raw=await request.text();
    if(raw.length>2000) return reply({error:'요청이 너무 큽니다.'},413);
    const body=JSON.parse(raw);
    switch(body.action) {
      case 'start':
        if(body.consent!==true) throw new BillingError('월 요금과 정기결제 안내에 동의해 주세요.');
        return reply(await startBilling(env,user.userId));
      case 'complete':
        if(['state','customerKey','authKey'].some(k=>typeof body[k]!=='string'||!body[k]||body[k].length>300)) throw new BillingError('결제 인증 정보를 확인해 주세요.');
        await completeBilling(env,user.userId,body); break;
      case 'cancel': await cancelBilling(env,user.userId); break;
      case 'retry': await retryBilling(env,user.userId); break;
      default: throw new BillingError('올바르지 않은 요청이에요.');
    }
    return reply({ok:true});
  } catch(error) {
    if(error instanceof BillingError) return reply({error:error.message},error.status);
    return reply({error:'결제를 처리하지 못했어요. 잠시 후 구독 내역을 확인해 주세요.'},502);
  }
}
