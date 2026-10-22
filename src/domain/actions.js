/* The core: one function applies every status change and writes history and bot posts. */
import {LOCS,NEAR_YARD} from '../data/sample.js';
import {MAX_TG_PHOTOS,REPORT_TYPES,STOP_ORDER,curIdx,isAgent,fmtDisp,glab,groupMembers,labels,retimeMsgs,spotsTotal,syncGroup,tnum,whMessage,whPhotos} from './stops.js';
import {MIN,fmtD,money,pick,rint} from '../lib/utils.js';
import {TRACKS,trackValue} from './status.js';
import {activeTrip,drv,firstName,groupTitle,user} from '../state.js';

export function grantDispatcher(t,d){
  d.members.forEach(m=>{m.tags=m.tags.filter(x=>x!=='Dispatcher');});
  if(!t.dispatcher)return;
  let m=d.members.find(m=>m.name===t.dispatcher);
  if(!m){m={name:t.dispatcher,tags:[]};d.members.push(m);}
  m.tags.push('Dispatcher');
}
export function act(t,a,o={}){
  const d=drv(t.driverId); const ts=o.ts||Date.now(); const who=o.who||user(); const src=o.src||'dispatcher';
  const log=(text,warn)=>{t.history.push({ts,who,src,text,warn:!!warn});t.updated=ts;if(d)d.ping=Math.max(d.ping||0,ts);};
  // Every bot post carries who issued it; the group sees "Issued by <first name>" under the message.
  const bot=m=>{if(m.kind==='trip')t.chat.forEach(x=>{if(x.kind==='trip')x.old=true;});t.chat.push({ts,by:firstName(who),...m});};
  const ci=curIdx(t); const s=ci>=0?t.stops[ci]:null; const fail=msg=>({ok:false,msg});
  switch(a){
    case 'send':
      t.status='active';t.confirm='pending';t.sentTs=ts;grantDispatcher(t,d);
      log(`Trip sent to group "${groupTitle(d)}". ${t.dispatcher?t.dispatcher+' got the Dispatcher tag':'No dispatcher assigned yet'}`);bot({kind:'trip'});
      // The trailer belongs to the trip: if it was already sent (e.g. to a driver who was unassigned), the new group gets it too.
      if(t.trailer){t.trailer={...t.trailer,ts};bot({kind:'trailer',num:t.trailer.num,photos:t.trailer.photos,text:whMessage(t)});log(`Trailer ${t.trailer.num} info sent to "${groupTitle(d)}"`);}
      else if(t.trailerReady&&t.trailerSendWithTrip){const photos=whPhotos(t);t.trailer={num:tnum(t),photos,ts};t.whDirty=false;bot({kind:'trailer',num:t.trailer.num,photos,text:whMessage(t)});log(`Trailer ${t.trailer.num} sent together with the trip`);}
      break;
    case 'confirm':
      if(t.confirm!=='pending')return fail('Trip is not waiting for confirmation');
      t.confirm='confirmed';t.confirmTs=ts;log('Trip confirmed');bot({kind:'note',text:`Trip confirmed by ${who}`});break;
    case 'refuse':
      if(t.confirm!=='pending')return fail('Trip is not waiting for confirmation');
      t.confirm='refused';t.refuseTs=ts;log('Trip refused',true);bot({kind:'note',text:`Trip refused by ${who}. Dispatcher notified.`});break;
    case 'resend':
      if(t.confirm==='confirmed')return fail('Trip is already confirmed');
      t.confirm='pending';t.sentTs=ts;log('Confirmation resent to the group');bot({kind:'trip',resent:true});break;
    case 'trailerPrep':
      if(t.trailerPrep)return fail('Trailer is already started');
      if(!o.num)return fail('Enter the trailer number');
      t.trailerNum=o.num;t.trailerPrep=ts;log(`Trailer: Preparing · ${o.num}`);break;
    case 'trailerReady':{
      if(!t.trailerPrep)return fail('Start preparing first');
      const D=o.data||{};t.stops.forEach(x=>{const w=D[x.id];if(!w)return;x.wQty=+w.qty;x.wUnit=w.unit||'plts';x.spots=+w.spots;x.photos=(w.photos||[]).slice();});
      const first=!t.trailerReady;t.trailerReady={num:t.trailerNum,ts};if(t.trailer)t.whDirty=true;
      log(`Trailer ${first?'saved':'updated'} · ${t.trailerNum} · ${spotsTotal(t)}/30 spots`);break;}
    case 'trailer':{
      if(!t.trailerReady)return fail('Save the trailer first');
      {const L=labels(t.stops);const miss=t.stops.findIndex(x=>!x.noFit&&x.wQty==null&&!isAgent(x));if(miss>=0)return fail(`Stop ${L[miss]} has no freight yet. Edit the trailer first`);}
      const re=!!t.trailer;const photos=whPhotos(t);
      if(photos.length>MAX_TG_PHOTOS)return fail(`Telegram fits ${MAX_TG_PHOTOS} photos in one message, this trailer has ${photos.length}`);
      if(re)t.chat.forEach(x=>{if(x.kind==='trailer')x.deleted=true;});
      t.trailer={num:tnum(t),photos,ts};t.whDirty=false;
      log(re?'Trailer info resent to driver · old message deleted':`Trailer: Sent to driver · ${t.trailer.num} · ${photos.length} photos`);
      bot({kind:'trailer',num:t.trailer.num,photos,text:whMessage(t)});break;}
    case 'enRouteYard':
      if(t.enRouteYard||t.atYard||t.leftYard)return fail('Truck is already heading to or at the yard');
      t.enRouteYard=ts;d.loc=pick(NEAR_YARD);d.speed=rint(45,64);d.yardEta=ts+rint(15,80)*MIN;
      log('Yard: En route to Yard');bot({kind:'status',text:'Status: En route to Yard',src});break;
    case 'atYard':
      if(t.atYard||t.leftYard)return fail('Already at or past the yard');
      if(!t.enRouteYard)t.enRouteYard=ts;
      t.atYard=ts;d.loc='Main Yard';d.speed=0;d.yardEta=null;log('Yard: At the Yard');bot({kind:'status',text:'Status: At the Yard',src});break;
    case 'leftYard':
      if(t.leftYard)return fail('Already left the yard');
      if(t.confirm!=='confirmed'||!t.trailer){
        const miss=[t.confirm!=='confirmed'?'trip not confirmed':'',!t.trailer?'trailer not sent':''].filter(Boolean).join(', ');
        if(src==='samsara'){const text=`Truck left the yard geofence, but ${miss}. Status was not changed.`;
          if(!t.alerts.some(x=>x.text===text)){t.alerts.push({ts,text});log(`Left yard geofence ignored: ${miss}`,true);}
          d.loc=pick(LOCS);d.speed=rint(50,64);d.ping=ts;}
        return fail(`Left the Yard needs a confirmed trip and a sent trailer (${miss})`);
      }
      t.leftYard=ts;if(!t.atYard)t.atYard=ts;if(!t.enRouteYard)t.enRouteYard=t.atYard;d.loc=pick(LOCS);d.speed=rint(55,67);d.eta=ts+rint(40,180)*MIN;d.yardEta=null;
      log('Yard: Left the Yard');bot({kind:'status',text:'Status: Left the Yard',src});break;
    case 'arrive':
      if(!t.leftYard||!s||s.status!=='pending')return fail('No stop to arrive at');
      s.status='arrived';s.t.arrived=ts;syncGroup(t,ci);d.loc=`${s.consignee}, ${s.city}`;d.speed=0;d.eta=null;
      log(`Stop ${glab(t,ci)} · Arrived at ${s.consignee}`);bot({kind:'status',text:`Stop ${glab(t,ci)} · Arrived — ${s.consignee}`,src});break;
    case 'checkin':
      if(!s||!['pending','arrived'].includes(s.status))return fail('Stop must be Pending or Arrived to check in');
      if(!t.leftYard){
        if(t.confirm!=='confirmed')return fail('Trip is not confirmed yet');
        t.leftYard=ts;if(!t.atYard)t.atYard=ts;log('Left the Yard (inferred from first Check In)');
      }
      if(!s.t.arrived)s.t.arrived=ts;s.status='checked_in';s.t.checked_in=ts;syncGroup(t,ci);d.loc=`${s.consignee}, ${s.city}`;d.speed=0;d.eta=null;
      log(`Stop ${glab(t,ci)} · Checked In`);bot({kind:'status',text:`Stop ${glab(t,ci)} · Checked In — by ${who}`,src});break;
    case 'indoor':
      if(!s||s.status!=='checked_in')return fail('Check In first');
      s.status='in_door';s.door=o.door||s.door||'';s.t.in_door=ts;syncGroup(t,ci);
      log(`Stop ${glab(t,ci)} · In Door${s.door?' #'+s.door:''}`);bot({kind:'status',text:`Stop ${glab(t,ci)} · In Door${s.door?' #'+s.door:''} — by ${who}`,src});break;
    case 'unload':{
      if(!s||s.status!=='in_door')return fail('Set In Door first');
      s.status='unloaded';s.t.unloaded=ts;syncGroup(t,ci);log(`Stop ${glab(t,ci)} · Unloaded`);bot({kind:'status',text:`Stop ${glab(t,ci)} · Unloaded — by ${who}`,src});
      const n=curIdx(t);
      if(n===-1){d.speed=0;bot({kind:'note',text:'All stops unloaded. Dispatcher will mark Empty — Ready for Pickup.'});}
      else{d.loc=`Leaving ${s.city}`;d.speed=rint(25,45);d.eta=ts+rint(60,200)*MIN;}
      break;}
    case 'empty':
      if(curIdx(t)!==-1)return fail('All stops must be Unloaded first');
      if(t.empty)return fail('Already marked empty');
      t.empty=ts;t.emptyAt=t.stops[t.stops.length-1].city;t.backhaul={dispatcher:'',state:'looking'};
      log(`Empty — Ready for Pickup in ${t.emptyAt}`);bot({kind:'note',text:`Trip complete. Empty — Ready for Pickup in ${t.emptyAt}.`});break;
    case 'dispatcher':
      if(o.name===t.dispatcher)return fail('Same dispatcher');
      {const old=t.dispatcher;t.dispatcher=o.name;grantDispatcher(t,d);log(old?`Dispatcher changed: ${old} → ${o.name}. Tag moved in the group`:`Dispatcher assigned: ${o.name}. Got the Dispatcher tag in the group`);}break;
    case 'unassign':{
      // Driver is taken off the trip before departure. The trip keeps its stops, trailer and dispatcher.
      if(t.leftYard)return fail('Truck already left the yard');if(!d)return fail('No driver on this trip');
      d.members.forEach(m=>{if(m.name===t.dispatcher)m.tags=m.tags.filter(x=>x!=='Dispatcher');});
      const name=d.name,g=groupTitle(d);
      Object.assign(t,{driverId:null,status:'draft',confirm:null,sentTs:null,confirmTs:null,refuseTs:null,enRouteYard:null,atYard:null,alerts:[],chat:[],ack:null});
      log(`Driver unassigned: ${name}. Trip${t.trailer?' and trailer':''} messages deleted in "${g}", driver notified`,true);break;}
    case 'bhDispatcher':
      t.backhaul.dispatcher=o.name;t.backhaul.state=o.name?'assigned':'looking';log(o.name?`Backhaul dispatcher: ${o.name}`:'Backhaul dispatcher cleared');break;
    case 'booked':
      t.backhaul.state='booked';t.closed=ts;log('Backhaul booked. Trip closed, driver is available');break;
    case 'detNotify':{const st=t.stops[o.i];st.detNotified={ts,who};log(`Stop ${glab(t,o.i)} · Broker notified: detention may occur`);break;}
    case 'report':{const st=t.stops[o.i];st.reports.push({type:o.type,amount:o.amount||0,hours:o.hours||0,plt:o.plt||0,note:o.note||'',ts,who});
      log(`Stop ${glab(t,o.i)} · ${REPORT_TYPES[o.type]} reported${o.amount?' · '+money(o.amount):''}${o.hours?' · '+o.hours+' h':''}${o.plt?' · '+o.plt+' plt':''}${o.note?' · '+o.note:''}`,o.type==='damage');break;}
    case 'resched':{const st=t.stops[o.i];if(!o.appt)return fail('Pick the new date and time');if(!o.reason)return fail('Add a reason for the reschedule');
      const old=st.appt;st.appt=o.appt;st.resched=o.appt===st.brokerAppt?null:{ts,who,reason:o.reason};
      log(`Stop ${glab(t,o.i)} · Rescheduled ${fmtD(old)} → ${fmtD(o.appt)} (broker appt ${fmtD(st.brokerAppt)}) · ${o.reason}`);break;}
    case 'changed':
      t.chat.forEach(x=>{if(x.kind==='trip')x.deleted=true;});
      bot({kind:'trip',changed:true});t.ack={pending:true,ts};
      log('Trip changed. Old trip message deleted, new one posted: "Your trip has changes"');break;
    case 'ack':
      if(!t.ack||!t.ack.pending)return fail('No changes waiting for acknowledgement');
      t.ack={pending:false,ts,who,by:src==='driver'?'driver':'dispatcher'};
      log(src==='driver'?'Driver confirmed changes':'Driver informed by dispatcher');bot({kind:'note',text:(src==='driver'?'Driver confirmed changes · ':'Driver informed by dispatcher · ')+who});break;
    case 'dispTime':{
      const L=labels(t.stops);const g=groupMembers(t.stops,o.i);const oldT=fmtDisp(t.stops[o.i]);
      g.forEach(j=>{const x=t.stops[j];x.disp={...o.disp};});const newT=fmtDisp(t.stops[o.i]);
      retimeMsgs(t.stops,g,oldT);
      log(`Stop ${g.map(j=>L[j]).join('+')} · Dispatched time ${oldT||'—'} → ${newT}`);break;}
    case 'revised':{
      const st=t.stops[o.i];const old=st.rate;st.loadRate=o.total;st.rate=st.split?Math.round(o.total/st.split):o.total;st.rcFile=o.file||('RC_'+st.load+'_revised.pdf');
      t.stops.forEach(x=>{if(x!==st&&x.load===st.load){x.loadRate=o.total;x.rate=x.split?Math.round(o.total/x.split):o.total;x.rcFile=st.rcFile;}});
      log(`Revised RC for load ${st.load}: rate ${money(old)} → ${money(st.rate)}. Old RC replaced`);break;}
    case 'noFit':{const st=t.stops[o.i];const L=labels(t.stops);st.noFit=!st.noFit;
      log(st.noFit?`Stop ${L[o.i]} (load ${st.load}) doesn't fit in the trailer · consolidator notified`:`Stop ${L[o.i]}: doesn't-fit mark removed`,st.noFit);break;}
    case 'override':{
      // A person sets a status by hand; the change is logged, nothing is posted to the group.
      const T=TRACKS[o.track];if(!T)return fail('Unknown status');const from=trackValue(t,o.track),to=o.value;if(from===to)return fail('Status is already '+T.opts.find(x=>x[0]===to)[1]);
      const name=v=>T.opts.find(x=>x[0]===v)[1];
      if(o.track==='conf'){if(t.status!=='active')return fail('Send the trip first');t.confirm=to;if(to==='confirmed')t.confirmTs=ts;if(to==='refused')t.refuseTs=ts;if(to==='pending'&&!t.sentTs)t.sentTs=ts;}
      else if(o.track==='trailer'){const k=['none','preparing','ready','sent'].indexOf(to);const num=tnum(t)||'TBD';
        if(k<1){t.trailerPrep=null;t.trailerNum='';}else{t.trailerPrep=t.trailerPrep||ts;t.trailerNum=t.trailerNum||num;}
        t.trailerReady=k>=2?(t.trailerReady||{num,ts}):null;t.trailer=k>=3?(t.trailer||{num,photos:whPhotos(t),ts}):null;t.whDirty=false;}
      else if(o.track==='yard'){if(t.stops.some(s=>s.status!=='pending')&&to!=='left')return fail('Stops are already in progress');
        const k=['none','enroute','atyard','left'].indexOf(to);t.enRouteYard=k>=1?(t.enRouteYard||ts):null;t.atYard=k>=2?(t.atYard||ts):null;t.leftYard=k>=3?(t.leftYard||ts):null;}
      else if(o.track==='stop'){let i=t.stops.findIndex(s=>s.status!=='unloaded');if(i<0)i=t.stops.length-1;const K=STOP_ORDER.indexOf(to);
        groupMembers(t.stops,i).forEach(j=>{const s=t.stops[j];s.status=to;['arrived','checked_in','in_door','unloaded'].forEach((st,n)=>{if(n+1<=K)s.t[st]=s.t[st]||ts;else delete s.t[st];});});
        if(!t.leftYard){t.leftYard=ts;t.atYard=t.atYard||ts;}}
      log(`Status changed by hand · ${T.label}: ${name(from)} → ${name(to)}`,true);break;}
    case 'priority':t.priority=!t.priority;log(t.priority?'Marked as priority':'Priority removed');break;
    default:return fail('Unknown action');
  }
  return{ok:true};
}
