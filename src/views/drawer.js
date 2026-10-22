/* Trip card: preparing / departure, manifest, stops, history, stop details, Samsara, driver group. */
import {keyboard} from '../domain/bot.js';
import {confState,phaseLabel,readyToGo,trailerState,yardState} from '../domain/status.js';
import {REPORT_TYPES,STOP_LABEL,STOP_ORDER,agentOf,cityST,curIdx,detRisk,dispTs,fmtDisp,glab,groupMembers,isAgent,labels,refTxt,sortTs,spotTxt,spotsTotal,stopDistance,issuedLine,tnum,tripMessage,unitTxt,whMessage} from '../domain/stops.js';
import {MIN,ago,esc,fmtD,fmtT,hm,initials,lb,money,toInput} from '../lib/utils.js';
import {S,can,canEditTrip,canPrio,dispatchers,drv,groupTitle,trip} from '../state.js';
import {apptHtml,palletCell,prioTag,srcLabel,who2} from '../ui/components.js';

export function renderDrawer(){
  const el=document.getElementById('drawer');
  const t=S.drawer&&trip(S.drawer);if(t&&t.status==='draft'){S.drawer=null;el.innerHTML='';return;}
  if(window.TGWA){try{t?TGWA.BackButton.show():TGWA.BackButton.hide();}catch(e){}}
  if(!t){el.innerHTML='';return;}
  const d=drv(t.driverId);const[lab0,cls]=phaseLabel(t);const ci=curIdx(t);const dsp=can('dispatch');const rates=can('rates');
  const pre=!t.leftYard;const tot=t.stops.reduce((x,s)=>x+s.rate,0);
  let sel=S.sel[t.id];if(sel==null||sel>=t.stops.length)sel=ci>=0?ci:t.stops.length-1;
  el.innerHTML=`<div class="scrim" data-a="close"></div>
  <section class="drawer" role="dialog" aria-label="Trip ${t.id}">
    <div class="dh"><button class="btn ghost sm" data-a="close">Close</button>
      <h2 class="h1 mono">#${t.id}</h2>${prioTag(t)}<span class="pill ${cls}">${lab0}</span>
      <span data-ctx="driver" data-id="${t.id}" title="Right-click for options">${who2(d)}</span><span class="sp"></span>
      ${rates?`<span class="muted">Agreed total <b class="num" style="color:var(--fg)">${money(tot)}</b></span>`:''}
      ${canPrio()?`<button class="btn sm ghost" data-a="prio" data-id="${t.id}">${t.priority?'Remove priority':'Mark priority'}</button>`:''}
      ${canEditTrip()&&!t.closed?`<button class="btn sm pri" data-a="editTrip">Edit trip</button>`:''}
      <label class="row" style="gap:6px"><span class="lbl">Dispatcher</span>
        <select id="dDisp" ${dsp?'':'disabled'}>${dispatchers().map(n=>`<option ${t.dispatcher===n?'selected':''}>${n}</option>`).join('')}</select></label>
    </div>
    <div class="db">
      <div class="col">
        ${pre?t.alerts.map(a=>`<div class="alert">${fmtT(a.ts)} · ${esc(a.text)}</div>`).join(''):''}
        ${t.ack&&t.ack.pending?`<div class="alert row"><span style="flex:1;min-width:200px">Trip was changed ${ago(t.ack.ts)}. Waiting for the driver to acknowledge the new message.</span>${dsp?`<button class="btn sm" data-a="tact" data-x="ack">Driver informed</button>`:''}</div>`
          :t.ack?`<div class="okline">${t.ack.by==='driver'?'Driver confirmed changes':'Driver informed by dispatcher'} · ${esc(t.ack.who)} · ${fmtD(t.ack.ts)}</div>`:''}
        ${pre?prepCard(t,d,dsp):departedStrip(t)}
        ${manifestCard(t)}
        <div class="card sec"><div class="row"><span class="h2">${pre?'Route':'Stops'}</span><span class="note">click a stop to see its details</span><span class="sp"></span>
          ${dsp&&ci===-1&&!t.empty?`<button class="btn pri sm" data-a="tact" data-x="empty">Empty — Ready for Pickup</button>`:''}</div>
          <div class="col" style="gap:8px">${t.stops.map((s,i)=>stopCard(t,s,i,ci,sel,pre,dsp,rates)).join('')}</div>
        </div>
        <div class="card sec"><div class="row"><span class="h2">History</span><span class="sp"></span><span class="note">every change is kept</span></div>
          <ul class="hist">${t.history.slice().sort((a,b)=>b.ts-a.ts).map(h=>`<li class="${h.warn?'warn':''}"><span class="mono muted">${fmtD(h.ts)}</span><span><span class="src ${h.src}">${srcLabel(h.src)}</span></span><span>${esc(h.text)} <span class="muted">· ${esc(h.who)}</span></span></li>`).join('')}</ul>
        </div>
      </div>
      <div class="col">${stopDetail(t,d,sel,rates)}${samsaraCard(t,d)}${groupCard(t,d)}</div>
    </div>
  </section>`;
}
export function prepCard(t,d,dsp){
  const tracks=[
    ['Confirmation',confState(t),[['Sent',t.sentTs],[t.confirm==='refused'?'Refused':'Confirmed',t.confirm==='refused'?t.refuseTs:t.confirmTs]]],
    ['Trailer',trailerState(t),[['Preparing',t.trailerPrep],['Ready',t.trailerReady?.ts],['Sent',t.trailer?.ts]]],
    ['Yard',yardState(t,d),[['En route',t.enRouteYard],['At Yard',t.atYard],['Left',t.leftYard]]],
  ];
  return`<div class="card sec"><div class="row"><span class="h2">Preparing for trip</span>${readyToGo(t)?'<span class="pill c-ok">Ready to depart</span>':''}<span class="sp"></span>
    ${dsp&&['pending','refused'].includes(t.confirm)?`<button class="btn sm" data-a="tact" data-x="resend">Resend confirmation</button>`:''}
    ${dsp&&!t.atYard?`<button class="btn sm ghost" data-a="tact" data-x="atYard">Mark At the Yard</button>`:''}
    ${dsp?`<button class="btn sm ghost" data-a="tact" data-x="leftYard">Mark Left the Yard</button>`:''}</div>
    <div class="tracks">${tracks.map(([name,[l,c,sub],seq])=>{const k={Confirmation:'conf',Trailer:'trailer',Yard:'yard'}[name];return`<div class="track" data-ctx="trip" data-id="${t.id}" data-st="${k}" data-st-label="${name}"><span class="lbl">${name}${can('override')?` <button class="btn sm ghost stchg" data-a="ctxStatus" data-id="${t.id}" data-k="${k}">Change</button>`:''}</span><span class="pill ${c}">${l}</span><small>${esc(sub)}</small>
      <div class="seq">${seq.map(([n,ts])=>`<span class="${ts?'on':''}">${n}<b>${ts?fmtT(ts):'—'}</b></span>`).join('')}</div></div>`;}).join('')}</div>
    ${(dsp||can('build'))&&!t.leftYard&&d?`<div class="row" style="margin-top:10px"><span class="note">${t.confirm==='refused'?'Driver refused. Resend if it was a mistake, or take the driver off the trip and assign another one.':'To change the driver, unassign this one, then assign the new driver with Edit trip. Trailer and manifest stay with the trip.'}</span>
      <span class="sp"></span><button class="btn sm ghost danger" data-a="unassignAsk" data-id="${t.id}">Unassign driver</button></div>`:''}
  </div>`;
}
export function departedStrip(t){
  return`<div class="card strip"><span class="lbl">Departure</span>
    <span>Confirmed <b class="mono">${fmtT(t.confirmTs)}</b></span><span>Trailer <b class="mono">${esc(tnum(t)||'—')}</b></span>
    <span>At yard <b class="mono">${fmtT(t.atYard)}</b></span><span>Left yard <b class="mono">${fmtT(t.leftYard)}</b></span></div>`;
}
export function stopCard(t,s,i,ci,sel,pre,dsp,rates){
  const L=labels(t.stops);const lv=STOP_ORDER.indexOf(s.status);const g=groupMembers(t.stops,ci<0?0:ci);const cur=!pre&&ci>=0&&g.includes(i);
  const nxt={pending:'checkin',arrived:'checkin',checked_in:'indoor',in_door:'unload'}[s.status];const lead=i===g[0];
  return`<div class="stop ${cur?'cur':''} ${i===sel?'sel':''} ${s.status==='unloaded'?'done':''} ${s.noFit?'nofit':''}" data-a="selStop" data-i="${i}" tabindex="0">
    <div class="stop-h"><span class="stop-n">${L[i]}</span><b class="stop-f">${esc(s.consignee)}</b>${isAgent(s)?'<span class="pill c-warn">Agent</span>':''}${s.agent?`<span class="tag">dropped at agent ${esc(agentOf(t.stops,s)?.agentCode||'')}</span>`:''}${cur?'<span class="pill c-acc">Current</span>':''}
      ${s.noFit?'<span class="pill c-crit">Doesn\'t fit</span>':''}${s.reports.length?`<span class="tag">${s.reports.length} report${s.reports.length>1?'s':''}</span>`:''}${detRisk(s)?'<span class="pill c-crit">Detention risk</span>':''}
      <span class="sp"></span><span class="mono" title="Time the driver was dispatched for">${fmtDisp(s)||'<span class="muted">time not set</span>'}</span></div>
    <div class="stop-a">${esc(s.addr)}, ${esc(s.city)}</div>
    <div class="kv">${isAgent(s)?'':`<span><em>Appt</em>${apptHtml(s)}</span><span><em>Freight</em>${palletCell(s)}</span>`}${s.load?`<span><em>Load</em><span class="mono">${esc(s.load)}</span></span>`:''}${s.notes.length?`<span><em>Notes</em>${s.notes.length}</span>`:''}
      <span class="mi">${s.agent?'unloaded at the agent':s.legMi?`${s.legMi} mi from ${i===0?'yard':'previous stop'}`:'same address as previous'}</span></div>
    ${pre?'':`<div class="ss">${['arrived','checked_in','in_door','unloaded'].map((k,j)=>`<div class="${lv>=j+1?'on':''}">${STOP_LABEL[k]}<small>${s.t[k]?fmtT(s.t[k]):'—'}</small></div>`).join('')}</div>`}
    ${cur&&lead&&dsp&&nxt?`<div class="acts">${nxt==='indoor'?`<input type="text" id="door-${s.id}" placeholder="Door #" style="width:80px">`:''}
      <button class="btn sm" data-a="tact" data-x="${nxt}">Set ${STOP_LABEL[{checkin:'checked_in',indoor:'in_door',unload:'unloaded'}[nxt]]}${g.length>1?' for '+g.map(j=>L[j]).join(' + '):''}</button>
      <span class="note">Driver usually sets this from the bot; Samsara sets Arrived.</span></div>`:''}
  </div>`;
}

export function stopDetail(t,d,i,rates){
  const s=t.stops[i];const L=labels(t.stops);const x=stopDistance(t,i);const now=Date.now();const canNote=can('dispatch')||can('build');const dsp=can('dispatch');
  const dt=dispTs(s);let metrics;
  if(x.done){
    metrics=[['Arrived',fmtT(s.t.arrived)],['In door',fmtT(s.t.in_door)+(s.door?' · #'+esc(s.door):'')],['Unloaded',fmtT(s.t.unloaded)],['On site',hm((s.t.unloaded-s.t.arrived)/MIN)]];
  }else if(x.here){
    metrics=[['Status',STOP_LABEL[s.status]],['On site',hm((now-s.t.arrived)/MIN)+` <small>since ${fmtT(s.t.arrived)}</small>`],['Door',s.door?esc(s.door):'—'],['Dispatched for',fmtDisp(s)||'—']];
  }else{
    const vs=x.eta&&dt?(dt-x.eta)/MIN:null;
    const prevLbl=i===0?'yard':'Stop '+L[i-1];
    const leaveBy=dt?dt-s.legMi/52*60*MIN:null;
    const prevDep=i===0?t.leftYard:(t.stops[i-1].status==='unloaded'?t.stops[i-1].t.unloaded:null);
    const lb2=!leaveBy?'ASAP stop':prevDep?(prevDep<=leaveBy?`left ${fmtT(prevDep)} · on time`:`<span class="late">left ${fmtT(prevDep)} · ${hm((prevDep-leaveBy)/MIN)} late</span>`)
      :(now>leaveBy?`<span class="late">passed ${hm((now-leaveBy)/MIN)} ago</span>`:`in ${hm((leaveBy-now)/MIN)}`);
    metrics=[['Miles',x.mi+' mi <small>'+x.label+'</small>'],['Drive + stops',hm(x.drive)],['ETA',x.eta?fmtT(x.eta):'after departure'],
      ['vs dispatch time',!dt?'ASAP':vs==null?'in '+hm((dt-now)/MIN):vs>=0?`<span style="color:var(--ok)">${hm(vs)} early</span>`:`<span class="late">${hm(-vs)} late</span>`],
      [`Leave ${prevLbl} by`,leaveBy?`${fmtT(leaveBy)} <small>${lb2}</small>`:'ASAP'],['Leg',`${s.legMi} mi <small>${prevLbl} → stop ${L[i]}</small>`]];
  }
  const ph=s.photos||[];
  const rs=S.rs===s.id;const dtf=S.dt===s.id;const rep=S.rep&&S.rep.id===s.id?S.rep.type:null;
  const arrivedFor=s.t.arrived?hm((now-s.t.arrived)/MIN):'';
  return`<div class="card sec detail">
    <div class="row"><span class="h2">Stop ${L[i]}</span><span class="note">${i+1} of ${t.stops.length} loads</span><span class="pill ${s.status==='unloaded'?'c-ok':s.status==='pending'?'c-idle':'c-acc'}">${STOP_LABEL[s.status]}</span><span class="sp"></span>
      <button class="btn sm ghost" data-a="selStop" data-i="${i-1}" ${i===0?'disabled':''} aria-label="Previous stop">Prev</button><button class="btn sm ghost" data-a="selStop" data-i="${i+1}" ${i===t.stops.length-1?'disabled':''} aria-label="Next stop">Next</button></div>
    <div><b style="font-size:14px">${esc(s.consignee)}</b><div class="addr">${esc(s.addr)}, ${esc(s.city)}</div></div>
    ${s.noFit?`<div class="alert">Warehouse marked this load as <b>doesn't fit</b>. Change the trip: remove the stop or move it to another trip.</div>`:''}
    ${detRisk(s)?`<div class="alert row"><span style="flex:1;min-width:200px"><b>Detention may occur.</b> Broker appt ${fmtT(s.brokerAppt)}, on site since ${fmtT(s.t.arrived)} (${arrivedFor}). Notify the broker.</span>${dsp?`<button class="btn sm" data-a="detNotify" data-i="${i}">Broker notified</button>`:''}</div>`
      :s.detNotified?`<div class="okline">Broker notified about possible detention · ${fmtD(s.detNotified.ts)} · ${esc(s.detNotified.who)}</div>`:''}
    <div class="metrics">${metrics.map(([k,v])=>`<div><span class="lbl">${k}</span><b>${v}</b></div>`).join('')}</div>
    <div class="dsec"><div class="row"><span class="lbl">Times</span><span class="sp"></span>
        ${(dsp||can('build'))&&s.status!=='unloaded'&&!dtf?`<button class="btn sm ghost" data-a="dtOpen" data-i="${i}">Change dispatched time</button>`:''}${dsp&&s.status!=='unloaded'&&!rs?`<button class="btn sm ghost" data-a="rsOpen" data-i="${i}">Reschedule appt</button>`:''}</div>
      <div class="appts three"><div><small>Dispatched for</small><b class="mono">${fmtDisp(s)||'—'}</b><span class="note">sent to driver</span></div>
        <div><small>Broker appt (RC)</small><b class="mono">${fmtD(s.brokerAppt)}</b></div>
        <div><small>Our appt</small><b class="mono">${s.resched?fmtD(s.appt):'—'}</b>${s.resched?`<span class="note">${esc(s.resched.who)} · ${esc(s.resched.reason)}</span>`:'<span class="note">not rescheduled</span>'}</div></div>
      ${dtf?`<div class="row" style="margin-top:8px"><input type="datetime-local" id="dtDate" value="${toInput(dt||sortTs(s))}"><label class="chk"><input type="checkbox" id="dtAsap" ${s.disp&&s.disp.asap?'checked':''}> ASAP</label>
        <button class="btn sm pri" data-a="dtSave" data-i="${i}">Save and update driver</button><button class="btn sm ghost" data-a="dtCancel">Cancel</button></div>`:''}
      ${rs?`<div class="row" style="margin-top:8px"><input type="datetime-local" id="rsDate" value="${toInput(s.appt)}"><input type="text" id="rsReason" placeholder="Reason, e.g. receiver moved us to 10:00" style="flex:1;min-width:160px">
        <button class="btn sm pri" data-a="rsSave" data-i="${i}">Save</button><button class="btn sm ghost" data-a="rsCancel">Cancel</button></div>`:''}
      <p class="note" style="margin:6px 0 0">Detention alerts count from the broker appointment and are off when we reschedule.</p></div>
    <div class="kv" style="margin:0"><span><em>Load</em><span class="mono">${esc(s.load)}</span></span>${refTxt(s)?`<span><em>Ref</em><span class="mono">${esc(refTxt(s))}</span></span>`:''}<span><em>Broker</em>${esc(s.broker)}</span><span><em>Freight</em>${palletCell(s)}</span><span><em>Weight</em>${lb(s.weight)}</span>${rates?`<span><em>Rate</em>${money(s.rate)}${s.split?` <span class="muted">½ of ${money(s.loadRate)}</span>`:''}</span>`:''}</div>
    <div class="dsec"><span class="lbl">Report</span>
      ${dsp?`<div class="row" style="gap:6px;margin-top:6px">${Object.entries(REPORT_TYPES).map(([k,l])=>`<button class="btn sm ${rep===k?'pri':''}" data-a="repOpen" data-i="${i}" data-k="${k}">${l}</button>`).join('')}</div>`:''}
      ${rep?reportForm(s,i,rep):''}
      ${s.reports.length?`<ul class="notes">${s.reports.map(r=>`<li><span class="tag rep-${r.type}">${REPORT_TYPES[r.type]}</span> ${r.amount?money(r.amount)+' · ':''}${r.hours?r.hours+' h · ':''}${r.plt?r.plt+' plt · ':''}${esc(r.note)} <span class="muted">· ${esc(r.who)} ${fmtD(r.ts)}</span></li>`).join('')}</ul>`:(dsp?'':'<p class="muted">No reports.</p>')}</div>
    <div class="dsec"><span class="lbl">Warehouse photos of this stop${tnum(t)?' · trailer '+esc(tnum(t)):''}</span>
      ${ph.length?`<div class="photos">${ph.map((p,k)=>`<div class="ph" ${p?`style="background-image:url('${p}')"`:''}>${p?'':'Photo '+(k+1)}</div>`).join('')}</div>`:'<p class="note">No photos yet. Warehouse adds them while loading.</p>'}</div>
    <div class="dsec"><span class="lbl">Comment from Warehouse</span><p>${s.whNote||t.whComment?esc(s.whNote||t.whComment):'<span class="muted">—</span>'}</p></div>
    <div class="dsec"><span class="lbl">Consolidator note</span><p>${s.consNote?esc(s.consNote):'<span class="muted">—</span>'}</p></div>
    <div class="dsec"><span class="lbl">Dispatcher notes</span>
      ${s.notes.length?`<ul class="notes">${s.notes.map(n=>`<li><span class="mono muted">${fmtD(n.ts)}</span> <b>${esc(n.who)}</b> ${esc(n.text)}</li>`).join('')}</ul>`:'<p class="muted">No notes yet.</p>'}
      ${canNote?`<div class="row" style="margin-top:6px"><input type="text" id="note-${s.id}" placeholder="Add a note for this stop" style="flex:1"><button class="btn sm" data-a="addNote" data-i="${i}">Add</button></div>`:''}</div>
    ${rates?`<div class="dsec row"><span class="rcfile"><span class="lbl">Rate Confirmation</span><span class="mono">${esc(s.rcFile)}</span></span><span class="sp"></span>
      <button class="btn" data-a="rcOpen" data-id="${s.id}">Open Rate Confirmation</button>
      ${canNote?`<span class="btn sm ghost fileb">Upload revised RC<input type="file" accept="application/pdf,.pdf" data-rev="${i}"></span><button class="btn sm ghost" data-a="revSample" data-i="${i}">Sample revised RC</button>`:''}</div>`:''}
  </div>`;
}
export function reportForm(s,i,type){
  const suggest=type==='detention'&&s.t.arrived?Math.max(0,((s.t.unloaded||Date.now())-Math.max(s.t.arrived,s.brokerAppt))/3600000-2).toFixed(1):'';
  return`<div class="repform">
    ${type==='lumper'?`<label>Amount, $<input type="number" id="repAmount" placeholder="250"></label>`:''}
    ${type==='detention'?`<label>Billable hours<input type="number" step="0.25" id="repHours" value="${suggest}"></label><span class="note">2 h free after broker appt or arrival, whichever is later</span>`:''}
    ${type==='damage'?`<label>Pallets affected<input type="number" id="repPlt" placeholder="1"></label>`:''}
    <label style="flex:1;min-width:180px">Note<input type="text" id="repNote" placeholder="${type==='lumper'?'Paid with Comdata, receipt in group':type==='damage'?'What was damaged, who signed':'What happened'}"></label>
    <button class="btn sm pri" data-a="repSave" data-i="${i}">Save ${REPORT_TYPES[type]}</button><button class="btn sm ghost" data-a="repCancel">Cancel</button>
  </div>`;
}
export function manifestCard(t){
  const has=!!t.trailerReady;const L=labels(t.stops);const order=t.stops.map((s,i)=>i).reverse().filter(i=>!isAgent(t.stops[i]));
  return`<div class="card sec"><div class="row"><span class="h2">Trailer and manifest</span>${tnum(t)?`<span class="mono">Trailer ${esc(tnum(t))}</span>`:''}${has?`<span class="note">${spotsTotal(t)}/30 spots</span>`:''}<span class="pill ${trailerState(t)[1]}">${trailerState(t)[0]}</span><span class="sp"></span>
    ${can('manifest')&&!t.leftYard?`<button class="btn sm ghost" data-a="whGo" data-id="${t.id}">${has?'Edit in Warehouse':'Open in Warehouse'}</button>`:''}</div>
    ${has?`<div class="mgrid"><table class="mtbl"><thead><tr><th>Load order</th><th>Stop</th><th>City</th><th>Freight</th><th>Photos</th></tr></thead><tbody>
      ${order.map((i,k)=>{const s=t.stops[i];return`<tr class="${s.noFit?'late':''}"><td class="muted">${k===0?'nose':k===order.length-1?'door':k+1}</td><td>${L[i]}</td><td>${esc(agentOf(t.stops,s)?cityST(agentOf(t.stops,s).city)+' (agent)':cityST(s.city))}</td><td>${s.noFit?'doesn\'t fit':esc(unitTxt(s.wQty??0,s.wUnit)+' / '+spotTxt(s.spots??0))}</td><td>${(s.photos||[]).length}</td></tr>`;}).join('')}</tbody></table>
      <div><span class="lbl">Message to driver</span><pre class="whmsg">${esc(whMessage(t))}</pre></div></div>`
    :'<p class="note" style="margin:0">Warehouse enters the trailer number, then freight, spots and photos for each stop while loading.</p>'}
  </div>`;
}
export function groupCard(t,d){
  const as=S.actAs[t.id]||d.name;const m=d.members.find(x=>x.name===as);const kb=keyboard(t);
  const live=t.chat.filter(x=>!x.deleted);const last=live[live.length-1];const lastTrip=[...live].reverse().find(x=>x.kind==='trip');
  const tagged=d.members.filter(x=>x.tags.length);
  return`<div class="card sec">
    <div class="row"><div class="ava">${initials(d.name)}</div><div style="min-width:0"><b>${esc(groupTitle(d))}</b><div class="note">${d.members.length} members · chat happens in Telegram</div></div><span class="sp"></span>
      <button class="btn sm" data-a="openTg">Open in Telegram</button></div>
    <div class="row" style="gap:5px;margin-top:4px">${tagged.map(x=>x.tags.map(g=>`<span class="tag ${g}">${esc(x.name)} · ${g}</span>`).join('')).join('')}</div>
    <div class="row" style="margin-top:10px;gap:6px"><button class="btn sm ghost" data-a="msgShow">${S.msgOpen?'Hide':'Show'} trip message</button><button class="btn sm ghost" data-a="sim">${S.simOpen?'Hide':'Show'} bot button simulator <span class="muted">(prototype)</span></button></div>
    ${S.msgOpen?`<pre class="whmsg" style="margin-top:8px">${esc(tripMessage(t,lastTrip&&lastTrip.changed)+issuedLine(lastTrip&&lastTrip.by))}</pre>`:''}
    ${S.simOpen?`<div class="sim">
      <p class="note" style="margin:0 0 8px">Presses the bot's buttons as a group member, to test the tag rules. In production these buttons live in the Telegram group.</p>
      <label class="row" style="gap:6px"><span class="lbl">Press as</span><select id="actAs" data-id="${t.id}" style="flex:1">${d.members.map(x=>`<option value="${esc(x.name)}" ${x.name===as?'selected':''}>${esc(x.name)}${x.tags.length?' — '+x.tags.join(', '):''}</option>`).join('')}</select></label>
      ${last?`<div class="msg" style="margin-top:8px"><span class="from">Last bot post · ${fmtT(last.ts)}${last.by?' · issued by '+esc(last.by):''}</span>${last.kind==='trip'?(last.changed?'YOUR TRIP HAS CHANGES #':'YOUR NEW TRIP #')+t.id:last.kind==='trailer'?`Trailer ${esc(last.num)} with ${last.photos.length} photos`:esc(last.text)}</div>`:''}
      ${kb.length?`<div class="kbd">${kb.map(([a,l,dis])=>`<button data-a="chat" data-x="${a}" ${dis?'disabled':''}>${l}</button>`).join('')}</div>`:'<p class="note">No buttons right now.</p>'}
      <p class="note" style="margin:6px 0 0">Tags of ${esc(as)}: ${m&&m.tags.length?m.tags.join(', '):'none — read only'}</p></div>`:''}
  </div>`;
}
export function samsaraCard(t,d){
  const ci=curIdx(t);const s=ci>=0?t.stops[ci]:null;const dt=s?dispTs(s):null;const late=s&&d.eta&&dt&&d.eta>dt+15*MIN;
  return`<div class="card sam"><div class="row"><span class="h2">Samsara</span><span class="src samsara">simulated</span><span class="sp"></span><span class="trk">${esc(d.truck)}</span></div>
    <dl><dt>Location</dt><dd>${esc(d.loc)}</dd><dt>Speed</dt><dd>${d.speed?d.speed+' mph':'Stopped'}</dd>
    ${!t.leftYard?`<dt>To yard</dt><dd>${t.atYard?'At the yard':d.yardEta?'ETA '+fmtT(d.yardEta):'Not heading to yard'}</dd>`:`<dt>Next stop</dt><dd>${s?esc(s.consignee)+', '+esc(s.city):'—'}</dd>
    <dt>ETA</dt><dd>${d.eta&&s?`<span class="${late?'late':''}">${fmtT(d.eta)}${late?` · ${hm((d.eta-dt)/MIN)} after dispatched time`:dt?' · on time':' · ASAP stop'}</span>`:'—'}</dd>`}
    <dt>Last ping</dt><dd>${ago(d.ping)}</dd></dl>
    <button class="btn sm" data-a="gps">Simulate next GPS event</button>
    <p class="note" style="margin:8px 0 0">Auto rules: heading to yard → En route to Yard. Enters yard → At the Yard. Leaves yard → Left the Yard only if the trip is confirmed and the trailer sent. Enters a stop's address area → Arrived.</p></div>`;
}
