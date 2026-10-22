/* Telegram Mini App hooks: only active when opened inside Telegram. */
import {S} from './state.js';
import {renderDrawer} from './views/drawer.js';
import {renderModal} from './views/modal.js';

export function initTelegram(){const tg=window.Telegram&&window.Telegram.WebApp;if(!tg||!tg.initData)return;window.TGWA=tg;
  try{tg.ready();tg.expand();tg.setHeaderColor&&tg.setHeaderColor('#121926');tg.setBackgroundColor&&tg.setBackgroundColor('#0E131D');}catch(e){}
  const u=tg.initDataUnsafe&&tg.initDataUnsafe.user;if(u)window.TG_NAME='Signed in as '+[u.first_name,u.last_name].filter(Boolean).join(' ');
  try{tg.BackButton.onClick(()=>{if(S.modal){S.modal=null;renderModal();}else if(S.drawer){S.drawer=null;renderDrawer();}});}catch(e){}
}
