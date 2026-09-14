'use client';
/* eslint-disable next/no-html-link-for-pages -- Use full navigation for vinext production and authentication transitions. */
import { useEffect, useState } from 'react';
import { Wrench, Plus, ArrowLeft, ArrowRight, MapPin, Camera, Mic, FileText, Settings, Save, ChevronRight, CalendarDays, CircleCheck, Wallet, Building2, Phone, FolderOpen, Search, LoaderCircle, House, NotebookPen, UserRound, ReceiptText } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster, toast } from 'sonner';
import { Rec, money, total, today } from '@/lib/domain';
import { Quote, Notes, Field, Choice } from './sections';
import { WorkflowPanel } from './workflow-panels';
import { PaymentInbox } from './payment-inbox';
import { useDeskNavigation } from '@/lib/use-desk-navigation';
import type { EditState, Supplier } from '@/lib/models';
import { Receipts, ReceiptDialog } from './receipts';
import { SiteFiles, UploadDialog, type UploadKind } from './site-files';

import {readGuestRecords,saveGuestRecord,GUEST_KEY} from '@/lib/guest-records';

const stages = ['견적 대기', '방문 예정', '시공 중', '작업 완료', '정산 완료'];
async function call<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({ error: '연결을 확인하고 다시 시도해 주세요.' }));
  if (!response.ok && (body as {code?:string}).code === 'SITE_LIMIT_REACHED') toast.error((body as {error:string}).error, { duration: 10000, action: { label: '구독 안내', onClick: () => { window.location.href = '/subscription'; } } });
  if (!response.ok) throw new Error((body as {error?:string}).error || '저장하지 못했습니다. 다시 시도해 주세요.');
  return body as T;
}
const badgeTone = (status: string) => status === '시공 중' ? 'green' : status === '견적 대기' ? 'amber' : status === '정산 완료' ? 'gray' : 'mint';

function SignInLink() {
  // eslint-disable-next-line next/no-html-link-for-pages -- Sites sign-in requires a top-level navigation and must not be prefetched.
  return <a href="/login" target="_top">로그인</a>;
}

export default function Desk({draftOwner}:{draftOwner:string|null}) {
  const guest=!draftOwner;
  const [loginReason,setLoginReason]=useState('');
  const [guestCount,setGuestCount]=useState(0);
  const [rows, setRows] = useState<Rec[]>([]);

  const [receiptOpen,setReceiptOpen]=useState(false);
  const [uploadKind,setUploadKind]=useState<UploadKind|null>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);

  const [modal, setModal] = useState(''), [edit, setEdit] = useState<EditState>({});
  const [editorBlocked,setEditorBlocked]=useState(false);
  const [createdSite,setCreatedSite]=useState<string|null>(null);
  const {route,go,backToList}=useDeskNavigation(busy||editorBlocked||!!modal);
  const {area,site:active,tab,filter,search}=route;
  // eslint-disable-next-line react/react-compiler -- Open the newly saved site once the modal and save lock have cleared.
  useEffect(()=>{if(createdSite&&!busy&&!modal){go({site:createdSite,tab:"overview"});setCreatedSite(null);}},[createdSite,busy,modal,go]);
  const setTab=(tab:string)=>go({tab});
  const setFilter=(filter:string)=>go({filter},true);
  const setSearch=(search:string)=>go({search},true);
  useEffect(()=>{if(!busy&&!editorBlocked)return;const prevent=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent);},[busy,editorBlocked]);
  async function refresh() {
    try { setRows(guest?readGuestRecords():await call<Rec[]>('/api/records')); setError(''); return true; }
    catch (e) { setError((e as Error).message); return false; }
    finally { setReady(true); }
  }
  useEffect(() => { let cancelled=false;
    Promise.resolve().then(()=>guest?readGuestRecords():call<Rec[]>('/api/records')).then(data=>{if(!cancelled){setRows(data);setError('');}}).catch((e:Error)=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setReady(true);});
    Promise.resolve().then(()=>{if(!cancelled)setGuestCount(readGuestRecords().length);}).catch(()=>{});
    return ()=>{cancelled=true;}; }, [guest]);
  async function importGuest(){
    if(busy)return;setBusy(true);
    try{
      const pending=readGuestRecords(); const mapped=new Map<string,string>();
      for(const r of [...pending.filter(r=>r.kind==='site'),...pending.filter(r=>r.kind!=='site')]){
        const result=await call<{id:string}>('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:r.kind,data:r.data,parent:r.parent?mapped.get(r.parent):'',guestId:r.id})});
        mapped.set(r.id,result.id);
      }
      localStorage.removeItem(GUEST_KEY);setGuestCount(0);await refresh();go({site:null});toast.success('기기 기록을 계정에 보관했어요.');
    }catch(e){toast.error((e as Error).message+' 기기 원본은 유지됩니다.');}finally{setBusy(false);}
  }
  const requestLogin=()=>setLoginReason('사진·녹음 파일과 영수증 AI 인식은 로그인 후 사용할 수 있어요. 먼저 기기의 현장을 계정에 보관해 주세요.');

  const sites = rows.filter(r => r.kind === 'site'), site = sites.find(r => r.id === active);
  const profile = rows.find(r => r.kind === 'profile');
  const quote = (id: string) => rows.find(r => r.kind === 'quote' && r.parent === id);
  const paid = (id: string) => rows.filter(r => r.kind === 'payment' && r.parent === id).reduce((n, r) => n + r.data.amount, 0);
  const balance = (id: string) => Math.max(0, total(quote(id)?.data) - paid(id));
  const openSites = sites.filter(s => !['작업 완료', '정산 완료'].includes(s.data.status));
  const upcoming = [...openSites].sort((a, b) => (a.data.date || '9999').localeCompare(b.data.date || '9999'))[0];
  const balanceTotal = sites.reduce((n, s) => n + balance(s.id), 0);
  const monthPaid = rows.filter(r => r.kind === 'payment' && r.data.date?.slice(0, 7) === today().slice(0, 7)).reduce((n, r) => n + r.data.amount, 0);
  const visibleSites = sites.filter(s => (filter === '전체' || s.data.status === filter) && `${s.data.name} ${s.data.customer} ${s.data.address}`.toLowerCase().includes(search.trim().toLowerCase()));
  const dayLabel = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' }).format(new Date());
  const disabled = !ready || !!error || busy || editorBlocked;
  function enter(id: string, next = 'overview') { go({site:id,tab:next}); }
  function home() { navigate('today'); }
  function navigate(next:string){go({site:null,area:next});}
  async function save(kind: string, data: unknown, parent = '', id?: string) {
    if(guest)return saveGuestRecord(kind,data,parent,id);
    return call<{id:string}>('/api/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, data, parent, id }) });
  }
  async function task(fn: () => Promise<void>) {
    if (busy) return false;
    setBusy(true);
    try { await fn(); await refresh(); toast.success(guest?'이 기기에 저장했어요.':'저장했어요.'); return true; }
    catch (e) { toast.error((e as Error).message); return false; }
    finally { setBusy(false); }
  }
  function openSite(s?: Rec) {
    setEdit(s ? { ...s.data, id: s.id } : { name: '', customer: '', phone: '', address: '', date: today(), status: '견적 대기', scope: '' });
    setModal('site');
  }
  function openProfile() {
    setEdit(profile ? { ...profile.data } : { company: '', number: '', ceo: '', address: '', business: '건설업', category: '설비, 수도배관', contact: '', phone: '' });
    setModal('profile');
  }
  function openPayment(record?: Rec) {
    setEdit(record ? { ...record.data, id: record.id } : { date: today(), label: '계약금', amount: '', memo: '' });
    setModal('payment');
  }
  const payments = rows.filter(r => r.kind === 'payment' && r.parent === active).sort((a, b) => b.data.date.localeCompare(a.data.date));

  return <>
    <Toaster position="top-center" richColors />
    <header className="top">
      <div className="top-inner">
        <button className="brand linkbutton" onClick={home} aria-label="설비노트 홈"><span className="logo"><Wrench size={24} strokeWidth={2.4} /></span>설비노트<span className="brand-divider" /><span className="brand-caption">사장님의 현장 파트너</span></button>
        <div className="actions"><span className="account-label">{profile?.data.company || '내 작업 공간'}</span><button className="icon-button" disabled={disabled} onClick={openProfile} aria-label="사업자 정보"><Settings size={21} /></button></div>
      </div>
    </header>
    <Tabs value={active?'sites':area} onValueChange={v=>navigate(String(v))} className="app-navigation noprint"><TabsList className="app-nav" aria-label="주 메뉴">{[{id:'today',label:'오늘',icon:<House size={21}/>},{id:'sites',label:'현장',icon:<Building2 size={21}/>},{id:'records',label:'기록',icon:<NotebookPen size={21}/>},{id:'account',label:'내 정보',icon:<UserRound size={21}/>}].map(n=><TabsTrigger value={n.id} key={n.id}>{n.icon}<span>{n.label}</span></TabsTrigger>)}</TabsList></Tabs>
    <main className="shell">
      {guest&&<section className="notice noprint"><strong>로그인 없이 바로 시작하세요</strong><p>현장·견적·메모는 이 브라우저에 저장됩니다. 브라우저 데이터를 삭제하면 사라져요. 로그인하면 계정으로 옮겨 다른 기기에서도 사용할 수 있어요.</p><button className="btn" onClick={()=>setLoginReason('작성한 기록을 계정에 보관하고 다른 기기에서도 이어서 사용하세요.')}>로그인하고 클라우드에 보관</button></section>}
      {!guest&&guestCount>0&&<section className="notice noprint"><strong>이 기기에서 작성한 기록이 있어요</strong><p>기존 계정 기록은 유지하며 추가합니다. 옮기기에 실패해도 기기 원본은 남습니다.</p><button className="btn" disabled={busy||editorBlocked||!!modal} onClick={importGuest}>{busy?'옮기는 중…':'기기 기록을 내 계정으로 옮기기'}</button></section>}
      {ready&&!error&&!active&&<p className="notice noprint">등록한 현장 {sites.length}개 · 현장 10개까지 무료, 11개부터 월 9,900원 구독으로 이용하세요. <a href="/subscription">구독 안내</a></p>}
      {editorBlocked&&<output className="notice noprint">이동하기 전에 작성 내용을 저장하거나 녹음을 업로드해 주세요. 파일 전송 중에는 잠시 기다려 주세요.</output>}
      {error && <div className="error" role="alert"><span>{error}</span><button className="linkbutton" onClick={refresh}>다시 불러오기</button>{error.includes('로그인') && <SignInLink />}</div>}
      {!active ? <>
        {area==='today'&&<>
        <>{ready&&!error&&<WorkflowPanel rows={rows} onCreate={()=>openSite()} onEnter={enter}/>}</><div className="heading home-heading"><div><p className="eyebrow">{dayLabel}</p><h1>오늘도, 한 현장씩 차근차근.</h1><p className="muted">견적부터 작업 기록, 마무리 정산까지.</p></div><button className="btn primary" disabled={disabled} onClick={() => openSite()}><Plus size={19} />새 현장</button></div>
        <div className="upload-shortcuts"><button className="upload-shortcut" disabled={disabled} onClick={()=>guest?requestLogin():setUploadKind('photo')}><span className="icon-tile"><Camera size={23}/></span><span><strong>현장 사진 올리기</strong><small>사진 선택 · 휴대폰 촬영</small></span><ArrowRight size={19}/></button><button className="upload-shortcut" disabled={disabled} onClick={()=>guest?requestLogin():setUploadKind('quote')}><span className="icon-tile"><FileText size={23}/></span><span><strong>견적서 올리기</strong><small>PDF · 이미지 · 엑셀</small></span><ArrowRight size={19}/></button></div>
        <button className="receipt-shortcut" disabled={disabled} onClick={()=>guest?requestLogin():setReceiptOpen(true)}><span className="icon-tile"><ReceiptText size={25}/></span><span><strong>영수증으로 자재 구매 내역 남기기</strong><small>사진을 읽어 품목과 금액을 자동으로 저장해요</small></span><ArrowRight size={21}/></button>
        <section className="dashboard-top" aria-label="오늘의 현장과 정산">
          <div className="focus-card">
            <div className="row"><span className="eyebrow"><span className="live-dot" />{upcoming ? '다음으로 챙길 현장' : '새로운 현장 시작하기'}</span>{upcoming && <span className={'tag ' + badgeTone(upcoming.data.status)}>{upcoming.data.status}</span>}</div>
            {!ready ? <div className="stack focus-content"><Skeleton className="h-9 w-3/4" /><Skeleton className="h-5 w-1/2" /></div> : <div className="focus-content"><h2>{upcoming?.data.name || (sites.length ? '진행 중인 현장이 없어요' : '첫 현장을 등록해 주세요')}</h2><p>{upcoming ? upcoming.data.scope || '현장 정보와 필요한 작업을 확인해 보세요.' : '현장별로 견적서와 사진, 작업 내용을 모아둘 수 있어요.'}</p>{upcoming && <div className="focus-meta"><span><CalendarDays size={16} />{upcoming.data.date || '일정 미정'}</span><span><MapPin size={16} />{upcoming.data.address || '주소 미등록'}</span></div>}</div>}
            <div className="focus-bottom"><button className="btn primary" disabled={disabled} onClick={() => upcoming ? enter(upcoming.id, 'notes') : openSite()}>{upcoming ? <Mic size={19} /> : <Plus size={19} />}{upcoming ? '작업 기록 남기기' : '현장 등록하기'}<ArrowRight size={18} /></button>{upcoming && <button className="linkbutton" onClick={() => enter(upcoming.id)}>현장 살펴보기<ChevronRight size={17} /></button>}</div>
          </div>
          <div className="balance-card"><div className="row"><span className="icon-tile"><Wallet size={22} /></span><span className="muted">정산 현황</span></div><p className="balance-label">아직 받을 금액</p><strong className="balance-number">{ready ? money(balanceTotal) : '—'}<span>원</span></strong><div className="balance-divider" /><div className="row"><span className="muted">이번 달 입금</span><strong>{ready ? money(monthPaid) : '—'}원</strong></div><p className="balance-hint">저장한 견적과 입금 내역을 기준으로 계산해요.</p></div>
        </section>
        {ready&&!error&&<PaymentInbox rows={rows} onEnter={enter}/>}<section className="stats" aria-label="현장 요약">{[
          { label: '진행 중 현장', value: openSites.length, icon: <Building2 size={20} />, tone: 'mint' },
          { label: '견적 대기', value: sites.filter(s => s.data.status === '견적 대기').length, icon: <FileText size={20} />, tone: 'amber' },
          { label: '작업 완료', value: sites.filter(s => ['작업 완료', '정산 완료'].includes(s.data.status)).length, icon: <CircleCheck size={20} />, tone: 'purple' }
        ].map(s => <div className="stat" key={s.label}><span className={'icon-tile ' + s.tone}>{s.icon}</span><span>{s.label}</span><strong>{ready ? s.value : '—'}<small>곳</small></strong></div>)}</section>
        {!profile && ready && !error && <div className="intro"><span className="icon-tile"><FileText size={22} /></span><div className="intro-copy"><h2>견적서에 내 사업자 정보를 넣어보세요</h2><p>한 번 등록하면 견적을 작성할 때 자동으로 채워져요.</p></div><button className="linkbutton" onClick={openProfile}>정보 등록<ChevronRight size={17} /></button></div>}
        </>}
        {(area==='today'||area==='sites')&&<section className="site-section">
          {area==='sites'&&<div className="heading"><div><p className="eyebrow">견적부터 정산까지</p><h1>내 현장</h1></div><button className="btn primary" disabled={disabled} onClick={()=>openSite()}><Plus size={18}/>새 현장</button></div>}
          <div className="section-heading"><h2>내 현장 <span className="count">{sites.length}</span></h2><label className="searchbox"><Search size={18} /><input aria-label="현장 검색" placeholder="현장명, 고객, 주소 검색" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
          <Tabs value={filter} onValueChange={v => setFilter(String(v))}><TabsList className="filter-tabs">{['전체', ...stages].map(s => <TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}</TabsList></Tabs>
          {!ready ? <div className="site-grid">{[1, 2, 3].map(i => <Skeleton key={i} className="h-56 rounded-3xl" />)}</div> : visibleSites.length === 0 ? <div className="panel empty"><span className="empty-icon"><FolderOpen size={32} /></span><h3>{sites.length ? '조건에 맞는 현장이 없어요' : '현장 기록, 여기서 시작해요'}</h3><p>{sites.length ? '검색어나 진행 상태를 바꿔보세요.' : '고객과 공사 정보를 입력하면 견적과 작업 기록을 연결할 수 있어요.'}</p>{sites.length ? <button className="btn" onClick={() => { setFilter('전체'); setSearch(''); }}>전체 현장 보기</button> : <button className="btn" disabled={disabled} onClick={() => openSite()}><Plus size={17} />첫 현장 등록</button>}</div> : <div className="site-grid">{visibleSites.map(s => <button className="sitecard" key={s.id} onClick={() => enter(s.id)}><div className="row"><span className={'tag ' + badgeTone(s.data.status)}>{s.data.status}</span><ChevronRight size={19} className="subtle" /></div><h3>{s.data.name}</h3><p className="muted customer-name">{s.data.customer || '고객 미등록'}</p><div className="site-meta"><span><MapPin size={15} />{s.data.address || '주소 미등록'}</span><span><CalendarDays size={15} />{s.data.date || '일정 미정'}</span></div><div className="row site-money"><span>견적 합계</span><strong>{quote(s.id) ? money(total(quote(s.id)?.data)) + '원' : '작성 전'}</strong></div></button>)}</div>}
        </section>}
        {area==='records'&&<section className="stack"><div className="heading"><div><p className="eyebrow">차곡차곡 쌓인 작업</p><h1>작업 기록</h1><p className="muted">현장의 사진과 메모를 다시 확인하세요.</p></div><button className="btn primary" disabled={disabled} onClick={()=>navigate('sites')}><Plus size={18}/>기록할 현장 선택</button></div>{rows.filter(r=>r.kind==='note').length===0?<div className="panel empty"><span className="empty-icon"><NotebookPen size={30}/></span><h3>아직 작업 기록이 없어요</h3><p>현장을 선택하고 오늘 한 일을 남겨보세요.</p></div>:rows.filter(r=>r.kind==='note').sort((a,b)=>(b.data.date||b.created).localeCompare(a.data.date||a.created)).map(r=><button className="record-card" key={r.id} onClick={()=>enter(r.parent,'notes')}><span className="icon-tile"><NotebookPen size={22}/></span><div><span className="muted">{r.data.date} · {sites.find(s=>s.id===r.parent)?.data.name||'현장'}</span><h3>{r.data.stage}</h3><p>{r.data.text||'첨부파일 기록'}</p><span className="muted">첨부 {(r.data.attachments||[]).length}개</span></div><ChevronRight size={20}/></button>)}</section>}
        {area==='account'&&<section className="account-page stack"><div><p className="eyebrow">내 사업의 기본 정보</p><h1>내 정보</h1></div><div className="panel stack"><h2>휴대폰 홈 화면에 추가</h2><p>iPhone은 Safari의 공유 메뉴에서, Android는 Chrome 메뉴에서 ‘홈 화면에 추가’ 또는 ‘앱 설치’를 선택하세요.</p><p className="muted">현장 저장·사진 업로드·영수증 인식에는 인터넷 연결이 필요합니다.</p></div><div className="panel stack"><div className="row"><span className="icon-tile"><Building2 size={26}/></span><span className="tag">견적서 공급자 정보</span></div><h2>{profile?.data.company||'사업자 정보를 등록해 주세요'}</h2><p className="muted">견적서를 작성할 때 자동으로 채워져요.</p><dl className="profile-list">{[['대표자',profile?.data.ceo],['사업자등록번호',profile?.data.number],['소재지',profile?.data.address],['연락처',profile?.data.phone]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v||'미등록'}</dd></div>)}</dl><button className="btn primary" disabled={disabled} onClick={openProfile}><Settings size={18}/>{profile?'사업자 정보 수정':'사업자 정보 등록'}</button></div><a className="panel row" href="/subscription"><div><h2>설비노트 구독</h2><p className="muted">월 9,900원 · 테스트 결제와 구독 관리</p></div><span aria-hidden="true">→</span></a><div className="notice">저장한 견적의 공급자 정보는 작성 당시 값으로 유지돼요. 변경한 정보를 반영하려면 견적 편집에서 ‘최신 사업자 정보 적용’을 눌러 주세요.</div></section>}
      </> : site ? <>
        <button className="linkbutton back-link" onClick={backToList}><ArrowLeft size={17} />{area==='records'?'작업 기록으로':area==='today'?'오늘 화면으로':'내 현장으로'}</button>
        <div className="heading detail-heading"><div><span className={'tag ' + badgeTone(site.data.status)}>{site.data.status}</span><h1>{site.data.name}</h1><p className="muted">{site.data.customer || '고객 미등록'} · {site.data.date || '일정 미정'}</p></div><button className="btn" disabled={busy} onClick={() => openSite(site)}><Settings size={17} />현장 정보 수정</button></div>
        <div className="upload-shortcuts"><button className="upload-shortcut" disabled={disabled} onClick={()=>guest?requestLogin():setUploadKind('photo')}><span className="icon-tile"><Camera size={23}/></span><span><strong>현장 사진 올리기</strong><small>사진 선택 · 휴대폰 촬영</small></span><ArrowRight size={19}/></button><button className="upload-shortcut" disabled={disabled} onClick={()=>guest?requestLogin():setUploadKind('quote')}><span className="icon-tile"><FileText size={23}/></span><span><strong>견적서 올리기</strong><small>PDF · 이미지 · 엑셀</small></span><ArrowRight size={19}/></button></div>
        <Tabs value={tab} onValueChange={v => setTab(String(v))}>
          <TabsList className="tabsbar"><TabsTrigger value="overview"><Building2 size={17} />현장 정보</TabsTrigger><TabsTrigger value="quote"><FileText size={17} />견적서</TabsTrigger><TabsTrigger value="notes"><Mic size={17} />사진 · 음성 기록</TabsTrigger><TabsTrigger value="purchases"><ReceiptText size={17}/>자재 구매</TabsTrigger><TabsTrigger value="payments"><Wallet size={17} />수금 관리</TabsTrigger></TabsList>
          <TabsContent value="overview"><div className="detail-grid"><div className="panel stack"><div className="row"><h2>공사 정보</h2><span className="icon-tile"><Building2 size={21} /></span></div><div className="info-item"><MapPin size={19} /><div><p className="muted">현장 주소</p><p>{site.data.address || '등록된 주소가 없어요.'}</p></div></div><div className="info-item"><Phone size={19} /><div><p className="muted">고객 연락처</p><p>{site.data.phone ? <a href={'tel:' + site.data.phone}>{site.data.phone}</a> : '등록된 연락처가 없어요.'}</p></div></div><div className="scope-box"><p className="muted">공사 범위 · 특이사항</p><p>{site.data.scope || '현장 정보 수정에서 공사 범위를 남겨보세요.'}</p></div></div><div className="panel stack"><h2>현장 정산</h2><div className="row"><span className="muted">견적 합계</span><strong>{money(total(quote(site.id)?.data))}원</strong></div><div className="row"><span className="muted">입금 완료</span><strong>{money(paid(site.id))}원</strong></div><div className="settlement-total row"><span>남은 금액</span><strong>{money(balance(site.id))}원</strong></div><div className="stack quick-actions"><button className="btn primary" onClick={() => setTab('quote')}><FileText size={18} />견적 작성하기<ArrowRight size={18} /></button><button className="btn" onClick={() => setTab('notes')}><Camera size={18} />사진 · 음성으로 기록하기</button></div></div></div></TabsContent>
          <TabsContent value="quote"><div className="stack">{guest?<button className="btn" onClick={requestLogin}>로그인하고 견적 파일 올리기</button>:<SiteFiles siteId={site.id} category="quote" rows={rows} onRefresh={refresh}/>}<Quote draftOwner={draftOwner||'guest'} onBlockNavigation={setEditorBlocked} key={site.id} site={site} existing={quote(site.id)} sources={rows.filter(r=>r.kind==='quote'&&r.parent!==site.id)} profile={profile?.data || {}} busy={busy} onSave={(data) => task(async () => { await save('quote', data, site.id, quote(site.id)?.id); })} /></div></TabsContent>
          <TabsContent value="notes"><div className="stack">{guest?<button className="btn" onClick={requestLogin}>로그인하고 현장 사진 올리기</button>:<SiteFiles siteId={site.id} category="photo" rows={rows} onRefresh={refresh}/>}<Notes onRequireLogin={guest?requestLogin:undefined} draftOwner={draftOwner||'guest'} onBlockNavigation={setEditorBlocked} key={site.id} site={site} rows={rows} busy={busy} onSave={(data) => task(async () => { await save('note', data, site.id); })} onRefresh={refresh} /></div></TabsContent>
          <TabsContent value="purchases"><>{guest?<div className="panel stack"><h2>영수증으로 자재비 정리</h2><p>영수증 AI 인식과 원본 보관은 로그인 후 사용할 수 있어요.</p><button className="btn primary" onClick={requestLogin}>로그인하고 영수증 인식하기</button></div>:<Receipts key={site.id} siteId={site.id} rows={rows} onRefresh={refresh}/>}</></TabsContent><TabsContent value="payments"><div className="panel stack"><div className="row"><div><p className="eyebrow">이 현장의 정산</p><h2>입금 내역</h2></div><button className="btn primary" disabled={busy} onClick={() => openPayment()}><Plus size={17} />입금 등록</button></div><div className="payment-summary"><span>아직 받을 금액</span><strong>{money(balance(site.id))}<small>원</small></strong></div>{paid(site.id) > total(quote(site.id)?.data) && <p className="notice">입금액이 견적 합계보다 많아요. 견적과 입금 내역을 확인해 주세요.</p>}{!payments.length ? <div className="empty"><span className="empty-icon"><Wallet size={28} /></span><h3>첫 입금 내역을 남겨보세요</h3><p>계약금, 중도금, 잔금을 기록하면 남은 금액이 자동으로 계산돼요.</p></div> : payments.map(r => <div className="payment-row" key={r.id}><span className="payment-check"><CircleCheck size={20} /></span><div><strong>{r.data.label}</strong><p className="muted">{r.data.date}{r.data.memo ? ' · ' + r.data.memo : ''}</p></div><strong className="payment-amount">{money(r.data.amount)}원</strong><button className="linkbutton" disabled={busy} onClick={() => openPayment(r)}>수정</button></div>)}</div></TabsContent>
        </Tabs>
      </> : <div className="panel empty">{!ready?<><LoaderCircle className="spin" />현장을 불러오는 중이에요.</>:<><h2>현장을 찾을 수 없어요</h2><p>접근 가능한 현장 목록에서 다시 선택해 주세요.</p><button className="btn" onClick={()=>navigate('sites')}>내 현장 보기</button></>}</div>}
      <footer><span className="brand-mini"><Wrench size={14} />설비노트</span><span>현장 기록은 차곡차곡, 마무리는 가볍게.</span></footer>
    </main>
    <Dialog open={!!loginReason} onOpenChange={v=>{if(!v)setLoginReason('');}}><DialogContent className="entry-dialog"><DialogTitle>기록을 안전하게 보관하려면 로그인해 주세요</DialogTitle><DialogDescription>{loginReason}</DialogDescription><p>저장한 기기 기록은 로그인 후 ‘기기 기록을 내 계정으로 옮기기’로 보관할 수 있어요. 작성 중인 내용은 먼저 저장해 주세요.</p><a className="btn primary" href="/login">Google로 로그인하기</a><button className="btn" onClick={()=>setLoginReason('')}>계속 둘러보기</button></DialogContent></Dialog>
    {receiptOpen&&<ReceiptDialog sites={sites} initial={active||''} rows={rows} onClose={()=>setReceiptOpen(false)} onRefresh={refresh}/>}
    {uploadKind&&<UploadDialog category={uploadKind} initialSite={active||''} sites={sites} rows={rows} onClose={()=>setUploadKind(null)} onRefresh={refresh} onCreate={async name=>{const result=await save('site',{name,customer:'',phone:'',address:'',date:today(),status:'견적 대기',scope:''});await refresh();return result.id;}}/>}
    <Dialog open={!!modal} onOpenChange={o => { if (!o && !busy) setModal(''); }}>
      <DialogContent className="entry-dialog"><DialogTitle>{modal === 'site' ? (edit.id ? '현장 정보 수정' : '새 현장 등록') : modal === 'profile' ? '사업자 정보' : edit.id ? '입금 내역 수정' : '입금 등록'}</DialogTitle><DialogDescription>{modal === 'site' ? '현장명만 입력해도 시작할 수 있어요. 고객과 주소는 나중에 추가하세요.' : modal === 'profile' ? '견적서에 사용할 공급자 정보를 입력하세요.' : '실제로 입금된 날짜와 금액을 남겨주세요.'}</DialogDescription>
        {modal==='site'&&!edit.id&&<p className="notice">현재 현장 {sites.length}개 · 무료로 10개까지 등록할 수 있어요. 완료된 현장도 포함됩니다. 11번째부터 구독이 필요해요. <a href="/subscription">구독 확인</a></p>}
        <form className="grid" onSubmit={async e => {
          e.preventDefault(); const kind = modal; const data = { ...edit }; delete data.id;
          await task(async () => { const result=await save(kind === 'site' ? 'site' : kind === 'profile' ? 'profile' : 'payment', data, kind === 'payment' ? active! : '', kind === 'profile' ? profile?.id : edit.id); if(kind==='site'&&!edit.id)setCreatedSite(result.id); setModal(''); });
        }}>
          {modal === 'site' ? <><Field label="현장명 *" required value={edit.name} onChange={(v: string) => setEdit({ ...edit, name: v })} /><Choice label="진행 상태" value={edit.status} options={stages} onChange={(v: string) => setEdit({ ...edit, status: v })} /><details className="full optional-site" open={edit.id?true:undefined}><summary>고객·주소·공사 정보 추가 (선택)</summary><div className="grid"><Field label="고객 · 업체명" value={edit.customer} onChange={(v: string) => setEdit({ ...edit, customer: v })} /><Field label="연락처" type="tel" value={edit.phone} onChange={(v: string) => setEdit({ ...edit, phone: v })} /><Field label="현장 주소" full value={edit.address} onChange={(v: string) => setEdit({ ...edit, address: v })} /><Field label="방문 · 시공 예정일" type="date" value={edit.date} onChange={(v: string) => setEdit({ ...edit, date: v })} /><label className="field full">공사 범위 · 특이사항<textarea value={edit.scope} onChange={e => setEdit({ ...edit, scope: e.target.value })} placeholder="예: 주방 급수배관 교체, 철거 포함, 마감 복구 별도" /></label></div></details></> : modal === 'profile' ? Object.entries({ company: '상호 *', number: '사업자등록번호', ceo: '대표자', address: '소재지', business: '업태', category: '종목', contact: '담당자', phone: '연락처' }).map(([key, label]) => <Field key={key} label={label} required={key === 'company'} value={edit[key as keyof Supplier]} onChange={(v: string) => setEdit({ ...edit, [key]: v })} />) : <><Choice label="구분" value={edit.label} options={['계약금', '중도금', '잔금', '기타']} onChange={(v: string) => setEdit({ ...edit, label: v })} /><Field label="입금일 *" type="date" required value={edit.date} onChange={(v: string) => setEdit({ ...edit, date: v })} /><Field label="입금액 (원) *" type="number" required value={typeof edit.amount === 'number' ? edit.amount : undefined} onChange={(v: number) => setEdit({ ...edit, amount: v })} /><Field label="메모" value={edit.memo} onChange={(v: string) => setEdit({ ...edit, memo: v })} /></>}
          <button className="btn primary full" disabled={busy}>{busy ? <LoaderCircle size={18} className="spin" /> : <Save size={18} />}{busy ? '저장하는 중…' : '저장하기'}</button>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}

