/* Dispatch Board: trucks after they leave the yard. */
import {GROUP,GROUPS,attention,dMatch,phase,phaseLabel} from '../domain/status.js';
import {STOP_LABEL,STOP_ORDER,curIdx,dispTs,glab,groupsOf,pltTotal,sortTs} from '../domain/stops.js';
import {MIN,ago,esc,fmtD,fmtT} from '../lib/utils.js';
import {DRIVERS,S,TRIPS,activeTrip,dispatchers,drv,hasRole,user} from '../state.js';
import {applySort,driverTh,progress,srcLabel,sth,tile,who2} from '../ui/components.js';

export function boardData(){
  return DRIVERS.map(d=>{const t=activeTrip(d);if(!t||!t.leftYard)return null;const p=phase(t);return{d,t,p,g:GROUP[p],a:attention(t,d)};}).filter(Boolean);
}
export function viewBoard(){
  const all=boardData();
  const isDisp=hasRole('dispatcher');
  return`
  <div class="row"><h1 class="h1">Dispatch Board</h1><span class="muted">${all.length} trucks out of the yard · trips before departure are on Preparing</span><span class="sp"></span>
    <input type="text" id="fSearch" placeholder="Driver, truck, trip, load #, city" value="${esc(S.q)}" style="width:250px">
    <select id="fDisp"><option value="all">All dispatchers</option>${isDisp?`<option value="mine" ${S.disp==='mine'?'selected':''}>My trips (${user()})</option>`:''}${dispatchers().map(n=>`<option ${S.disp===n?'selected':''}>${n}</option>`).join('')}</select>
    <button class="btn" data-a="tick" title="Simulates the next batch of location events from Samsara">Run Samsara tick</button></div>
  <div class="sumrow">${GROUPS.map(([k,l])=>tile('grp',k,l,all.filter(r=>dMatch(r,k)).map(r=>{const ci=curIdx(r.t);return{id:r.t.id,d:r.d,name:r.d.name,sub:`${r.t.id} · ${phaseLabel(r.t)[0]}${k==='attn'?' · '+r.a[0]:ci>=0?' · '+r.t.stops[ci].city:r.t.emptyAt?' · '+r.t.emptyAt:''}`};}),S.grp===k,k==='attn'||k==='det'||k==='late'?'attn':'')).join('')}</div>
  <div class="boardwrap">
    <div class="tblwrap"><table class="tbl"><thead><tr>${driverTh('board')}${sth('board','trip','Trip')}${sth('board','status','Status')}<th>Stops</th>${sth('board','next','Next stop · ETA')}${sth('board','loc','Samsara')}${sth('board','disp','Dispatcher')}${sth('board','updated','Updated')}</tr></thead><tbody id="boardBody">${boardRows()}</tbody></table></div>
    <aside class="card feed"><div class="row"><span class="h2">Activity</span><span class="sp"></span><span class="note">all trips</span></div><ol>${feedItems()}</ol></aside>
  </div>
  <p class="foot">Sample data for the prototype. Samsara locations, ETAs and RC extraction are simulated.</p>`;
}
export function boardRows(){
  const q=S.q.trim().toLowerCase();const order=['stop','road','empty'];
  let rows=boardData().filter(r=>{
    if(!dMatch(r,S.grp))return false;
    if(S.disp==='mine'&&(!r.t||r.t.dispatcher!==user()))return false;
    if(!['all','mine'].includes(S.disp)&&(!r.t||r.t.dispatcher!==S.disp))return false;
    if(q){const hay=[r.d.name,r.d.truck,r.t?.id,...(r.t?.stops||[]).flatMap(s=>[s.load,s.city,s.consignee])].join(' ').toLowerCase();if(!hay.includes(q))return false;}
    return true;
  });
  rows.sort((a,b)=>(b.a.length>0)-(a.a.length>0)||order.indexOf(a.g)-order.indexOf(b.g)||((b.t?.updated||0)-(a.t?.updated||0)));
  const stage=r=>{const ci=curIdx(r.t);return ci<0?999:ci*10+STOP_ORDER.indexOf(r.t.stops[ci].status);};
  rows=applySort('board',rows,{truck:r=>+r.d.truck,name:r=>r.d.name,trip:r=>r.t.id,status:stage,next:r=>{const ci=curIdx(r.t);return ci<0?null:(r.d.eta||sortTs(r.t.stops[ci]));},loc:r=>r.d.loc,disp:r=>r.t.dispatcher,updated:r=>-r.t.updated});
  if(!rows.length)return`<tr><td colspan="8" class="empty">No drivers match these filters.</td></tr>`;
  return rows.map(({d,t,a})=>{
    const[lab,cls]=phaseLabel(t);const ci=t?curIdx(t):-1;const s=t&&ci>=0?t.stops[ci]:null;
    let next='<span class="muted">—</span>';
    if(s){const late=d.eta&&dispTs(s)&&d.eta>dispTs(s)+15*MIN;
      next=`${esc(s.consignee)}<span class="sub">${esc(s.city)} · ${fmtD(s.appt)}${s.resched?' (ours)':''}${d.eta&&t.leftYard&&s.status==='pending'?` · <span class="${late?'late':''}">ETA ${fmtT(d.eta)}</span>`:''}</span>`;}
    else if(t&&t.empty)next=`Empty in ${esc(t.emptyAt)}<span class="sub">${t.backhaul.dispatcher?'Backhaul: '+esc(t.backhaul.dispatcher):'Needs backhaul'}</span>`;
    return`<tr class="${a.length?'attn':''}" data-a="${t?'open':'none'}" data-id="${t?t.id:''}" data-ctx="trip">
      <td>${who2(d)}</td>
      <td>${t?`<span class="mono">${t.id}</span><span class="sub">${groupsOf(t.stops).length} stop${groupsOf(t.stops).length>1?'s':''}${pltTotal(t)!=null?' · '+pltTotal(t)+' plt':''}</span>`:'<span class="muted">No trip</span>'}</td>
      <td data-st="stop" data-st-label="Stop"><span class="pill ${cls}">${lab}</span>${a.length?`<span class="why">${esc(a[0])}</span>`:''}</td>
      <td>${t?progress(t):''}${s&&s.status!=='pending'?`<span class="sub">S${glab(t,ci)} ${STOP_LABEL[s.status]}${s.door?' · Door '+esc(s.door):''}</span>`:''}</td>
      <td>${next}</td>
      <td><span class="loc" title="${esc(d.loc)}">${esc(d.loc)}</span><span class="sub">${d.speed?d.speed+' mph · ':''}ping ${ago(d.ping)}</span></td>
      <td>${t?esc(t.dispatcher):'<span class="muted">—</span>'}</td>
      <td class="muted num">${t?ago(t.updated):''}</td></tr>`;
  }).join('');
}
export function feedItems(){
  const ev=[];TRIPS.forEach(t=>{if(t.status!=='active')return;const d=drv(t.driverId);t.history.forEach(h=>ev.push({...h,t,d}));});
  ev.sort((a,b)=>b.ts-a.ts);
  return ev.slice(0,18).map(e=>`<li data-a="open" data-id="${e.t.id}"><time>${fmtT(e.ts)}</time><p>${esc(e.text)}<small>${esc(e.d.name)} · ${e.t.id} · <span class="src ${e.src}">${srcLabel(e.src)}</span></small></p></li>`).join('');
}
