/* Shared data through Firebase, used when the app is opened inside Telegram.
   Login: anonymous Firebase session + Telegram launch data checked by the tgLogin function (server/functions).
   Data: every driver, trip, unassigned load and agent is one Firestore document; the app object is kept as JSON
   text in "d". The app keeps working on its in-memory arrays (state.js) exactly as before: after each user action
   we write the objects that changed, and changes from other people are put back into the arrays and redrawn.
   The trip builder in progress stays on this device only. */
import {FIREBASE,REGION,SDK} from './config.js';
import {CLOUD} from './mode.js';
import {AGENTS,DRIVERS,POOL,S,TRIPS,USERS,hasRole,trip} from '../state.js';

const COLS={drivers:DRIVERS,trips:TRIPS,pool:POOL,agents:AGENTS};
const last={drivers:new Map(),trips:new Map(),pool:new Map(),agents:new Map()};
const lastTeam=new Map();
let fs,db,me,hooks,timer=0,writing=false,again=false;

/* Files picked in the browser live as blob: URLs that die with the page; same rule as store.js. */
const clean=(k,v)=>typeof v==='string'&&v.startsWith('blob:')?(k==='rcUrl'?undefined:null):v;
const json=o=>JSON.stringify(o,clean);
const teamKey=u=>JSON.stringify({roles:u.roles,status:u.status});
const localKey=()=>'ub.cloud.'+me.id;

/* Inside Telegram we always use shared data. ?demo and ?local keep the browser-only prototype. */
export function cloudWanted(){
  const q=new URLSearchParams(location.search);
  if(q.has('demo')||q.has('local'))return false;
  const tg=window.Telegram&&window.Telegram.WebApp;
  return !!(tg&&tg.initData);
}

/* Returns true when the person is approved and the data is loaded; false when they wait for approval or are blocked
   (hooks.gate shows that screen). Throws with a readable message when login fails. */
export async function startCloud(h){
  hooks=h;
  const emu=new URLSearchParams(location.search).has('emu')&&['localhost','127.0.0.1'].includes(location.hostname);
  const [{initializeApp},auth,firestore,functions]=await Promise.all(['app','auth','firestore','functions'].map(m=>import(`${SDK}firebase-${m}.js`)));
  fs=firestore;
  const app=initializeApp(FIREBASE);
  const a=auth.getAuth(app);db=fs.getFirestore(app);const fn=functions.getFunctions(app,REGION);
  if(emu){auth.connectAuthEmulator(a,'http://127.0.0.1:9099',{disableWarnings:true});fs.connectFirestoreEmulator(db,'127.0.0.1',8080);functions.connectFunctionsEmulator(fn,'127.0.0.1',5001);}
  await a.authStateReady();
  if(!a.currentUser)await auth.signInAnonymously(a);
  let res;
  try{res=(await functions.httpsCallable(fn,'tgLogin')({initData:window.Telegram.WebApp.initData})).data;}
  catch(e){throw new Error(e.code==='functions/permission-denied'?e.message:'Could not log in: '+(e.message||e.code));}
  me=res.user;Object.assign(CLOUD,{on:true,user:me,bot:res.bot||''});S.uid=me.id;
  if(me.status!=='active'){
    fs.onSnapshot(fs.doc(db,'users',me.id),s=>{const u=s.data();if(u&&u.status!==me.status)location.reload();});
    hooks.gate(me.status,me);return false;
  }
  await Promise.all([listenTeam(),...Object.keys(COLS).map(listen)]);
  try{const l=JSON.parse(localStorage.getItem(localKey())||'null');if(l){if(l.tab)S.tab=l.tab;if(l.builder)S.builder={...l.builder,stops:(l.builder.stops||[]).filter(s=>!s.extracting)};}}catch(e){}
  // An empty workspace (first login) gets the agents directory and three drivers with trips to try things on.
  if(hasRole('owner')&&!DRIVERS.length&&!TRIPS.length&&!POOL.length&&!AGENTS.length){hooks.seed();await flush();}
  ['click','change','input','drop','keydown'].forEach(ev=>document.addEventListener(ev,flushSoon,true));
  addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
  setInterval(flush,5000); // catches timer-driven changes (AI reads, Samsara ticks, delayed sends)
  return true;
}

function listen(col){
  const arr=COLS[col],m=last[col];
  return new Promise(ok=>fs.onSnapshot(fs.collection(db,col),snap=>{
    let changed=false;
    snap.docChanges().forEach(ch=>{
      if(ch.doc.metadata.hasPendingWrites)return;
      const id=ch.doc.id,i=arr.findIndex(x=>String(x.id)===id);
      if(ch.type==='removed'){if(i>=0){arr.splice(i,1);changed=true;}m.delete(id);return;}
      const j=ch.doc.get('d');if(typeof j!=='string'||m.get(id)===j)return;
      let o;try{o=JSON.parse(j);}catch(e){return;}
      m.set(id,j);if(i>=0)arr[i]=o;else arr.push(o);changed=true;
    });
    ok();if(changed)refresh();
  },err=>hooks.toast('Live updates stopped: '+err.message,true)));
}
function listenTeam(){
  return new Promise(ok=>fs.onSnapshot(fs.collection(db,'users'),snap=>{
    snap.docChanges().forEach(ch=>{
      if(ch.doc.metadata.hasPendingWrites)return;
      const id=ch.doc.id,i=USERS.findIndex(x=>x.id===id);
      if(ch.type==='removed'){if(i>=0)USERS.splice(i,1);lastTeam.delete(id);return;}
      const u={...ch.doc.data(),id};lastTeam.set(id,teamKey(u));if(i>=0)USERS[i]=u;else USERS.push(u);
    });
    const mine=USERS.find(u=>u.id===me.id);
    if(!mine||mine.status!=='active'){location.reload();return;}
    ok();refresh();
  },err=>hooks.toast('Live updates stopped: '+err.message,true)));
}

/* Redraw after someone else's change, but never under the cursor: wait until the field being typed in loses focus. */
let rT=0,waitBlur=false;
function refresh(){
  clearTimeout(rT);rT=setTimeout(()=>{
    const a=document.activeElement;
    if(a&&a!==document.body&&a.matches('input,textarea,select,[contenteditable]')){
      if(!waitBlur){waitBlur=true;a.addEventListener('blur',()=>{waitBlur=false;refresh();},{once:true});}return;}
    if(S.drawer&&!trip(S.drawer))S.drawer=null;
    if(S.modal&&S.modal.tid&&!trip(S.modal.tid))S.modal=null;
    hooks.render();
  },120);
}

export function flushSoon(){clearTimeout(timer);timer=setTimeout(flush,400);}
/* Writes what changed since the last write or the last server update. Rejected writes are rolled back by
   Firestore, and the listeners above put the server's version back on screen. */
export async function flush(){
  if(!me)return;
  if(writing){again=true;return;}
  clearTimeout(timer);
  try{localStorage.setItem(localKey(),JSON.stringify({tab:S.tab,builder:S.builder&&{...S.builder,stops:S.builder.stops.filter(s=>!s.extracting)}},clean));}catch(e){}
  const ops=[];
  for(const[col,arr]of Object.entries(COLS)){
    const m=last[col],seen=new Set();
    arr.forEach(o=>{if(!o||o.id==null)return;const id=String(o.id);seen.add(id);const j=json(o);
      if(m.get(id)!==j){m.set(id,j);ops.push(b=>b.set(fs.doc(db,col,id),{d:j,u:Date.now(),by:me.id}));}});
    [...m.keys()].forEach(id=>{if(!seen.has(id)){m.delete(id);ops.push(b=>b.delete(fs.doc(db,col,id)));}});
  }
  USERS.forEach(u=>{const k=teamKey(u);if(lastTeam.has(u.id)&&lastTeam.get(u.id)!==k){lastTeam.set(u.id,k);
    ops.push(b=>b.update(fs.doc(db,'users',u.id),{roles:u.roles,status:u.status}));}});
  if(!ops.length)return;
  writing=true;
  try{for(let k=0;k<ops.length;k+=400){const b=fs.writeBatch(db);ops.slice(k,k+400).forEach(f=>f(b));await b.commit();}}
  catch(e){hooks.toast(e.code==='permission-denied'?'Not saved: you have no rights for this change':'Not saved: '+e.message,true);}
  finally{writing=false;if(again){again=false;flush();}}
}
