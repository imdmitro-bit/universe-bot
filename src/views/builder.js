/* Trip builder: RC upload (read by Claude when a key is set, simulated otherwise), stop editor, message to driver. */
import {AI_MODEL_LABEL,aiReady} from '../ai/config.js';
import {readRc} from '../ai/rcReader.js';
import {CONSIGNEES} from '../data/sample.js';
import {act,grantDispatcher} from '../domain/actions.js';
import {STOP_LABEL,cityST,fmtDisp,groupMembers,groupsOf,isAgent,labels,mkAgentStop,mkStop,msgRows,parseDispLine,rawAddrKey,refTxt,stopBlockAuto,stopHead,tripMessage} from '../domain/stops.js';
import {MIN,NOW,esc,fmtD,pick,rint,rnd,toInput,uid} from '../lib/utils.js';
import {AGENTS,DRIVERS,POOL,S,TRIPS,activeTrip,can,canPrio,dispatchers,drv,groupTitle,isAfterHours,isDraftId,newTrip,trip,tripNo,user} from '../state.js';
import {render,renderView,toast} from '../ui/render.js';

export const cloneStop=s=>JSON.parse(JSON.stringify(s));
export function startBuilder(t){
  const base={open:null,clearArm:0,pick:false};
  S.builder=t?{...base,id:t.id,num:isDraftId(t.id)?'':t.id,active:t.status==='active',stops:t.stops.map(cloneStop),notes:(t.notes||[]).map(n=>({...n})),driverId:t.driverId||'',dispatcher:t.dispatcher||'',priority:!!t.priority}
    :{...base,id:null,num:'',tripObj:{...newTrip(),id:'draft-'+uid()},active:false,stops:[],notes:[],driverId:'',dispatcher:'',priority:false};
  S.tab='trips';
}
export const bId=()=>S.builder.num||'_____';
const rowsOf=B=>B.stops.filter(s=>!s.extracting);
export function placeRow(stops,row){
  const idx=stops.indexOf(row);stops.splice(idx,1);const raw=rawAddrKey(row);let last=-1;
  stops.forEach((s,j)=>{if(!s.agent&&!isAgent(s)&&!s.extracting&&rawAddrKey(s)===raw&&String(row.addr||'').trim())last=j;});
  if(last>=0&&stops[last].linkKey)row.linkKey=stops[last].linkKey;
  if(last>=0)last=groupMembers(stops,last).slice(-1)[0];
  if(last>=0){stops.splice(last+1,0,row);const lead=stops[groupMembers(stops,last+1)[0]];row.disp=lead.disp?{...lead.disp}:null;row.legMi=0;}
  else stops.splice(idx,0,row);
}
/* An RC dropped on an empty stop card fills that card in place; otherwise it adds stops at the end. */
const putPlaceholder=(B,ph,targetId)=>{const ti=targetId?B.stops.findIndex(x=>x.id===targetId):-1;const blank=ti>=0?B.stops[ti]:null;if(blank)B.stops.splice(ti,1,ph);else B.stops.push(ph);return blank;};
export const isBlank=s=>!!s&&!s.extracting&&!isAgent(s)&&!s.agent&&!String(s.consignee||'').trim()&&!String(s.addr||'').trim()&&!String(s.city||'').trim();
export function addBlankStop(){const s=mkStop({c:'',addr:'',city:''},0);Object.assign(s,{load:'',broker:'',refType:'DEL',refNum:'',rate:0,loadRate:0,weight:0,pallets:0,consNote:'',rcFile:''});S.builder.stops.push(s);return s;}
export function extract(file,two,targetId){
  const B=S.builder;const ph={id:uid(),extracting:true,file:file||`RC_${rint(10000,99999)}.pdf`};putPlaceholder(B,ph,targetId);
  let ph2=null;if(two){ph2={id:uid(),extracting:true,file:ph.file};B.stops.splice(B.stops.indexOf(ph)+1,0,ph2);}
  setTimeout(()=>{
    const ready=B.stops.filter(s=>!s.extracting);
    let c;if(ready.length&&rnd()<.3&&!two){const r=pick(ready);c={c:r.consignee,city:r.city,addr:r.addr};}
    else{const used=new Set(ready.map(s=>s.consignee));let n=0;do{c=pick(CONSIGNEES);n++;}while(used.has(c.c)&&n<30);}
    const prev=ready.map(s=>s.brokerAppt);const ap=(prev.length?Math.max(...prev):NOW+18*60*MIN)+rint(2,4)*60*MIN;
    const s1=mkStop(c,ap);Object.assign(ph,s1,{id:ph.id,extracting:false,ai:true,file:ph.file,rcFile:ph.file});
    if(ph2){let c2;do{c2=pick(CONSIGNEES);}while(c2.c===c.c);const s2=mkStop(c2,ap+rint(2,4)*60*MIN);
      Object.assign(ph2,s2,{id:ph2.id,extracting:false,ai:true,file:ph.file,rcFile:ph.file,load:ph.load,broker:ph.broker,refType:ph.refType});
      const total=ph.rate+ph2.rate;[ph,ph2].forEach(x=>{x.split=2;x.loadRate=total;x.rate=Math.round(total/2);});}
    placeRow(B.stops,ph);if(ph2)placeRow(B.stops,ph2);
    if(S.builder===B&&S.tab==='trips')renderView();
  },1300);
}
/* A real PDF goes to Claude when a key is set; otherwise the upload is simulated like Sample RC. */
export function addRcFile(file,targetId){
  if(aiReady())return readReal(file,targetId);
  extract(file.name,false,targetId);toast('AI is not connected, so this RC was simulated. Add the key in AI settings',true);
}
const parseLocal=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v||'');return m?new Date(+m[1],m[2]-1,+m[3],+m[4],+m[5]).getTime():0;};
const hhmm=v=>(v||'').slice(11,16);
const cityLine=p=>`${p.city}, ${p.state} ${p.zip}`.trim().replace(/^,\s*/,'');
const winTxt=(a,b)=>{const t=hhmm(a);return b&&hhmm(b)!==t?`${t}–${hhmm(b)}`:t&&t!=='00:00'?t:'';};
function loadOwner(B,load){
  const k=String(load).trim().toLowerCase();if(!k)return null;const same=s=>!s.extracting&&String(s.load).trim().toLowerCase()===k;
  if(B.stops.some(same))return'this trip';
  const t=TRIPS.find(t=>t.id!==B.id&&t.stops.some(same));if(t)return'trip #'+tripNo(t);
  const ids=new Set(B.stops.map(s=>s.id));return POOL.some(s=>!ids.has(s.id)&&same(s))?'Unassigned loads':null;
}
/* Claude's JSON for one RC → builder stop rows (one per delivery; the RC rate is split between them). */
export function rcToStops(r,file){
  const n=r.deliveries.length,total=Math.round((+r.total_rate||0)*100)/100,url=URL.createObjectURL(file);
  const p=r.pickup,pickup={name:p.facility,addr:p.address,city:cityLine(p),ts:parseLocal(p.date_start),win:winTxt(p.date_start,p.date_end)};
  const rows=r.deliveries.map(d=>{
    const s=mkStop({c:d.facility,addr:d.address,city:cityLine(d)},parseLocal(d.appt_start)||NOW);
    const w=winTxt(d.appt_start,d.appt_end);
    const note=d.appt_end&&hhmm(d.appt_end)!==hhmm(d.appt_start)?`Delivery window ${w} (RC)`:!w?'RC gives the delivery date only, no time':'';
    return Object.assign(s,{ai:true,file:file.name,rcFile:file.name,rcUrl:url,load:r.load_number||s.load,broker:r.broker,pickup,
      refType:d.delivery_number?d.delivery_number_type||'REF':'',refNum:d.delivery_number,weight:0,pallets:0,
      rate:n>1?Math.round(total/n):total,loadRate:total,split:n>1?n:0,consNote:note});
  });
  return rows;
}
async function readReal(file,targetId){
  const B=S.builder;const ph={id:uid(),extracting:true,file:file.name};const blank=putPlaceholder(B,ph,targetId);
  const drop=()=>{const i=B.stops.indexOf(ph);if(i>=0){if(blank)B.stops.splice(i,1,blank);else B.stops.splice(i,1);}};
  const done=()=>{if(S.builder===B&&S.tab==='trips')renderView();};
  let r;
  try{r=await readRc(file);}catch(e){drop();done();return toast(`${file.name}: ${e.message}`,true);}
  if(!r.is_rate_confirmation){drop();done();return toast(`${file.name} is not a rate confirmation${r.not_rc_reason?': '+r.not_rc_reason:''}`,true);}
  if(!r.deliveries.length){drop();done();return toast(`${file.name}: no delivery stop found`,true);}
  const owner=loadOwner(B,r.load_number);
  if(owner){drop();done();return toast(`Load ${r.load_number} is already on ${owner}. Use "Upload revised RC" on that stop, or remove the stop first`,true);}
  const rows=rcToStops(r,file);const n=rows.length;
  B.stops.splice(B.stops.indexOf(ph),1,...rows);rows.forEach(s=>placeRow(B.stops,s));
  done();toast(`Read ${file.name}: ${n} stop${n>1?'s':''} · `+(r.cached?'already read before, no cost':`${r.usage.input.toLocaleString('en-US')} in / ${r.usage.output.toLocaleString('en-US')} out tokens`));
}
export function viewBuilder(){
  const B=S.builder;const rates=can('rates');const st=B.stops;const L=labels(st);const ids=new Set(st.map(s=>s.id));const pool=POOL.filter(s=>!ids.has(s.id));
  const title=B.active?`Edit trip #${B.id}`:`${B.id?'Edit draft':'New trip'} <label class="tnum">#<input type="text" id="bNum" inputmode="numeric" autocomplete="off" placeholder="Trip number" value="${esc(B.num)}"></label>`;
  const cards=B.notes.filter(n=>n.after===null).map(noteCard);
  st.forEach((s,i)=>{if(s.agent)return;
    cards.push(s.extracting?`<div class="cube"><div class="cube-h"><span class="stop-n">…</span><b class="cube-file">Reading ${esc(s.file)}</b></div><span class="ai">AI extracting</span><div class="shimmer"></div></div>`
      :isAgent(s)?agentTile(B,s,i,L):stopEditor(B,s,i,L,rates));
    const inside=isAgent(s)?st.filter(x=>x.agent===s.id).map(x=>x.id):[];
    B.notes.filter(n=>n.after===s.id||inside.includes(n.after)).forEach(n=>cards.push(noteCard(n)));
  });
  const lf=B.linkFrom!=null?B.stops.findIndex(x=>x.id===B.linkFrom):-1;
  return`${lf>=0?`<div class="alert row" style="margin-bottom:10px"><span style="flex:1">Choose the stop that is the same place as stop ${L[lf]}. They become ${L[lf].replace(/[A-Z]$/,'')||L[lf]}A / B.</span><button class="btn sm" data-a="linkCancel">Cancel</button></div>`:''}
  <div class="row"><button class="btn ghost sm" data-a="cancelB">Back to trips</button><h1 class="h1">${title}</h1>${B.active?'<span class="note">Saving sends the driver a new message: "Your trip has changes"</span>':''}
    <span class="sp"></span>${!B.active&&(st.length||B.notes.length)?`<button class="btn sm ghost danger" data-a="clearAll">${B.clearArm>Date.now()?'Confirm: clear all':'Clear all'}</button>`:''}</div>
  <div class="bld">
    <div class="col">
      <div class="drop" id="drop"><p><b>Upload Rate Confirmations</b><small>PDF. AI reads the facility, address, City ST ZIP, DEL#, appointment, load #, broker and rate. The dispatched time is yours.
        ${aiReady()?`<span class="okline">AI connected · ${AI_MODEL_LABEL}</span>`:`AI not connected, uploads are simulated. <a href="#" data-a="aiOpen" style="color:var(--tg-link)">AI settings</a>`}</small></p>
        <span class="btn fileb">Choose PDFs<input type="file" id="rcFile" accept="application/pdf,.pdf" multiple></span>
        <button class="btn ghost" data-a="sampleRC">Sample RC</button><button class="btn ghost" data-a="sampleRC2" title="One RC with two deliveries; rate is split in half">Sample RC · 2 stops</button>
        <button class="btn ghost" data-a="poolPick">Unassigned loads <span class="muted">${pool.length}</span></button>
        <button class="btn ghost" data-a="addAgent">+ Agent</button><button class="btn ghost" data-a="addDispNote">+ Note</button></div>
      ${B.pick?`<div class="card sec"><div class="row"><span class="h2">Unassigned loads</span><span class="sp"></span><button class="btn sm ghost" data-a="poolPick">Close</button></div>
        ${pool.length?pool.map(s=>`<div class="poolrow"><span class="mono">${esc(s.load)}</span><b>${esc(s.consignee)}</b><span class="muted">${esc(s.city)}</span><span class="sp"></span><span class="muted">${s.fromTrip?'from #'+s.fromTrip:''}</span><button class="btn sm" data-a="poolAdd" data-id="${s.id}">Add</button></div>`).join(''):'<p class="note">No unassigned loads.</p>'}</div>`:''}
      ${st.length||B.notes.length?`<div class="cubes">${cards.join('')}</div>
        <p class="note" style="margin:0">Click any line to edit it. Drag by ⠿ to change the order, or drop a load onto an agent.</p>`
        :`<div class="card empty">Upload the first RC. Each load becomes a stop. Loads going to the same address are grouped as 2A, 2B.</div>`}
    </div>
    <aside class="card side">
      ${picker('driver','Driver group',B.driverId?whoTxt(drv(B.driverId)):'','Truck #, first or last name',B.active)}${B.active?'<span class="note">Use Reassign in the trip card to change the driver.</span>':''}
      ${picker('disp','Dispatcher',B.dispatcher,'Dispatcher name',false)}
      <span class="note">A draft can wait without them. To send, the dispatcher is required; they get the Dispatcher tag in the driver's group.</span>
      ${canPrio()?`<label class="chk"><input type="checkbox" id="bPrio" ${B.priority?'checked':''}> Priority trip</label>`:''}
      <div id="bmsg">${msgPanel()}</div>
      <div class="row"><button class="btn" data-a="saveDraft" ${B.active?'hidden':''}>Save trip</button><span class="sp"></span><button class="btn pri" data-a="sendTrip">${B.active?'Review and send changes':'Save and send'}</button></div>
    </aside>
  </div>`;
}
const whoTxt=d=>d?`${d.truck} · ${d.name}`:'';
/* Search field instead of a long select: type a truck number, a first or a last name. */
function picker(kind,label,value,ph,disabled){
  return`<div class="pk"><span class="lbl">${label}</span><input type="text" data-pk="${kind}" value="${esc(value)}" placeholder="${ph}" autocomplete="off" spellcheck="false" ${disabled?'disabled':''} aria-label="${label}"><div class="pk-list" id="pkl-${kind}" hidden></div></div>`;
}
export function pickerOptions(kind,q,ctx){
  const k=String(q||'').trim().toLowerCase();const hit=(...xs)=>!k||xs.some(x=>String(x).toLowerCase().split(/[\s·,/]+/).some(w=>w.startsWith(k))||String(x).toLowerCase().startsWith(k));
  if(kind==='driver')return DRIVERS.filter(d=>hit(d.truck,d.name)).slice(0,8).map(d=>{const t=activeTrip(d);const busy=t&&t.id!==S.builder.id;return{v:d.id,html:`<span class="trk">${esc(d.truck)}</span> ${esc(d.name)}`,sub:busy?'on trip #'+t.id:'available',off:busy};});
  if(kind==='disp')return dispatchers().filter(n=>hit(n)).map(n=>({v:n,html:esc(n),sub:isAfterHours(n)?'After Hours':'Dispatcher'}));
  if(kind==='agent')return AGENTS.filter(a=>hit(a.code,a.name,a.city)).slice(0,8).map(a=>({v:a.id,html:`<b class="mono">${esc(a.code)}</b> ${esc(a.name)}`,sub:a.city}));
  return[];
}
/* One stop as a compact card: what goes to the driver is edited in place; load #, broker and rate sit under More. */
export function stopEditor(B,s,i,L,rates){
  const g=groupMembers(B.stops,i);const inG=g.length>1;const isLast=i===g[g.length-1];const G=groupsOf(B.stops);const gi=G.findIndex(x=>x.includes(i));
  const lead=i===g[0];const mv=k=>grpMovable(B.stops,G,gi)&&grpMovable(B.stops,G,gi+k);const open=B.open===s.id;const done=s.status&&s.status!=='pending';
  const inp=(f,v,ph,cls='',type='text')=>`<label class="cf${cls}"><input type="${type}" data-f="${f}" data-i="${i}" value="${esc(v)}" placeholder="${ph}" aria-label="${ph}"></label>`;
  return`<div class="cube ${s.noFit?'nofit':''} ${open?'open':''} ${isBlank(s)?'blank':''}" data-cube="${i}">
    <div class="cube-h">${done?'':`<span class="grip" draggable="true" data-drag="${i}" title="Drag to change the order" aria-hidden="true">⠿</span>`}<span class="stop-n">${L[i]}</span>
      ${done?`<span class="pill c-ok">${STOP_LABEL[s.status]}</span>`:''}${s.noFit?'<span class="pill c-crit">Doesn\'t fit</span>':''}<span class="sp"></span>
      ${done?'':s.linkKey&&inG?`<button class="btn sm ghost" data-a="unlink" data-i="${i}" title="This stop was linked by hand. Unlink to make it a separate stop">Unlink</button>`:`<button class="btn sm ghost" data-a="linkStart" data-i="${i}" title="Link with another stop at the same place (1A, 1B)" aria-label="Link stop ${L[i]} with another stop">🔗</button>`}
      <button class="btn sm ghost" data-a="noteAfter" data-i="${i}" title="Add a dispatch note after this stop">+ Note</button><button class="btn sm ghost" data-a="cubeMore" data-i="${i}" aria-expanded="${open}">${open?'Less':'More'}</button><button class="xbtn" data-a="rmStop" data-i="${i}" aria-label="Remove stop ${L[i]}">×</button></div>
    ${B.linkFrom!=null&&B.linkFrom!==s.id&&!done&&!(B.stops.find(x=>x.id===B.linkFrom)&&groupMembers(B.stops,B.stops.findIndex(x=>x.id===B.linkFrom)).includes(i))?`<button class="btn sm pri linkhere" data-a="linkHere" data-i="${i}">Link here · same place</button>`:''}
    ${B.linkFrom==null?(h=>h>=0?`<div class="samehint">Looks like the same place as stop ${L[h]} · <a href="#" data-a="linkTo" data-i="${i}" data-k="${h}">Link</a></div>`:'')(samePlaceHint(B.stops,i)):''}
    ${isBlank(s)?'<div class="blank-hint">Drop an RC here, or type the stop</div>':''}${inp('consignee',s.consignee,'Delivery facility',' big')}${inp('addr',s.addr,'Street address',' sub')}${inp('city',s.city,'City, ST ZIP',' sub')}
    <div class="cf-row"><span class="k">Appt</span>${inp('brokerAppt',toInput(s.brokerAppt),'Broker appointment',' t','datetime-local')}</div>
    <div class="cf-row"><select data-f="refType" data-i="${i}" class="cfsel" aria-label="Number type">${['DEL','PO','REF',''].map(r=>`<option value="${r}" ${s.refType===r?'selected':''}>${r?r+'#':'none'}</option>`).join('')}</select>${inp('refNum',s.refNum,'Delivery number',' t')}</div>
    <div class="cf-row disp">${lead?dispInputs(s,i):`<span class="note">Same time as ${L[g[0]]}${s.disp?' · '+esc(fmtDisp(s)):''}</span>`}</div>
    ${open?`<div class="more">
      ${s.pickup&&s.pickup.name?`<p class="note" style="margin:0 0 6px">Pickup: <b style="color:var(--fg-2)">${esc(s.pickup.name)}</b>, ${esc(s.pickup.addr)}, ${esc(s.pickup.city)}${s.pickup.ts?` · <span class="mono">${fmtD(s.pickup.ts).slice(0,5)} ${esc(s.pickup.win)}</span>`:''}</p>`:''}
      <div class="fgrid">${fld(i,'load','Load # (not sent to driver)',s.load)}${fld(i,'broker','Broker',s.broker)}${rates?fld(i,'rate',s.split?`Rate, $ (1/${s.split} of RC)`:'Agreed rate, $',s.rate,'','number'):''}${fld(i,'weight','Weight, lb',s.weight,'','number')}
        ${fld(i,'consNote','Note for dispatcher (optional)',s.consNote||'','w4')}</div>
      <div class="row" style="margin-top:8px;gap:6px">${s.ai?`<span class="ai">from ${esc(s.file)}</span>`:''}${s.split?`<span class="tag">split RC · rate 1/${s.split}</span>`:''}<span class="sp"></span>
        ${lead?`<button class="btn sm ghost" data-a="mvG" data-i="${i}" data-k="-1" ${mv(-1)?'':'disabled'}>Move up</button><button class="btn sm ghost" data-a="mvG" data-i="${i}" data-k="1" ${mv(1)?'':'disabled'}>Move down</button>`:''}
        ${inG&&!isLast&&mv(0)?`<button class="btn sm ghost" data-a="swapAB" data-i="${i}">Swap ${L[i]} ↔ ${L[i+1]}</button>`:''}</div>
    </div>`:''}
  </div>`;
}
const dispInputs=(s,i)=>`<span class="k">Dispatch</span><label class="cf t"><input type="datetime-local" data-f="dispTs" data-i="${i}" value="${s.disp&&!s.disp.asap?toInput(s.disp.ts):''}" ${s.disp&&s.disp.asap?'disabled':''} aria-label="Dispatched time"></label><span class="chk"><input type="checkbox" data-f="asap" data-i="${i}" ${s.disp&&s.disp.asap?'checked':''}> ASAP</span>`;
/* Agent stop: a narrow tile that widens as loads are dropped into it. Empty, it is a stop of its own (e.g. unstack). */
function agentTile(B,s,i,L){
  const loads=B.stops.map((x,j)=>j).filter(j=>B.stops[j].agent===s.id);const done=s.status&&s.status!=='pending';
  return`<div class="cube agent ${loads.length?'has':''}" data-cube="${i}" style="--n:${loads.length}">
    <div class="cube-h">${done?'':`<span class="grip" draggable="true" data-drag="${i}" title="Drag to change the order" aria-hidden="true">⠿</span>`}<span class="stop-n">${L[i]}</span><span class="sp"></span>
      <button class="btn sm ghost" data-a="noteAfter" data-i="${i}" title="Add a dispatch note after this stop">+ Note</button><button class="xbtn" data-a="rmStop" data-i="${i}" aria-label="Remove agent stop ${L[i]}">×</button></div>
    <div class="ag-body">
      <div class="ag-info"><span class="ag-tag">Agent</span>
        ${s.agentId?`<b>${esc(s.agentCode)}</b><span>${esc(s.consignee)}</span><span class="muted">${esc(s.addr)}</span><span class="muted">${esc(s.city)}</span><a href="#" data-a="agentChange" data-i="${i}" class="ag-chg">Change</a>`
          :`<div class="pk"><input type="text" data-pk="agent" data-i="${i}" placeholder="Find agent: code, name, city" autocomplete="off" aria-label="Agent"><div class="pk-list" id="pkl-agent-${i}" hidden></div></div>`}
        <div class="ag-disp">${dispInputs(s,i)}</div>
        ${loads.length?'':'<span class="note">Drop loads here</span>'}</div>
      ${loads.length?`<div class="ag-loads">${loads.map(j=>{const x=B.stops[j];return`<div class="mini" data-cube="${j}"><div class="mini-h"><span class="grip" draggable="true" data-drag="${j}" title="Drag out to make it a normal stop again" aria-hidden="true">⠿</span><span class="sp"></span><button class="xbtn" data-a="takeOut" data-i="${j}" title="Take out of the agent" aria-label="Take ${esc(x.consignee)} out of the agent">↩</button></div>
        <b>${esc(x.consignee)}</b><span class="muted">Final: ${esc(x.city)}</span><span class="muted mono">Appt ${fmtD(x.brokerAppt)}</span>${refTxt(x)?`<span class="mono">${esc(refTxt(x))}</span>`:''}<span class="note">Agent delivers it</span></div>`;}).join('')}</div>`:''}
    </div>
  </div>`;
}
function noteCard(n){
  return`<div class="cube notec" data-note="${n.id}"><span class="grip" draggable="true" data-dragnote="${n.id}" title="Drag between stops" aria-hidden="true">⠿</span>
    <span class="lbl">Dispatch note</span><textarea data-notetext="${n.id}" rows="2" placeholder="Text for the driver, e.g. 2ND STOP NEED TO UNSTACK AT AGENT">${esc(n.text)}</textarea>
    <button class="xbtn" data-a="rmNote" data-id="${n.id}" aria-label="Remove note">×</button></div>`;
}
/* Drag and drop: a group moves as a whole; dropping 2A on 2B swaps them; a load dropped on an agent rides inside it,
   a load dragged out of an agent becomes a normal stop again. Stops already in progress never move. */
export function dropStop(from,to){
  const st=S.builder.stops;const src=st[from],dst=st[to];if(!src||!dst||from===to)return false;
  const target=isAgent(dst)?dst:dst.agent?st.find(x=>x.id===dst.agent):null;
  if(target&&!isAgent(src)){if(src.agent===target.id)return true;if(src.status&&src.status!=='pending')return false;
    if(st.some(x=>x.agent===src.id))return false;
    st.splice(from,1);src.agent=target.id;src.disp=target.disp?{...target.disp}:null;src.legMi=0;src.msg=null;
    const at=st.indexOf(target);let end=at;st.forEach((x,k)=>{if(x.agent===target.id)end=k;});st.splice(end+1,0,src);return true;}
  if(src.agent){delete src.agent;src.disp=null;src.msg=null;src.legMi=rint(70,260);const k=st.indexOf(src);st.splice(k,1);st.splice(st.indexOf(dst),0,src);return true;}
  const G=groupsOf(st);const a=G.findIndex(g=>g.includes(from)),b=G.findIndex(g=>g.includes(to));
  if(a<0||b<0)return false;
  if(a===b){if([src,dst].some(v=>v.status&&v.status!=='pending'))return false;st[from]=dst;st[to]=src;return true;}
  for(let k=Math.min(a,b);k<=Math.max(a,b);k++)if(!grpMovable(st,G,k))return false;
  const g=G.splice(a,1)[0];G.splice(b,0,g);st.splice(0,st.length,...G.flat().map(k=>st[k]));return true;
}
/* A load taken out of an agent becomes a normal stop right after the agent stop. */
export function releaseLoad(x){
  const st=S.builder.stops;const a=st.find(y=>y.id===x.agent);if(!a)return false;
  st.splice(st.indexOf(x),1);let end=st.indexOf(a);st.forEach((y,k)=>{if(y.agent===a.id)end=k;});
  delete x.agent;x.disp=null;x.msg=null;x.legMi=rint(70,260);st.splice(end+1,0,x);return true;
}
export function dropNote(id,to){const n=S.builder.notes.find(x=>x.id===id);const s=S.builder.stops[to];if(!n||!s)return false;n.after=s.agent||s.id;return true;}
export function addNote(after){const n={id:uid(),after,text:''};S.builder.notes.push(n);return n;}
export function addAgentStop(){const B=S.builder;const a={id:null,code:'',name:'',addr:'',city:''};const s=mkAgentStop(a);B.stops.push(s);return s;}
export function setAgent(i,agentId){const s=bStop(i);const a=AGENTS.find(x=>x.id===agentId);if(!s||!a)return;Object.assign(s,{agentId:a.id,agentCode:a.code,consignee:a.name,addr:a.addr,city:a.city,msg:null});}
/* Manual link: the dispatcher says two stops are the same place (1A/1B) even if the RCs spell it differently.
   The linked stop keeps its own name and address in the driver message; time and statuses are shared. */
const linkable=s=>s&&!s.extracting&&!isAgent(s)&&!s.agent&&(!s.status||s.status==='pending');
export function linkStops(from,to){
  const st=S.builder.stops;const a=st[from],b=st[to];if(!linkable(a)||!linkable(b)||from===to)return false;
  const g=groupMembers(st,to);const key=st[g[0]].linkKey||'link:'+st[g[0]].id;g.forEach(j=>st[j].linkKey=key);
  st.splice(st.indexOf(a),1);const end=Math.max(...groupMembers(st,st.indexOf(b)));a.linkKey=key;st.splice(end+1,0,a);
  const lead=st[groupMembers(st,st.indexOf(b))[0]];groupMembers(st,st.indexOf(a)).forEach(j=>{st[j].disp=lead.disp?{...lead.disp}:null;if(st[j]!==lead)st[j].legMi=0;});return true;
}
export function unlinkStop(i){
  const st=S.builder.stops;const s=st[i];if(!s||!s.linkKey)return false;const g=groupMembers(st,i);
  st.splice(i,1);delete s.linkKey;s.disp=null;s.legMi=rint(70,260);s.msg=null;const end=Math.max(-1,...groupMembers(st,Math.min(g[0],st.length-1)));st.splice(end+1,0,s);
  const rest=st.filter(x=>x.linkKey===st[Math.min(g[0],st.length-1)]?.linkKey&&x.linkKey);if(rest.length<2)rest.forEach(x=>delete x.linkKey);return true;
}
/* A gentle hint: another stop looks like the same place (same ZIP and house number, or same name in the same city). */
export function samePlaceHint(st,i){
  const s=st[i];if(!linkable(s))return -1;const zip=x=>(String(x.city).match(/\d{5}/)||[''])[0],num=x=>(String(x.addr).match(/^\s*(\d+)/)||['',''])[1];
  const word=x=>String(x.consignee).toLowerCase().replace(/[^a-z0-9 ]/g,'').split(' ').find(w=>w.length>=4)||'';const town=x=>cityST(x.city).toLowerCase();
  const g=groupMembers(st,i);
  return st.findIndex((x,j)=>j!==i&&!g.includes(j)&&linkable(x)&&((zip(x)&&zip(x)===zip(s)&&num(x)&&num(x)===num(s))||(word(x)&&word(x)===word(s)&&town(x)===town(s))));
}
/* Removing a stop: loads inside an agent become normal stops, notes move to the stop before it. */
/* × on an agent that holds loads only empties it (loads become normal stops again); × on an empty agent removes it. */
export function removeStop(i){
  const B=S.builder;const s=bStop(i);if(!s)return null;
  if(isAgent(s)&&B.stops.some(x=>x.agent===s.id)){B.stops.filter(x=>x.agent===s.id).forEach(x=>releaseLoad(x));return'emptied';}
  const rows=msgRows(B.stops);const k=rows.indexOf(i);const prev=k>0?B.stops[rows[k-1]].id:null;
  B.notes.forEach(n=>{if(n.after===s.id)n.after=prev;});
  B.stops.splice(i,1);return s;
}
export function fld(i,f,l,v,cls='',type='text'){return`<label class="${cls}">${l}<input type="${type}" data-f="${f}" data-i="${i}" value="${esc(v)}"></label>`;}
export function msgPanel(){
  const B=S.builder;const st=rowsOf(B);const L=labels(B.stops);const idx=s=>B.stops.indexOf(s);
  const notes=id=>B.notes.filter(n=>n.after===id&&n.text.trim()).map(n=>`<pre class="mnote">${esc(n.text.toUpperCase())}</pre>`).join('');
  const blocks=st.filter(s=>!s.agent).map(s=>{const i=idx(s);const txt=s.msg!=null?s.msg:stopBlockAuto(s,B.stops);const inside=B.stops.filter(x=>x.agent===s.id).map(x=>x.id);
    return`<div class="mblock"><div class="row" id="mbh-${i}">${msgHead(s,i,L)}</div>
    <textarea data-msg="${i}" rows="${txt.split('\n').length}">${esc(txt)}</textarea></div>${[s.id,...inside].map(notes).join('')}`;}).join('');
  return`<span class="lbl">Message to driver</span>
  <div class="msgbox"><div class="mono" style="font-weight:600">${B.active?'YOUR TRIP HAS CHANGES':'YOUR NEW TRIP'} #${bId()}</div>${notes(null)}
  ${blocks||'<p class="note">Stops appear here as RCs are read.</p>'}
  <button class="btn sm ghost addstop" data-a="addBlankStop">+ Add next stop</button>
  </div><p class="note" style="margin:4px 0 0">Type the date and time right in a block (10/22 10AM or 10/22 ASAP), it fills the stop card too. Load # and rate are never sent.</p>`;
}
export function msgHead(s,i,L){return`<b class="mono">${stopHead(S.builder.stops,i,L)}</b><span class="sp"></span>${s.msg!=null?'<span class="tag">edited</span>':''}<button class="xbtn" data-a="rmStop" data-i="${i}" aria-label="Remove stop ${L[i]}">×</button>`;}
export function refreshBuilderBits(){const m=document.getElementById('bmsg');if(m)m.innerHTML=msgPanel();}
/* The text a person typed in a block also sets the dispatched time of that stop (and of its 2A/2B group). */
export function syncTimeFromText(i){
  const B=S.builder;const s=bStop(i);if(!s)return;const d=parseDispLine(s.msg||'');const g=groupMembers(B.stops,i);
  g.forEach(j=>{B.stops[j].disp=d?{...d}:null;});B.stops.filter(x=>x.agent===s.id).forEach(x=>x.disp=d?{...d}:null);
  const lead=g[0];const a=document.querySelector(`[data-f=dispTs][data-i="${lead}"]`),c=document.querySelector(`[data-f=asap][data-i="${lead}"]`);
  if(a){a.value=d&&!d.asap?toInput(d.ts):'';a.disabled=!!(d&&d.asap);}if(c)c.checked=!!(d&&d.asap);
}
/* Only stops the driver has not reached can be reordered, and never ahead of a stop already in progress. */
export const grpMovable=(stops,G,gi)=>gi>=0&&gi<G.length&&G[gi].every(k=>!stops[k].status||stops[k].status==='pending');
export function moveGroup(stops,i,dir){const G=groupsOf(stops);const gi=G.findIndex(g=>g.includes(i));const ti=gi+dir;if(!grpMovable(stops,G,gi)||!grpMovable(stops,G,ti))return;[G[gi],G[ti]]=[G[ti],G[gi]];const ns=G.flat().map(k=>stops[k]);stops.splice(0,stops.length,...ns);}
export function toPool(s,tid){
  delete s.agent;Object.assign(s,{status:'pending',door:'',t:{},disp:null,msg:null,wQty:null,spots:null,photos:[],noFit:false,detNotified:null,fromTrip:tid,pooledAt:Date.now()});
  POOL.push(s);
}
/* Checks before sending; returns the problem as text or '' when the trip can go. */
export function sendProblem(){
  const B=S.builder;const rows=rowsOf(B);const L=labels(rows);
  if(B.stops.some(s=>s.extracting))return'Wait until AI finishes reading the RC';
  if(!rows.length)return'Add at least one stop';
  if(!B.active){const n=String(B.num||'').trim();if(!n)return'Enter the trip number';if(!/^\d{1,10}$/.test(n))return'Trip number is digits only';
    if(TRIPS.some(x=>x.id===n&&x.id!==B.id))return`Trip #${n} already exists. Trip numbers never repeat`;}
  if(!B.driverId)return'Choose a driver group to send. Or save a draft and assign the driver later on Preparing';
  if(!B.dispatcher)return'Choose a dispatcher. A trip is always sent with its dispatcher';
  const ag=rows.find(s=>isAgent(s)&&!s.agentId);if(ag)return`Choose the agent for stop ${L[rows.indexOf(ag)]}`;
  const bl=rows.find(isBlank);if(bl)return`Stop ${L[rows.indexOf(bl)]} is empty. Drop an RC on it, type it, or remove it`;
  const miss=groupsOf(rows).find(g=>!rows[g[0]].disp);if(miss)return`Set the dispatched time or ASAP for stop ${L[miss[0]]}`;
  const busy=activeTrip(drv(B.driverId));if(busy&&busy.id!==B.id)return`${drv(B.driverId).name} is already on trip #${busy.id}. Choose another driver`;
  return'';
}
export const builderMessage=()=>{const B=S.builder;return tripMessage({id:bId(),stops:rowsOf(B),notes:B.notes},B.active);};
/* Edits made in the send preview are kept: each STOP# section goes back to its block, notes stay notes. */
export function applyMessageText(text){
  const B=S.builder;const rows=rowsOf(B);const L=labels(rows);const head={};msgRows(rows).forEach(i=>head[stopHead(rows,i,L)]=rows[i]);
  const sec=[{row:null,lines:[]}];String(text).split('\n').forEach(l=>{const r=head[l.trim()];if(r)sec.push({row:r,lines:[]});else sec[sec.length-1].lines.push(l);});
  sec.forEach(({row,lines},k)=>{
    let body=(k===0?lines.slice(1):lines).join('\n').replace(/^\n+|\n+$/g,'');
    const ids=row?[row.id,...rows.filter(x=>x.agent===row.id).map(x=>x.id)]:[null];
    B.notes.filter(n=>ids.includes(n.after)&&n.text.trim()).reverse().forEach(n=>{const t=n.text.toUpperCase().trim();
      if(body.endsWith(t)){body=body.slice(0,body.length-t.length).replace(/\n+$/,'');}else{B.notes.splice(B.notes.indexOf(n),1);}});
    if(!row)return;const auto=stopBlockAuto(row,rows);row.msg=body===auto?null:body;
    const d=parseDispLine(body);if(d){const i=rows.indexOf(row);groupMembers(rows,i).forEach(j=>rows[j].disp={...d});rows.filter(x=>x.agent===row.id).forEach(x=>x.disp={...d});}
  });
}
/* mode: 'send' (after the preview), 'draft' (Save trip: kept, nothing goes to the group) or 'auto' (Back to trips keeps the work as a draft). */
export function commitBuilder(mode){
  const B=S.builder;const send=mode==='send';const rows=rowsOf(B);const L=labels(rows);
  if(send){const p=sendProblem();if(p)return toast(p,true);}
  else{
    if(B.stops.some(s=>s.extracting))return toast('Wait until AI finishes reading the RC',true);
    if(!rows.length&&!B.notes.length){if(mode==='auto'){S.builder=null;return render();}return toast('Add at least one stop',true);}
    const n=String(B.num||'').trim();
    if(n&&(!/^\d{1,10}$/.test(n)||TRIPS.some(x=>x.id===n&&x.id!==B.id))){if(mode!=='auto')return toast(/^\d+$/.test(n)?`Trip #${n} already exists. Trip numbers never repeat`:'Trip number is digits only',true);B.num='';}
  }
  let t=B.id?trip(B.id):null;
  const newId=B.active?B.id:(B.num||(t&&isDraftId(t.id)?t.id:B.tripObj?.id||'draft-'+uid()));
  if(t&&!B.active&&t.id!==newId){if(!isDraftId(t.id))t.history.push({ts:Date.now(),who:user(),src:'consolidator',text:`Trip number changed #${t.id} → #${newId}`});t.id=newId;}
  if(!t){t=B.tripObj;t.id=newId;TRIPS.push(t);t.history.push({ts:Date.now(),who:user(),src:'consolidator',text:`Trip built from ${rows.length} load${rows.length>1?'s':''}`});}
  const keep=new Set(rows.map(s=>s.id));const OL=labels(t.stops);
  t.stops.forEach((s,i)=>{if(!keep.has(s.id)&&!isAgent(s)&&!isBlank(s)){t.history.push({ts:Date.now(),who:user(),src:'consolidator',text:`Stop ${OL[i]} (load ${s.load}) removed → Unassigned loads`});toPool(s,t.id);}});
  rows.forEach(r=>{const k=POOL.findIndex(p=>p.id===r.id);if(k>=0){POOL.splice(k,1);t.history.push({ts:Date.now(),who:user(),src:'consolidator',text:`Load ${r.load} added from Unassigned loads`});}
    r.rate=+r.rate||0;r.weight=+r.weight||0;delete r.extracting;});
  groupsOf(rows).forEach(g=>{const d0=rows[g[0]].disp;g.forEach((i,k)=>{rows[i].disp=d0?{...d0}:null;if(k>0)rows[i].legMi=0;else if(!rows[i].legMi)rows[i].legMi=rint(70,260);});});
  const restopped=t.stops.map(s=>s.id).join()!==rows.map(s=>s.id).join();
  t.stops=rows;t.notes=B.notes.filter(n=>n.text.trim()).map(n=>({...n,after:n.after&&!keep.has(n.after)?null:n.after}));
  if(restopped&&t.trailerReady&&!t.leftYard){if(t.trailer)t.whDirty=true;S.whEdit[t.id]=true;delete S.whd[t.id];
    t.history.push({ts:Date.now(),who:user(),src:'consolidator',text:'Stops changed after the trailer was saved. Warehouse needs to update the manifest',warn:true});}
  t.driverId=B.driverId||null;t.dispatcher=B.dispatcher;t.priority=B.priority;t.updated=Date.now();
  S.builder=null;S.drawer=null;
  if(B.active){if(t.dispatcher)grantDispatcher(t,drv(t.driverId));act(t,'changed',{src:'consolidator'});S.tripsTab='active';toast(`#${t.id}: changes sent to ${groupTitle(drv(t.driverId))}`);}
  else if(send){act(t,'send',{who:user(),src:'consolidator'});S.tripsTab='active';toast(`#${t.id} sent to ${groupTitle(drv(t.driverId))}`);}
  else{S.tripsTab='draft';const d=drv(t.driverId);toast(mode==='auto'?`Saved ${tripNo(t)}, not sent yet`:`Trip ${tripNo(t)} saved${d?` for ${d.name}, not sent yet`:''}`);}
  S.tab=B.stay||'trips';render();
}
export function clearBuilder(){const B=S.builder;Object.assign(B,{stops:[],notes:[],driverId:'',dispatcher:'',num:'',priority:false,open:null,clearArm:0});}

export function bStop(i){return S.builder.stops[+i];}
export function bGroupSet(i,fn){const B=S.builder;groupMembers(B.stops,+i).forEach(j=>fn(B.stops[j]));}
