/* Files people add: Rate Confirmation PDFs and warehouse photos. On the page each one is a blob: URL that lives until
   the page closes. With shared data it is also uploaded (server → private "Universe Files" Telegram channel) and saved
   as "tg:<file_id>"; fileSrc() turns such a reference back into something the page can show. */
import {CLOUD} from './mode.js';

const ref2url=new Map(),url2ref=new Map(),loading=new Set(),failed=new Set();
let pending=0;
export const pendingUploads=()=>pending;
/* What gets saved for a blob: URL: its uploaded reference, or null while it is not uploaded (yet). */
export const refOf=url=>url2ref.get(url)||null;
export function registerFile(url,ref){if(url&&ref){url2ref.set(url,ref);ref2url.set(ref,url);}}

/* Something to put in src/url(): the blob URL, or '' while a stored file is still downloading (the page redraws when it arrives). */
export function fileSrc(v){
  if(!v)return'';
  if(!String(v).startsWith('tg:'))return v;
  const u=ref2url.get(v);if(u)return u;
  if(CLOUD.call&&!loading.has(v)&&!failed.has(v)){
    loading.add(v);
    CLOUD.call('fileGet',{ref:v}).then(r=>{
      const bin=atob(r.b64),a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);
      ref2url.set(v,URL.createObjectURL(new Blob([a],{type:r.type})));CLOUD.redraw&&CLOUD.redraw();
    }).catch(()=>failed.add(v)).finally(()=>loading.delete(v));
  }
  return'';
}
export const isStored=v=>String(v||'').startsWith('tg:');

const b64Of=blob=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=()=>rej(new Error('Could not read the file'));r.readAsDataURL(blob);});
/* Phone photos are large; 1600 px JPEG is plenty to see pallets and seals, and Telegram keeps photos at that size anyway. */
async function shrink(file){
  try{
    const img=await createImageBitmap(file);const k=Math.min(1,1600/Math.max(img.width,img.height));
    const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(b=>r(b||file),'image/jpeg',.85));
  }catch(e){return file;}
}
/* Returns the URL to show right away; with shared data the upload runs in the background. */
export function addFile(file,kind,note){
  const url=URL.createObjectURL(file);
  if(!CLOUD.on)return url;
  pending++;
  (kind==='photo'?shrink(file):Promise.resolve(file)).then(b64Of)
    .then(b64=>CLOUD.call('fileUpload',{name:kind==='photo'?file.name.replace(/\.\w+$/,'')+'.jpg':file.name,kind,b64,note}))
    .then(r=>{registerFile(url,r.ref);CLOUD.flushSoon&&CLOUD.flushSoon();})
    .catch(e=>CLOUD.toast&&CLOUD.toast(`${file.name} was not saved: ${e.message}`,true))
    .finally(()=>{pending--;CLOUD.redraw&&CLOUD.redraw();});
  return url;
}
export {b64Of};
