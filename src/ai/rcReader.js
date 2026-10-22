/* Reads one Rate Confirmation PDF with Claude and returns plain JSON: load, broker, rate and every delivery stop.
   Prototype only: the browser calls the API directly with the user's own key. Production does the same call on the server. */
import {AI_MODEL,aiKey} from './config.js';

const SDK_URL='https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.1.0/+esm';
let sdk=null;
const loadSdk=async()=>sdk||(sdk=(await import(SDK_URL)).default);

/* Only what the TMS needs from an RC: price, load #, broker, pickup, deliveries, delivery number.
   Rules learned from real RCs (Echo, RJW, Schneider, ArcBest, Fulton, Flock, LDI, GO TO, Priority 1). */
const SYSTEM=`You read freight Rate Confirmations (RC) for an LTL carrier and return JSON with only these fields.

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
const SCHEMA=obj({
  is_rate_confirmation:{type:'boolean'},not_rc_reason:str,
  load_number:str,broker:str,total_rate:num,
  pickup:obj({...place,date_start:str,date_end:str}),
  deliveries:{type:'array',items:obj({...place,appt_start:str,appt_end:str,
    delivery_number:str,delivery_number_type:{type:'string',enum:['DEL','PO','REF','']},
  })},
});

const readB64=file=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=()=>rej(new Error('Could not read the file'));r.readAsDataURL(file);});

/* Throws an Error whose message is ready to show in a toast. */
/* Cache by the file's SHA-256: the same PDF is read once, even under another name or after a reload.
   Bump CACHE_V when the schema or the rules change, so old answers are not reused. */
const CACHE_V='rc2';
const cacheKey=h=>`ub.${CACHE_V}.${h}`;
async function fileHash(file){const d=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return[...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('');}
function cacheGet(h){try{const v=localStorage.getItem(cacheKey(h));return v?JSON.parse(v):null;}catch(e){return null;}}
function cachePut(h,v){try{localStorage.setItem(cacheKey(h),JSON.stringify(v));}catch(e){/* storage full or blocked: just read again next time */}}

export async function readRc(file){
  if(file.size>30*1024*1024)throw new Error(`${file.name} is over 30 MB`);
  const hash=await fileHash(file).catch(()=>null);
  const hit=hash&&cacheGet(hash);if(hit)return{...hit,usage:{input:0,output:0},cached:true};
  const key=aiKey();if(!key)throw new Error('Add the Claude API key in AI settings first');
  const [Anthropic,data]=await Promise.all([loadSdk(),readB64(file)]).catch(e=>{throw new Error(e.message.includes('import')?'Could not load the Claude SDK. Check the internet connection':e.message);});
  const client=new Anthropic({apiKey:key,dangerouslyAllowBrowser:true});
  const body={
    model:AI_MODEL,max_tokens:16000,system:SYSTEM,
    output_config:{effort:'medium',format:{type:'json_schema',schema:SCHEMA}},
    messages:[{role:'user',content:[
      {type:'document',source:{type:'base64',media_type:'application/pdf',data}},
      {type:'text',text:`File name: ${file.name}. Extract the rate confirmation.`},
    ]}],
  };
  let msg;
  try{
    // Server-side fallback: if the model declines, the API retries on its recommended fallback model.
    msg=await client.beta.messages.create({...body,betas:['server-side-fallback-2026-07-01'],fallbacks:'default'});
  }catch(e){
    if(e instanceof Anthropic.BadRequestError&&/fallback/i.test(e.message))msg=await client.messages.create(body).catch(e2=>{throw apiError(Anthropic,e2);});
    else throw apiError(Anthropic,e);
  }
  if(msg.stop_reason==='refusal')throw new Error(`Claude declined to read ${file.name}`);
  if(msg.stop_reason==='max_tokens')throw new Error(`${file.name}: the answer was cut off, try again`);
  const text=msg.content.filter(b=>b.type==='text').map(b=>b.text).join('');
  let out;try{out=JSON.parse(text);}catch(e){throw new Error(`${file.name}: Claude returned an unreadable answer`);}
  if(hash)cachePut(hash,out);
  return{...out,usage:{input:msg.usage.input_tokens,output:msg.usage.output_tokens},cached:false};
}
/* Cheap check that the key works and can use the model: no document is sent. */
export async function checkAiKey(){
  const key=aiKey();if(!key)throw new Error('No key saved');
  const Anthropic=await loadSdk().catch(()=>{throw new Error('Could not load the Claude SDK. Check the internet connection');});
  const client=new Anthropic({apiKey:key,dangerouslyAllowBrowser:true});
  const m=await client.models.retrieve(AI_MODEL).catch(e=>{throw apiError(Anthropic,e);});
  return`Key works · ${m.display_name||AI_MODEL} is available`;
}
function apiError(Anthropic,e){
  if(e instanceof Anthropic.AuthenticationError)return new Error('The Claude API key was rejected. Check it in AI settings');
  if(e instanceof Anthropic.PermissionDeniedError||e instanceof Anthropic.NotFoundError)return new Error('This API key has no access to '+AI_MODEL);
  if(e instanceof Anthropic.RateLimitError)return new Error('Too many requests to Claude right now. Wait a minute and retry');
  if(e instanceof Anthropic.APIConnectionError)return new Error('No connection to the Claude API');
  if(e instanceof Anthropic.APIError)return new Error('Claude API error: '+(e.message||e.status));
  return e instanceof Error?e:new Error(String(e));
}
