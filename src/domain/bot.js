/* What the bot shows in a driver group: the buttons under the current trip message and the text of each post.
   Shared by the app (bot button simulator in the trip card) and the server (real Telegram, server/functions). */
import {STOP_ORDER,curIdx,glab,issuedLine,tripMessage} from './stops.js';

/* Buttons for the trip right now: [action, label, disabled]. Disabled ones are greyed out in the simulator
   and left out in Telegram (Telegram has no disabled buttons). */
export function keyboard(t){
  if(t.closed||t.empty||t.status!=='active')return[];
  const k=[];if(t.ack&&t.ack.pending)k.push(['ack','Acknowledge changes']);
  if(t.confirm==='pending')return k.concat([['confirm','Confirm trip'],['refuse','Refuse']]);
  if(t.confirm==='refused')return k;
  const ci=curIdx(t);if(ci<0)return k;
  const s=t.stops[ci];const lv=STOP_ORDER.indexOf(s.status);const gl=glab(t,ci);
  return k.concat([['checkin',`Stop ${gl}: Checked In`,lv>1],['indoor',`Stop ${gl}: In Door`,lv!==2],['unload',`Stop ${gl}: Unloaded`,lv!==3]]);
}
/* Buttons only the driver may press; Dispatcher, Admin and Supervisor can press the rest. */
export const DRIVER_ONLY=['confirm','refuse'];

/* Text of one bot post (an entry of trip.chat). */
export function postText(t,m){
  if(m.kind==='trip')return tripMessage(t,m.changed)+issuedLine(m.by);
  if(m.kind==='trailer')return(m.text||'')+issuedLine(m.by);
  return m.text||'';
}
