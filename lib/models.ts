import type { Item, Rec } from './domain';
export type Supplier = { company?:string; number?:string; ceo?:string; address?:string; business?:string; category?:string; contact?:string; phone?:string };
export type QuoteData = { title:string; date:string; valid:number; vat:boolean; items:Item[]; notes:string; footer:string; supplier:Supplier };
export type Attachment = { id:string; name:string; type:string };
export type NoteData = { date:string; stage:string; text:string; attachments:Attachment[] };
export type EditState = Supplier & { id?:string; name?:string; customer?:string; date?:string; status?:string; scope?:string; label?:string; amount?:number|''; memo?:string };
export type QuoteProps = { draftOwner:string|null; onBlockNavigation:(blocked:boolean)=>void; site:Rec; existing?:Rec; sources?:Rec[]; profile:Supplier; busy:boolean; onSave:(data:QuoteData)=>Promise<boolean> };
export type NotesProps = { onRequireLogin?:()=>void; draftOwner:string|null; onBlockNavigation:(blocked:boolean)=>void; site:Rec; rows:Rec[]; busy:boolean; onSave:(data:NoteData)=>Promise<boolean>; onRefresh:()=>Promise<boolean> };
export type SpeechResultEvent = { resultIndex:number; results:{ length:number; [index:number]:{ isFinal:boolean; [index:number]:{ transcript:string } } } };
export interface SpeechEngine { lang:string; continuous:boolean; interimResults:boolean; onresult:((event:SpeechResultEvent)=>void)|null; onerror:((event:{error:string})=>void)|null; onend:(()=>void)|null; start():void; stop():void; abort():void; }
export type SpeechWindow = Window & { SpeechRecognition?:new()=>SpeechEngine; webkitSpeechRecognition?:new()=>SpeechEngine };
