/* Stops and loads: 2A/2B grouping by address, labels, times, driver and warehouse messages, detention, distances. */
import {BROKERS,CONS_NOTES} from '../data/sample.js';
import {MIN,pick,rint,rnd,uid} from '../lib/utils.js';
import {drv} from '../state.js';

export function mkStop(tpl,appt){const p=rint(4,18);const load='LD-'+rint(400000,899999);const r=rnd();const rate=rint(45,140)*10;return{id:uid(),load,broker:pick(BROKERS),consignee:tpl.c,city:tpl.city,addr:tpl.addr,refType:r<.7?'DEL':r<.85?'PO':r<.9?'REF':'',refNum:String(rint(1000000,999999999)),disp:null,msg:null,appt,brokerAppt:appt,resched:null,pallets:p,wQty:null,wUnit:'plts',spots:null,photos:[],noFit:false,weight:p*rint(70,110)*10,rate,loadRate:rate,split:0,status:'pending',door:'',t:{},legMi:rint(70,260),consNote:rnd()<.45?pick(CONS_NOTES):'',whNote:'',notes:[],reports:[],detNotified:null,rcFile:'RC_'+load+'.pdf',rcTs:null};}

/* Agent stop: the driver drops loads at an agent (or only stops there, e.g. to unstack). Loads dropped there keep
   their own row with agent=<agent row id>; they share the agent's stop number and are delivered later by the agent. */
export const isAgent=s=>s&&s.kind==='agent';
export function mkAgentStop(a){return{id:uid(),kind:'agent',agentId:a.id,agentCode:a.code,load:'',broker:'',consignee:a.name,addr:a.addr,city:a.city,refType:'',refNum:'',disp:null,msg:null,appt:0,brokerAppt:0,resched:null,pallets:0,wQty:null,wUnit:'plts',spots:null,photos:[],noFit:false,weight:0,rate:0,loadRate:0,split:0,status:'pending',door:'',t:{},legMi:rint(70,260),consNote:'',whNote:'',notes:[],reports:[],detNotified:null,rcFile:'',rcTs:null};}
export const agentOf=(stops,s)=>s&&s.agent?stops.find(x=>x.id===s.agent):null;

export const STOP_ORDER=['pending','arrived','checked_in','in_door','unloaded'];
export const STOP_LABEL={pending:'Pending',arrived:'Arrived',checked_in:'Checked In',in_door:'In Door',unloaded:'Unloaded'};
export const curIdx=t=>t.stops.findIndex(s=>s.status!=='unloaded');

export const DWELL=90; // planned minutes at each stop
export function stopDistance(t,i){
  const c0=curIdx(t);if(c0>=0&&i!==c0&&groupMembers(t.stops,c0).includes(i))return stopDistance(t,c0);
  const d=drv(t.driverId),s=t.stops[i],now=Date.now();
  if(s.status==='unloaded')return{done:true};
  if(!t.leftYard){const mi=t.stops.slice(0,i+1).reduce((x,s)=>x+s.legMi,0);const drive=mi/52*60+i*DWELL;return{mi,drive,label:'from yard',eta:null};}
  const ci=curIdx(t),cur=t.stops[ci];
  let mi0=0,min0=0;
  if(cur.status==='pending'){if(d.eta){min0=Math.max(1,(d.eta-now)/MIN);mi0=Math.round(min0*0.85);}else{mi0=cur.legMi;min0=mi0/52*60;}}
  if(i===ci)return{mi:mi0,drive:min0,eta:now+min0*MIN,label:'from truck',here:cur.status!=='pending'};
  let mi=mi0,min=min0;
  for(let k=ci;k<i;k++){if(t.stops[k].status!=='unloaded'&&t.stops[k+1].legMi>0)min+=DWELL;mi+=t.stops[k+1].legMi;min+=t.stops[k+1].legMi/52*60;}
  return{mi:Math.round(mi),drive:min,eta:now+min*MIN,label:'from truck'};
}
export const unitTxt=(q,u)=>u==='crate'?`${q} crate${q==1?'':'s'}`:`${q} plts`;
export const spotTxt=n=>`${n} spot${n==1?'':'s'}`;
export const cityST=c=>String(c).replace(/\s*\d{5}(-\d{4})?\s*$/,'').replace(/,/g,'').replace(/\s+/g,' ').trim();
/* Same place = same address. A dispatcher can also link two stops by hand (linkKey) when the RCs spell the place differently. */
export const rawAddrKey=s=>(String(s.addr)+'|'+String(s.city)).toLowerCase().replace(/[.,]/g,'').replace(/\s+/g,' ').trim();
export const addrKey=s=>s.extracting?'x'+s.id:s.linkKey&&!s.agent&&!isAgent(s)?s.linkKey:!isAgent(s)&&!s.agent&&!String(s.addr||'').trim()&&!String(s.city||'').trim()?'e'+s.id:isAgent(s)?'agent:'+s.id:s.agent?'agent:'+s.agent:rawAddrKey(s);
export function groupsOf(stops){const g=[];stops.forEach((s,i)=>{const last=g[g.length-1];if(last&&addrKey(stops[last[0]])===addrKey(s))last.push(i);else g.push([i]);});return g;}
export function labels(stops){const L=[];groupsOf(stops).forEach((g,n)=>{const ag=g.some(i=>isAgent(stops[i]));g.forEach((i,k)=>L[i]=g.length>1&&!ag?`${n+1}${'ABCDEFGH'[k]}`:`${n+1}`);});return L;}
export function groupMembers(stops,i){return groupsOf(stops).find(g=>g.includes(i))||[i];}
export const glab=(t,i)=>{const L=labels(t.stops);return[...new Set(groupMembers(t.stops,i).map(j=>L[j]))].join('+');};
export const tnum=t=>t.trailer?.num||t.trailerReady?.num||t.trailerNum||'';
export const spotsTotal=t=>t.stops.filter(s=>!isAgent(s)).reduce((x,s)=>x+(s.noFit?0:(s.spots||0)),0);
export const pltTotal=t=>{const v=t.stops.filter(s=>s.wQty!=null&&!s.noFit);return v.length?v.reduce((x,s)=>x+(s.wUnit==='plts'?+s.wQty:0),0):null;};
export const refTxt=s=>s.refType&&s.refNum?`${s.refType}# ${s.refNum}`:'';
export const dispTs=s=>s.disp&&!s.disp.asap?s.disp.ts:null;
export const sortTs=s=>dispTs(s)||(s.disp&&s.disp.day)||s.brokerAppt||s.appt;
export function fmtDisp(s){
  if(!s||!s.disp)return'';const d=new Date(s.disp.asap?(s.disp.day||s.brokerAppt):s.disp.ts),p=n=>String(n).padStart(2,'0');
  const day=`${p(d.getMonth()+1)}/${p(d.getDate())}`;if(s.disp.asap)return day+' ASAP';
  let h=d.getHours();const m=d.getMinutes();const ap=h>=12?'PM':'AM';h=h%12||12;return`${day} ${h}${m?':'+p(m):''}${ap}`;
}
/* An edited message block keeps its text, but a new dispatched time still has to reach the driver.
   A block without a time keeps an empty line where the time goes. */
export function retimeMsgs(stops,idxs,oldT){
  idxs.forEach(j=>{const x=stops[j];if(x.msg==null)return;const to=fmtDisp(x);
    if(oldT){if(oldT!==to&&x.msg.includes(oldT))x.msg=x.msg.replace(oldT,to);return;}
    if(!to)return;const ls=x.msg.split('\n');const k=ls.findIndex((l,n)=>n>0&&!l.trim());if(k>=0)ls[k]=to;else ls.splice(Math.min(3,ls.length),0,to);x.msg=ls.join('\n');});
}
/* Reads the dispatched time a person typed into a message block: "10/22 10AM", "10/22 10:30PM", "10/22 ASAP". */
export function parseDispLine(text,ref=Date.now()){
  for(const line of String(text).split('\n')){
    const m=/^\s*(\d{1,2})\/(\d{1,2})\s+(?:(ASAP)|(\d{1,2})(?::(\d{2}))?\s*(AM|PM))\s*$/i.exec(line);if(!m)continue;
    const mo=+m[1]-1,dd=+m[2];if(mo<0||mo>11||dd<1||dd>31)continue;
    const now=new Date(ref);let y=now.getFullYear();if(mo<now.getMonth()-6)y++;else if(mo>now.getMonth()+6)y--;
    if(m[3])return{asap:true,day:new Date(y,mo,dd,12,0).getTime()};
    let h=+m[4]%12+(m[6].toUpperCase()==='PM'?12:0);const mi=m[5]?+m[5]:0;if(+m[4]<1||+m[4]>12||mi>59)continue;
    return{ts:new Date(y,mo,dd,h,mi).getTime()};
  }
  return null;
}
export function stopBlockAuto(s,stops){
  if(isAgent(s)){const loads=(stops||[]).filter(x=>x.agent===s.id);
    return[`AGENT ${String(s.agentCode||s.consignee).toUpperCase()}`,String(s.addr).toUpperCase(),String(s.city).toUpperCase(),fmtDisp(s),
      ...(loads.length?['','DROP THERE LOADS',...loads.map(x=>cityST(x.city).replace(/ ([A-Z]{2})$/,', $1').toUpperCase()),'GIVE PPW AND SEAL TO AGENT']:[])].join('\n');}
  return[String(s.consignee).toUpperCase(),String(s.addr).toUpperCase(),String(s.city).toUpperCase(),fmtDisp(s),refTxt(s)].filter((v,k)=>k!==4||v).join('\n');
}
/* Rows that get their own block in the driver message: every stop row except loads riding inside an agent stop. */
export const msgRows=stops=>stops.map((s,i)=>i).filter(i=>!stops[i].agent);
export const stopHead=(stops,i,L)=>`STOP# ${L[i]}${isAgent(stops[i])?' AGENT':''}`;
/* Dispatch notes sit after a stop row (after=row id) or right under the header (after=null). */
export const notesAfter=(notes,id)=>(notes||[]).filter(n=>n.after===id&&String(n.text).trim());
/* The signature line the bot adds under every message it posts for a person. */
export const issuedLine=by=>by?`\n\nIssued by ${by}`:'';
export function tripMessage(t,changed){
  const L=labels(t.stops);const out=[(changed?'YOUR TRIP HAS CHANGES #':'YOUR NEW TRIP #')+t.id,''];
  notesAfter(t.notes,null).forEach(n=>out.push(n.text.toUpperCase(),''));
  msgRows(t.stops).forEach(i=>{const s=t.stops[i];out.push(stopHead(t.stops,i,L),s.msg!=null?s.msg:stopBlockAuto(s,t.stops),'');
    const inside=t.stops.filter(x=>x.agent===s.id).map(x=>x.id);[s.id,...inside].forEach(id=>notesAfter(t.notes,id).forEach(n=>out.push(n.text.toUpperCase(),'')));});
  return out.join('\n').trim();
}
export function whMessage(t){
  const rows=t.stops.map((s,i)=>i).reverse().filter(i=>!t.stops[i].noFit&&!isAgent(t.stops[i]));
  return[tnum(t),...rows.flatMap(i=>{const s=t.stops[i];const a=agentOf(t.stops,s);return[a?cityST(a.city)+' (agent)':cityST(s.city),`${unitTxt(s.wQty??0,s.wUnit||'plts')} / ${spotTxt(s.spots??0)}`];})].join('\n');
}
export const MAX_STOP_PHOTOS=2, MAX_TG_PHOTOS=10; // Telegram album limit is 10
export const whPhotos=t=>t.stops.slice().reverse().filter(s=>!s.noFit&&!isAgent(s)).flatMap(s=>s.photos||[]);
export const onSite=s=>['arrived','checked_in','in_door'].includes(s.status);
export const detActive=s=>!isAgent(s)&&!s.agent&&onSite(s)&&!s.resched&&s.t.arrived<=s.brokerAppt+15*MIN&&Date.now()>s.brokerAppt+90*MIN;
export const detRisk=s=>detActive(s)&&!s.detNotified;
export const REPORT_TYPES={lumper:'Lumper',detention:'Detention',damage:'Damage / OS&D',other:'Other'};
export function syncGroup(t,ci){const g=groupMembers(t.stops,ci);const s=t.stops[ci];g.forEach(j=>{if(j===ci)return;const m=t.stops[j];if(m.status==='unloaded')return;m.status=s.status;m.door=s.door;['arrived','checked_in','in_door','unloaded'].forEach(k=>{if(s.t[k]&&!m.t[k])m.t[k]=s.t[k];});});}
