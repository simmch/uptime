// Responsive drawers and safe-area handling for phones, tablets, and hybrid devices.
import { h } from './dom.js';

const root = document.documentElement;
const coarse = matchMedia('(any-pointer: coarse)');

function classify() {
  const touch = coarse.matches || navigator.maxTouchPoints > 0;
  root.classList.toggle('touch', touch);
  root.classList.toggle('compact', touch && (innerWidth < 1180 || innerHeight < 640));
  root.classList.toggle('phone', touch && (innerWidth < 760 || innerHeight < 480));
}

function measureViewport() {
  const viewport = window.visualViewport;
  if (!viewport || viewport.scale !== 1) return;
  root.style.setProperty('--m-viewport-height', Math.floor(viewport.height) + 'px');
  root.style.setProperty('--m-viewport-top', Math.round(viewport.offsetTop) + 'px');
}

const DRAWERS = [
  ['.palette', 'palette', 'Components'],
  ['.inspector', 'inspector', 'Inspector'],
  ['.run-left', 'log', 'Event log'],
  ['.run-right', 'metrics', 'Metrics'],
  ['.m-camera', 'camera', 'Camera'],
];

export const isCompact = () => root.classList.contains('compact');
export const hasTouch = () => root.classList.contains('touch');

export function setDrawer(id) {
  if (id) root.dataset.drawer = id;
  else delete root.dataset.drawer;
  document.querySelectorAll('.m-dock button').forEach(button => {
    const open = button.dataset.drawer === id;
    button.classList.toggle('on', open);
    button.setAttribute('aria-pressed', String(open));
  });
}

export function cameraControls(world) {
  const controls = [
    ['Zoom out', '−', () => world.adjustView(1 / 1.25)],
    ['Zoom in', '+', () => world.adjustView(1.25)],
    ['Rotate left', '↶', () => world.adjustView(1, -.22)],
    ['Rotate right', '↷', () => world.adjustView(1, .22)],
    ['Fit map', 'Fit', () => world.fitArchitecture()],
  ];
  return h('div', { class: 'm-camera panel', role: 'group', 'aria-label': 'Camera controls' },
    controls.map(([label, text, action]) => h('button', { class: 'btn small', type: 'button', 'aria-label': label, onclick: action }, text)));
}

let topEl;
const topObserver = window.ResizeObserver ? new ResizeObserver(measureTop) : null;
function measureTop() {
  const bar = document.querySelector('#screen .build-top, #screen .run-top');
  if (bar !== topEl) {
    topObserver?.disconnect();
    topEl = bar;
    if (bar) topObserver?.observe(bar);
  }
  if (bar) root.style.setProperty('--m-top', Math.ceil(bar.getBoundingClientRect().bottom + 6) + 'px');
  else root.style.removeProperty('--m-top');
}

function syncDock() {
  if (hasTouch()) measureTop();
  const screen = document.getElementById('screen');
  if (!screen || !hasTouch()) return;
  const present = DRAWERS.filter(([selector]) => screen.querySelector(selector));
  const current = screen.querySelector('.m-dock');
  if (!present.length) {
    current?.remove();
    if (root.dataset.drawer) setDrawer(null);
    return;
  }
  const key = present.map(drawer => drawer[1]).join(',');
  if (current?.dataset.key === key) return;
  current?.remove();
  const selected = present.some(([, id]) => id === root.dataset.drawer) ? root.dataset.drawer : null;
  const dock = h('div', { class: 'm-dock', 'data-key': key, role: 'group', 'aria-label': 'Map panels' },
    present.map(([, id, label]) => h('button', {
      type: 'button', class: 'btn small', 'data-drawer': id,
      onclick: () => setDrawer(root.dataset.drawer === id ? null : id),
    }, label)));
  screen.append(dock);
  setDrawer(selected);
}

function refreshLayout() {
  classify();
  measureViewport();
  syncDock();
}

function init() {
  const screen = document.getElementById('screen');
  new MutationObserver(syncDock).observe(screen, { childList: true });
  new MutationObserver(() => setDrawer(null)).observe(screen, { attributes: true, attributeFilter: ['class'] });
  refreshLayout();
}

classify();
measureViewport();
window.addEventListener('resize', refreshLayout);
coarse.addEventListener?.('change', refreshLayout);
window.visualViewport?.addEventListener('resize', measureViewport);
window.visualViewport?.addEventListener('scroll', measureViewport);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
