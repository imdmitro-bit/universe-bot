/* Warehouse: trailer number, freight per stop from nose to door, photos, send to driver. */
import {trailerState,whSort,whTrips} from '../domain/status.js';
import {agentOf,cityST,isAgent,fmtDisp,labels,spotsTotal,whMessage,whPhotos} from '../domain/stops.js';
import {esc} from '../lib/utils.js';
import {S,can,canPrio,drv,trip,tripNo,user} from '../state.js';
import {prioTag,who2} from '../ui/components.js';
import {renderView,run,toast} from '../ui/render.js';

export const whEditing=t=>!!S.whEdit[t.id]||(!!t.trailerPrep&&!t.trailerReady);
export function whDraft(t){const o=S.whd[t.id]||(S.whd[t.id]={});
  t.stops.forEach(s=>{if(!o[s.id])o[s.id]={qty:s.wQty??'',unit:s.wUnit||'plts',spots:s.spots??'',photos:(s.photos||[]).slice()};});return o;}
export function viewWarehouse(){
  const list=whTrips().sort(whSort);
  const todo=list.filter(t=>!t.trailer||t.whDirty||whEditing(t)||S.whJust[t.id]==='sent');const sent=list.filter(t=>!todo.includes(t));
  return`<div class="row"><h1 class="h1">Warehouse</h1><span class="muted">${todo.length} to prepare · priority first, then by first delivery</span></div>
  <div class="grid2">${todo.length?todo.map(whCard).join(''):'<div class="card empty">All trailers are sent.</div>'}</div>
  ${sent.length?`<h2 class="h2" style="margin:22px 0 0">Sent <span class="muted" style="font-weight:400">${sent.length}</span></h2><div class="grid2">${sent.map(whCard).join('')}</div>`:''}
  <p class="foot">Sent trailers stay here until the truck leaves the yard. Edit and Resend replace the message in the driver's group.</p>`;
}
export function whCard(t){
  const d=drv(t.driverId);const ok=can('manifest');const L=labels(t.stops);const ed=whEditing(t);const[tl,tc]=trailerState(t);
  const just=S.whJust[t.id];const isSent=t.trailer&&!t.whDirty&&!ed&&!just;
  let body='';
  if(!t.trailerPrep){
    body=ok?`<div class="row"><input type="text" id="whnum-${t.id}" placeholder="Trailer #, e.g. 539571" style="flex:1"><button class="btn pri" data-a="whStart" data-id="${t.id}">Start preparing</button></div><p class="note" style="margin:0">Enter the trailer number and press Enter.</p>`:'<p class="note">Not started.</p>';
  }else if(ed&&ok){
    const W=whDraft(t);const order=t.stops.map((s,i)=>i).reverse().filter(i=>!isAgent(t.stops[i]));
    const sp=order.reduce((x,i)=>x+(t.stops[i].noFit?0:(+W[t.stops[i].id].spots||0)),0);
    body=`<div class="row"><span class="lbl">Load from nose to door</span><span class="sp"></span><span class="note">Trailer <b class="mono" style="color:var(--fg)">${esc(t.trailerNum)}</b></span></div>
    ${order.map((i,k)=>{const s=t.stops[i];const w=W[s.id];return`<div class="ldrow ${s.noFit?'nofit':''}">
      <div class="row" style="gap:8px"><span class="trk">${L[i]}</span><b>${esc(agentOf(t.stops,s)?cityST(agentOf(t.stops,s).city)+' (agent)':cityST(s.city))}</b><span class="muted" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.consignee)}</span><span class="sp"></span><span class="note">${k===0?'nose':k===order.length-1?'door':''}</span>
        <button class="btn sm ghost ${s.noFit?'danger':''}" data-a="noFit" data-id="${t.id}" data-i="${i}">${s.noFit?'Doesn\'t fit · undo':'Doesn\'t fit'}</button></div>
      ${s.noFit?'<p class="note" style="margin:6px 0 0">Consolidator is notified to change the trip.</p>':`<div class="ldf"><input type="number" min="0" placeholder="Qty" data-wf="qty" data-t="${t.id}" data-s="${s.id}" value="${esc(w.qty)}">
        <select data-wf="unit" data-t="${t.id}" data-s="${s.id}"><option value="plts" ${w.unit==='plts'?'selected':''}>plts</option><option value="crate" ${w.unit==='crate'?'selected':''}>crate</option></select>
        <input type="number" min="0" placeholder="Spots" data-wf="spots" data-t="${t.id}" data-s="${s.id}" value="${esc(w.spots)}">
        <span class="btn sm fileb">Photo<input type="file" accept="image/*" multiple data-wph="${t.id}" data-s="${s.id}"></span><button class="btn sm ghost" data-a="whSamplePh" data-id="${t.id}" data-s="${s.id}">Sample</button></div>
        ${w.photos.length?`<div class="photos" style="grid-template-columns:repeat(6,1fr)">${w.photos.map((p,j)=>`<div class="ph" ${p?`style="background-image:url('${p}')"`:''}>${p?'':'Photo '+(j+1)}</div>`).join('')}</div>`:''}`}
    </div>`;}).join('')}
    <div class="row"><span class="note" id="whsp-${t.id}">${sp}/30 spots</span><span class="sp"></span>${t.trailerReady?`<button class="btn ghost" data-a="whCancel" data-id="${t.id}">Cancel</button>`:''}<button class="btn pri" data-a="whSave" data-id="${t.id}">Save trailer</button></div>`;
  }else{
    const ph=whPhotos(t);
    body=`<pre class="whmsg">${esc(whMessage(t))}</pre>${ph.length?`<div class="photos" style="grid-template-columns:repeat(6,1fr)">${ph.map((p,j)=>`<div class="ph" ${p?`style="background-image:url('${p}')"`:''}>${p?'':'Photo '+(j+1)}</div>`).join('')}</div>`:''}
    ${ok?`<div class="row"><span class="note">${spotsTotal(t)}/30 spots · ${ph.length} photos</span><span class="sp"></span><button class="btn" data-a="whEdit" data-id="${t.id}">Edit</button>${t.status==='draft'&&t.trailerSendWithTrip?'<span class="note">Goes with the trip</span>':`<button class="btn ${isSent?'':'pri'}" data-a="whSendOpen" data-id="${t.id}">${t.trailer?'Resend':'Send to driver'}</button>`}</div>`:''}`;
  }
  if(just==='sent')body=`<div class="sentnote">✓ Sent to ${esc(d.name)} · Truck ${esc(d.truck)}<small>Moving to Sent…</small></div>`+body;
  return`<div class="card whc ${isSent?'dim':''} ${just==='sent'?'justsent':just==='moved'?'flash':''}" id="whc-${t.id}"><div class="row"><b class="mono">${esc(tripNo(t))}</b>${t.status==='draft'?'<span class="pill c-idle">Trip not sent</span>':''}${prioTag(t)}<span class="pill ${tc}">${tl}</span><span class="sp"></span><span class="note">1st ${fmtDisp(t.stops[0])||'time not set'}</span>
      ${canPrio()?`<button class="btn sm ghost" data-a="prio" data-id="${t.id}">${t.priority?'Unprioritize':'Priority'}</button>`:''}</div>
    <div class="row">${d?who2(d):'<span class="muted">No driver assigned yet</span>'}</div>
    <div class="whstops">${t.stops.map((s,i)=>`<span class="${s.noFit?'late':''}"><b>${L[i]}</b> ${esc(s.consignee)} — ${esc(cityST(s.city))}</span>`).join('')}</div>
    ${body}
  </div>`;
}

/* After Send the card stays in place for a moment, turns green, then moves to Sent and blinks there,
   so the person sees where it went. */
export function markSent(id){
  S.whJust[id]='sent';renderView();
  setTimeout(()=>{S.whJust[id]='moved';if(S.tab!=='warehouse')return delete S.whJust[id];renderView();
    const c=document.getElementById('whc-'+id);if(c)c.scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(()=>{delete S.whJust[id];const c2=document.getElementById('whc-'+id);if(c2){c2.classList.remove('flash');c2.classList.add('dim');}},1800);},1800);
}
export function whStart(id){
  const t=trip(id);const inp=document.getElementById('whnum-'+id);const v=inp?inp.value.trim():'';
  if(!v)return toast('Enter the trailer number',true);
  const r=run(t,'trailerPrep',{num:v,who:user(),src:'warehouse'});if(r.ok)toast(`Loading trailer ${v}. Start with the last stop.`);
}
