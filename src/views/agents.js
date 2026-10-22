/* Agents: loads the driver dropped at an agent (we keep tracking them until the agent delivers) and the agents directory. */
import {agentOf,cityST} from '../domain/stops.js';
import {esc,fmtD} from '../lib/utils.js';
import {AGENTS,S,TRIPS,can,tripNo} from '../state.js';

/* Every load riding inside an agent stop, with where it is now. */
export function agentLoads(){
  const out=[];
  TRIPS.forEach(t=>t.stops.forEach(s=>{const a=agentOf(t.stops,s);if(!a)return;
    const state=s.agentDelivered?'delivered':s.status==='unloaded'?'at_agent':'on_truck';out.push({t,s,a,state});}));
  const rank={at_agent:0,on_truck:1,delivered:2};
  return out.sort((x,y)=>rank[x.state]-rank[y.state]||(x.s.brokerAppt||0)-(y.s.brokerAppt||0));
}
const STATE={on_truck:['On the truck','c-teal'],at_agent:['At agent','c-warn'],delivered:['Delivered by agent','c-ok']};
export function viewAgents(){
  const rows=agentLoads();const dsp=can('dispatch');const edit=can('build')||can('truck');const now=Date.now();
  return`<div class="row"><h1 class="h1">Agents</h1><span class="muted">Loads dropped at agents and who delivers them</span></div>
  <div class="tblwrap" style="margin-top:14px"><table class="tbl" style="min-width:900px"><thead><tr><th>Load #</th><th>Agent</th><th>Dropped</th><th>Deliver to</th><th>Broker appt</th><th>Status</th><th></th></tr></thead><tbody>
  ${rows.length?rows.map(({t,s,a,state})=>{const late=state!=='delivered'&&s.brokerAppt&&s.brokerAppt<now;const[l,c]=STATE[state];return`<tr data-a="open" data-id="${t.id}" class="${late?'attn':''}">
    <td class="mono">${esc(s.load)}</td>
    <td><b class="mono">${esc(a.agentCode||'—')}</b><span class="sub">${esc(cityST(a.city))}</span></td>
    <td>${state==='on_truck'?'<span class="muted">not yet</span>':`<span class="mono">${fmtD(s.t.unloaded)}</span>`}<span class="sub">trip ${esc(tripNo(t))}</span></td>
    <td>${esc(s.consignee)}<span class="sub">${esc(s.city)}</span></td>
    <td class="mono ${late?'late':''}">${fmtD(s.brokerAppt)}</td>
    <td><span class="pill ${c}">${l}</span>${state==='delivered'?`<span class="sub">${fmtD(s.agentDelivered.ts)} · ${esc(s.agentDelivered.who)}</span>`:''}</td>
    <td>${dsp&&state==='at_agent'?`<button class="btn sm" data-a="agentDelivered" data-id="${t.id}" data-s="${s.id}">Delivered</button>`:''}</td></tr>`;}).join('')
    :'<tr><td colspan="7" class="empty">No loads at agents. Drop a load onto an agent stop in the trip builder.</td></tr>'}
  </tbody></table></div>
  <h2 class="h2" style="margin:22px 0 10px">Directory <span class="muted" style="font-weight:400">${AGENTS.length}</span></h2>
  <div class="tblwrap"><table class="tbl" style="min-width:700px"><thead><tr><th>Code</th><th>Name</th><th>Address</th><th>City, ST ZIP</th></tr></thead><tbody>
    ${AGENTS.map(a=>`<tr data-a="none"><td class="mono"><b>${esc(a.code)}</b></td><td>${esc(a.name)}</td><td>${esc(a.addr)}</td><td>${esc(a.city)}</td></tr>`).join('')}
  </tbody></table></div>
  ${edit?`<div class="card sec" style="margin-top:12px"><span class="h2">Add agent</span>
    <div class="fgrid"><label>Code<input type="text" id="agCode" placeholder="WDS"></label><label class="w2">Name<input type="text" id="agName" placeholder="WDS Warehouse / Stefi Enterprises"></label><label>Address<input type="text" id="agAddr" placeholder="2904 Transport Street"></label>
      <label>City, ST ZIP<input type="text" id="agCity" placeholder="Richmond, VA 23234"></label></div>
    <div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn pri" data-a="agentAdd">Save agent</button></div></div>`:''}
  <p class="foot">The driver's stop is the agent's address; the load keeps its final consignee and broker appointment. No detention for loads left at an agent.</p>`;
}
