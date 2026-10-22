/* Driver groups: truck numbers and Telegram tags. */
import {CLOUD} from '../cloud/mode.js';
import {phaseLabel} from '../domain/status.js';
import {esc} from '../lib/utils.js';
import {DRIVERS,S,TG_GROUPS,activeTrip,can,groupTitle,tgGroupOf} from '../state.js';
import {who2} from '../ui/components.js';

export function viewDrivers(){
  const tk=can('truck'),tg=can('tags');
  const add=tk||tg||can('build');
  return`<div class="row"><h1 class="h1">Driver Groups</h1><span class="muted">The Telegram group is the driver in the system. Tags decide who can press which buttons.</span></div>
  ${add?`<div class="card sec" style="margin-top:14px"><div class="row"><span class="h2">Add driver group</span><span class="note">${CLOUD.on?'Then link the driver\'s Telegram group below.':'In production the group is linked with /bind in Telegram.'}</span></div>
    <div class="row" style="margin-top:10px"><input type="text" id="dgName" placeholder="Driver full name, e.g. James Smith" style="flex:1;min-width:200px"><input type="text" id="dgTruck" placeholder="Truck #" inputmode="numeric" style="width:110px"><button class="btn pri" data-a="driverAdd">Add driver group</button></div></div>`:''}
  ${CLOUD.on?tgGroupsCard():''}
  ${DRIVERS.length?'':`<div class="card empty" style="margin-top:14px">No driver groups yet. Add the first driver above, or open the prototype with <a href="?demo" style="color:var(--tg-link)">sample data</a>.</div>`}
  <div class="tblwrap" style="margin-top:14px"><table class="tbl" style="min-width:820px"><thead><tr><th>Group</th><th>Truck #</th><th>Tagged members</th><th>Status</th><th></th></tr></thead><tbody>
  ${DRIVERS.map(d=>{const t=activeTrip(d);const[l,c]=phaseLabel(t);const tagged=d.members.filter(m=>m.tags.length);
    return`<tr data-a="none"><td>${who2(d)}<span class="sub" style="margin-top:3px">Group: ${esc(groupTitle(d))}</span>${CLOUD.on?`<span class="sub">${tgGroupOf(d.id)?'Telegram: linked':'<span class="late">Telegram group not linked</span>'}</span>`:''}<span class="sub">${d.members.length} members</span></td>
    <td>${tk?`<input type="text" data-truck="${d.id}" value="${esc(d.truck)}" style="width:70px">`:d.truck}</td>
    <td><div class="row" style="gap:5px">${tagged.map(m=>m.tags.map(x=>`<span class="tag ${x}" title="${esc(m.name)}">${esc(m.name)} · ${x}</span>`).join('')).join('')}</div></td>
    <td><span class="pill ${c}">${l}</span></td>
    <td>${tg?`<button class="btn sm ghost" data-a="exp" data-id="${d.id}">${S.expand[d.id]?'Done':'Manage tags'}</button>`:''}</td></tr>
    ${S.expand[d.id]?`<tr data-a="none"><td colspan="5" style="background:var(--bg-2)">${d.members.map(m=>`<div class="memrow"><span>${esc(m.name)}</span><span class="row" style="gap:5px">${['Driver','Dispatcher','Admin','Supervisor'].map(x=>`<button class="tag ${x} tgl ${m.tags.includes(x)?'on':''}" data-a="tagT" data-id="${d.id}" data-m="${esc(m.name)}" data-k="${x}">${x}</button>`).join('')}</span></div>`).join('')}</td></tr>`:''}`;}).join('')}
  </tbody></table></div>
  <p class="foot">Truck # can be changed by Owner, Admin and Supervisor. The group name updates with it.</p>
  ${can('team')?`<p class="foot">${CLOUD.on?'Shared data: everyone in the team sees the same drivers and trips.':'Prototype data is kept in this browser.'} <button class="btn sm" data-a="seedMore">Add 10 drivers with trips</button> <button class="btn sm ghost danger" data-a="resetData">${S.resetArm>Date.now()?'Confirm: start over':'Start over with 3 sample drivers'}</button></p>`:''}`;
}

/* Real Telegram groups the bot was added to. Owner, Admin and Supervisor pick which driver each group belongs to. */
const BOT_STATE={administrator:['Admin','c-ok'],creator:['Admin','c-ok'],member:['Not admin','c-warn'],restricted:['Restricted','c-warn'],left:['Bot removed','c-crit'],kicked:['Bot removed','c-crit']};
function tgGroupsCard(){
  const edit=can('truck');const bot=CLOUD.bot?'@'+CLOUD.bot:'the bot';
  const list=TG_GROUPS.slice().sort((a,b)=>(['left','kicked'].includes(a.botStatus)-['left','kicked'].includes(b.botStatus))||String(a.title).localeCompare(b.title));
  const drivers=DRIVERS.slice().sort((a,b)=>String(a.truck).localeCompare(String(b.truck),undefined,{numeric:true}));
  return`<div class="card sec" style="margin-top:14px"><div class="row"><span class="h2">Telegram groups</span>
    <span class="note">Add ${esc(bot)} to the driver's group and make it an admin with "Delete messages" and "Change group info". The group shows up here; pick its driver. The bot renames the group to "Name · Truck N".</span></div>
  ${list.length?`<div class="tblwrap" style="margin-top:10px"><table class="tbl" style="min-width:620px"><thead><tr><th>Telegram group</th><th>Bot</th><th>Driver</th></tr></thead><tbody>
  ${list.map(g=>{const[l,c]=BOT_STATE[g.botStatus]||BOT_STATE.member;const gone=['left','kicked'].includes(g.botStatus);
    return`<tr data-a="none"><td><b>${esc(g.title||'(no name)')}</b><span class="sub mono">${esc(g.chatId)}</span></td><td><span class="pill ${c}">${l}</span>${g.botStatus==='member'?'<span class="sub">Make the bot an admin</span>':''}</td>
    <td>${edit&&!gone?`<select data-tglink="${esc(g.chatId)}"><option value="">— Not linked —</option>${drivers.map(d=>`<option value="${d.id}" ${g.driverId===d.id?'selected':''}>${esc(d.truck)} · ${esc(d.name)}</option>`).join('')}</select>`
      :esc((DRIVERS.find(d=>d.id===g.driverId)||{}).name||'—')}</td></tr>`;}).join('')}
  </tbody></table></div>`:'<p class="note" style="margin-top:8px">No groups yet. Add the bot to a Telegram group, then it appears here.</p>'}
  </div>`;
}
