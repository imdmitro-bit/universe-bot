/* Builds the sample trips by replaying real actions, so seeded history looks like live history. */
import {DISPATCHERS} from '../config/roles.js';
import {AGENTS_SAMPLE,CONSIGNEES,TEAM_SAMPLE,DISP_NOTES,NAMES,NE_STOPS,RESCHED_REASONS,WH_NOTES} from './sample.js';
import {act} from '../domain/actions.js';
import {curIdx,groupMembers,groupsOf,mkStop} from '../domain/stops.js';
import {MIN,NOW,pick,rint,rnd} from '../lib/utils.js';
import {CLOUD} from '../cloud/mode.js';
import {AGENTS,DRIVERS,POOL,S,TRIPS,USERS,dispatchers,newDriverGroup,newTrip,user} from '../state.js';

/* The agents directory, always there at the start. */
export function seedAgents(){AGENTS_SAMPLE.forEach((a,k)=>AGENTS.push({id:'a'+(k+1),...a}));}
/* Sample team for the browser-only prototype. With shared data the team is the real people who logged in through Telegram. */
export function seedTeam(){
  TEAM_SAMPLE.forEach((u,k)=>USERS.push({id:'u'+(k+1),...u,roles:[...u.roles],status:'active',lastSeen:NOW-rint(5,600)*MIN}));
  S.uid=USERS[0].id;
}
/* First start without saved data: three drivers with trips at different steps, to try the flow on real-looking data.
   Then everything is yours. team:false keeps the real team (shared data); disp puts one dispatcher on all three trips. */
export function seedStarter({team=true,disp=null}={}){
  if(!AGENTS.length)seedAgents();
  if(team)seedTeam();
  [['James Smith','348','sent','Anna K.'],['Carlos Rivera','227','confirmed','Mark L.'],['Mike Johnson','264','delivering','Oleh P.']].forEach(([name,truck,ph,d0])=>{
    const d={...newDriverGroup(name,truck),loc:'Home parking — Aurora, IL',ping:NOW-rint(1,9)*MIN};DRIVERS.push(d);seedTrip(d,ph,disp||d0,false);});
}
/* "Add 10 drivers with trips": appends drivers with trips at different steps to your own data, to play with statuses. */
export function seedMore(n=10){
  const phases=['refused','sentPrep','ready','trailerMoving','at_yardReady','left_yard','delivering','detention','delivered','empty'];
  const used=new Set(DRIVERS.map(d=>d.name)),trucks=new Set(DRIVERS.map(d=>d.truck));const pool=dispatchers().length?dispatchers():CLOUD.on?[user()]:DISPATCHERS;
  const names=NAMES.filter(x=>!used.has(x));const added=[];
  for(let k=0;k<n&&k<names.length;k++){let tr;do{tr=String(rint(201,298));}while(trucks.has(tr));trucks.add(tr);
    const d={...newDriverGroup(names[k],tr),loc:pick(['Home parking — Aurora, IL','Truck stop — Gary, IN','Home parking — Joliet, IL']),ping:NOW-rint(1,9)*MIN};
    DRIVERS.push(d);seedTrip(d,phases[k%phases.length],pick(pool),false);added.push(d);}
  return added;
}
export function seed(){
  seedAgents();seedTeam();
  const trucks=new Set();
  NAMES.forEach((name,i)=>{
    let tr;do{tr=rint(201,298);}while(trucks.has(tr));trucks.add(tr);
    DRIVERS.push({...newDriverGroup(name,String(tr)),id:'d'+(i+1),
      loc:pick(['Home parking — Aurora, IL','Truck stop — Gary, IN','Home parking — Joliet, IL','Truck stop — Hammond, IN']),ping:NOW-rint(1,9)*MIN});
  });
  const phases=['sent','sent','sentPrep','refused','confirmed','confirmedMoving','trailerOnly','ready','ready','trailer','trailerMoving','at_yard','at_yardNoTrailer','at_yardReady','left_yard','left_yard',
    'delivering','delivering','delivering','delivering','delivering','detention','detention','delivered','delivered','empty','empty','backhaul','idle','idle','idle','idle'];
  for(let i=phases.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[phases[i],phases[j]]=[phases[j],phases[i]];}
  const dispPool=['Anna K.','Anna K.','Mark L.','Oleh P.','Sara T.'];
  let ne=false;DRIVERS.forEach((d,i)=>{const ph=phases[i];if(ph==='idle')return;const g=ph==='trailer'&&!ne;if(g)ne=true;seedTrip(d,ph,pick(dispPool),g);});
  for(let k=0;k<2;k++){
    const t=newTrip();const n=rint(2,3);const used=new Set();
    for(let j=0;j<n;j++){let c;do{c=pick(CONSIGNEES);}while(used.has(c.c));used.add(c.c);t.stops.push(mkStop(c,NOW+(20+j*3)*60*MIN));}
    t.created=NOW-rint(20,90)*MIN;t.updated=t.created;t.history.push({ts:t.created,who:'Consolidator',src:'consolidator',text:'Draft created from '+n+' Rate Confirmations'});
    TRIPS.push(t);
  }
  for(let k=0;k<3;k++){const s=mkStop(pick(CONSIGNEES),NOW+rint(20,40)*60*MIN);s.fromTrip=String(27531+k);s.pooledAt=NOW-rint(30,300)*MIN;POOL.push(s);}
}
export function genWh(t,ne){const out={};t.stops.forEach((s,i)=>{if(ne){const c=NE_STOPS[i];out[s.id]={qty:c.q[0],unit:c.q[1],spots:c.q[2],photos:[null]};}else{const crate=rnd()<.08;const q=crate?1:rint(2,14);out[s.id]={qty:q,unit:crate?'crate':'plts',spots:Math.max(1,Math.round(q*(.45+rnd()*.6))),photos:rnd()<.4?[null,null]:[null]};}});return out;}
export function seedTrip(d,ph,disp,ne){
  const t=newTrip();t.driverId=d.id;t.dispatcher=disp;if(ne)t.id='27557';
  let n;
  if(ne){NE_STOPS.forEach(c=>{const s=mkStop(c,0);s.refType=c.ref?c.ref[0]:'';s.refNum=c.ref?c.ref[1]:'';t.stops.push(s);});n=t.stops.length;}
  else{n=pick([1,2,2,2,3,3,3,4]);const used=new Set();for(let j=0;j<n;j++){let c;do{c=pick(CONSIGNEES);}while(used.has(c.c));used.add(c.c);t.stops.push(mkStop(c,0));}
    if(n>=3&&rnd()<.35){const a=t.stops[1],b=t.stops[2];b.consignee=a.consignee;b.addr=a.addr;b.city=a.city;}}
  groupsOf(t.stops).forEach(g=>g.slice(1).forEach(i=>t.stops[i].legMi=0));
  if(!ne&&rnd()<.12)t.priority=true;
  const PRE=['send','confirm','trailerPrep','trailerReady','trailer','enRouteYard','atYard','leftYard'];
  const stopSteps=[];groupsOf(t.stops).forEach(()=>stopSteps.push('arrive','checkin','indoor','unload'));
  let steps;
  switch(ph){
    case'sent':steps=['send'];break; case'sentPrep':steps=['send','trailerPrep'];break; case'refused':steps=['send','refuse'];break;
    case'confirmed':steps=['send','confirm','trailerPrep'];break; case'confirmedMoving':steps=['send','confirm','enRouteYard'];break;
    case'trailerOnly':steps=['send','trailerPrep','trailerReady','trailer'];break;
    case'ready':steps=['send','confirm','trailerPrep','trailerReady'];break;
    case'trailer':steps=['send','confirm','trailerPrep','trailerReady','trailer'];break;
    case'trailerMoving':steps=['send','confirm','trailerPrep','trailerReady','trailer','enRouteYard'];break;
    case'at_yard':steps=['send','confirm','trailerPrep','trailerReady','enRouteYard','atYard'];break;
    case'at_yardNoTrailer':steps=['send','confirm','enRouteYard','atYard','trailerPrep'];break;
    case'at_yardReady':steps=PRE.slice(0,7);break;
    case'left_yard':steps=PRE;break;
    case'delivering':steps=PRE.concat(stopSteps.slice(0,rint(1,stopSteps.length-1)));break;
    case'delivered':steps=PRE.concat(stopSteps);break;
    case'empty':case'backhaul':steps=PRE.concat(stopSteps,['empty']);break;
    case'detention':steps=PRE.concat(['arrive','checkin']);break;
  }
  const gaps=steps.map(()=>rint(14,50));let m=(ph==='detention'?rint(110,140):rint(2,40))+gaps.slice(1).reduce((x,y)=>x+y,0);
  t.created=Date.now()-(m+rint(20,60))*MIN;
  t.history.push({ts:t.created,who:'Consolidator',src:'consolidator',text:`Trip built from ${n} Rate Confirmation${n>1?'s':''}`});
  steps.forEach((st,k)=>{
    const ts=Date.now()-m*MIN; const last=k===steps.length-1;
    let who=d.name,src='driver',o={};
    if(st==='send'){who='Consolidator';src='consolidator';}
    if(['trailerPrep','trailerReady','trailer'].includes(st)){who='Warehouse';src='warehouse';}
    if(st==='trailerPrep')o.num=ne?'539571':String(rint(530000,549999));
    if(st==='trailerReady')o.data=genWh(t,ne);
    if(['enRouteYard','atYard','leftYard','arrive'].includes(st)){who='Samsara';src='samsara';}
    if(['checkin','indoor','unload'].includes(st)&&rnd()<.25){who=t.dispatcher;src='dispatcher';}
    if(st==='indoor')o.door=String(rint(3,48));
    if(st==='empty'){who=t.dispatcher;src='dispatcher';}
    act(t,st,{ts,who,src,...o});
    if(!last)m-=gaps[k+1];
  });
  if(t.trailer){t.stops.forEach(s=>{if(rnd()<.6)s.whNote=pick(WH_NOTES);});}
  if(t.leftYard&&rnd()<.5){const s=pick(t.stops);s.notes.push({ts:Date.now()-rint(10,120)*MIN,who:t.dispatcher,text:pick(DISP_NOTES)});}
  if(ph==='backhaul')act(t,'bhDispatcher',{name:pick(DISPATCHERS),who:'Supervisor',src:'dispatcher',ts:Date.now()-rint(3,15)*MIN});
  // appointments that make sense against the timeline
  const ci=curIdx(t);
  if(!t.leftYard){let a=NOW+rint(4,16)*60*MIN;groupsOf(t.stops).forEach(g=>{g.forEach(i=>t.stops[i].appt=a+rint(0,2)*30*MIN);a+=rint(2,4)*60*MIN;});}
  else{
    let a=null;
    t.stops.forEach((s,i)=>{
      if(s.t.arrived){s.appt=s.t.arrived+rint(-40,30)*MIN;a=s.appt;}
      else{
        if(i===ci&&d.eta)s.appt=d.eta+rint(-70,120)*MIN; else s.appt=(a||NOW)+rint(150,260)*MIN;
        a=s.appt;
      }
    });
  }
  if(ph==='detention'){groupMembers(t.stops,0).forEach(i=>{const s=t.stops[i];s.appt=s.t.arrived+rint(-5,10)*MIN;});}
  t.stops.forEach(s=>{s.brokerAppt=s.appt;s.rcTs=t.created;});
  t.stops.forEach(s=>{if(s.status==='pending'&&ph!=='detention'&&rnd()<.12){s.brokerAppt=s.appt-rint(2,5)*60*MIN;s.resched={ts:t.created+rint(20,90)*MIN,who:t.dispatcher||'Consolidator',reason:pick(RESCHED_REASONS)};}});
  groupsOf(t.stops).forEach(g=>{const s0=t.stops[g[0]];const asap=s0.status==='pending'&&rnd()<.15;const b=new Date(s0.brokerAppt);b.setMinutes(b.getMinutes()<30?0:30,0,0);
    const dsp=asap?{asap:true,day:s0.brokerAppt}:{ts:b.getTime()-pick([0,0,0,60,120])*MIN};g.forEach(i=>t.stops[i].disp={...dsp});});
  if(ne){
    const b=new Date(NOW);b.setHours(20,0,0,0);if(b.getTime()<NOW+2*60*MIN)b.setDate(b.getDate()+1);const B0=b.getTime(),H=60*MIN;
    const set=(i,disp,appt)=>{const s=t.stops[i];s.disp=disp;s.brokerAppt=appt;s.appt=appt;s.resched=null;};
    set(0,{ts:B0},B0);set(1,{ts:B0+10*H},B0+10*H);set(2,{asap:true,day:B0+12*H},B0+12*H);set(3,{asap:true,day:B0+12*H},B0+14*H);set(4,{asap:true,day:B0+16*H},B0+17*H);
  }
  if(t.leftYard&&ci>=0&&t.stops[ci].status==='pending'&&!d.eta)d.eta=NOW+rint(30,200)*MIN;
  d.ping=Math.max(d.ping,NOW-rint(1,7)*MIN);
  TRIPS.push(t);
}
