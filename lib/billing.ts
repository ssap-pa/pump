// Portable server-only service: also used by the Cloudflare scheduled Worker.
export const MONTHLY_PRICE = 9900;
const DAY = 86400000;
const KST = 9 * 3600000;
export interface BillingEnv {
  DB: D1Database;
  TOSS_CLIENT_KEY?: string;
  TOSS_SECRET_KEY?: string;
  BILLING_ENCRYPTION_KEY?: string;
  BILLING_ORIGIN?: string;
  BILLING_RENEWALS_ENABLED?: string;
}
type Subscription = {
  id: string; customerKey: string; status: 'pending'|'active'|'past_due'|'canceled';
  encryptedKey?: string; card?: string; state?: string; expires?: number;
  anchor?: number; cycle: number; periodEnd?: number; consentAt: number;
};
type Invoice = {
  orderId: string; amount: number; status: 'pending'|'done'|'failed'|'review';
  created: number; approvedAt?: string; paymentKey?: string; cycle: number;
  periodEnd: number; errorCode?: string;
};
type ProviderResponse = {code?:string;status?:string;orderId?:string;totalAmount?:number;currency?:string;paymentKey?:string;approvedAt?:string;customerKey?:string;billingKey?:string;card?:{number?:string}};
export class BillingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
class ProviderError extends Error {
  constructor(public code: string, public status: number) { super('결제사 요청을 처리하지 못했습니다.'); }
}
export function configured(e: BillingEnv) {
  return !!(e.TOSS_CLIENT_KEY?.startsWith('test_ck_') && e.TOSS_SECRET_KEY?.startsWith('test_sk_') &&
    /^[a-f0-9]{64}$/.test(e.BILLING_ENCRYPTION_KEY || '') && e.BILLING_ORIGIN);
}
function requireConfig(e: BillingEnv) {
  if (!configured(e)) throw new BillingError('테스트 결제 연결을 준비하고 있어요. 설정 완료 후 다시 이용해 주세요.', 503);
}
export function nextMonth(anchor: number, month: number) {
  const date = new Date(anchor + KST);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + month, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(date.getUTCDate(), last),
    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()) - KST;
}
async function cipherKey(e: BillingEnv) {
  const raw = Uint8Array.from(e.BILLING_ENCRYPTION_KEY!.match(/../g)!, v => parseInt(v, 16));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(e: BillingEnv, value: string, owner: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(owner)}, await cipherKey(e), new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...iv)) + '.' + btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
async function unseal(e: BillingEnv, value: string, owner: string) {
  const [iv, bytes] = value.split('.').map(s => Uint8Array.from(atob(s), c => c.charCodeAt(0)));
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(owner)}, await cipherKey(e), bytes));
}
async function provider(e: BillingEnv, path: string, method: string, body?: unknown, key?: string): Promise<ProviderResponse> {
  requireConfig(e);
  const response = await fetch('https://api.tosspayments.com/v1/' + path, {
    method, headers: {'Authorization':'Basic '+btoa(e.TOSS_SECRET_KEY+':'), 'Content-Type':'application/json', ...(key ? {'Idempotency-Key':key} : {})},
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(65000),
  });
  if (response.ok && method === 'DELETE') return {};
  const data = await response.json() as ProviderResponse;
  if (!response.ok) throw new ProviderError(String(data.code || 'UNKNOWN'), response.status);
  return data;
}
async function read(e: BillingEnv, owner: string): Promise<Subscription|null> {
  const row = await e.DB.prepare('SELECT data FROM subscriptions WHERE owner=?').bind(owner).first<{data:string}>();
  return row ? JSON.parse(row.data) : null;
}
async function locked<T>(e: BillingEnv, owner: string, action: (s: Subscription|null, token: string) => Promise<T>): Promise<T> {
  const token = crypto.randomUUID();
  await e.DB.prepare("INSERT OR IGNORE INTO subscriptions(owner,data) VALUES(?, 'null')").bind(owner).run();
  const result = await e.DB.prepare('UPDATE subscriptions SET lock_token=?,lock_until=? WHERE owner=? AND lock_until<?')
    .bind(token,Date.now()+300000,owner,Date.now()).run();
  if (!result.meta.changes) throw new BillingError('결제를 처리하고 있어요. 잠시 후 내역을 확인해 주세요.',409);
  try { return await action(await read(e,owner),token); }
  finally { await e.DB.prepare('UPDATE subscriptions SET lock_token=NULL,lock_until=0 WHERE owner=? AND lock_token=?').bind(owner,token).run(); }
}
async function save(e: BillingEnv, owner: string, s: Subscription, due: number, token: string) {
  const r = await e.DB.prepare('UPDATE subscriptions SET data=?,due_at=? WHERE owner=? AND lock_token=? AND lock_until>?')
    .bind(JSON.stringify(s),due,owner,token,Date.now()).run();
  if (!r.meta.changes) throw new BillingError('처리 결과를 확인 중이에요. 잠시 후 새로고침해 주세요.',409);
}
export async function billingStatus(e: BillingEnv, owner: string) {
  const s = await read(e,owner);
  const invoices = await e.DB.prepare('SELECT data FROM subscription_payments WHERE owner=? ORDER BY created DESC LIMIT 24').bind(owner).all<{data:string}>();
  return { configured:configured(e), testMode:true, amount:MONTHLY_PRICE,
    renewalsEnabled:e.BILLING_RENEWALS_ENABLED==='true',
    subscription:s ? {status:s.status,card:s.card,periodEnd:s.periodEnd,paidThrough:(s.periodEnd||0)>Date.now(),canRetry:!!s.encryptedKey && s.status==='past_due'} : null,
    payments:invoices.results.map(r => {const p:Invoice=JSON.parse(r.data);return {orderId:p.orderId,amount:p.amount,status:p.status,created:p.created,approvedAt:p.approvedAt};}),
  };
}
export async function startBilling(e: BillingEnv, owner: string) {
  requireConfig(e);
  return locked(e,owner,async (old,token) => {
    if (old && (old.status==='active' || old.encryptedKey || (old.periodEnd||0)>Date.now()))
      throw new BillingError('기존 구독 상태를 먼저 확인해 주세요.');
    const s:Subscription={id:crypto.randomUUID(),customerKey:crypto.randomUUID(),status:'pending',state:crypto.randomUUID(),expires:Date.now()+600000,cycle:0,consentAt:Date.now()};
    await save(e,owner,s,0,token);
    return {clientKey:e.TOSS_CLIENT_KEY,customerKey:s.customerKey,
      successUrl:e.BILLING_ORIGIN+'/billing/return?state='+s.state,
      failUrl:e.BILLING_ORIGIN+'/billing/return?failed=1'};
  });
}
async function charge(e: BillingEnv, owner: string, s: Subscription, token: string) {
  if (!s.encryptedKey || s.status==='canceled') throw new BillingError('등록한 결제 수단이 없어요.');
  const now=Date.now();
  s.anchor ||= now;
  const orderId='sn_'+s.id.replaceAll('-','')+'_'+s.cycle;
  const existing=await e.DB.prepare('SELECT data FROM subscription_payments WHERE order_id=?').bind(orderId).first<{data:string}>();
  const invoice:Invoice=existing ? JSON.parse(existing.data) : {orderId,amount:MONTHLY_PRICE,status:'pending',created:now,cycle:s.cycle,periodEnd:nextMonth(s.anchor,s.cycle+1)};
  if (invoice.status==='review') throw new BillingError('이 결제는 확인이 필요해요. 추가 결제는 진행하지 않습니다.',409);
  await e.DB.prepare('INSERT OR IGNORE INTO subscription_payments(order_id,owner,data,created) VALUES(?,?,?,?)').bind(orderId,owner,JSON.stringify(invoice),invoice.created).run();
  await save(e,owner,s,now+DAY,token);
  let result:ProviderResponse|undefined;
  try {
    // Recover a successful charge when the prior response or DB update was lost.
    if (existing) {
      try {result=await provider(e,'payments/orders/'+orderId,'GET');}
      catch (err) { if (!(err instanceof ProviderError && err.code==='NOT_FOUND_PAYMENT')) throw err; }
    }
    if (!result) {
      if (now-invoice.created>14*DAY) {
        invoice.status='review'; throw new BillingError('결제 확인 기간을 초과했어요. 내역 확인이 필요합니다.',409);
      }
      result=await provider(e,'billing/'+encodeURIComponent(await unseal(e,s.encryptedKey,owner)),'POST',
        {customerKey:s.customerKey,amount:MONTHLY_PRICE,orderId,orderName:'설비노트 월 구독 (테스트)'},orderId);
    }
    if (result.status!=='DONE' || result.orderId!==orderId || result.totalAmount!==MONTHLY_PRICE || result.currency!=='KRW' || typeof result.paymentKey!=='string') {
      invoice.status='review'; throw new BillingError('결제 금액 또는 상태를 확인 중이에요.',409);
    }
    invoice.status='done'; invoice.paymentKey=result.paymentKey; invoice.approvedAt=result.approvedAt;
    const next={...s,status:'active' as const,periodEnd:invoice.periodEnd,cycle:s.cycle+1};
    delete next.state; delete next.expires;
    await e.DB.batch([
      e.DB.prepare('UPDATE subscription_payments SET data=? WHERE order_id=?').bind(JSON.stringify(invoice),orderId),
      e.DB.prepare('UPDATE subscriptions SET data=?,due_at=? WHERE owner=? AND lock_token=?').bind(JSON.stringify(next),next.periodEnd,owner,token),
    ]);
  } catch (error) {
    s.status='past_due';
    // Keep unknown outcomes pending; retry only with the original order/key.
    if (error instanceof ProviderError && error.status>=400 && error.status<500 && error.status!==409) invoice.status='failed';
    if (error instanceof ProviderError) invoice.errorCode=error.code;
    await e.DB.prepare('UPDATE subscription_payments SET data=? WHERE order_id=?').bind(JSON.stringify(invoice),orderId).run();
    // No automatic retries after errors. A customer can request reconciliation.
    await save(e,owner,s,0,token);
    if (error instanceof BillingError) throw error;
    throw new BillingError('결제를 완료하지 못했어요. 내역 확인 버튼으로 결과를 다시 확인해 주세요.',502);
  }
}
export async function completeBilling(e: BillingEnv,owner:string,input:{state:string;customerKey:string;authKey:string}) {
  requireConfig(e);
  return locked(e,owner,async(s,token)=>{
    if (!s || s.customerKey!==input.customerKey) throw new BillingError('다른 계정의 결제 요청이에요.',403);
    if (s.status==='active') return;
    if (s.status==='canceled' || !s.state || s.state!==input.state || (s.expires||0)<Date.now()) throw new BillingError('결제 요청이 만료되었어요. 구독 화면에서 다시 시작해 주세요.',403);
    if (!s.encryptedKey) {
      const result=await provider(e,'billing/authorizations/issue','POST',{authKey:input.authKey,customerKey:s.customerKey},'issue_'+s.id);
      if (result.customerKey!==s.customerKey || typeof result.billingKey!=='string') throw new BillingError('카드 등록 결과를 확인할 수 없어요.',502);
      s.encryptedKey=await seal(e,result.billingKey,owner);
      s.card=typeof result.card?.number==='string' ? result.card.number : '등록된 카드';
      await save(e,owner,s,0,token);
    }
    await charge(e,owner,s,token);
  });
}
export async function retryBilling(e: BillingEnv,owner:string) {
  requireConfig(e);
  return locked(e,owner,async(s,token)=>{
    if (!s || s.status!=='past_due') throw new BillingError('확인할 결제가 없어요.');
    await charge(e,owner,s,token);
  });
}
async function revoke(e:BillingEnv,owner:string,s:Subscription,token:string) {
  if (!s.encryptedKey) {await save(e,owner,s,0,token);return;}
  try {
    await provider(e,'billing/'+encodeURIComponent(await unseal(e,s.encryptedKey,owner)),'DELETE');
  } catch(err) {
    if (!(err instanceof ProviderError && ['NOT_FOUND_BILLING_KEY','ALREADY_DELETED_BILLING_KEY'].includes(err.code))) return;
  }
  delete s.encryptedKey;
  await save(e,owner,s,0,token);
}
export async function cancelBilling(e:BillingEnv,owner:string) {
  requireConfig(e);
  return locked(e,owner,async(s,token)=>{
    if (!s) return;
    s.status='canceled'; delete s.state; delete s.expires;
    await save(e,owner,s,Date.now()+DAY,token);
    await revoke(e,owner,s,token);
  });
}
export async function renewSubscriptions(e:BillingEnv) {
  requireConfig(e);
  if(e.BILLING_RENEWALS_ENABLED!=='true') return;
  const due=await e.DB.prepare('SELECT owner FROM subscriptions WHERE due_at>0 AND due_at<=? ORDER BY due_at LIMIT 5').bind(Date.now()).all<{owner:string}>();
  // Sequential and bounded to avoid overwhelming the payment provider.
  for(const row of due.results) {
    try {await locked(e,row.owner,async(s,token)=>{
      if(s?.status==='canceled') await revoke(e,row.owner,s,token);
      else if(s?.status==='active' && (s.periodEnd||0)<=Date.now()) await charge(e,row.owner,s,token);
    });} catch { /* State remains retryable; no customer or payment secrets in logs. */ }
  }
}
