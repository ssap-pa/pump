export type PurchaseItem={name:string;quantity:number|null;unitPrice:number|null;amount:number|null};
export type Purchase={fileId:string;vendor:string;date:string;total:number|null;supplyAmount?:number|null;vat?:number|null;discount?:number|null;items:PurchaseItem[];rawText:string;confidence:number;status:'needs_review'|'confirmed';provider?:string;recognizedAt?:string;usage?:{inputTokens:number;outputTokens:number}};
export function receiptBalance(p:Purchase):string{
 if(p.total==null)return '최종 결제액을 원본에서 확인해 주세요.';
 if(p.supplyAmount!=null&&p.vat!=null){
  const difference=p.total-p.supplyAmount-p.vat;
  return difference===0?'공급가액 + 부가세가 최종 결제액과 일치해요.':`공급가액 + 부가세와 최종 결제액의 차이 ${difference.toLocaleString('ko-KR')}원 · 할인 반영 여부와 추가 비용을 확인해 주세요.`;
 }
 if(p.items.some(i=>i.amount===null))return '일부 품목 금액이 없어 합계를 확인할 수 없어요.';
 const sum=p.items.reduce((s,i)=>s+(i.amount??0),0);
 return sum===p.total?'품목 합계가 최종 결제액과 일치해요.':'품목 합계와 최종 결제액이 달라요. 원본의 공급가액·부가세·할인을 확인해 주세요.';
}
const number=(s:string)=>Number(s.replace(/[,\s₩원]/g,''));
export function parseReceipt(text:string,confidence=0):Omit<Purchase,'fileId'>{
 const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);let date='',vendor='',total:number|null=null;
 const match=text.match(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
 if(match){const d=`${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;if(!Number.isNaN(Date.parse(d))&&Number(match[2])<=12&&Number(match[3])<=31)date=d;}
 const vendorLine=lines.find(l=>/^(상호|가맹점명|판매처)\s*[:：]/.test(l));
 if(vendorLine)vendor=vendorLine.replace(/^(상호|가맹점명|판매처)\s*[:：]\s*/,'');
 const amountToken=/\d[\d,]*(?:\.\d+)?/g;
 const items:PurchaseItem[]=[];
 let quantityFirst=false;
 for(const line of lines){
  if(/(수량.*단가|단가.*수량)/.test(line)){quantityFirst=line.indexOf('수량')<line.indexOf('단가');continue;}
  if(/(총\s*합계|총\s*액|결제\s*금액|합계\s*금액|^합\s*계)/.test(line)){const nums=line.match(amountToken);if(nums?.length)total=number(nums.at(-1)!);continue;}
  if(/사업자|등록번호|승인|카드|전화|TEL|주소|대표|상호|가맹점|판매처|거스름|받은|부가세|공급가|과세|면세|할인|적립|포인트|영수증|거래일|일시|합계|총액|현금|결제|쿠폰|취소|반품|상품명|품명|품목명/i.test(line)||/20\d{2}[.\-/]/.test(line))continue;
  // Monetary columns must be separated from the item label by whitespace.
  const m=line.match(/^(.+?\S)\s+((?:[₩]?\d[\d,]*(?:\.\d+)?\s*(?:원)?\s+){0,2}[₩]?\d[\d,]*(?:\.\d+)?\s*(?:원)?)$/);
  if(!m||!/[가-힣a-zA-Z]/.test(m[1])||m[1].length>120)continue;
  const vals=(m[2].match(amountToken)||[]).map(number);const amount=vals.at(-1)!;
  if(!Number.isFinite(amount)||amount<0||amount>1e9)continue;
  let quantity:number|null=null,unitPrice:number|null=null;
  if(vals.length===3){const [a,b]=vals;const q=quantityFirst?a:b,p=quantityFirst?b:a;if(q>=0&&q<=10000&&p>=0&&Math.abs(q*p-amount)<=1){quantity=q;unitPrice=p;}}
  const name=m[1].replace(/^\d{1,3}[.)]?\s+/,'').trim();if(name)items.push({name,quantity,unitPrice,amount});
 }
 return {vendor,date,total,items:items.slice(0,100),rawText:text.slice(0,40000),confidence:Math.max(0,Math.min(100,confidence)),status:'needs_review'};
}
export function validPurchase(v:unknown):v is Purchase{
 if(!v||typeof v!=='object')return false;const p=v as Purchase;
 const n=(x:unknown)=>x===null||(typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1e9);
 return [p.supplyAmount,p.vat,p.discount].every(x=>x===undefined||n(x))&&typeof p.vendor==='string'&&p.vendor.length<=200&&typeof p.date==='string'&&(p.date===''||/^\d{4}-\d{2}-\d{2}$/.test(p.date))&&n(p.total)&&Array.isArray(p.items)&&p.items.length<=100&&p.items.every(i=>i&&typeof i.name==='string'&&i.name.trim().length>0&&i.name.length<=200&&n(i.quantity)&&n(i.unitPrice)&&n(i.amount))&&['needs_review','confirmed'].includes(p.status);
}
