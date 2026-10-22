/* Screens before the app: signing in, waiting for approval, blocked, login error. */
import {esc} from '../lib/utils.js';

export function renderGate(kind,info){
  document.getElementById('top').innerHTML=`<div class="brand"><div class="logo">UB</div><div><b>Universe Bot</b><small>TMS for LTL</small></div></div>`;
  const name=info&&info.name?esc(info.name.split(' ')[0]):'';
  const body={
    loading:`<span class="h2">Signing in…</span><p class="muted">Checking your Telegram account.</p>`,
    pending:`<span class="h2">Waiting for approval</span><p>Hi${name?' '+name:''}! You're on the list. An Owner, Admin or Supervisor gives you your roles in Team, and this screen opens the app by itself.</p>`,
    blocked:`<span class="h2">No access</span><p>Your access was turned off. Ask an Owner or Admin if this is a mistake.</p>`,
    error:`<span class="h2">Could not sign in</span><p>${esc(info&&info.message||info||'Unknown error')}</p><div class="row" style="margin-top:12px"><button class="btn pri" onclick="location.reload()">Try again</button></div>`,
  }[kind];
  document.getElementById('view').innerHTML=`<div class="card sec" style="max-width:460px;margin:40px auto">${body}</div>`;
}
