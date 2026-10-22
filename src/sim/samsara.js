/* Simulated Samsara location events (prototype only). */
import {act} from '../domain/actions.js';
import {curIdx,glab} from '../domain/stops.js';
import {DRIVERS,TRIPS} from '../state.js';
import {render,run,toast} from '../ui/render.js';

export function gps(t){
  if(t.closed||t.empty)return toast('No location events for a finished trip',true);
  if(!t.enRouteYard&&!t.atYard&&!t.leftYard){run(t,'enRouteYard',{who:'Samsara',src:'samsara'});return toast('Samsara: truck is heading to the yard');}
  if(!t.atYard&&!t.leftYard){run(t,'atYard',{who:'Samsara',src:'samsara'});return toast('Samsara: truck entered the yard');}
  if(!t.leftYard){const r=run(t,'leftYard',{who:'Samsara',src:'samsara'});if(r.ok)toast('Samsara: truck left the yard');return;}
  const ci=curIdx(t);
  if(ci<0)return toast('All stops delivered');
  if(t.stops[ci].status==='pending'){run(t,'arrive',{who:'Samsara',src:'samsara'});toast(`Samsara: arrived at stop ${glab(t,ci)}`);return;}
  toast('Truck is at the stop. Waiting for driver statuses.');
}
export function tick(){
  const cands=TRIPS.filter(t=>t.status==='active'&&!t.closed&&!t.empty).map(t=>{
    const ci=curIdx(t);
    if(t.confirm==='confirmed'&&!t.enRouteYard&&!t.atYard&&!t.leftYard)return[t,'enRouteYard'];
    if(t.enRouteYard&&!t.atYard&&!t.leftYard)return[t,'atYard'];
    if(t.confirm==='confirmed'&&t.trailer&&t.atYard&&!t.leftYard)return[t,'leftYard'];
    if(t.leftYard&&ci>=0&&t.stops[ci].status==='pending')return[t,'arrive'];
    return null;}).filter(Boolean);
  for(let i=cands.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cands[i],cands[j]]=[cands[j],cands[i]];}
  const n=Math.min(3,cands.length);
  cands.slice(0,n).forEach(([t,a])=>act(t,a,{who:'Samsara',src:'samsara'}));
  DRIVERS.forEach(d=>{if(d.speed)d.ping=Date.now()-Math.floor(Math.random()*90000);});
  toast(n?`Samsara: ${n} automatic status change${n>1?'s':''}`:'Samsara: no status changes');
  render();
}
