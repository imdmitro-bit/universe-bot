/* Shared HTML snippets: truck plate + driver, filter tiles, stop progress, route, appointments. */
import {S} from '../state.js';
import {act} from '../domain/actions.js';
import {STOP_LABEL,STOP_ORDER,cityST,curIdx,groupsOf,labels,spotTxt,unitTxt} from '../domain/stops.js';
import {esc,fmtD} from '../lib/utils.js';

export const who2=d=>`<span class="who2"><span class="trk">${esc(d.truck)}</span><span class="dn">${esc(d.name)}</span></span>`;

export function tile(act,k,label,items,on,cls){
  const more=items.length-14;
  return`<div class="sumw"><button class="sum ${on?'on':''} ${cls||''}" data-a="${act}" data-k="${k}"><b>${items.length}</b><span>${label}</span></button>
    ${items.length?`<div class="pop"><div class="pop-in">${items.slice(0,14).map(it=>`<button data-a="${it.a||'open'}" data-id="${it.id}"><b>${it.d?who2(it.d):esc(it.name)}</b><span>${esc(it.sub)}</span></button>`).join('')}${more>0?`<span class="note" style="padding:4px 8px">+${more} more, click the tile to filter</span>`:''}</div></div>`:''}</div>`;
}
export function progress(t){
  const ci=curIdx(t);
  return`<div class="prog">${t.stops.map((s,i)=>{const lv=STOP_ORDER.indexOf(s.status);return`<div class="st ${i===ci&&t.leftYard?'cur':''}" title="Stop ${labels(t.stops)[i]} · ${esc(s.consignee)} · ${STOP_LABEL[s.status]}">${[1,2,3,4].map(k=>`<i class="${lv>=k?'on':''}"></i>`).join('')}</div>`;}).join('')}</div>`;
}
export const srcLabel=s=>({driver:'Driver',dispatcher:'Dispatcher',samsara:'Samsara',warehouse:'Warehouse',consolidator:'Consolidator',system:'System'}[s]||s);

export function routeHtml(t,zip=true){
  return groupsOf(t.stops).map(g=>{const s=t.stops[g[0]];return`<span>${esc(zip?s.city:cityST(s.city))}${g.length>1?` <b class="muted">×${g.length}</b>`:''}</span>`;}).join('<i>→</i>');
}
export const prioTag=t=>t.priority?'<span class="prio">PRIORITY</span>':'';
export function palletCell(s){return s.noFit?'<span class="late">doesn\'t fit</span>':s.wQty!=null?`${unitTxt(s.wQty,s.wUnit)}${s.spots?' / '+spotTxt(s.spots):''}`:'<span class="muted">— Warehouse</span>';}
export function apptHtml(s){
  return`<span class="mono">${fmtD(s.appt)}</span>${s.resched?` <span class="tag" title="Our appointment. Broker's was ${fmtD(s.brokerAppt)}">Ours</span> <s class="muted mono" title="Broker appointment">${fmtD(s.brokerAppt)}</s>`:''}`;
}
/* Sortable table headers: click once for ▲, twice for ▼, a third time for the default order. Remembered per table. */
export function th(table,key,label){const s=S.sort[table];const on=s&&s.k===key;
  return`<button class="thb ${on?'on':''}" data-a="sort" data-t="${table}" data-k="${key}" aria-label="Sort by ${label}">${label}<span class="arr">${on?(s.dir>0?'▲':'▼'):''}</span></button>`;}
export const sth=(table,key,label)=>`<th>${th(table,key,label)}</th>`;
export const driverTh=table=>`<th>${th(table,'truck','Truck')} · ${th(table,'name','Name')}</th>`;
export function applySort(table,rows,get){
  const s=S.sort[table];const g=s&&get[s.k];if(!g)return rows;
  const val=r=>{const v=g(r);return v==null||v===''?null:v;};
  return rows.slice().sort((a,b)=>{const x=val(a),y=val(b);if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;
    const c=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'en',{numeric:true,sensitivity:'base'});return c*s.dir;});
}
