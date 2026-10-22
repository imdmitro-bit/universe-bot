/* Keeps the prototype's data in this browser (localStorage), so drivers, trips, team and agents survive a reload.
   Production keeps it in Supabase; this is only so the prototype can be tried for real.
   Demo mode (?demo) never writes here, so sample data cannot overwrite your own. */
import {AGENTS,DRIVERS,POOL,S,TRIPS,USERS} from './state.js';

const KEY='ub.data.v1';
const LISTS={drivers:DRIVERS,trips:TRIPS,pool:POOL,agents:AGENTS,users:USERS};
let enabled=false,timer=0;

/* Files picked in the browser live as blob: URLs that die with the page; keep a placeholder instead. */
const clean=(k,v)=>typeof v==='string'&&v.startsWith('blob:')?(k==='rcUrl'?undefined:null):v;

export function loadSaved(){
  let data;try{data=JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){data=null;}
  if(!data||!Array.isArray(data.users)||!data.users.length)return false;
  Object.entries(LISTS).forEach(([k,arr])=>{arr.splice(0,arr.length,...(data[k]||[]));});
  S.uid=USERS.some(u=>u.id===data.uid)?data.uid:USERS[0].id;
  if(data.tab)S.tab=data.tab;
  if(data.builder)S.builder={...data.builder,stops:(data.builder.stops||[]).filter(s=>!s.extracting)};
  return true;
}
export function saveNow(){
  if(!enabled)return;clearTimeout(timer);
  const B=S.builder&&{...S.builder,stops:S.builder.stops.filter(s=>!s.extracting)};
  const data={v:1,savedAt:Date.now(),uid:S.uid,tab:S.tab,builder:B,...Object.fromEntries(Object.entries(LISTS).map(([k,a])=>[k,a]))};
  try{localStorage.setItem(KEY,JSON.stringify(data,clean));}catch(e){console.warn('Could not save data',e);}
}
export const saveSoon=()=>{if(!enabled)return;clearTimeout(timer);timer=setTimeout(saveNow,400);};
export function startSaving(){
  enabled=true;
  ['click','change','input','drop','keydown'].forEach(ev=>document.addEventListener(ev,saveSoon,true));
  addEventListener('pagehide',saveNow);document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNow();});
  setInterval(saveNow,5000); // catches timer-driven changes (AI reads, Samsara ticks, delayed sends)
  saveNow();
}
export function clearSaved(){try{localStorage.removeItem(KEY);}catch(e){}enabled=false;}
