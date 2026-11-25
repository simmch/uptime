import './style.css';
import './ui/mobile.css';
import './ui/mobile.js';
import { loadAtlas } from './render/atlas.js';
import { loadManifest, loadModels, modelKeys } from './render/models.js';
import { World } from './render/world.js';
import { App, show, renderHUD, renderNav } from './ui/app.js';
import { initModals, initToasts, $ } from './ui/dom.js';
import './ui/build.js';
import './ui/panels.js';
import './ui/labs.js';
import './ui/title.js';
import './ui/drive.js';
import './ui/home.js';
import './ui/legacy.js';
import './ui/retro.css';
import { S, setState, discardLocal } from './core/state.js';
import { startAccount, flushCloud, signedInEmail, userId, pushCloud } from './auth/cloud.js';
import { openAccount } from './ui/account.js';
import { mkNode, storyJob } from './data/jobs.js';
import * as G from './game.js';

async function boot() {
  initModals($('#modals')); initToasts($('#toasts'));
  await Promise.all([loadAtlas(), loadManifest()]);
  const loading = $('#loading');
  await loadModels(modelKeys(), (done, total) => { if (loading) loading.textContent = `LOADING… ${Math.round(100 * done / total)}%`; });
  App.world = new World($('#world'), $('#labels'));
  App.world.buildOffice({ villain: false, home: 'couch', gear: [], certs: [], chapter: 1 });
  const leftover = await discardLocal();
  const account = await startAccount();
  if (leftover && !S) {
    setState(leftover);
    if (signedInEmail()) {
      S.owner = userId();
      try { await pushCloud(); }
      catch { delete S.owner; }
    }
  }
  show('title');
  if (account.recovery) openAccount({ recovery: true });
  $('#loading')?.remove();
  window.addEventListener('beforeunload', event => {
    if (!S) return;
    if (signedInEmail()) flushCloud();
    else {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  window.__uptime = { App, show, G, mkNode, storyJob, get S() { return S; } }; // handy for debugging in the console
}
boot().catch(e => { console.error(e); const l = $('#loading'); if (l) l.textContent = 'Failed to load: ' + e.message; });
