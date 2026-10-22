/* Trips list: active, drafts, unassigned loads, completed. */
import {phaseLabel} from '../domain/status.js';
import {groupsOf,pltTotal,refTxt,spotsTotal} from '../domain/stops.js';
import {ago,esc,fmtD,money} from '../lib/utils.js';
import {POOL,S,TRIPS,can,drv,isDraftId,tripNo} from '../state.js';
import {applySort,driverTh,prioTag,routeHtml,sth,who2} from '../ui/components.js';

export function viewTrips(){
  const tabs=[['active','Active'],['draft','Drafts'],['pool','Unassigned loads'],['done','Completed']];
  const cnt=k=>k==='pool'?POOL.length:TRIPS.filter(t=>k==='draft'?t.status==='draft':k==='done'?t.closed:t.status==='active'&&!t.closed).length;
  const rates=can('rates');let body;
  if(S.tripsTab==='pool'){
    body=`<div class="tblwrap"><table class="tbl" style="min-width:960px"><thead><tr><th>Load #</th><th>Deliver to</th><th>Ref</th><th>Broker</th><th>Broker appt</th>${rates?'<th>Rate</th>':''}<th>From trip</th><th>Removed</th><th></th></tr></thead><tbody>
    ${POOL.length?POOL.map(s=>`<tr data-a="none"><td class="mono">${esc(s.load)}</td><td>${esc(s.consignee)}<span class="sub">${esc(s.city)}</span></td><td class="mono">${esc(refTxt(s))||'<span class="muted">—</span>'}</td><td>${esc(s.broker)}</td><td class="mono">${fmtD(s.brokerAppt)}</td>${rates?`<td class="num">${money(s.rate)}${s.split?' <span class="muted">½</span>':''}</td>`:''}<td class="mono">${s.fromTrip?'#'+s.fromTrip:'—'}</td><td class="muted">${s.pooledAt?ago(s.pooledAt):''}</td><td>${rates?`<button class="btn sm ghost" data-a="rcOpen" data-id="${s.id}">Open RC</button>`:''}</td></tr>`).join('')
      :`<tr><td colspan="9" class="empty">No unassigned loads. A load removed from a trip lands here with its RC, rate and history.</td></tr>`}
    </tbody></table></div><p class="foot">Add these to a trip from New trip or Edit trip with "Add from unassigned loads".</p>`;
  }else{
    let list=TRIPS.filter(t=>S.tripsTab==='draft'?t.status==='draft':S.tripsTab==='done'?t.closed:t.status==='active'&&!t.closed).sort((a,b)=>b.updated-a.updated);
    const D=t=>drv(t.driverId);list=applySort('trips',list,{trip:t=>isDraftId(t.id)?null:t.id,status:t=>phaseLabel(t)[0],truck:t=>D(t)?+D(t).truck:null,name:t=>D(t)?.name,route:t=>t.stops[0]?.city,freight:t=>pltTotal(t),total:t=>t.stops.reduce((x,s)=>x+s.rate,0),disp:t=>t.dispatcher,updated:t=>-t.updated});
    body=`<div class="tblwrap"><table class="tbl"><thead><tr>${sth('trips','trip','Trip')}${sth('trips','status','Status')}${driverTh('trips')}${sth('trips','route','Route')}${sth('trips','freight','Freight (WH)')}${rates?sth('trips','total','Agreed total'):''}${sth('trips','disp','Dispatcher')}${sth('trips','updated','Updated')}</tr></thead><tbody>
    ${list.length?list.map(t=>{const d=drv(t.driverId);const[l,c]=phaseLabel(t);const nG=groupsOf(t.stops).length;return`<tr data-ctx="trip" data-a="${t.status==='draft'?'editDraft':'open'}" data-id="${t.id}">
      <td class="mono">${esc(tripNo(t).replace(/^#/,""))}${prioTag(t)}</td><td><span class="pill ${c}">${l}</span></td>
      <td>${d?who2(d):'<span class="muted">Not assigned</span>'}</td>
      <td><div class="route">${routeHtml(t,false)}</div><span class="sub">${nG} stops${t.stops.length>nG?' · '+t.stops.length+' loads':''}</span></td>
      <td class="num">${pltTotal(t)!=null?pltTotal(t)+' plt · '+spotsTotal(t)+' spots':'<span class="muted">—</span>'}</td>${rates?`<td class="num">${money(t.stops.reduce((x,s)=>x+s.rate,0))}</td>`:''}
      <td>${esc(t.dispatcher)||'<span class="muted">—</span>'}</td><td class="muted">${ago(t.updated)}</td></tr>`;}).join(''):`<tr><td colspan="8" class="empty">Nothing here yet.</td></tr>`}
    </tbody></table></div>`;
  }
  return`<div class="row"><h1 class="h1">Trips</h1><span class="sp"></span>${can('build')?`<button class="btn pri" data-a="newTrip">New trip</button>`:''}</div>
  <div class="subtabs">${tabs.map(([k,l])=>`<button class="${S.tripsTab===k?'on':''}" data-a="ttab" data-k="${k}">${l} <span class="muted">${cnt(k)}</span></button>`).join('')}</div>${body}`;
}
