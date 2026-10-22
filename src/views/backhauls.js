/* Backhauls: empty drivers and backhaul dispatchers. */
import {phase,phaseLabel} from '../domain/status.js';
import {ago,esc} from '../lib/utils.js';
import {TRIPS,can,dispatchers,drv} from '../state.js';
import {who2} from '../ui/components.js';

export function viewBackhauls(){
  const list=TRIPS.filter(t=>t.status==='active'&&!t.closed&&['delivered','empty'].includes(phase(t))).sort((a,b)=>(a.empty||9e15)-(b.empty||9e15));
  const dsp=can('dispatch');
  return`<div class="row"><h1 class="h1">Backhauls</h1><span class="muted">Drivers that are empty or about to be</span></div>
  <div class="tblwrap" style="margin-top:14px"><table class="tbl" style="min-width:860px"><thead><tr><th>Driver · Truck</th><th>Trip</th><th>Status</th><th>Empty at</th><th>Empty since</th><th>Backhaul dispatcher</th><th></th></tr></thead><tbody>
  ${list.length?list.map(t=>{const d=drv(t.driverId);const[l,c]=phaseLabel(t);return`<tr>
    <td>${who2(d)}</td><td class="mono"><a href="#" data-a="open" data-id="${t.id}" style="color:var(--tg-link)">${t.id}</a></td>
    <td><span class="pill ${c}">${l}</span></td><td>${esc(t.emptyAt||t.stops[t.stops.length-1].city)}</td>
    <td class="muted">${t.empty?ago(t.empty):'waiting Empty Ready'}</td>
    <td>${t.empty?`<select data-bh="${t.id}" ${dsp?'':'disabled'}><option value="">Not assigned</option>${dispatchers().map(n=>`<option ${t.backhaul.dispatcher===n?'selected':''}>${n}</option>`).join('')}</select>`:'<span class="muted">—</span>'}</td>
    <td>${dsp?(t.empty?`<button class="btn sm" data-a="booked" data-id="${t.id}" ${t.backhaul.dispatcher?'':'disabled'}>Backhaul booked</button>`:`<button class="btn sm" data-a="tactId" data-x="empty" data-id="${t.id}">Mark Empty</button>`):''}</td></tr>`;}).join(''):`<tr><td colspan="7" class="empty">No empty drivers right now.</td></tr>`}
  </tbody></table></div>
  <p class="foot">Backhaul booked closes the trip and the driver becomes available for the next trip.</p>`;
}
