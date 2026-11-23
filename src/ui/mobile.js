// Touch / small-screen support. Everything here is gated on touch devices so the
// desktop (mouse) layout is untouched.
//   html.touch   – coarse pointer, no hover (phones, tablets)
//   html.compact – touch + not enough room for the desktop side panels
//   html.phone   – touch + narrow phone width
const root = document.documentElement;
const TOUCH = matchMedia('(hover: none) and (pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(hover: hover)').matches);

function classify() {
  if (!TOUCH) { root.classList.remove('touch', 'compact', 'phone'); return; }
  const w = innerWidth, h = innerHeight;
  root.classList.add('touch');
  root.classList.toggle('compact', w < 1180 || h < 640);
  root.classList.toggle('phone', w < 760 || h < 480);
}
classify();
addEventListener('resize', () => { classify(); measureTop(); });
addEventListener('orientationchange', () => setTimeout(classify, 120));

// ── slide-out drawers for the build / run side panels ──
const DRAWERS = [
  ['.palette', 'palette', 'Components'],
  ['.inspector', 'inspector', 'Inspector'],
  ['.run-left', 'log', 'Event log'],
  ['.run-right', 'metrics', 'Metrics'],
];

function setDrawer(id) {
  if (id) root.dataset.drawer = id; else delete root.dataset.drawer;
  document.querySelectorAll('.m-dock button').forEach(b => b.classList.toggle('on', b.dataset.drawer === id));
}

// Drawers start just under the build/run top bar, whose height varies as it wraps.
let topRO = null, topEl = null;
function measureTop() {
  const bar = document.querySelector('#screen > .build-top, #screen > .run-top');
  if (bar !== topEl) {
    topRO?.disconnect(); topEl = bar;
    if (bar && window.ResizeObserver) { topRO = new ResizeObserver(measureTop); topRO.observe(bar); }
  }
  if (bar) root.style.setProperty('--m-top', Math.ceil(bar.getBoundingClientRect().bottom + 6) + 'px');
  else root.style.removeProperty('--m-top');
}

function syncDock() {
  if (root.classList.contains('touch')) measureTop();
  const screen = document.getElementById('screen');
  if (!screen || !root.classList.contains('touch')) return;
  const present = DRAWERS.filter(([sel]) => screen.querySelector(':scope > ' + sel));
  let dock = screen.querySelector(':scope > .m-dock');
  const key = present.map(d => d[1]).join(',');
  if (!present.length) { dock?.remove(); if (root.dataset.drawer) setDrawer(null); return; }
  if (dock && dock.dataset.key === key) return;
  dock?.remove();
  if (!DRAWERS.some(d => d[1] === root.dataset.drawer && present.includes(d))) setDrawer(null);
  dock = document.createElement('div');
  dock.className = 'm-dock'; dock.dataset.key = key;
  for (const [, id, label] of present) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn small'; b.dataset.drawer = id; b.textContent = label;
    b.onclick = () => setDrawer(root.dataset.drawer === id ? null : id);
    dock.append(b);
  }
  screen.append(dock);
  setDrawer(root.dataset.drawer || null);
}

function init() {
  const screen = document.getElementById('screen');
  if (!screen) return void setTimeout(init, 50);
  new MutationObserver(syncDock).observe(screen, { childList: true });
  // When the screen itself changes, start with all drawers closed.
  new MutationObserver(() => setDrawer(null)).observe(screen, { attributes: true, attributeFilter: ['class'] });
  // Picking a component to place closes the palette so the map can be tapped.
  document.addEventListener('click', e => {
    if (!root.classList.contains('compact')) return;
    if (e.target.closest?.('.palette .pitem:not(.locked)')) setDrawer(null);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

export const isCompact = () => root.classList.contains('compact');
