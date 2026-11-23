import './style.css';
import { loadAtlas } from './render/atlas.js';
import { World } from './render/world.js';
import { App, show, renderHUD, renderNav } from './ui/app.js';
import { initModals, initToasts, $ } from './ui/dom.js';
import './ui/build.js';
import './ui/panels.js';
import './ui/labs.js';
import './ui/title.js';
import './ui/drive.js';
import './ui/home.js';
import { S, save } from './core/state.js';
import { mkNode, storyJob } from './data/jobs.js';
import * as G from './game.js';

async function boot() {
  initModals($('#modals')); initToasts($('#toasts'));
  await loadAtlas();
  App.world = new World($('#world'), $('#labels'));
  App.world.buildOffice({ villain: false, home: 'couch', gear: [], certs: [], chapter: 1 });
  show('title');
  $('#loading')?.remove();
  window.addEventListener('beforeunload', () => { if (S) save(); });
  window.__uptime = { App, show, G, mkNode, storyJob, get S() { return S; } }; // handy for debugging in the console
}
boot().catch(e => { console.error(e); const l = $('#loading'); if (l) l.textContent = 'Failed to load: ' + e.message; });
