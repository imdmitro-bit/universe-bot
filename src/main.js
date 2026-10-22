/* Entry point. Order matters: Telegram first (it sets the user name for the top bar), then events, sample data, first render. */
import {initTelegram} from './telegram.js';
import {bindEvents} from './events.js';
import {seed,seedStarter} from './data/seed.js';
import {render} from './ui/render.js';
import {loadSaved,startSaving} from './store.js';

import * as state from './state.js';
import * as roles from './config/roles.js';
import * as stops from './domain/stops.js';
import * as status from './domain/status.js';
import * as actions from './domain/actions.js';
import * as ui from './ui/render.js';
import * as board from './views/board.js';
import * as drawer from './views/drawer.js';
import * as builder from './views/builder.js';
import {toInput} from './lib/utils.js';

initTelegram();
bindEvents();
// ?demo shows sample drivers and trips and never saves. Otherwise your own data is kept in this browser;
// the very first start has three drivers with trips to try things on.
if(new URLSearchParams(location.search).has('demo'))seed();
else{if(!loadSaved())seedStarter();startSaving();}
render();

// Debug handle for the browser console and tests/regress.js. Not used by the app itself.
window.UB=Object.assign({toInput},state,roles,stops,status,actions,ui,board,drawer,builder);
