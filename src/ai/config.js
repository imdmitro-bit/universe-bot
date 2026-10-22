/* AI settings for the prototype. The API key lives only in this browser (localStorage) and is typed in by the user.
   In production the key moves to the server and the browser never sees it. */
const KEY='ub.anthropicKey';
export const AI_MODEL='claude-opus-5-5';
export const AI_MODEL_LABEL='Claude Opus 5.5';

export function aiKey(){try{return localStorage.getItem(KEY)||'';}catch(e){return'';}}
export function setAiKey(v){try{v?localStorage.setItem(KEY,v):localStorage.removeItem(KEY);return true;}catch(e){return false;}}
export const aiReady=()=>!!aiKey();
export const maskKey=k=>k?k.slice(0,10)+'…'+k.slice(-4):'';
