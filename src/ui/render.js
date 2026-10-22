/* Top bar, view switching, toast. Every view is a function that returns HTML. */
import {aiReady} from '../ai/config.js';
import {ROLES,TABS} from '../config/roles.js';
import {act} from '../domain/actions.js';
import {needsTrailer,phase} from '../domain/status.js';
import {esc} from '../lib/utils.js';
import {S,TRIPS,activeUsers,can,myTabs} from '../state.js';
import {viewAgents} from '../views/agents.js';
import {viewBackhauls} from '../views/backhauls.js';
import {viewBoard} from '../views/board.js';
import {viewBuilder} from '../views/builder.js';
import {renderDrawer} from '../views/drawer.js';
import {viewDrivers} from '../views/drivers.js';
import {renderModal} from '../views/modal.js';
import {viewPrep} from '../views/prep.js';
import {viewTeam} from '../views/team.js';
import {viewTrips} from '../views/trips.js';
import {viewWarehouse} from '../views/warehouse.js';

export function render(){renderTop();renderView();renderDrawer();renderModal();}
export function renderTop(){
  const tabs=myTabs();
  if(!tabs.includes(S.tab))S.tab=tabs[0];
  const cnt={warehouse:TRIPS.filter(needsTrailer).length,backhauls:TRIPS.filter(t=>t.status==='active'&&!t.closed&&['delivered','empty'].includes(phase(t))).length};
  document.getElementById('top').innerHTML=`
    <div class="brand"><div class="logo">UB</div><div><b>Universe Bot</b><small>${window.TG_NAME?esc(window.TG_NAME):'Mini App · prototype'}</small></div></div>
    <nav class="tabs" aria-label="Sections">${tabs.map(k=>`<button class="tab ${S.tab===k?'on':''}" data-a="tab" data-k="${k}">${TABS[k]}${cnt[k]?`<span class="cnt">${cnt[k]}</span>`:''}</button>`).join('')}</nav>
    ${can('build')?`<button class="btn sm ghost" data-a="aiOpen" title="Claude reads Rate Confirmations">AI <span class="${aiReady()?'okline':'muted'}">${aiReady()?'on':'off'}</span></button>`:''}
    <div class="who"><label for="roleSel">Viewing as</label>
      <select id="roleSel">${activeUsers().map(u=>`<option value="${u.id}" ${S.uid===u.id?'selected':''}>${esc(u.name)} · ${u.roles.map(r=>ROLES[r].label).join(' + ')}</option>`).join('')}</select></div>`;
}
export function renderView(){
  const v=document.getElementById('view');
  if(S.tab==='board')v.innerHTML=viewBoard();
  else if(S.tab==='departures')v.innerHTML=viewPrep();
  else if(S.tab==='trips')v.innerHTML=S.builder?viewBuilder():viewTrips();
  else if(S.tab==='warehouse')v.innerHTML=viewWarehouse();
  else if(S.tab==='backhauls')v.innerHTML=viewBackhauls();
  else if(S.tab==='agents')v.innerHTML=viewAgents();
  else if(S.tab==='team')v.innerHTML=viewTeam();
  else if(S.tab==='drivers')v.innerHTML=viewDrivers();
}

let toastT;
export function toast(msg,bad){const el=document.getElementById('toast');el.textContent=msg;el.className='toast'+(bad?' bad':'');el.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>el.hidden=true,2800);}
export function run(t,a,o){const r=act(t,a,o);if(!r.ok)toast(r.msg,true);render();return r;}
