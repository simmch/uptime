// Tiny DOM helpers.
import { sfx } from '../audio/sfx.js';
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
}

export function money(n, { sign = false } = {}) {
  const neg = n < 0; const a = Math.abs(n);
  const s = a >= 1e9 ? (a / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : a >= 1e4 ? (a / 1e3).toFixed(1) + 'k' : Math.round(a).toLocaleString();
  return (neg ? '−' : sign ? '+' : '') + '$' + s;
}
export function num(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(0) + 'k' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toString(); }
export function pct(n, d = 2) { return n.toFixed(d) + '%'; }
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ───── modal stack ─────
let modalRoot;
export function initModals(root) { modalRoot = root; }
export function modal(content, { title = '', wide = false, closable = true, onClose = null, cls = '' } = {}) {
  const box = h('div', { class: `modal ${wide ? 'wide' : ''} ${cls}` },
    title ? h('div', { class: 'modal-title' }, h('span', {}, title), closable ? h('button', { class: 'x', 'data-sfx': 'none', onclick: () => close() }, '✕') : null) : null,
    h('div', { class: 'modal-body' }, content));
  const back = h('div', { class: 'modal-back' }, box);
  if (closable) back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  modalRoot.append(back);
  sfx('ui_open');
  function close() { if (back.isConnected) sfx('ui_close'); back.remove(); onClose?.(); }
  return { close, el: box, body: box.querySelector('.modal-body') };
}
export function confirmBox(text, { ok = 'OK', cancel = 'Cancel', title = 'Confirm' } = {}) {
  return new Promise(res => {
    const m = modal(h('div', {}, h('p', { html: text }), h('div', { class: 'row end gap' },
      cancel ? h('button', { class: 'btn ghost', onclick: () => { m.close(); res(false); } }, cancel) : null,
      h('button', { class: 'btn', onclick: () => { m.close(); res(true); } }, ok))), { title, closable: false });
  });
}

// ───── toasts ─────
let toastRoot;
export function initToasts(root) { toastRoot = root; }
export function toast(html, kind = 'info', ms = 3200) {
  if (kind === 'bad') sfx('ui_error');
  const el = h('div', { class: `toast ${kind}`, html });
  toastRoot.append(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

// ───── tiny sparkline ─────
export function sparkline(canvas, series, { colors = ['#5dff8a'], max = null, min = 0 } = {}) {
  const g = canvas.getContext('2d'); const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  const all = series.flat(); const mx = max ?? Math.max(1e-9, ...all); const mn = min;
  series.forEach((s, i) => {
    g.strokeStyle = colors[i % colors.length]; g.lineWidth = 1.5; g.beginPath();
    s.forEach((v, j) => { const x = (j / Math.max(1, 239)) * W; const y = H - ((v - mn) / (mx - mn || 1)) * (H - 2) - 1; j ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
  });
}
