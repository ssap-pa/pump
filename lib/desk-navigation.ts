export const AREAS=['today','sites','records','account'];
export const DETAIL_TABS=['overview','quote','notes','purchases','payments'];
export const STAGES=['전체','견적 대기','방문 예정','시공 중','작업 완료','정산 완료'];
export type DeskLocation={area:string;site:string|null;tab:string;search:string;filter:string};
export function readLocation(search: string): DeskLocation {
  const p=new URLSearchParams(search);
  return {area:AREAS.includes(p.get('view')||'')?p.get('view')!:'today',site:p.get('site')||null,
    tab:DETAIL_TABS.includes(p.get('tab')||'')?p.get('tab')!:'overview',search:p.get('q')||'',filter:STAGES.includes(p.get('stage')||'')?p.get('stage')!:'전체'};
}
export function locationUrl(route: DeskLocation) {
  const p=new URLSearchParams();
  if(route.area!=='today')p.set('view',route.area);
  if(route.site){p.set('site',route.site);p.set('tab',route.tab);}
  if(route.search)p.set('q',route.search);
  if(route.filter!=='전체')p.set('stage',route.filter);
  return '/'+(p.size?'?'+p.toString():'');
}
