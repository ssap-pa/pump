import type { NoteData, QuoteData } from './models';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validQuote(v:unknown):v is QuoteData {
  return object(v)&&typeof v.title==='string'&&typeof v.date==='string'&&typeof v.valid==='number'&&typeof v.vat==='boolean'&&typeof v.notes==='string'&&typeof v.footer==='string'&&object(v.supplier)&&Array.isArray(v.items)&&v.items.length<=200&&v.items.every(i=>object(i)&&typeof i.name==='string'&&typeof i.unit==='string'&&typeof i.memo==='string'&&typeof i.qty==='number'&&Number.isFinite(i.qty)&&typeof i.price==='number'&&Number.isFinite(i.price));
}
export function validNote(v:unknown):v is NoteData {
  return object(v)&&typeof v.text==='string'&&typeof v.date==='string'&&typeof v.stage==='string'&&Array.isArray(v.attachments)&&v.attachments.length<=100&&v.attachments.every(a=>object(a)&&typeof a.id==='string'&&typeof a.name==='string'&&typeof a.type==='string');
}
