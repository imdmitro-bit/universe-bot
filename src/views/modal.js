/* Modals: Rate Confirmation preview and the "send trailer to driver" preview. */
import {AI_MODEL_LABEL,aiKey,maskKey} from '../ai/config.js';
import {TRACKS,trackValue} from '../domain/status.js';
import {issuedLine,refTxt,tnum,whMessage,whPhotos} from '../domain/stops.js';
import {esc,fmtD,lb,money} from '../lib/utils.js';
import {CLOUD} from '../cloud/mode.js';
import {S,drv,findStop,firstName,groupTitle,tgGroupOf,trip,tripNo,user} from '../state.js';
import {who2} from '../ui/components.js';

export function renderModal(){
  const el=document.getElementById('modal');const M=S.modal;
  if(!M){el.innerHTML='';return;}
  if(M.kind==='whSend'){
    const t=trip(M.tid);const d=drv(t.driverId);const ph=whPhotos(t);
    el.innerHTML=`<div class="scrim" style="z-index:30" data-a="modalClose"></div>
    <div class="modal" role="dialog" aria-label="Send trailer to driver">
      <div class="row mh"><span class="h2">${t.trailer?'Resend':'Send'} trailer to driver</span><span class="sp"></span><button class="btn sm ghost" data-a="modalClose">Cancel</button></div>
      <div class="row" style="gap:14px;margin-bottom:10px">${who2(d)}<span class="muted">Trip <b class="mono" style="color:var(--fg)">#${t.id}</b></span><span class="muted">Group: ${esc(groupTitle(d))}</span></div>
      <div class="tgprev"><span class="from">Universe Bot</span>${ph.length?`<div class="photos">${ph.map((p,k)=>`<div class="ph" ${p?`style="background-image:url('${p}')"`:''}>${p?'':'Photo '+(k+1)}</div>`).join('')}</div>`:''}<pre>${esc(whMessage(t)+issuedLine(firstName(user())))}</pre></div>
      <p class="note">${ph.length} photo${ph.length===1?'':'s'} and the text go in one message.${t.trailer?' The previous trailer message in the group will be deleted.':''}</p>
      <div class="row"><span class="sp"></span><button class="btn" data-a="modalClose">Cancel</button><button class="btn pri" data-a="whSendNow" data-id="${t.id}">${t.trailer?'Resend':'Send'} to ${esc(d.name)}</button></div>
    </div>`;return;
  }
  if(M.kind==='status'){
    const t=trip(M.tid);const T=TRACKS[M.track];const cur=trackValue(t,M.track);
    el.innerHTML=`<div class="scrim" style="z-index:30" data-a="modalClose"></div>
    <div class="modal" role="dialog" aria-label="Change status" style="width:min(420px,calc(100% - 32px))">
      <div class="row mh"><span class="h2">Change ${esc(T.label.toLowerCase())}</span><span class="mono muted">${esc(tripNo(t))}</span><span class="sp"></span><button class="btn sm ghost" data-a="modalClose">Cancel</button></div>
      <div class="stlist">${T.opts.map(([v,l])=>`<label class="chk"><input type="radio" name="stv" value="${v}" ${v===cur?'checked':''}> ${esc(l)}${v===cur?' <span class="muted">· now</span>':''}</label>`).join('')}</div>
      <p class="note">Set by hand, written to the trip history. Nothing is posted to the driver group.</p>
      <div class="row"><span class="sp"></span><button class="btn" data-a="modalClose">Cancel</button><button class="btn pri" data-a="statusDo" data-id="${t.id}" data-k="${M.track}">Change status</button></div>
    </div>`;return;
  }
  if(M.kind==='unassign'){
    const t=trip(M.tid);const d=drv(t.driverId);
    el.innerHTML=`<div class="scrim" style="z-index:30" data-a="modalClose"></div>
    <div class="modal" role="alertdialog" aria-label="Unassign driver" style="width:min(480px,calc(100% - 32px))">
      <div class="row mh"><span class="h2">Unassign ${esc(d.name)}?</span></div>
      <div class="row" style="margin-bottom:10px">${who2(d)}<span class="muted">from trip <b class="mono" style="color:var(--fg)">${esc(tripNo(t))}</b></span></div>
      <p style="margin:0 0 8px">Are you sure? The trip${t.trailer?' and trailer':''} messages will be deleted from "${esc(groupTitle(d))}" and the driver will be notified.</p>
      <p class="note">Stops, trailer and dispatcher stay with the trip. It waits on Preparing until you assign a new driver.</p>
      <div class="row"><span class="sp"></span><button class="btn" data-a="modalClose">Cancel</button><button class="btn pri danger-fill" data-a="unassignDo" data-id="${t.id}">Unassign driver</button></div>
    </div>`;return;
  }
  if(M.kind==='sendPreview'){
    const B=S.builder;const d=drv(B.driverId);
    el.innerHTML=`<div class="scrim" style="z-index:30" ${M.sent?'':'data-a="modalClose"'}></div>
    <div class="modal ${M.sent?'sentok':''}" role="dialog" aria-label="Check the message before sending">
      <div class="row mh"><span class="h2">${M.sent?'✓ Sent':B.active?'Send changes to the driver':'Send to driver group'}</span><span class="sp"></span>${M.sent?'':'<button class="btn sm ghost" data-a="modalClose">Back</button>'}</div>
      <div class="row" style="gap:14px;margin-bottom:10px">${who2(d)}<span class="muted">Group: <b style="color:var(--fg)">${esc(groupTitle(d))}</b></span><span class="muted">Dispatcher: <b style="color:var(--fg)">${esc(B.dispatcher||'not assigned')}</b></span></div>
      <div class="tgprev"><span class="from">Universe Bot</span>
        <textarea id="spText" rows="${Math.min(26,M.text.split('\n').length+1)}" ${M.sent?'disabled':''} aria-label="Message to the driver">${esc(M.text)}</textarea>
        <pre class="issued">Issued by ${esc(firstName(user()))}</pre>
        <div class="kbd" style="margin-top:6px">${B.active?'<button disabled>Acknowledge changes</button>':'<button disabled>Confirm trip</button><button disabled>Refuse</button>'}</div></div>
      <p class="note">${M.sent?`Posted to ${esc(groupTitle(d))}.`:'This is exactly what the driver sees in the group. Edit the text here if needed, the changes are kept in the trip.'}</p>
      ${CLOUD.on&&!M.sent&&!tgGroupOf(d.id)?`<p class="note late">${esc(d.name)}'s Telegram group is not linked yet, so nothing reaches Telegram. Link it in Driver Groups → Telegram groups.</p>`:''}
      ${M.sent?'':`<div class="row"><span class="sp"></span><button class="btn" data-a="modalClose">Back</button><button class="btn pri" data-a="spSend">Send to ${esc(d.name)}</button></div>`}
    </div>`;return;
  }
  if(M.kind==='ai'){
    const k=aiKey();
    el.innerHTML=`<div class="scrim" style="z-index:30" data-a="modalClose"></div>
    <div class="modal" role="dialog" aria-label="AI settings">
      <div class="row mh"><span class="h2">AI settings</span><span class="sp"></span><button class="btn sm ghost" data-a="modalClose">Close</button></div>
      <p style="margin:0 0 10px">${AI_MODEL_LABEL} reads uploaded Rate Confirmations and fills the stops. It never sets the dispatched time.</p>
      ${k?`<div class="row" style="margin-bottom:10px"><span class="okline">Key saved in this browser</span><span class="mono muted">${esc(maskKey(k))}</span><span class="sp"></span>
        <button class="btn sm" data-a="aiCheck">Check key</button><button class="btn sm ghost danger" data-a="aiClear">Remove key</button></div>`:''}
      <label class="aikey"><span class="lbl">${k?'Replace':'Claude API'} key</span><input type="password" id="aiKey" autocomplete="off" spellcheck="false" placeholder="sk-ant-…"></label>
      <p class="note">The key is stored only in this browser and is sent only to the Claude API. Don't save it on a shared computer. In the working version the key lives on the server and nobody sees it in the app.</p>
      <p class="note">One RC costs a few cents. The token count of each read is shown after upload.</p>
      <div class="row"><span class="sp"></span><button class="btn" data-a="modalClose">Cancel</button><button class="btn pri" data-a="aiSave">Save key</button></div>
    </div>`;return;
  }
  const f=findStop(M.sid);if(!f){el.innerHTML='';return;}const s=f.s,t=f.t;
  if(s.rcUrl){
    el.innerHTML=`<div class="scrim" style="z-index:30" data-a="modalClose"></div>
    <div class="modal wide" role="dialog" aria-label="Rate Confirmation ${esc(s.load)}">
      <div class="row mh"><span class="h2">Rate Confirmation</span><span class="mono muted">${esc(s.rcFile)}</span><span class="sp"></span><a class="btn sm" href="${esc(s.rcUrl)}" target="_blank" rel="noopener">Open in new tab</a><button class="btn sm ghost" data-a="modalClose">Close</button></div>
      <iframe class="rcpdf" src="${esc(s.rcUrl)}" title="${esc(s.rcFile)}"></iframe>
      <p class="note" style="margin:10px 0 0">Original PDF, read by AI. In production it is stored under load ${esc(s.load)}${t?`, trip #${t.id}`:', currently unassigned'}.</p>
    </div>`;return;
  }
  el.innerHTML=`<div class="scrim" style="z-index:30" data-a="modalClose"></div>
  <div class="modal" role="dialog" aria-label="Rate Confirmation ${esc(s.load)}">
    <div class="row mh"><span class="h2">Rate Confirmation</span><span class="mono muted">${esc(s.rcFile)}</span><span class="sp"></span><button class="btn sm ghost" data-a="modalClose">Close</button></div>
    <div class="rcdoc">
      <div class="row"><b style="font:700 18px var(--f-display);color:#13203B">${esc(s.broker)}</b><span class="sp"></span><span>LOAD CONFIRMATION<br><b>${esc(s.load)}</b></span></div>
      <hr>
      <div class="rcgrid"><div><small>Carrier</small>Your company (sample)</div><div><small>Truck / Trailer</small>${esc(t&&drv(t.driverId)?.truck||'—')} / ${esc(t&&tnum(t)||'—')}</div>
        <div><small>Consignee</small>${esc(s.consignee)}<br>${esc(s.addr)}<br>${esc(s.city)}</div><div><small>Delivery appointment</small>${fmtD(s.brokerAppt)}${refTxt(s)?'<br>'+esc(refTxt(s)):''}</div>
        <div><small>Commodity</small>General freight, ${s.pallets} pallets, ${lb(s.weight)}</div><div><small>Equipment</small>53' dry van</div></div>
      <hr>
      <div class="rcgrid"><div><small>Line haul</small>${money(s.split?s.loadRate:s.rate)}</div><div><small>Total carrier pay</small><b>${money(s.split?s.loadRate:s.rate)}</b></div></div>
      <p style="font-size:11.5px;margin:12px 0 0">Detention: 2 hours free, then $50/hr with in/out times on BOL. Lumper reimbursed with receipt. Carrier must notify broker before detention starts.</p>
    </div>
    <p class="note" style="margin:10px 0 0">Prototype preview. In production the original PDF opens here. It is stored under load ${esc(s.load)}${t?`, trip #${t.id}`:', currently unassigned'}.</p>
  </div>`;
}
