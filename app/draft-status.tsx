export function DraftStatus({dirty,restored,unavailable,discard}:{dirty:boolean;restored:boolean;unavailable:boolean;discard:()=>void}) {
  return <output className={'draft-status noprint'+(unavailable&&dirty?' draft-warning':'')}>
    {unavailable ? '이 브라우저에서 임시 보관을 사용할 수 없어요. 이동하기 전에 저장해 주세요.' : dirty ? `${restored?'작성 중이던 내용을 복구했어요. ':''}이 탭에 임시 보관 중 · 저장 버튼을 눌러 현장에 반영하세요.` : '작성 중 내용은 이 탭에 임시 보관돼요. 다른 기기에서 보려면 저장하세요.'}
    {dirty&&<button className="linkbutton" style={{display:'block',marginTop:8}} onClick={()=>{if(window.confirm('저장하지 않은 변경을 지울까요? 서버에 저장한 견적·기록·업로드 파일은 그대로 유지돼요.'))discard();}}>저장하지 않은 변경 지우기</button>}
  </output>;
}
