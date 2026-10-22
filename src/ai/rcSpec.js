/* What Claude is asked to read from a Rate Confirmation, and the JSON it must return.
   Shared by the browser reader (rcReader.js) and the server (server/functions/ai.js, copied by sync-app.sh). */
/* Only what the TMS needs from an RC: price, load #, broker, pickup, deliveries, delivery number.
   Rules learned from real RCs (Echo, RJW, Schneider, ArcBest, Fulton, Flock, LDI, GO TO, Priority 1). */
export const SYSTEM=`You read freight Rate Confirmations (RC) for an LTL carrier and return JSON with only these fields.

- load_number: the broker's load identifier as printed; it may contain letters ("CXQ-ZGD4", "M480784"). Labels vary: Load #, Order, Route #, Trip, Load ID, Reference (BOL). If a "LOAD#" field holds junk (e.g. "ps"), use the real trip/order number.
- broker: the brokerage company name (not the rep, not the carrier "Universe Cargo Group").
- total_rate: total carrier pay in USD including fuel surcharge and all line items. Number only.
- pickup: the first pickup stop. facility name as printed, street address, city, state (2 letters), zip (5 digits).
- deliveries: every delivery/drop stop in route order (never pickups), with facility, address, city, state, zip.
- Times are local "YYYY-MM-DDTHH:MM" as printed, no time zone conversion. *_start is the appointment or window start, *_end is the window end or "" for a fixed time. Date only: use T00:00 and end "".
- delivery_number: the number the driver gives at the receiver. Prefer DEL#/DELV#/Delivery #/Delivery confirmation number/Delivery Order Number (type "DEL"); else PO# (type "PO"); else another consignee reference or appointment number (type "REF"); else "" and type "". Never use BOL or pickup numbers or junk like a person's name. If several qualify, join them with ", ".

If the document is not a Rate Confirmation / load tender (BOL, receipt, invoice, POD...), set is_rate_confirmation false, say why in not_rc_reason and leave the other values empty.`;

const str={type:'string'},num={type:'number'};
const obj=(properties)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const place={facility:str,address:str,city:str,state:str,zip:str};
export const SCHEMA=obj({
  is_rate_confirmation:{type:'boolean'},not_rc_reason:str,
  load_number:str,broker:str,total_rate:num,
  pickup:obj({...place,date_start:str,date_end:str}),
  deliveries:{type:'array',items:obj({...place,appt_start:str,appt_end:str,
    delivery_number:str,delivery_number_type:{type:'string',enum:['DEL','PO','REF','']},
  })},
});
