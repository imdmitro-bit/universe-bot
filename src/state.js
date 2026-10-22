/* In-memory app state and lookups. Inside Telegram these arrays are kept in sync with Firebase (cloud/cloud.js). */
import {PERM,ROLES} from './config/roles.js';

/* Team: the people who log in through the Mini App (Telegram identity). One person can have several roles;
   rights and tabs add up. Drivers are not users: a driver is a truck's Telegram group. */
export const USERS=[];
export const me=()=>USERS.find(u=>u.id===S.uid)||null;
export const myRoles=()=>me()?.roles||[];
export const can=p=>myRoles().some(r=>PERM[p].includes(r));
export const hasRole=r=>myRoles().includes(r);
export const user=()=>me()?.name||'—';
export const firstName=n=>String(n||'').trim().split(/\s+/)[0]||'';
export function myTabs(){const out=[];myRoles().forEach(r=>(ROLES[r]?.tabs||[]).forEach(t=>{if(!out.includes(t))out.push(t);}));return out;}
export const activeUsers=()=>USERS.filter(u=>u.status==='active');
export const dispatchers=()=>activeUsers().filter(u=>u.roles.some(r=>r==='dispatcher'||r==='afterhours')).map(u=>u.name);
export const isAfterHours=name=>activeUsers().some(u=>u.name===name&&u.roles.includes('afterhours')&&!u.roles.includes('dispatcher'));
/* Tags in a driver group follow the Team: Owner/Admin -> Admin, Supervisor -> Supervisor. Driver and per-trip Dispatcher tags are kept. */
const teamTags=u=>[...new Set(u.roles.map(r=>r==='owner'||r==='admin'?'Admin':r==='supervisor'?'Supervisor':null).filter(Boolean))];
export function syncGroupMembers(d){
  const staff=new Set(USERS.map(u=>u.name));
  d.members=d.members.filter(m=>m.tags.includes('Driver')||!staff.has(m.name)||activeUsers().some(u=>u.name===m.name));
  activeUsers().forEach(u=>{let m=d.members.find(x=>x.name===u.name);if(!m){m={name:u.name,tags:[]};d.members.push(m);}
    m.tags=[...teamTags(u),...m.tags.filter(t=>t==='Dispatcher'||t==='Driver')];});
}
export const syncAllGroups=()=>DRIVERS.forEach(syncGroupMembers);
/* Column sorting per table survives a reload (per browser, a convenience only). */
const savedSort=(()=>{try{return JSON.parse(localStorage.getItem('ub.sort')||'{}');}catch(e){return{};}})();
export const S={uid:null,sort:savedSort,whJust:{},whEdit:{},whd:{},dt:null,msgOpen:false,rep:null,rs:null,modal:null,manEdit:null,tab:'departures',pgrp:'all',pq:'',sel:{},simOpen:false,grp:'all',disp:'all',q:'',drawer:null,tripsTab:'active',builder:null,wh:{},actAs:{},expand:{}};
export const DRIVERS=[]; export const TRIPS=[]; let tripSeq=27540;
export const drv=id=>DRIVERS.find(d=>d.id===id);
export const trip=id=>TRIPS.find(t=>t.id===id);
export const activeTrip=d=>TRIPS.find(t=>t.driverId===d.id&&t.status==='active'&&!t.closed);
/* A draft saved before the consolidator typed a trip number gets an internal id; it is never shown as a number. */
export const isDraftId=id=>String(id).startsWith('draft-');
export const tripNo=t=>isDraftId(t.id)?'(no number)':'#'+t.id;
/* A driver group = the Telegram group of one truck: the driver, the truck tablet and the office staff with their tags. */
export function newDriverGroup(name,truck){
  const d={id:'d'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name,truck:String(truck),members:[
    {name,tags:['Driver']},{name:`Truck ${truck} tablet`,tags:['Driver']}],
    loc:'Home parking',speed:0,eta:null,ping:Date.now()};
  syncGroupMembers(d);return d;
}
export const groupTitle=d=>`${d.name} · Truck ${d.truck}`;
/* Real Telegram groups the bot is in (shared data only; the bot registers them). A group linked to a driver gets its trips. */
export const TG_GROUPS=[];
const botIn=g=>['member','administrator','creator','restricted'].includes(g.botStatus||'member');
export const tgGroupOf=driverId=>TG_GROUPS.filter(g=>g.driverId===driverId&&botIn(g)).sort((a,b)=>(b.linkedAt||0)-(a.linkedAt||0))[0]||null;
export function newTrip(){let id;do{id=String(tripSeq++);}while(id==='27557'||TRIPS.some(t=>t.id===id));return{id,priority:false,trailerNum:'',ack:null,whDirty:false,driverId:null,dispatcher:'',status:'draft',confirm:null,trailer:null,trailerPrep:null,trailerReady:null,enRouteYard:null,atYard:null,leftYard:null,empty:null,closed:null,backhaul:null,stops:[],created:Date.now(),updated:Date.now(),history:[],chat:[],alerts:[],notes:[]};}
export function findStop(sid){for(const t of TRIPS){const i=t.stops.findIndex(s=>s.id===sid);if(i>=0)return{t,s:t.stops[i],i};}const s=POOL.find(x=>x.id===sid);return s?{t:null,s,i:-1}:null;}
export const POOL=[];
/* Agents directory: warehouses where drivers drop loads for the agent to deliver. */
export const AGENTS=[];
export const agent=id=>AGENTS.find(a=>a.id===id);
export const canEditTrip=()=>myRoles().some(r=>['owner','admin','supervisor','consolidator','afterhours','dispatcher'].includes(r));
export const canPrio=()=>myRoles().some(r=>['owner','admin','supervisor','consolidator','afterhours','manager'].includes(r));
