/* Team: who may log in and with which roles. People join with an invite link and log in through Telegram;
   Owner, Admin and Supervisor approve them. A person can have several roles. */
import {ROLES} from '../config/roles.js';
import {ago,esc} from '../lib/utils.js';
import {S,USERS,can,hasRole} from '../state.js';

const STATUS={active:['Active','c-ok'],pending:['Waiting for approval','c-warn'],blocked:['Blocked','c-crit']};
/* Supervisor manages the team but cannot hand out Owner or Admin. */
export const canGrant=r=>hasRole('owner')||(hasRole('admin')&&r!=='owner')||(hasRole('supervisor')&&!['owner','admin'].includes(r));
export function viewTeam(){
  const order={pending:0,active:1,blocked:2};const list=USERS.slice().sort((a,b)=>order[a.status]-order[b.status]||a.name.localeCompare(b.name));
  const inv=S.invite;
  return`<div class="row"><h1 class="h1">Team</h1><span class="muted">People who log in to the Mini App. Roles decide what they see; Admin and Supervisor tags in driver groups follow them.</span>
    <span class="sp"></span>${can('team')?'<button class="btn pri" data-a="inviteOpen">Invite</button>':''}</div>
  ${inv?`<div class="card sec" style="margin-top:14px"><div class="row"><span class="h2">Invite link</span><span class="sp"></span><button class="btn sm ghost" data-a="inviteClose">Close</button></div>
    <p style="margin:8px 0">Send this link in Telegram. The person opens it, starts the bot and lands in the Mini App with "Waiting for approval".</p>
    <pre class="whmsg">${esc(inv.link)}</pre>
    <div class="row" style="margin-top:10px"><span class="note">Prototype: pretend someone opened the link</span><input type="text" id="joinName" placeholder="Name, e.g. Olga" style="width:180px"><input type="text" id="joinUser" placeholder="@username" style="width:150px"><button class="btn sm" data-a="inviteJoin">Join</button></div></div>`:''}
  <div class="tblwrap" style="margin-top:14px"><table class="tbl" style="min-width:900px"><thead><tr><th>Name</th><th>Telegram</th><th>Roles</th><th>Status</th><th>Last seen</th><th></th></tr></thead><tbody>
  ${list.map(u=>{const[l,c]=STATUS[u.status];const self=u.id===S.uid;return`<tr data-a="none" class="${u.status==='pending'?'attn':''}">
    <td><b>${esc(u.name)}</b>${self?' <span class="tag">you</span>':''}</td><td class="mono muted">@${esc(u.username)}</td>
    <td><div class="row" style="gap:4px">${Object.entries(ROLES).map(([k,r])=>{const on=u.roles.includes(k);const may=can('team')&&canGrant(k)&&!(self&&k==='owner');
      return`<button class="tag tgl ${on?'on':''}" data-a="roleT" data-id="${u.id}" data-k="${k}" ${may?'':'disabled'} aria-pressed="${on}">${r.label}</button>`;}).join('')}</div></td>
    <td><span class="pill ${c}">${l}</span></td><td class="muted">${u.lastSeen?ago(u.lastSeen):'—'}</td>
    <td>${can('team')&&!self?(u.status==='pending'?`<button class="btn sm pri" data-a="userApprove" data-id="${u.id}">Approve</button>`
      :u.status==='active'?`<button class="btn sm ghost danger" data-a="userBlock" data-id="${u.id}">Block</button>`:`<button class="btn sm ghost" data-a="userUnblock" data-id="${u.id}">Unblock</button>`):''}</td></tr>`;}).join('')}
  </tbody></table></div>
  <p class="foot">Drivers are not here: a driver is the truck's Telegram group (Driver Groups). Blocked people lose access and leave the driver groups' tag list.</p>`;
}
