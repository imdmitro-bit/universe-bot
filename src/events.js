/* All DOM events. Views render HTML with data-a="action" attributes; these listeners route them. */
import {setAiKey} from './ai/config.js';
import {checkAiKey} from './ai/rcReader.js';
import {ROLES} from './config/roles.js';
import {act} from './domain/actions.js';
import {MAX_STOP_PHOTOS,REPORT_TYPES,curIdx,dispTs,fmtDisp,groupMembers,groupsOf,isAgent,labels,retimeMsgs,sortTs,tnum} from './domain/stops.js';
import {esc,money} from './lib/utils.js';
import {gps,tick} from './sim/samsara.js';
import {AGENTS,DRIVERS,POOL,S,TRIPS,USERS,activeTrip,can,canEditTrip,canPrio,drv,groupTitle,isDraftId,newDriverGroup,hasRole,myRoles,myTabs,syncAllGroups,trip,tripNo,user} from './state.js';
import {render,renderView,run,toast} from './ui/render.js';
import {boardRows} from './views/board.js';
import {addAgentStop,addBlankStop,addNote,addRcFile,isBlank,linkStops,unlinkStop,applyMessageText,releaseLoad,bGroupSet,bStop,builderMessage,clearBuilder,cloneStop,commitBuilder,dropNote,dropStop,extract,moveGroup,msgHead,msgPanel,pickerOptions,placeRow,refreshBuilderBits,removeStop,sendProblem,setAgent,startBuilder,syncTimeFromText} from './views/builder.js';
import {renderDrawer} from './views/drawer.js';
import {renderModal} from './views/modal.js';
import {prepRows} from './views/prep.js';
import {CLOUD} from './cloud/mode.js';
import {seedMore,seedStarter} from './data/seed.js';
import {clearSaved} from './store.js';
import {canGrant} from './views/team.js';
import {markSent,whDraft,whStart} from './views/warehouse.js';

/* Search pickers (driver, dispatcher, agent): the list under the field shows what matches as you type. */
function pkShow(inp){
  const kind=inp.dataset.pk;const list=inp.parentElement.querySelector('.pk-list');if(!list)return;
  const opts=pickerOptions(kind,inp.value);
  list.innerHTML=opts.length?opts.map((o,k)=>`<button type="button" class="pk-opt ${k===0&&!o.off?'hi':''}" data-pkv="${o.v}" ${o.off?'disabled':''}>${o.html}<small>${o.sub}</small></button>`).join(''):'<span class="note" style="padding:6px 8px">No match</span>';
  list.hidden=false;
}
function pkPick(inp,v){
  const B=S.builder;const kind=inp.dataset.pk;
  if(kind==='driver'){B.driverId=v;const d=drv(v);inp.value=d?`${d.truck} · ${d.name}`:'';}
  else if(kind==='disp'){B.dispatcher=v;inp.value=v;}
  else if(kind==='agent'){setAgent(+inp.dataset.i,v);renderView();return;}
  inp.parentElement.querySelector('.pk-list').hidden=true;
}
export function bindEvents(){
document.addEventListener('click',e=>{
  if(e.target.matches('input,select,textarea,option'))return;
  const el=e.target.closest('[data-a]');if(!el)return;
  const a=el.dataset.a;const t=S.drawer?trip(S.drawer):null;
  if(el.tagName==='A')e.preventDefault();
  switch(a){
    case'pgrp':S.pgrp=el.dataset.k;renderView();break;
    case'grp':S.grp=el.dataset.k;renderView();break;
    case'tab':S.tab=el.dataset.k;S.builder=S.tab==='trips'?S.builder:null;render();break;
    case'open':{if(!el.dataset.id)break;const ot=trip(el.dataset.id);
      // A draft (never sent, or unassigned) opens in the builder, not in the trip card.
      if(ot&&ot.status==='draft'){if(!can('build')&&!canEditTrip())return toast('This trip is a draft. Consolidator finishes it in Trips',true);startBuilder(ot);S.drawer=null;render();break;}
      S.drawer=el.dataset.id;S.rep=null;S.rs=null;S.dt=null;renderDrawer();break;}
    case'close':S.drawer=null;renderDrawer();break;
    case'tick':tick();break;
    case'gps':gps(t);break;
    case'selStop':{const i=+el.dataset.i;if(t&&i>=0&&i<t.stops.length){S.sel[t.id]=i;renderDrawer();}break;}
    case'addNote':{const i=+el.dataset.i;const s=t.stops[i];const inp=document.getElementById('note-'+s.id);const v=inp.value.trim();if(!v)return toast('Type a note first',true);
      s.notes.push({ts:Date.now(),who:user(),text:v});t.history.push({ts:Date.now(),who:user(),src:hasRole('consolidator')&&!can('dispatch')?'consolidator':'dispatcher',text:`Note on stop ${labels(t.stops)[i]}: ${v}`});t.updated=Date.now();render();break;}
    case'openTg':toast('In the real Mini App this opens the driver group in Telegram');break;
    case'sim':S.simOpen=!S.simOpen;renderDrawer();break;
    case'msgShow':S.msgOpen=!S.msgOpen;renderDrawer();break;
    case'prio':{if(!canPrio())return toast('Owner, Supervisor, Consolidator, After Hours and Manager can set priority',true);const tt=trip(el.dataset.id);run(tt,'priority',{});toast(tt.priority?`#${tt.id} marked priority`:`#${tt.id} priority removed`);break;}
    case'editTrip':if(!canEditTrip())return toast('This role cannot edit trips',true);startBuilder(t);S.drawer=null;render();break;
    case'detNotify':run(t,'detNotify',{i:+el.dataset.i});toast('Logged: broker notified');break;
    case'repOpen':{const sid=t.stops[+el.dataset.i].id;S.rep=S.rep&&S.rep.id===sid&&S.rep.type===el.dataset.k?null:{id:sid,type:el.dataset.k};renderDrawer();break;}
    case'repCancel':S.rep=null;renderDrawer();break;
    case'repSave':{const v=id=>{const x=document.getElementById(id);return x?x.value.trim():'';};const o={i:+el.dataset.i,type:S.rep.type,amount:+v('repAmount')||0,hours:+v('repHours')||0,plt:+v('repPlt')||0,note:v('repNote')};
      if(o.type==='lumper'&&!o.amount)return toast('Enter the lumper amount',true);
      if((o.type==='other'||o.type==='damage')&&!o.note)return toast('Describe what happened',true);
      S.rep=null;const r=run(t,'report',o);if(r.ok)toast(`${REPORT_TYPES[o.type]} saved to stop ${labels(t.stops)[o.i]}`);break;}
    case'rsOpen':S.rs=t.stops[+el.dataset.i].id;S.dt=null;renderDrawer();break;
    case'rsCancel':S.rs=null;renderDrawer();break;
    case'rsSave':{const dt=new Date(document.getElementById('rsDate').value).getTime();const r=act(t,'resched',{i:+el.dataset.i,appt:dt||0,reason:document.getElementById('rsReason').value.trim()});
      if(!r.ok)return toast(r.msg,true);S.rs=null;render();toast('Appointment rescheduled. Detention alerts are off for this stop.');break;}
    case'dtOpen':S.dt=t.stops[+el.dataset.i].id;S.rs=null;renderDrawer();break;
    case'dtCancel':S.dt=null;renderDrawer();break;
    case'dtSave':{const asap=document.getElementById('dtAsap').checked;const v=new Date(document.getElementById('dtDate').value).getTime();
      if(!asap&&!v)return toast('Pick a date and time, or ASAP',true);
      const r=act(t,'dispTime',{i:+el.dataset.i,disp:asap?{asap:true,day:v||sortTs(t.stops[+el.dataset.i])}:{ts:v}});if(!r.ok)return toast(r.msg,true);
      if(t.status==='active'&&t.sentTs)act(t,'changed',{});S.dt=null;render();toast('Dispatched time changed. Driver got "Your trip has changes".');break;}
    case'revSample':{const s=t.stops[+el.dataset.i];const base=s.split?s.loadRate:s.rate;const nt=Math.round(base*(1+(Math.random()<.5?-1:1)*(.05+Math.random()*.1))/10)*10;
      run(t,'revised',{i:+el.dataset.i,total:nt});toast(`Revised RC saved. Rate is now ${money(t.stops[+el.dataset.i].rate)}`);break;}
    case'rcOpen':S.modal={sid:el.dataset.id};renderModal();break;
    case'modalClose':{const M=S.modal;if(M&&M.kind==='sendPreview'&&S.builder&&S.builder.stay&&!M.sent){S.builder=null;S.modal=null;renderModal();break;}
      if(M&&M.kind==='sendPreview'){if(M.sent)break;const ta=document.getElementById('spText');if(ta&&ta.value!==M.text){applyMessageText(ta.value);S.modal=null;renderView();renderModal();break;}}
      S.modal=null;renderModal();break;}
    /* AI settings */
    case'aiOpen':S.modal={kind:'ai'};renderModal();break;
    case'aiSave':{const v=(document.getElementById('aiKey')?.value||'').trim();
      if(!v)return toast('Paste the API key first',true);if(!v.startsWith('sk-ant-'))return toast('A Claude API key starts with sk-ant-',true);
      if(!setAiKey(v))return toast('This browser blocks local storage, the key was not saved',true);
      render();toast('Key saved in this browser. Checking it…');checkAiKey().then(m=>toast(m)).catch(e=>toast(e.message,true));break;}
    case'aiCheck':checkAiKey().then(m=>toast(m)).catch(e=>toast(e.message,true));break;
    case'aiClear':setAiKey('');render();toast('Key removed from this browser');break;
    case'tact':{
      if(!can('dispatch'))return toast('This role cannot change trip statuses',true);
      const x=el.dataset.x;const o={src:'dispatcher'};
      if(x==='indoor'){const s=t.stops[curIdx(t)];const inp=document.getElementById('door-'+s.id);o.door=inp?inp.value.trim():'';}
      const r=run(t,x,o);if(r.ok&&x==='resend')toast('Trip posted again with Confirm / Refuse');if(r.ok&&x==='ack')toast('Logged: driver informed by dispatcher');break;}
    case'tactId':run(trip(el.dataset.id),el.dataset.x,{src:'dispatcher'});break;
    case'chat':{
      const d=drv(t.driverId);const as=S.actAs[t.id]||d.name;const m=d.members.find(x=>x.name===as);const tags=m?m.tags:[];const x=el.dataset.x;
      if(['confirm','refuse'].includes(x)&&!tags.includes('Driver'))return toast(`${as} has no Driver tag. Only drivers can ${x} a trip.`,true);
      if(!tags.length)return toast(`${as} has no tag in this group, so the bot ignores the button`,true);
      const src=tags.includes('Driver')?'driver':'dispatcher';const o={who:as,src};
      if(x==='indoor')o.door=String(Math.floor(Math.random()*40)+3);
      run(t,x,o);break;}
    case'unassignAsk':{hideCtx();S.modal={kind:'unassign',tid:el.dataset.id};renderModal();break;}
    case'unassignDo':{const tt=trip(el.dataset.id);const name=drv(tt.driverId)?.name;S.modal=null;const r=run(tt,'unassign',{});if(r.ok){S.drawer=null;render();toast(`${name} unassigned. ${tripNo(tt)} is waiting for a driver on Preparing`);}break;}
    case'ctxOpen':{hideCtx();const ot=trip(el.dataset.id);if(ot&&ot.status==='draft'){startBuilder(ot);render();break;}S.drawer=el.dataset.id;renderDrawer();break;}
    case'ctxStatus':{hideCtx();if(!can('override'))return toast('This role cannot change statuses by hand',true);S.modal={kind:'status',tid:el.dataset.id,track:el.dataset.k};renderModal();break;}
    case'statusDo':{const v=document.querySelector('input[name=stv]:checked')?.value;const tt=trip(el.dataset.id);S.modal=null;const r=run(tt,'override',{track:el.dataset.k,value:v});if(r.ok)toast(`${tripNo(tt)}: status changed`);break;}
    case'ctxEdit':{hideCtx();if(!canEditTrip())return toast('This role cannot edit trips',true);startBuilder(trip(el.dataset.id));S.drawer=null;render();break;}
    case'ctxSend':{hideCtx();const st=trip(el.dataset.id);const prev=S.tab;startBuilder(st);S.tab=prev;S.builder.stay=prev;
      const p=sendProblem();if(p){S.builder=null;return toast(p+(/time|stop|agent|number/i.test(p)?'. Open Edit trip to fix it':''),true);}
      S.modal={kind:'sendPreview',text:builderMessage()};renderModal();break;}
    case'booked':run(trip(el.dataset.id),'booked',{});toast('Trip closed, driver is Available');break;
    case'exp':S.expand[el.dataset.id]=!S.expand[el.dataset.id];renderView();break;
    case'tagT':{const d=drv(el.dataset.id);const m=d.members.find(x=>x.name===el.dataset.m);const k=el.dataset.k;
      m.tags=m.tags.includes(k)?m.tags.filter(x=>x!==k):m.tags.concat(k);toast(`${m.name}: ${m.tags.join(', ')||'no tags'}`);renderView();break;}
    /* trips + builder */
    case'ttab':S.tripsTab=el.dataset.k;renderView();break;
    case'newTrip':startBuilder();render();break;
    case'editDraft':if(!can('build'))return toast('Only Consolidator, Supervisor, Admin and Owner build trips',true);startBuilder(trip(el.dataset.id));render();break;
    case'sendDraft':{const t=trip(el.dataset.id);const d=drv(t.driverId);if(!d)return toast('Assign a driver first',true);if(isDraftId(t.id))return toast('Open the trip and enter the trip number first',true);if(!t.dispatcher)return toast('Assign a dispatcher first',true);
      const L=labels(t.stops);const miss=groupsOf(t.stops).find(g=>!t.stops[g[0]].disp);
      if(miss)return toast(`Set the dispatched time for stop ${L[miss[0]]} first: open the trip`,true);
      const busy=activeTrip(d);if(busy)return toast(`${d.name} is already on trip #${busy.id}`,true);
      const r=run(t,'send',{who:user(),src:'consolidator'});if(r.ok)toast(`#${t.id} sent to ${groupTitle(d)}`);break;}
    case'cubeMore':{const sid=bStop(el.dataset.i).id;S.builder.open=S.builder.open===sid?null:sid;renderView();break;}
    case'agentDelivered':{const t=trip(el.dataset.id);const s=t&&t.stops.find(x=>x.id===el.dataset.s);if(!s)break;s.agentDelivered={ts:Date.now(),who:user()};
      t.history.push({ts:Date.now(),who:user(),src:'dispatcher',text:`Load ${s.load} delivered by agent to ${s.consignee}, ${s.city}`});t.updated=Date.now();renderView();toast(`Load ${s.load}: delivered by agent`);break;}
    case'driverAdd':{const name=(document.getElementById('dgName')?.value||'').trim().replace(/\s+/g,' ');const tr=(document.getElementById('dgTruck')?.value||'').trim();
      if(!name)return toast('Enter the driver name',true);if(!/^\d{1,6}$/.test(tr))return toast('Truck # is digits only',true);
      const dup=DRIVERS.find(x=>x.truck===tr);if(dup)return toast(`Truck ${tr} is already in group "${groupTitle(dup)}"`,true);
      const d=newDriverGroup(name,tr);DRIVERS.push(d);renderView();toast(`Group "${groupTitle(d)}" added`);document.getElementById('dgName')?.focus();break;}
    case'agentAdd':{const v=id=>(document.getElementById(id)?.value||'').trim();const a={code:v('agCode').toUpperCase(),name:v('agName'),addr:v('agAddr'),city:v('agCity')};
      if(!a.code||!a.name||!a.addr||!a.city)return toast('Fill code, name, address and City, ST ZIP',true);
      if(AGENTS.some(x=>x.code===a.code))return toast(`Agent ${a.code} already exists`,true);
      AGENTS.push({id:'a'+(AGENTS.length+1)+'-'+Date.now().toString(36),...a});renderView();toast(`Agent ${a.code} saved`);break;}
    case'addBlankStop':{const s=addBlankStop();renderView();document.querySelector(`[data-cube="${S.builder.stops.indexOf(s)}"] [data-f=consignee]`)?.focus();break;}
    /* team */
    case'inviteOpen':S.invite={link:CLOUD.on?(CLOUD.bot?`https://t.me/${CLOUD.bot}`:'Open the bot in Telegram and tap the menu button'):`https://t.me/UniverseBot?start=join_${Math.random().toString(36).slice(2,10)}`};renderView();break;
    case'inviteClose':S.invite=null;renderView();break;
    case'inviteJoin':{const name=(document.getElementById('joinName')?.value||'').trim();const un=(document.getElementById('joinUser')?.value||'').trim().replace(/^@/,'');
      if(!name)return toast('Enter the name',true);if(USERS.some(u=>u.name.toLowerCase()===name.toLowerCase()))return toast(`${name} is already in the team`,true);
      USERS.push({id:'u'+Date.now().toString(36),name,username:un||name.toLowerCase().replace(/\W+/g,''),roles:[],status:'pending',lastSeen:Date.now()});S.invite=null;renderView();toast(`${name} is waiting for approval`);break;}
    case'roleT':{const u=USERS.find(x=>x.id===el.dataset.id);const k=el.dataset.k;if(!u||!can('team')||!canGrant(k))return;
      u.roles=u.roles.includes(k)?u.roles.filter(r=>r!==k):[...u.roles,k];if(u.status==='active'&&!u.roles.length){u.roles=[k];return toast('An active person needs at least one role. Block them to remove access',true);}
      syncAllGroups();render();break;}
    case'userApprove':{const u=USERS.find(x=>x.id===el.dataset.id);if(!u.roles.length)return toast('Choose at least one role first',true);u.status='active';syncAllGroups();render();toast(`${u.name} can log in now`);break;}
    case'userBlock':{const u=USERS.find(x=>x.id===el.dataset.id);u.status='blocked';syncAllGroups();render();toast(`${u.name} blocked`);break;}
    case'userUnblock':{const u=USERS.find(x=>x.id===el.dataset.id);u.status=u.roles.length?'active':'pending';syncAllGroups();render();toast(`${u.name}: ${u.status==='active'?'access back':'choose a role, then approve'}`);break;}
    case'linkStart':{S.builder.linkFrom=bStop(el.dataset.i).id;renderView();break;}
    case'linkCancel':{S.builder.linkFrom=null;renderView();break;}
    case'linkHere':{const B=S.builder;const from=B.stops.findIndex(x=>x.id===B.linkFrom);B.linkFrom=null;if(!linkStops(from,+el.dataset.i))toast('These stops cannot be linked',true);renderView();refreshBuilderBits();break;}
    case'linkTo':{if(!linkStops(+el.dataset.i,+el.dataset.k))toast('These stops cannot be linked',true);renderView();break;}
    case'unlink':{unlinkStop(+el.dataset.i);renderView();break;}
    case'sort':{const t=el.dataset.t,k=el.dataset.k,cur=S.sort[t];S.sort[t]=!cur||cur.k!==k?{k,dir:1}:cur.dir>0?{k,dir:-1}:null;if(!S.sort[t])delete S.sort[t];
      try{localStorage.setItem('ub.sort',JSON.stringify(S.sort));}catch(e){}renderView();break;}
    case'seedMore':{const added=seedMore(10);render();toast(added.length?`Added ${added.length} drivers with trips at different steps`:'No more sample names left',!added.length);break;}
    case'resetData':{if(!(S.resetArm>Date.now())){S.resetArm=Date.now()+4000;renderView();break;}
      // Shared data: drivers, trips and unassigned loads are replaced for everyone; team and agents stay.
      if(CLOUD.on){S.resetArm=0;S.builder=null;S.drawer=null;DRIVERS.length=0;TRIPS.length=0;POOL.length=0;seedStarter({team:false,disp:user()});render();toast('Started over with 3 sample drivers');break;}
      clearSaved();location.href=location.pathname;break;}
    case'cancelB':if(S.builder.active){S.builder=null;render();toast('Changes were not sent');}else commitBuilder('auto');break;
    case'clearAll':{const B=S.builder;if(B.clearArm>Date.now()){clearBuilder();renderView();toast('Cleared');}else{B.clearArm=Date.now()+4000;renderView();setTimeout(()=>{if(S.builder===B&&B.clearArm&&B.clearArm<=Date.now()){B.clearArm=0;renderView();}},4100);}break;}
    case'addAgent':{addAgentStop();renderView();document.querySelector('[data-pk=agent]')?.focus();break;}
    case'addDispNote':{const st=S.builder.stops;const rows=st.filter(x=>!x.agent&&!x.extracting);addNote(rows.length?rows[rows.length-1].id:null);renderView();const ts=document.querySelectorAll('[data-notetext]');ts[ts.length-1]?.focus();break;}
    case'noteAfter':{const n=addNote(bStop(el.dataset.i).id);renderView();document.querySelector(`[data-notetext="${n.id}"]`)?.focus();break;}
    case'rmNote':{const B=S.builder;B.notes=B.notes.filter(n=>n.id!==el.dataset.id);renderView();break;}
    case'agentChange':{const s=bStop(el.dataset.i);s.agentId=null;renderView();document.querySelector(`[data-pk=agent][data-i="${el.dataset.i}"]`)?.focus();break;}
    case'spSend':{const M=S.modal;if(!M||M.sent)break;const ta=document.getElementById('spText');if(ta&&ta.value!==M.text)applyMessageText(ta.value);
      const p=sendProblem();if(p)return toast(p,true);M.sent=true;renderModal();setTimeout(()=>{S.modal=null;commitBuilder('send');},1400);break;}
    case'sampleRC':extract();renderView();break;
    case'sampleRC2':extract(null,true);renderView();break;
    case'poolPick':S.builder.pick=!S.builder.pick;renderView();break;
    case'poolAdd':{const p=POOL.find(x=>x.id===el.dataset.id);if(!p)break;const c=cloneStop(p);S.builder.stops.push(c);placeRow(S.builder.stops,c);renderView();toast(`Load ${c.load} added. Set the dispatched time.`);break;}
    case'mvG':moveGroup(S.builder.stops,+el.dataset.i,+el.dataset.k);renderView();break;
    case'swapAB':{const st=S.builder.stops,i=+el.dataset.i;if([st[i],st[i+1]].some(x=>x.status&&x.status!=='pending'))return toast('This stop is already in progress and cannot be moved',true);
      [st[i],st[i+1]]=[st[i+1],st[i]];renderView();break;}
    case'rmStop':{const s=bStop(el.dataset.i);if(s.status&&s.status!=='pending')return toast('This stop is already in progress and cannot be removed',true);
      const r=removeStop(+el.dataset.i);renderView();if(r==='emptied')toast('Loads are normal stops again. Press × once more to remove the agent');else if(!s.extracting&&!isAgent(s))toast(`Load ${s.load} will go to Unassigned loads when you save`);break;}
    case'takeOut':{if(releaseLoad(bStop(el.dataset.i)))renderView();break;}
    case'saveDraft':commitBuilder('draft');break;
    case'sendTrip':{const p=sendProblem();if(p){if(/trip number/i.test(p))document.getElementById('bNum')?.focus();return toast(p,true);}
      document.querySelectorAll('.pk-list').forEach(l=>l.hidden=true);S.modal={kind:'sendPreview',text:builderMessage()};renderModal();break;}
    /* warehouse */
    case'whGo':S.drawer=null;S.tab='warehouse';if(trip(el.dataset.id).trailerReady){S.whEdit[el.dataset.id]=true;delete S.whd[el.dataset.id];}render();break;
    case'whStart':whStart(el.dataset.id);break;
    case'noFit':{const tt=trip(el.dataset.id);run(tt,'noFit',{i:+el.dataset.i});break;}
    case'whSamplePh':{const w=whDraft(trip(el.dataset.id))[el.dataset.s];if(w.photos.length>=MAX_STOP_PHOTOS)return toast(`Up to ${MAX_STOP_PHOTOS} photos per stop`,true);w.photos.push(null);renderView();break;}
    case'whEdit':S.whEdit[el.dataset.id]=true;delete S.whd[el.dataset.id];renderView();break;
    case'whCancel':S.whEdit[el.dataset.id]=false;delete S.whd[el.dataset.id];renderView();break;
    case'whSave':{const tt=trip(el.dataset.id);const W=whDraft(tt);const L=labels(tt.stops);
      const bad=tt.stops.findIndex(s=>!s.noFit&&!isAgent(s)&&(W[s.id].qty===''||W[s.id].spots===''));
      if(bad>=0)return toast(`Enter quantity and spots for stop ${L[bad]}`,true);
      const r=act(tt,'trailerReady',{data:W,who:user(),src:'warehouse'});if(!r.ok)return toast(r.msg,true);
      S.whEdit[tt.id]=false;delete S.whd[tt.id];render();toast(tt.trailer?'Saved. Resend to update the driver.':'Trailer saved. Send it to the driver.');break;}
    case'whSendOpen':{const wt=trip(el.dataset.id);if(wt.status==='draft'){wt.trailerSendWithTrip=true;wt.history.push({ts:Date.now(),who:user(),src:'warehouse',text:'Trailer ready, it goes to the driver together with the trip'});renderView();return toast('The trip is not sent yet. The trailer goes to the driver together with it',false);}}
      if(!trip(el.dataset.id).driverId)return toast('Assign a driver first, the trailer goes to the driver group',true);S.modal={kind:'whSend',tid:el.dataset.id};renderModal();break;
    case'whSendNow':{const tt=trip(el.dataset.id);const re=!!tt.trailer;const r=act(tt,'trailer',{who:user(),src:'warehouse'});S.modal=null;render();
      if(!r.ok)return toast(r.msg,true);if(S.tab==='warehouse')markSent(tt.id);toast(`${re?'Resent':'Sent'} trailer ${tnum(tt)} to ${drv(tt.driverId).name}`);break;}
  }
});
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.id==='roleSel'){S.uid=el.value;S.disp=hasRole('dispatcher')?'mine':'all';S.builder=null;S.drawer=null;S.tab=myTabs()[0];render();toast(`Viewing as ${user()} · ${myRoles().map(r=>ROLES[r].label).join(' + ')}`);return;}
  if(el.id==='fDisp'){S.disp=el.value;renderView();return;}
  if(el.id==='dDisp'){run(trip(S.drawer),'dispatcher',{name:el.value});return;}
  if(el.id==='actAs'){S.actAs[el.dataset.id]=el.value;renderDrawer();return;}
  if(el.id==='bPrio'){S.builder.priority=el.checked;return;}
  if(el.id==='rcFile'){[...el.files].forEach(addRcFile);renderView();return;}
  if(el.dataset.drvsel){const t=trip(el.dataset.drvsel);t.driverId=el.value||null;t.updated=Date.now();
    if(el.value)t.history.push({ts:Date.now(),who:user(),src:'consolidator',text:'Driver set: '+drv(el.value).name});render();return;}
  if(el.dataset.dd){const t=trip(el.dataset.dd);if(!el.value)return;if(t.status==='draft'){t.dispatcher=el.value;t.history.push({ts:Date.now(),who:user(),src:'consolidator',text:'Dispatcher set: '+el.value});t.updated=Date.now();toast(`#${t.id}: dispatcher ${el.value}`);render();}else{const r=run(t,'dispatcher',{name:el.value});if(r.ok)toast(`#${t.id}: ${el.value} got the Dispatcher tag in the group`);}return;}
  if(el.dataset.bh){run(trip(el.dataset.bh),'bhDispatcher',{name:el.value});return;}
  if(el.dataset.truck){const d=drv(el.dataset.truck);const v=el.value.trim();if(!v||v===d.truck){el.value=d.truck;return;}
    const dup=DRIVERS.find(x=>x!==d&&x.truck===v);if(dup){el.value=d.truck;return toast(`Truck ${v} is already in group "${groupTitle(dup)}"`,true);}
    const old=d.truck;d.truck=v;const t=activeTrip(d);
    if(t)t.history.push({ts:Date.now(),who:user(),src:'dispatcher',text:`Truck changed ${old} → ${v}. Group renamed to "${groupTitle(d)}"`});
    toast(`Group renamed to "${groupTitle(d)}"`);render();return;}
  if(el.dataset.rev!=null){const t=trip(S.drawer);const f=el.files[0];if(!f)return;const s=t.stops[+el.dataset.rev];const base=s.split?s.loadRate:s.rate;
    run(t,'revised',{i:+el.dataset.rev,total:Math.round(base*1.06/10)*10,file:f.name});toast(`Revised RC ${f.name} replaced the old one`);return;}
  if(el.dataset.wph){const w=whDraft(trip(el.dataset.wph))[el.dataset.s];const files=[...el.files];const room=MAX_STOP_PHOTOS-w.photos.length;
    files.slice(0,Math.max(0,room)).forEach(f=>w.photos.push(URL.createObjectURL(f)));if(files.length>room)toast(`Up to ${MAX_STOP_PHOTOS} photos per stop`,true);renderView();return;}
  if(el.dataset.wf==='unit'){whDraft(trip(el.dataset.t))[el.dataset.s].unit=el.value;return;}
  if(el.dataset.f&&S.builder){const i=+el.dataset.i,f=el.dataset.f;
    const g=groupMembers(S.builder.stops,i),oldT=fmtDisp(bStop(i));
    if(f==='dispTs'){const v=new Date(el.value).getTime();bGroupSet(i,s=>s.disp=v?{ts:v}:null);retimeMsgs(S.builder.stops,g,oldT);refreshBuilderBits();return;}
    if(f==='asap'){const s0=bStop(i);const day=dispTs(s0)||s0.brokerAppt;bGroupSet(i,s=>s.disp=el.checked?{asap:true,day}:null);retimeMsgs(S.builder.stops,g,oldT);renderView();return;}
    if(f==='brokerAppt'){const v=new Date(el.value).getTime();if(v){const s=bStop(i);s.brokerAppt=v;if(!s.resched)s.appt=v;}return;}
    if(f==='refType'){bStop(i).refType=el.value;refreshBuilderBits();return;}
    if(['addr','city'].includes(f)){renderView();return;}
  }
});
document.addEventListener('input',e=>{
  const el=e.target;
  if(el.id==='fSearch'){S.q=el.value;document.getElementById('boardBody').innerHTML=boardRows();return;}
  if(el.id==='pSearch'){S.pq=el.value;document.getElementById('prepBody').innerHTML=prepRows();return;}
  if(el.id==='bNum'&&S.builder){const v=el.value.replace(/\D/g,'').slice(0,10);if(v!==el.value)el.value=v;S.builder.num=v;refreshBuilderBits();return;}
  if(el.dataset.pk&&S.builder){if(el.dataset.pk==='driver'&&!el.value.trim())S.builder.driverId='';if(el.dataset.pk==='disp'&&!el.value.trim())S.builder.dispatcher='';pkShow(el);return;}
  if(el.dataset.notetext&&S.builder){const n=S.builder.notes.find(x=>x.id===el.dataset.notetext);if(n)n.text=el.value;refreshBuilderBits();return;}
  if(el.dataset.msg!=null&&S.builder){const i=+el.dataset.msg,s=bStop(i),first=s.msg==null;s.msg=el.value;syncTimeFromText(i);
    if(first){const h=document.getElementById('mbh-'+i);if(h)h.innerHTML=msgHead(s,i,labels(S.builder.stops));}return;}
  if(el.dataset.f&&S.builder&&!['dispTs','asap','brokerAppt','refType'].includes(el.dataset.f)){const s=bStop(el.dataset.i);s[el.dataset.f]=el.value;
    if(['consignee','addr','city','refNum'].includes(el.dataset.f))refreshBuilderBits();return;}
  if(el.dataset.wf&&el.dataset.wf!=='unit'){const tt=trip(el.dataset.t);const W=whDraft(tt);W[el.dataset.s][el.dataset.wf]=el.value;
    const sp=tt.stops.reduce((x,s)=>x+(s.noFit?0:(+W[s.id].spots||0)),0);const o=document.getElementById('whsp-'+tt.id);if(o)o.textContent=`${sp}/30 spots`;}
});
document.addEventListener('keydown',e=>{
  if(e.target.dataset&&e.target.dataset.pk){const list=e.target.parentElement.querySelector('.pk-list');
    if(e.key==='Enter'){const o=list&&list.querySelector('.pk-opt:not([disabled])');if(o){e.preventDefault();pkPick(e.target,o.dataset.pkv);}return;}
    if(e.key==='Escape'&&list&&!list.hidden){list.hidden=true;e.stopPropagation();return;}}
  if(e.key==='Enter'&&e.target.id&&e.target.id.startsWith('whnum-')){whStart(e.target.id.slice(6));return;}
  if(e.key!=='Escape')return;hideCtx();if(S.modal&&S.modal.kind==='sendPreview'&&S.builder&&S.builder.stay&&!S.modal.sent){S.builder=null;S.modal=null;renderModal();return;}if(S.builder&&S.builder.linkFrom!=null&&!S.modal){S.builder.linkFrom=null;renderView();return;}if(S.modal){S.modal=null;renderModal();}else if(S.drawer){S.drawer=null;renderDrawer();}
});
/* Right-click on a trip row, a driver or a status: a small menu with what can be done right there. */
function hideCtx(){const m=document.getElementById('ctx');if(m)m.hidden=true;}
function ctxItems(t,stEl){
  const items=[];const pre=!t.leftYard;const edit=canEditTrip()&&!t.closed;
  if(t.status==='draft'){if(t.driverId&&edit)items.push(['ctxSend','Send to driver']);if(edit)items.push(['ctxEdit','Edit trip']);}
  else{items.push(['ctxOpen',`Open trip ${tripNo(t)}`]);if(edit)items.push(['ctxEdit','Edit trip']);}
  if(stEl&&can('override'))items.push(['ctxStatus',`Change status · ${stEl.dataset.stLabel}`,stEl.dataset.st]);
  if(t.driverId&&(can('dispatch')||can('build')))items.push(pre?['unassignAsk','Unassign driver','','danger']:['','Driver can be unassigned only before the truck leaves the yard']);
  return items;
}
document.addEventListener('contextmenu',e=>{const el=e.target.closest&&e.target.closest('[data-ctx]');if(!el){hideCtx();return;}
  const row=el.dataset.id?el:el.closest('[data-id]');const t=row&&trip(row.dataset.id);if(!t)return;e.preventDefault();
  const stEl=e.target.closest('[data-st]');
  let m=document.getElementById('ctx');if(!m){m=document.createElement('div');m.id='ctx';m.className='ctx';document.body.appendChild(m);}
  m.innerHTML=ctxItems(t,stEl).map(([a,l,k,c])=>a?`<button class="${c||''}" data-a="${a}" data-id="${t.id}" data-k="${k||''}">${esc(l)}</button>`:`<span class="note" style="padding:6px 10px">${esc(l)}</span>`).join('');
  m.hidden=false;const w=m.offsetWidth||200,h=m.offsetHeight||80;m.style.left=Math.min(e.clientX,innerWidth-w-8)+'px';m.style.top=Math.min(e.clientY,innerHeight-h-8)+'px';});
document.addEventListener('scroll',hideCtx,true);
/* Picker: choose with the mouse before the field loses focus; close the list when focus leaves. */
document.addEventListener('mousedown',e=>{if(!(e.target.closest&&e.target.closest('.ctx')))hideCtx();if(!(e.target.closest&&e.target.closest('.pk')))document.querySelectorAll('.pk-list').forEach(l=>l.hidden=true);
  const o=e.target.closest&&e.target.closest('[data-pkv]');if(!o||o.disabled)return;e.preventDefault();
  const inp=o.closest('.pk').querySelector('[data-pk]');pkPick(inp,o.dataset.pkv);});
document.addEventListener('focusin',e=>{if(e.target.dataset&&e.target.dataset.pk&&S.builder)pkShow(e.target);});
document.addEventListener('focusout',e=>{const inp=e.target;if(!inp.dataset||!inp.dataset.pk||!S.builder)return;setTimeout(()=>{const l=inp.parentElement&&inp.parentElement.querySelector('.pk-list');if(l)l.hidden=true;
  const B=S.builder;if(!B)return;if(inp.dataset.pk==='driver'){const d=drv(B.driverId);inp.value=d?`${d.truck} · ${d.name}`:'';}if(inp.dataset.pk==='disp')inp.value=B.dispatcher||'';},120);});
/* Reorder stop cards by dragging ⠿; drop a load on an agent; move dispatch notes between stops. */
let drag=null;
document.addEventListener('dragstart',e=>{const g=e.target.closest&&e.target.closest('[data-drag],[data-dragnote]');if(!g||!S.builder)return;
  drag=g.dataset.dragnote?{note:g.dataset.dragnote}:{from:+g.dataset.drag};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','stop');
  g.closest('.mini,.cube')?.classList.add('dragging');});
document.addEventListener('dragend',()=>{drag=null;document.querySelectorAll('.dragging,.over').forEach(c=>c.classList.remove('dragging','over'));});
document.addEventListener('dragover',e=>{if(!drag)return;const c=e.target.closest&&e.target.closest('[data-cube]');
  if(!c){if(e.target.closest&&e.target.closest('.cubes,.bld')){e.preventDefault();document.querySelectorAll('.over').forEach(x=>x.classList.remove('over'));}return;}e.preventDefault();
  const t=c.classList.contains('mini')?c.closest('.cube'):c;document.querySelectorAll('.over').forEach(x=>x!==t&&x.classList.remove('over'));t.classList.add('over');});
document.addEventListener('drop',e=>{if(!drag)return;const c=e.target.closest&&e.target.closest('[data-cube]');
  if(!c){if(e.target.closest&&e.target.closest('.cubes,.bld')){e.preventDefault();const d=drag;drag=null;const s=d.from!=null&&bStop(d.from);if(s&&s.agent&&releaseLoad(s))renderView();}return;}
  e.preventDefault();
  const d=drag;drag=null;const to=+c.dataset.cube;
  if(d.note){dropNote(d.note,to);return renderView();}
  if(d.from===to)return renderView();if(dropStop(d.from,to))renderView();else{renderView();toast('A stop already in progress cannot be moved',true);}});
/* RC files can be dropped anywhere in the builder; dropped on an empty stop card they fill that card. */
const hasFiles=e=>!!e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
['dragover','dragleave','drop'].forEach(ev=>document.addEventListener(ev,e=>{
  if(!S.builder||drag||!hasFiles(e))return;const z=e.target.closest&&e.target.closest('.bld');if(!z)return;e.preventDefault();
  const c=e.target.closest('[data-cube]');const blank=c&&isBlank(bStop(c.dataset.cube))?c:null;
  document.querySelectorAll('.filedrop').forEach(x=>x!==blank&&x.classList.remove('filedrop'));
  if(ev==='dragover'){z.classList.add('fileover');if(blank)blank.classList.add('filedrop');return;}
  z.classList.remove('fileover');if(ev!=='drop')return;
  const files=[...e.dataTransfer.files].filter(f=>/pdf$/i.test(f.type)||/\.pdf$/i.test(f.name));if(!files.length)return toast('Drop PDF rate confirmations',true);
  const tid=blank?bStop(blank.dataset.cube).id:null;files.forEach((f,k)=>addRcFile(f,k===0?tid:null));renderView();
}));

}
