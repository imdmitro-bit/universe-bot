/* Driver groups: truck numbers and Telegram tags. */
import {phaseLabel} from '../domain/status.js';
import {esc} from '../lib/utils.js';
import {DRIVERS,S,activeTrip,can,groupTitle} from '../state.js';
import {who2} from '../ui/components.js';

export function viewDrivers(){
  const tk=can('truck'),tg=can('tags');
  const add=tk||tg||can('build');
  return`<div class="row"><h1 class="h1">Driver Groups</h1><span class="muted">The Telegram group is the driver in the system. Tags decide who can press which buttons.</span></div>
  ${add?`<div class="card sec" style="margin-top:14px"><div class="row"><span class="h2">Add driver group</span><span class="note">In production the group is linked with /bind in Telegram.</span></div>
    <div class="row" style="margin-top:10px"><input type="text" id="dgName" placeholder="Driver full name, e.g. James Smith" style="flex:1;min-width:200px"><input type="text" id="dgTruck" placeholder="Truck #" inputmode="numeric" style="width:110px"><button class="btn pri" data-a="driverAdd">Add driver group</button></div></div>`:''}
  ${DRIVERS.length?'':`<div class="card empty" style="margin-top:14px">No driver groups yet. Add the first driver above, or open the prototype with <a href="?demo" style="color:var(--tg-link)">sample data</a>.</div>`}
  <div class="tblwrap" style="margin-top:14px"><table class="tbl" style="min-width:820px"><thead><tr><th>Group</th><th>Truck #</th><th>Tagged members</th><th>Status</th><th></th></tr></thead><tbody>
  ${DRIVERS.map(d=>{const t=activeTrip(d);const[l,c]=phaseLabel(t);const tagged=d.members.filter(m=>m.tags.length);
    return`<tr data-a="none"><td>${who2(d)}<span class="sub" style="margin-top:3px">Group: ${esc(groupTitle(d))}</span><span class="sub">${d.members.length} members</span></td>
    <td>${tk?`<input type="text" data-truck="${d.id}" value="${esc(d.truck)}" style="width:70px">`:d.truck}</td>
    <td><div class="row" style="gap:5px">${tagged.map(m=>m.tags.map(x=>`<span class="tag ${x}" title="${esc(m.name)}">${esc(m.name)} · ${x}</span>`).join('')).join('')}</div></td>
    <td><span class="pill ${c}">${l}</span></td>
    <td>${tg?`<button class="btn sm ghost" data-a="exp" data-id="${d.id}">${S.expand[d.id]?'Done':'Manage tags'}</button>`:''}</td></tr>
    ${S.expand[d.id]?`<tr data-a="none"><td colspan="5" style="background:var(--bg-2)">${d.members.map(m=>`<div class="memrow"><span>${esc(m.name)}</span><span class="row" style="gap:5px">${['Driver','Dispatcher','Admin','Supervisor'].map(x=>`<button class="tag ${x} tgl ${m.tags.includes(x)?'on':''}" data-a="tagT" data-id="${d.id}" data-m="${esc(m.name)}" data-k="${x}">${x}</button>`).join('')}</span></div>`).join('')}</td></tr>`:''}`;}).join('')}
  </tbody></table></div>
  <p class="foot">Truck # can be changed by Owner, Admin and Supervisor. The group name updates with it.</p>
  ${can('team')?`<p class="foot">Prototype data is kept in this browser. <button class="btn sm" data-a="seedMore">Add 10 drivers with trips</button> <button class="btn sm ghost danger" data-a="resetData">${S.resetArm>Date.now()?'Confirm: start over':'Start over with 3 sample drivers'}</button></p>`:''}`;
}
