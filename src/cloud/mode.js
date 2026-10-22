/* Whether this page works on shared data (Firebase) or on this browser only. Views read it; cloud.js sets it.
   Kept apart from cloud.js so views don't load the Firebase SDK. */
/* call(name,data,opts): a server function; flushSoon/redraw/toast: hooks for files.js. */
export const CLOUD={on:false,user:null,bot:'',call:null,flushSoon:null,redraw:null,toast:null};
