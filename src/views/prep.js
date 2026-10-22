/* Preparing: trips before they leave the yard. */
import {PGROUPS,confState,trackValue,prepAttn,prepMatch,prepTrips,readyToGo,trailerState,yardState} from '../domain/status.js';
import {cityST,fmtDisp,groupsOf,pltTotal,sortTs,spotsTotal,tnum} from '../domain/stops.js';
import {MIN,ago,esc,hm,lb} from '../lib/utils.js';
import {DRIVERS,S,activeTrip,can,dispatchers,drv,tripNo} from '../state.js';
import {applySort,driverTh,prioTag,routeHtml,sth,tile,who2} from '../ui/components.js';

export function viewPrep(){
  const all=prepTrips();
  if(!PGROUPS.some(([k])=>k===S.pgrp))S.pgrp='all';
  return`<div class="row"><h1 class="h1">Preparing for Trip</h1><span class="muted">${all.filter(t=>!t.leftYard).length} trips before departure · priority first, then by first delivery</span><span class="sp"></span>
    <input type="text" id="pSearch" placeholder="Driver, truck, trip, city" value="${esc(S.pq)}" style="width:230px">
    <button class="btn" data-a="tick" title="Simulates the next batch of location events from Samsara">Run Samsara tick</button></div>
  <div class="sumrow">${PGROUPS.map(([k,l])=>tile('pgrp',k,l,all.filter(t=>prepMatch(t,k)).map(t=>{const d=drv(t.driverId);return{id:t.id,a:t.status==='draft'?'editDraft':'open',d,name:d?d.name:'Not assigned',sub:`${tripNo(t)} · ${k==='attn'?prepAttn(t)[0]:cityST(t.stops[0].city)+' · '+(fmtDisp(t.stops[0])||'time not set')}`};}),S.pgrp===k,k==='attn'||k==='prio'?'attn':k==='ready'?'go':'')).join('')}</div>
  <div class="tblwrap"><table class="tbl" style="min-width:1420px"><thead><tr>${driverTh('prep')}${sth('prep','trip','Trip')}${sth('prep','loc','Samsara now')}${sth('prep','route','Route')}${sth('prep','first','First delivery')}${sth('prep','conf','Confirmation')}${sth('prep','trailer','Trailer')}${sth('prep','tnum','Trailer #')}${sth('prep','yard','Yard')}${sth('prep','disp','Dispatcher')}${sth('prep','updated','Updated')}</tr></thead><tbody id="prepBody">${prepRows()}</tbody></table></div>
  <p class="foot">Each status column is one value that changes in place. Confirmation comes from the driver's buttons, Trailer from Warehouse, Yard from Samsara. First delivery is the time the driver was dispatched for. A trip moves to the Dispatch Board once it leaves the yard.</p>`;
}
export function prepRows(){
  const q=S.pq.trim().toLowerCase();
  const rows=prepTrips().filter(t=>prepMatch(t,S.pgrp)).filter(t=>{
    if(!q)return true;const d=drv(t.driverId);
    return[t.id,d?.name,d?.truck,...t.stops.flatMap(s=>[s.city,s.consignee,s.load])].join(' ').toLowerCase().includes(q);
  }).sort((a,b)=>(b.priority?1:0)-(a.priority?1:0)||sortTs(a.stops[0])-sortTs(b.stops[0]));
  const D=t=>drv(t.driverId),CONF={pending:0,refused:1,confirmed:3};
  const rows2=applySort('prep',rows,{truck:t=>D(t)?+D(t).truck:null,name:t=>D(t)?.name,trip:t=>t.id,loc:t=>D(t)?.loc,route:t=>t.stops[0]?.city,first:t=>sortTs(t.stops[0]),
    conf:t=>t.status==='draft'?2:CONF[t.confirm],trailer:t=>['none','preparing','ready','sent'].indexOf(trackValue(t,'trailer')),tnum:t=>tnum(t)||null,
    yard:t=>['none','enroute','atyard','left'].indexOf(trackValue(t,'yard')),disp:t=>t.dispatcher,updated:t=>-t.updated});
  if(!rows2.length)return`<tr><td colspan="11" class="empty">No trips match this filter.</td></tr>`;
  const canD=can('dispatch')||can('build');
  return rows2.map(t=>{
    const d=drv(t.driverId);const a=prepAttn(t);const[cl,cc,cs]=confState(t);const[tl,tc,ts]=trailerState(t);const[yl,yc,ys]=yardState(t,d);
    const first=sortTs(t.stops[0]);const nG=groupsOf(t.stops).length;
    return`<tr class="${a.length?'attn':readyToGo(t)?'go':''}" data-a="${t.status==='draft'?'editDraft':'open'}" data-id="${t.id}" data-ctx="trip">
      <td>${t.status==='draft'&&can('build')?draftDriverCell(t):d?`<span data-ctx="driver" data-id="${t.id}" title="Right-click for options">${who2(d)}</span>`:'<span class="who2"><span class="trk off">—</span><span class="dn muted">Not assigned</span></span>'}</td>
      <td><span class="mono">${esc(tripNo(t).replace(/^#/,""))}</span>${prioTag(t)}${a.length?`<span class="why">${esc(a[0])}</span>`:readyToGo(t)?'<span class="sub" style="color:var(--ok)">Ready to depart</span>':''}</td>
      <td>${d&&t.status==='active'?`<span class="loc" title="${esc(d.loc)}">${esc(d.loc)}</span><span class="sub">${d.speed?d.speed+' mph · ':''}ping ${ago(d.ping)}</span>`:'<span class="muted">—</span>'}</td>
      <td><div class="route">${routeHtml(t)}</div><span class="sub">${nG} stop${nG>1?'s':''}${t.stops.length>nG?` · ${t.stops.length} loads`:''}${pltTotal(t)!=null?' · '+pltTotal(t)+' plt':''} · ${lb(t.stops.reduce((x,s)=>x+s.weight,0))}</span></td>
      <td style="white-space:nowrap">${fmtDisp(t.stops[0])?`<span class="mono">${fmtDisp(t.stops[0])}</span>`:'<span class="muted">time not set</span>'}<span class="sub">${first>Date.now()?'in '+hm((first-Date.now())/MIN):'—'}</span></td>
      <td data-st="conf" data-st-label="Confirmation"><span class="pill ${cc}">${cl}</span><span class="sub">${esc(cs)}</span></td>
      <td data-st="trailer" data-st-label="Trailer"><span class="pill ${tc}">${tl}</span><span class="sub">${esc(ts)}</span></td>
      <td><b class="mono">${esc(tnum(t))||'<span class="muted">—</span>'}</b><span class="sub">${t.trailerReady?`${spotsTotal(t)}/30 spots`:t.trailerPrep?'loading':'not started'}</span></td>
      <td data-st="yard" data-st-label="Yard"><span class="pill ${yc}">${yl}</span><span class="sub">${esc(ys)}</span></td>
      <td><select data-dd="${t.id}" ${canD?'':'disabled'} aria-label="Dispatcher for ${t.id}"><option value="">Assign…</option>${dispatchers().map(n=>`<option ${t.dispatcher===n?'selected':''}>${n}</option>`).join('')}</select></td>
      <td class="muted">${ago(t.updated)}</td></tr>`;
  }).join('');
}
/* A draft gets its driver right in the table; sending to the group is a separate, explicit press. */
function draftDriverCell(t){
  return`<select data-drvsel="${t.id}" aria-label="Driver for ${t.id}"><option value="">Assign driver…</option>${DRIVERS.filter(x=>!activeTrip(x)||x.id===t.driverId).map(x=>`<option value="${x.id}" ${x.id===t.driverId?'selected':''}>${esc(x.truck)} · ${esc(x.name)}</option>`).join('')}</select>
    ${t.driverId?`<button class="btn sm pri" data-a="sendDraft" data-id="${t.id}" style="margin-top:4px">Send to group</button>`:'<span class="sub">not sent yet</span>'}`;
}
