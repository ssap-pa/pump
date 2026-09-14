import type {Rec} from './domain';
export const GUEST_KEY='seolbinote:guest:records:v1';
export function readGuestRecords():Rec[]{
  const raw=localStorage.getItem(GUEST_KEY);
  if(!raw)return [];
  const rows=JSON.parse(raw);
  if(!Array.isArray(rows)||rows.some(r=>!r||typeof r.id!=='string'||typeof r.kind!=='string'||!r.data))throw Error('기기 저장 내용을 읽지 못했어요. 브라우저 데이터를 지우지 말고 문의해 주세요.');
  return rows;
}
export function saveGuestRecord(kind:string,data:unknown,parent='',id?:string){
  const rows=readGuestRecords();
  if(!id&&kind==='site'&&rows.filter(r=>r.kind==='site').length>=10)throw Error('기기에서는 현장 10개까지 무료로 사용할 수 있어요. 로그인 후 계정에 보관해 주세요.');
  const record:Rec={id:id||crypto.randomUUID(),kind,parent,data,created:new Date().toISOString()};
  const next=id?rows.map(r=>r.id===id?{...record,created:r.created}:r):[...rows,record];
  try{localStorage.setItem(GUEST_KEY,JSON.stringify(next));}catch{throw Error('기기 저장 공간이 부족하거나 저장이 차단됐어요. 입력 내용은 닫지 말고 저장 설정을 확인해 주세요.');}
  return {id:record.id};
}
