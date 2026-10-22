/* Small helpers: seeded random for sample data, escaping, number and date formatting. */

let _seed=20261022;
export function rnd(){_seed|=0;_seed=_seed+0x6D2B79F5|0;let t=Math.imul(_seed^_seed>>>15,1|_seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}
export const rint=(a,b)=>a+Math.floor(rnd()*(b-a+1));
export const pick=a=>a[Math.floor(rnd()*a.length)];
/* Ids stay unique across reloads (saved data keeps old ids): a per-load prefix plus a counter. */
const _base=Date.now().toString(36);let _uid=1;export const uid=()=>'x'+_base+(_uid++);
export const MIN=60000, NOW=Date.now();
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmtT=ts=>ts?new Date(ts).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false}):'';
export const fmtD=ts=>{if(!ts)return'—';const d=new Date(ts),p=n=>String(n).padStart(2,'0');return`${p(d.getMonth()+1)}/${p(d.getDate())} ${fmtT(ts)}`;};
export const ago=ts=>{const m=Math.round((Date.now()-ts)/MIN);if(m<1)return'now';if(m<60)return m+'m ago';const h=Math.floor(m/60);return h+'h '+(m%60)+'m ago';};
export const money=n=>'$'+Number(n||0).toLocaleString('en-US');
export const lb=n=>Number(n||0).toLocaleString('en-US')+' lb';
export const toInput=ts=>{const d=new Date(ts),p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;};
export const initials=n=>n.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();

export const hm=m=>{m=Math.max(0,Math.round(m));const h=Math.floor(m/60);return h?`${h}h ${String(m%60).padStart(2,'0')}m`:`${m}m`;};
