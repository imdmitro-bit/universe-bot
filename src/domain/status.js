/* Derived state the boards show: trip phase, the three pre-trip tracks, attention rules, filters. */
import {act} from './actions.js';
import {STOP_LABEL,curIdx,detActive,detRisk,dispTs,labels,sortTs,tnum} from './stops.js';
import {MIN,ago,fmtT,hm} from '../lib/utils.js';
import {TRIPS} from '../state.js';

/* Derived trip phase — what the board shows */
export function phase(t){
  if(t.status==='draft')return'draft';
  if(t.closed)return'closed';
  if(t.empty)return'empty';
  const ci=curIdx(t);
  if(ci===-1)return'delivered';
  if(t.leftYard)return t.stops[ci].status==='pending'?'on_road':'at_stop';
  if(t.confirm==='refused')return'refused';
  if(t.atYard)return'at_yard';
  if(t.enRouteYard)return'to_yard';
  if(t.confirm==='pending')return'sent';
  return t.trailer?'trailer':'confirmed';
}
/* Three independent pre-trip tracks. Each one is a single value that changes in place. */
export function confState(t){
  if(t.status==='draft')return['Not sent','c-idle',t.driverId?'driver assigned':'no driver yet'];
  if(t.confirm==='confirmed')return['Confirmed','c-ok',fmtT(t.confirmTs)+' · driver'];
  if(t.confirm==='refused')return['Refused','c-crit',fmtT(t.refuseTs)+' · driver'];
  return['Awaiting confirm','c-warn','sent '+ago(t.sentTs)];
}
export function trailerState(t){
  if(t.trailer&&t.whDirty)return['Edited · resend','c-warn',tnum(t)];
  if(t.trailer)return['Trailer Sent','c-ok',t.trailer.num+' · '+fmtT(t.trailer.ts)];
  if(t.trailerReady)return['Ready to send','c-acc',t.trailerReady.num+' · '+fmtT(t.trailerReady.ts)];
  if(t.trailerPrep)return['Preparing','c-warn',(t.trailerNum?t.trailerNum+' · ':'')+'since '+fmtT(t.trailerPrep)];
  return['Not started','c-idle','Warehouse'];
}
export function yardState(t,d){
  if(t.leftYard)return['Left the Yard','c-ok',fmtT(t.leftYard)];
  if(t.atYard)return['At the Yard','c-acc','since '+fmtT(t.atYard)];
  if(t.enRouteYard)return['En route to Yard','c-teal',d&&d.yardEta?'ETA '+fmtT(d.yardEta):fmtT(t.enRouteYard)];
  return['Not moving','c-idle',t.status==='draft'?'—':'not heading to yard'];
}
export const readyToGo=t=>t.status==='active'&&t.confirm==='confirmed'&&!!t.trailer&&!!t.atYard&&!t.leftYard;
export const GROUP={sent:'await',refused:'await',confirmed:'prep',trailer:'prep',at_yard:'prep',to_yard:'prep',on_road:'road',at_stop:'stop',delivered:'empty',empty:'empty',available:'idle'};
export const GROUPS=[['all','All on trip'],['attn','Need attention'],['road','On the road'],['stop','At a stop'],['late','ETA late'],['det','Detention'],['empty','Empty / backhaul']];
export function isLate(t,d){if(phase(t)!=='on_road'||!d.eta)return false;const dt=dispTs(t.stops[curIdx(t)]);return!!dt&&d.eta>dt+15*MIN;}
export function dMatch(r,k){switch(k){case'all':return true;case'attn':return r.a.length>0;case'late':return isLate(r.t,r.d);case'det':return r.t.stops.some(detActive);default:return r.g===k;}}
export function phaseLabel(t){
  if(!t)return['Available','c-idle'];
  const p=phase(t),ci=curIdx(t),n=t.stops.length;
  switch(p){
    case'draft':return['Draft','c-idle'];
    case'sent':return['Awaiting confirm','c-warn'];
    case'refused':return['Refused','c-crit'];
    case'confirmed':return['Confirmed','c-acc'];
    case'trailer':return['Trailer Sent','c-acc'];
    case'at_yard':return['At the Yard','c-teal'];
    case'to_yard':return['En route to Yard','c-teal'];
    case'on_road':return[ci===0?'Left the Yard':`En route · Stop ${ci+1}/${n}`,'c-teal'];
    case'at_stop':return[`Stop ${ci+1}/${n} · ${STOP_LABEL[t.stops[ci].status]}`,'c-ok'];
    case'delivered':return['All Unloaded','c-vio'];
    case'empty':return[t.backhaul&&t.backhaul.state==='assigned'?'Empty · Backhaul assigned':'Empty · Ready','c-vio'];
    case'closed':return['Completed','c-idle'];
  }
}
export function attention(t,d){
  if(!t)return[];
  const r=[],p=phase(t),now=Date.now();
  t.stops.forEach((s,i)=>{if(detRisk(s))r.push(`Stop ${labels(t.stops)[i]}: detention may occur — notify broker`);});
  if(p==='refused')r.push('Refused by driver');
  if(p==='sent'&&now-t.sentTs>45*MIN)r.push('No confirmation for '+Math.round((now-t.sentTs)/MIN)+'m');
  if(p==='on_road'&&d.eta){const s=t.stops[curIdx(t)];const dt=dispTs(s);if(dt&&d.eta>dt+15*MIN)r.push(`ETA ${hm((d.eta-dt)/MIN)} after dispatched time`);}
  if(t.alerts.length&&!t.leftYard)r.push('Left yard geofence without confirm/trailer');
  if(p==='delivered'){const last=t.stops[t.stops.length-1].t.unloaded;if(now-last>30*MIN)r.push('Unloaded — mark Empty');}
  return r;
}

export const PGROUPS=[['all','All before departure'],['attn','Need attention'],['prio','Priority'],['draft','Not sent'],['await','Awaiting confirm'],['trailer','Trailer not sent'],['to_yard','En route to Yard'],['at_yard','At the Yard'],['ready','Ready to depart'],['left','Left yard · last 3h']];
export function prepTrips(){return TRIPS.filter(t=>!t.closed&&(t.status==='draft'||(t.status==='active'&&(!t.leftYard||Date.now()-t.leftYard<3*60*MIN))));}
export function prepAttn(t){
  if(t.status!=='active'||t.leftYard)return[];
  const r=[],now=Date.now(),first=sortTs(t.stops[0]),L=labels(t.stops);
  t.stops.forEach((s,i)=>{if(s.noFit)r.push(`Stop ${L[i]} doesn't fit — change the trip`);});
  if(t.confirm==='refused')r.push('Driver refused');
  if(t.confirm==='pending'&&now-t.sentTs>45*MIN)r.push('No confirmation for '+hm((now-t.sentTs)/MIN));
  if(t.atYard&&!t.trailer)r.push('Driver at yard, trailer not sent');
  if(!t.trailerPrep&&first-now<8*60*MIN)r.push('Trailer not started, 1st delivery in '+hm((first-now)/MIN));
  if(t.alerts.length)r.push('Left yard geofence without confirm/trailer');
  return r;
}
export function prepMatch(t,k){
  const act=t.status==='active';
  switch(k){
    case'all':return!t.leftYard;
    case'attn':return prepAttn(t).length>0;
    case'prio':return!!t.priority&&!t.leftYard;
    case'draft':return t.status==='draft';
    case'await':return act&&!t.leftYard&&['pending','refused'].includes(t.confirm);
    case'trailer':return act&&!t.leftYard&&!t.trailer;
    case'to_yard':return act&&!!t.enRouteYard&&!t.atYard;
    case'at_yard':return act&&!!t.atYard&&!t.leftYard;
    case'ready':return readyToGo(t);
    case'left':return!!t.leftYard;
  }
}
/* Warehouse sees every saved trip before departure, sent or not: loading can start before the driver gets the trip. */
const whOpen=t=>!t.closed&&!t.leftYard&&(t.status==='active'||(t.status==='draft'&&t.stops.some(s=>s.consignee||s.kind==='agent')));
export const needsTrailer=t=>whOpen(t)&&!t.trailer;
export const whTrips=()=>TRIPS.filter(whOpen);
export const whSort=(a,b)=>(b.priority?1:0)-(a.priority?1:0)||sortTs(a.stops[0])-sortTs(b.stops[0]);
/* Manual status change (Owner, Admin, Supervisor, Manager, After Hours): every track and its values, in order. */
export const TRACKS={
  conf:{label:'Confirmation',opts:[['pending','Awaiting confirm'],['confirmed','Confirmed'],['refused','Refused']]},
  trailer:{label:'Trailer',opts:[['none','Not started'],['preparing','Preparing'],['ready','Ready to send'],['sent','Trailer Sent']]},
  yard:{label:'Yard',opts:[['none','Not moving'],['enroute','En route to Yard'],['atyard','At the Yard'],['left','Left the Yard']]},
  stop:{label:'Current stop',opts:[['pending','Pending'],['arrived','Arrived'],['checked_in','Checked In'],['in_door','In Door'],['unloaded','Unloaded']]},
};
export function trackValue(t,k){
  if(k==='conf')return t.confirm||'pending';
  if(k==='trailer')return t.trailer?'sent':t.trailerReady?'ready':t.trailerPrep?'preparing':'none';
  if(k==='yard')return t.leftYard?'left':t.atYard?'atyard':t.enRouteYard?'enroute':'none';
  if(k==='stop'){const i=t.stops.findIndex(s=>s.status!=='unloaded');return i<0?'unloaded':t.stops[i].status;}
}
