/* Reference data for the prototype only (consignees, brokers, notes, drivers). */

export const CONSIGNEES=[
  {c:'Great Lakes Foods DC',city:'Lansing, MI 48917',addr:'4100 Grand River Ave'},
  {c:'Heartland Grocery DC',city:'Indianapolis, IN 46241',addr:'7801 W Morris St'},
  {c:'Buckeye Retail Hub',city:'Columbus, OH 43207',addr:'2250 Alum Creek Dr'},
  {c:'Ohio Valley Distribution',city:'Louisville, KY 40213',addr:'4600 Produce Rd'},
  {c:'Tri-State Cold Storage',city:'Cincinnati, OH 45203',addr:'1100 Gest St'},
  {c:'North Star Wholesale',city:'Minneapolis, MN 55413',addr:'3300 Broadway St NE'},
  {c:'Gateway Market DC',city:'St. Louis, MO 63134',addr:'9200 Latty Ave'},
  {c:'Motor City Supply',city:'Detroit, MI 48238',addr:'14000 Lyndon St'},
  {c:'Badger Foods DC',city:'Madison, WI 53704',addr:'4602 Hayes Rd'},
  {c:'Music City Distribution',city:'Nashville, TN 37228',addr:'610 Mainstream Dr'},
  {c:'Cornbelt Logistics Center',city:'Des Moines, IA 50313',addr:'5300 NE 22nd St'},
  {c:'Hoosier Fresh DC',city:'Fort Wayne, IN 46809',addr:'6400 Ardmore Ave'},
  {c:'Lakeshore Retail DC',city:'Toledo, OH 43607',addr:'3150 Hill Ave'},
  {c:'Cumberland Warehouse',city:'Bowling Green, KY 42101',addr:'500 Corporate Ct'},
];
export const NE_STOPS=[
  {c:'BOZZUTOS, INC.',addr:'400 Industrial Avenue',city:'Cheshire, CT 06410',ref:['DEL','3225111'],q:[11,'plts',9]},
  {c:'DC #800 (Uxbridge)',addr:'869 Quaker Hwy',city:'Uxbridge, MA 01569',ref:['DEL','101308582'],q:[11,'plts',11]},
  {c:'ALBERTSONS',addr:'205 Spencer Drive',city:'Wells, ME 04090',ref:['DEL','862484786'],q:[9,'plts',4]},
  {c:'ALBERTSONS',addr:'205 Spencer Drive',city:'Wells, ME 04090',ref:['PO','4471203'],q:[6,'plts',4]},
  {c:'ORONO OLD TOWN SELF STORAGE',addr:'161 Park St',city:'Orono, ME 04473',ref:null,q:[1,'crate',4]},
];
export const RESCHED_REASONS=['Receiver had no doors, moved by phone','Driver running late, broker approved new time','Earlier slot opened, receiver confirmed','FCFS window, we booked a firm time'];
export const BROKERS=['Apex Freight Brokerage','BlueLine Logistics','Summit Load Partners','Keystone Brokerage','RiverRoad Freight','Northbound Logistics'];
export const CONS_NOTES=['Lumper required, pay with Comdata, keep the receipt','Call receiving 1 hour before arrival','FCFS window 06:00–14:00, appt is a target','Pallets for this stop are at the tail, unload first','Do not double-stack, fragile','Broker wants check-in call with load # on arrival','Seal must stay on until receiver breaks it'];
export const WH_NOTES=['Loaded at the tail, shrink-wrapped, 2 pallets top-heavy','Behind the bulkhead, separated with load bar','Middle of trailer, marked with orange tape','Nose of trailer, 4 pallets double-stacked as allowed','Seal 448217 on the doors'];
export const DISP_NOTES=['Receiver says door assignments start at 7','Driver asked for a fuel stop after this one','Broker confirmed, no lumper needed','Running 30 min late, broker notified'];
export const NEAR_YARD=['I-55 N near Joliet, IL','I-80 E near Morris, IL','I-355 S near Lockport, IL','I-294 S near Hinsdale, IL','US-30 near Aurora, IL'];
export const LOCS=['I-65 S near Lafayette, IN','I-94 E near Kalamazoo, MI','I-70 E near Richmond, IN','I-69 N near Fort Wayne, IN','I-74 E near Danville, IL','I-90 W near Rockford, IL','I-71 S near Florence, KY','I-80 E near Gary, IN','US-31 N near Kokomo, IN','I-55 S near Springfield, IL','I-75 N near Dayton, OH'];
export const NAMES=['John Miller','Carlos Rivera','Mike Johnson','Andrii Kovalenko','David Brooks','Tyrone Ellis','Serhii Bondar','James Carter','Luis Ortega','Kevin Walsh','Marcus Reed','Dmytro Shevchuk','Brian Foster','Ahmed Yusuf','Paul Novak','Eric Dunn','Victor Lopez','Ryan Hughes','Oleksandr Melnyk','Chris Patel','Daniel Kim','Jorge Ramos','Steve Grant','Nikola Petrov','Aaron Scott','Mateo Cruz','Greg Lawson','Ivan Horvat','Sean Murphy','Tom Becker','Yusuf Demir','Robert Hall'];
export const AGENTS_SAMPLE=[
  {code:'WDS',name:'WDS Warehouse / Stefi Enterprises',addr:'2904 Transport Street',city:'Richmond, VA 23234'},
  {code:'NEX',name:'Northeast Crossdock',addr:'120 Turnpike Rd',city:'Westborough, MA 01581'},
  {code:'PDX',name:'Peach State Delivery Exchange',addr:'4400 Fulton Industrial Blvd SW',city:'Atlanta, GA 30336'},
];
/* Office team for the prototype. In production people join with an invite link and log in through Telegram. */
export const TEAM_SAMPLE=[
  {name:'Dmytro',username:'dmytro',roles:['owner']},
  {name:'Kate M.',username:'kate_admin',roles:['admin']},
  {name:'Peter S.',username:'peter_sup',roles:['supervisor']},
  {name:'Nick R.',username:'nick_mgr',roles:['manager']},
  {name:'Anna K.',username:'anna_disp',roles:['dispatcher']},
  {name:'Mark L.',username:'mark_disp',roles:['dispatcher']},
  {name:'Oleh P.',username:'oleh_disp',roles:['dispatcher']},
  {name:'Sara T.',username:'sara_disp',roles:['dispatcher','afterhours']},
  {name:'Ivan D.',username:'ivan_nights',roles:['afterhours']},
  {name:'Lena C.',username:'lena_cons',roles:['consolidator']},
  {name:'Max W.',username:'max_wh',roles:['warehouse']},
  {name:'Tom B.',username:'tom_safety',roles:['safety']},
];
