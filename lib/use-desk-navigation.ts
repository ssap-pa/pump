'use client';
import { useEffect, useRef, useState } from 'react';
import { readLocation, locationUrl, type DeskLocation } from './desk-navigation';

export function useDeskNavigation(blocked: boolean) {
  const [route,setRoute]=useState<DeskLocation>(readLocation(''));
  const latest=useRef(route);
  const lock=useRef(blocked);
  useEffect(()=>{lock.current=blocked;},[blocked]);
  const position=useRef(0);
  const url=useRef('/');
  useEffect(()=>{
    const initial=readLocation(window.location.search);
    // eslint-disable-next-line react/react-compiler -- Hydrate browser history after the server render.
    latest.current=initial;setRoute(initial);url.current=locationUrl(initial);
    position.current=history.state?.deskPosition||0;
    history.replaceState({...history.state,deskPosition:position.current},'',url.current);
    const pop=()=>{
      const next=history.state?.deskPosition??0;
      if(lock.current && next!==position.current){history.go(position.current-next);return;}
      position.current=next;
      latest.current=readLocation(window.location.search);setRoute(latest.current);url.current=locationUrl(latest.current);
      const y=history.state?.deskScroll||0;
      requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'instant'})));
    };
    window.addEventListener('popstate',pop);
    return()=>window.removeEventListener('popstate',pop);
  },[]);
  function go(patch:Partial<DeskLocation>,replace=false,scroll=0){
    if(lock.current)return;
    const previous=latest.current, next={...previous,...patch};
    const target=locationUrl(next);
    if(target===url.current)return;
    const returnScroll=previous.site?history.state?.deskReturnScroll||0:window.scrollY;
    const state={...history.state,deskScroll:window.scrollY};
    history.replaceState(state,'',url.current);
    if(!replace)position.current++;
    history[replace?'replaceState':'pushState']({...state,deskPosition:position.current,deskScroll:replace?window.scrollY:scroll,deskReturnScroll:returnScroll},'',target);
    latest.current=next;setRoute(next);url.current=target;
    if(!replace)requestAnimationFrame(()=>window.scrollTo({top:scroll,behavior:'instant'}));
  }
  function backToList(){go({site:null},false,history.state?.deskReturnScroll||0);}
  return {route,go,backToList};
}
