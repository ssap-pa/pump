import type {Worker} from 'tesseract.js';
export async function recognizeReceipt(blob:Blob,onProgress:(v:string)=>void){
 let worker:Worker|undefined,stopped=false,timer:ReturnType<typeof setTimeout>;
 const run=async()=>{
  const {createWorker,PSM}=await import('tesseract.js');
  onProgress('한글 인식 준비 중… 처음에는 잠시 걸릴 수 있어요.');
  worker=await createWorker(['kor','eng'],1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr/core',langPath:'/ocr/lang',workerBlobURL:false,logger:m=>{if(m.status==='recognizing text')onProgress(`영수증 읽는 중 · ${Math.round(m.progress*100)}%`);}});
  if(stopped){await worker.terminate();throw new Error('인식 시간이 초과됐어요.');}
  await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK,preserve_interword_spaces:'1'});
  const bitmap=await createImageBitmap(blob);
  if(bitmap.width*bitmap.height>40000000){bitmap.close();throw new Error('사진 해상도가 너무 커요. 영수증 부분만 잘라 다시 올려 주세요.');}
  const ratio=Math.min(1,2600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const {data}=await worker.recognize(canvas);return {text:data.text,confidence:data.confidence};
 };
 try{return await Promise.race([run(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{stopped=true;reject(new Error('인식 시간이 오래 걸려 중단했어요. 영수증이 선명하게 보이도록 다시 시도해 주세요.'));},120000);})]);}
 finally{clearTimeout(timer!);stopped=true;await worker?.terminate();}
}

