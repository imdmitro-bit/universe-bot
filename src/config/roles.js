/* Roles, what each one sees and may do. Admin rights get narrowed later. */

/* Names the demo trips use; the real list of dispatchers comes from the Team tab. */
export const DISPATCHERS=['Anna K.','Mark L.','Oleh P.','Sara T.'];
export const AFTER_HOURS='Ivan D.';
export const ROLES={
  owner:{label:'Owner',tabs:['departures','board','trips','warehouse','backhauls','agents','drivers','team']},
  admin:{label:'Admin',tabs:['departures','board','trips','warehouse','backhauls','agents','drivers','team']},
  supervisor:{label:'Supervisor',tabs:['departures','board','trips','warehouse','backhauls','agents','drivers','team']},
  manager:{label:'Manager',tabs:['departures','board','trips','backhauls','agents','drivers']},
  dispatcher:{label:'Dispatcher',tabs:['board','departures','trips','backhauls','agents']},
  afterhours:{label:'After Hours',tabs:['board','departures','trips','backhauls','agents']},
  consolidator:{label:'Consolidator',tabs:['trips','departures','board','agents']},
  warehouse:{label:'Warehouse',tabs:['warehouse','departures']},
  safety:{label:'Safety',tabs:['board','departures','drivers']},
};
export const PERM={
  build:['owner','admin','supervisor','consolidator'],
  dispatch:['owner','admin','supervisor','dispatcher','afterhours'],
  truck:['owner','admin','supervisor'],
  tags:['owner','admin','supervisor'],
  warehouse:['owner','admin','supervisor','warehouse'],
  manifest:['owner','admin','supervisor','warehouse','consolidator'],
  team:['owner','admin','supervisor'],
  override:['owner','admin','supervisor','manager','afterhours'],
  rates:['owner','admin','supervisor','manager','dispatcher','afterhours','consolidator'],
};
export const TABS={departures:'Preparing',board:'Dispatch Board',trips:'Trips',warehouse:'Warehouse',backhauls:'Backhauls',agents:'Agents',drivers:'Driver Groups',team:'Team'};
