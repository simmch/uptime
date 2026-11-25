// App shell: HUD, navigation, dialogue, office & job board, screen routing.
import { h, $, money, num, modal, toast, confirmBox, esc } from './dom.js';
import { icon, pixelIcon } from '../render/atlas.js';
import { S, save, xpForLevel, title, creditLimit, home } from '../core/state.js';
import { on, emit } from '../core/events.js';
import { CHARS } from '../data/story.js';
import { DOMAINS } from '../data/domains.js';
import { NEEDS, COMPLIANCE } from '../sim/review.js';
import { popularityBonus, workBreak } from '../data/life.js';
import { setAtComputer, syncMusic } from '../audio/music.js';
import * as G from '../game.js';
import { sfx } from '../audio/sfx.js';
import { signedInEmail } from '../auth/cloud.js';

export const App = { world: null, screen: 'office', screens: {}, busy: false };

export function registerScreen(name, impl) { App.screens[name] = impl; }

export function show(name, arg) {
  const prev = App.screens[App.screen];
  prev?.leave?.();
  App.screen = name;
  const root = $('#screen'); root.innerHTML = ''; root.className = 'screen-' + name;
  App.screens[name].enter(root, arg);
  syncMusic(name);
  renderNav();
}

// ═════════════ HUD ═════════════
export function renderHUD() {
  if (!S) return;
  const el = $('#hud');
  const lvlNext = xpForLevel(S.level + 1), lvlCur = xpForLevel(S.level);
  const pctXp = Math.max(0, Math.min(100, ((S.xp - lvlCur) / (lvlNext - lvlCur)) * 100));
  const daysToRent = (7 - ((S.day - 1) % 7)) % 7 || 7;
  const credit = creditLimit();
  const ch = G.chapter();
  el.innerHTML = '';
  el.append(
    h('div', { class: 'hud-left' },
      h('span', { html: icon(S.villain ? 'hacker' : 'player', 40) }),
      h('div', {},
        h('div', { class: 'hud-name' }, S.name, h('span', { class: 'hud-title' }, ' · ' + title()),
          h('button', {
            class: 'hud-save' + (signedInEmail() ? ' saved' : ''),
            type: 'button',
            onclick: () => App.openAccount?.(),
          }, signedInEmail() ? 'Saved' : 'Save game')),
        h('div', { class: 'xpbar' }, h('div', { style: { width: pctXp + '%' } }), h('span', {}, `LV ${S.level}  ${num(Math.max(0, S.xp - lvlCur))}/${num(lvlNext - lvlCur)} XP`)))),
    h('div', { class: 'hud-mid' },
      h('div', { class: 'stat money ' + (S.money < 0 ? 'neg' : ''), title: credit ? `Credit line: $${credit.toLocaleString()}` : 'No credit line — going negative at rent time means trouble' }, h('span', { html: icon('coins', 22) }), money(S.money)),
      h('div', { class: 'stat', title: `${S.home === 'couch' ? 'Rent' : 'Home upkeep'} $${home().rent}/week (${home().name})` }, h('span', { html: icon('calendar', 22) }), `Day ${S.day}`, h('small', {}, ` ${S.home === 'couch' ? 'rent' : 'upkeep'} in ${daysToRent}d`)),
      h('div', { class: 'stat', title: S.villain ? 'Notoriety' : 'Reputation raises pay' }, h('span', { html: icon(S.villain ? 'megaphone' : 'star', 22) }), S.villain ? `${S.notoriety || 0}` : `${S.rep}`),
      h('div', { class: 'stat ' + (S.sp ? 'glow' : ''), title: 'Skill points' }, h('span', { html: icon('book', 22) }), `${S.sp} SP`)),
    h('div', { class: 'hud-right' }, h('div', { class: 'chapter' }, `CH ${ch.n} · ${ch.title.toUpperCase()}`), h('small', {}, ch.subtitle)),
  );
}

const NAV = [
  ['office', 'house', 'Home'], ['skills', 'book', 'Skills'], ['codex', 'scroll', 'Codex'], ['certs', 'medal', 'Certifications'],
  ['practice', 'terminal', 'Practice Labs'], ['shop', 'cart', 'Shop & Housing'], ['legacy', 'heart', 'Life & legacy'],
  ['log', 'notebook', 'Story & History'], ['settings', 'wrench', 'Save & Settings'],
];
export function renderNav() {
  const el = $('#nav'); el.innerHTML = '';
  if (['build', 'run', 'title', 'drive', 'ending'].includes(App.screen)) { el.style.display = 'none'; return; }
  el.style.display = '';
  for (const [id, spr, label] of NAV) {
    const b = h('button', { class: 'navbtn ' + (App.screen === id ? 'on' : ''), title: label, onclick: () => { if (App.panels[id]) App.panels[id](); else if (App.screen !== id) show(id); } }, h('span', { html: pixelIcon(spr, 30) }), h('span', { class: 'navlabel' }, label));
    if (id === 'office' && App.screen === 'office') b.setAttribute('aria-current', 'page');
    if (id === 'skills' && S.sp > 0) b.append(h('span', { class: 'dot' }));
    el.append(b);
  }
}
App.panels = {};

// ═════════════ DIALOGUE ═════════════
export function dialogue(lines) {
  return new Promise(resolve => {
    if (!lines?.length) return resolve();
    const root = $('#dialogue'); let i = 0, typing = null;
    const box = h('div', { class: 'dlg' }); root.innerHTML = ''; root.append(box); root.classList.add('on');
    const render = () => {
      const [who, text] = lines[i]; const c = CHARS[who] || CHARS.you;
      if (who === 'null') sfx('null_glitch'); else if (who === 'hr') sfx('email_ping'); else if (who === 'autopilot') sfx('terminal_success');
      const name = who === 'you' ? S.name : c.name;
      box.innerHTML = '';
      const txt = h('div', { class: 'dlg-text' });
      box.append(h('div', { class: 'dlg-portrait', html: icon(who === 'you' ? (S.villain ? 'hacker' : 'player') : c.sprite, 72) }),
        h('div', { class: 'dlg-body' }, h('div', { class: 'dlg-name', style: { color: c.color } }, name, c.title ? h('small', {}, ' — ' + c.title) : null), txt,
          h('div', { class: 'dlg-hint' }, `${i + 1}/${lines.length} · `,
            h('span', { class: 'desktop-input-hint' }, 'click / space ▸'), h('span', { class: 'touch-input-hint' }, 'tap to continue ▸'))));
      let k = 0; clearInterval(typing);
      typing = setInterval(() => { k += 2; if (k % 6 === 0) sfx('text_blip'); txt.textContent = text.slice(0, k); if (k >= text.length) { clearInterval(typing); typing = null; } }, 14);
      txt.dataset.full = text;
    };
    const next = () => {
      if (typing) { clearInterval(typing); typing = null; box.querySelector('.dlg-text').textContent = lines[i][1]; return; }
      i++; if (i >= lines.length) { root.classList.remove('on'); root.innerHTML = ''; document.removeEventListener('keydown', key); resolve(); } else render();
    };
    const key = e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); next(); } };
    box.addEventListener('click', next); document.addEventListener('keydown', key);
    render();
  });
}

// ═════════════ STORY driver ═════════════
export async function runStory() {
  if (App.busy) return; App.busy = true;
  try {
    for (let guard = 0; guard < 8; guard++) {
      const ev = G.tryAdvanceStory();
      if (!ev) break;
      if (ev.type === 'chapter') await chapterCard(ev.chapter);
      else if (ev.type === 'lines') { const first = ev.step.lines?.[0]?.[0]; if (first && !['mara', 'you', 'null', 'devon', 'hr', 'autopilot'].includes(first)) sfx('phone_buzz'); await dialogue(ev.step.lines); }
      else if (ev.type === 'toast') toast(ev.html, 'warn', 6000);
      else if (ev.type === 'villain') { toast('You have joined NULL. The Signal awaits.', 'bad', 6000); }
      else if (ev.type === 'ending') { App.screens.ending && show('ending'); break; }
      renderHUD();
    }
  } finally { App.busy = false; }
  if (App.screen === 'office') App.world?.buildOffice(S);
}

function chapterCard(ch) {
  return new Promise(res => {
    const el = h('div', { class: 'chapter-card' }, h('div', { class: 'cc-n' }, `CHAPTER ${ch.n}`), h('div', { class: 'cc-t' }, ch.title), h('div', { class: 'cc-s' }, ch.subtitle));
    document.body.append(el);
    sfx('chapter_hit');
    setTimeout(() => el.classList.add('on'), 20);
    const done = () => { el.classList.remove('on'); setTimeout(() => { el.remove(); res(); }, 500); };
    el.addEventListener('click', done); setTimeout(done, 3200);
  });
}

// The job board is opened from the work computer in the house.
export function openDesk() {
  sfx('key_press', { vol: .23 });
  G.refreshBoard();
  const story = h('div', { class: 'panel story-card' }, h('div', { class: 'panel-title' }, 'STORY CONTRACT'));
  const step = G.step(), storyJob = G.currentStoryJob();
  if (storyJob) story.append(jobCard(storyJob, true, () => desk.close()));
  else if (step?.gate && !G.gateMet(step.gate)) story.append(h('p', { class: 'muted' },
    step.gateText || 'Keep working to unlock the next part of the story.'));
  else story.append(h('p', { class: 'muted' }, 'No story contract ready. Take side work or practice a skill.'));

  const board = h('div', { class: 'panel board' },
    h('div', { class: 'panel-title' }, S.villain ? 'UNDERGROUND OPS' : 'JOB BOARD'));
  if (!S.board.length) board.append(h('p', { class: 'muted' }, 'No offers right now. Come back after getting some sleep.'));
  for (const job of S.board) board.append(jobCard(job, false, () => desk.close()));

  const urgent = workBreak(S.life);
  const bonus = popularityBonus(S.life);
  const toolbar = h('div', { class: 'desk-toolbar row gap wrap' },
    h('button', { class: 'btn help-button', onclick: () => App.panels.phone({ job: storyJob }) }, 'Ask a friend'),
    h('button', { class: 'btn ghost', onclick: () => App.panels.feed() }, 'Social feed'),
    h('button', { class: 'btn ghost', onclick: () => App.panels.legacy('company') }, 'Company'),
    bonus > 0 ? h('span', { class: 'good' }, `Online visibility · +${+(bonus * 100).toFixed(1)}% to contract pay`) : null);
  const desk = modal(h('div', { class: 'desk' }, toolbar,
    urgent ? h('p', { class: 'hint' }, `Take a break before starting work. ${urgent.action}.`) : null, story, board),
  { title: 'Work computer', wide: true, onClose: () => setAtComputer(false) });
  setAtComputer(true);
}

export function handleRent(ev = []) {
  for (const e of ev) {
    if (e.type === 'lifeNotice') showLifeNotice(e);
    if (e.type === 'rent') toast(`${icon('house', 18)} ${e.owned ? 'Home upkeep' : 'Rent paid'}: <b>${money(e.amount)}</b>`, 'warn');
    if (e.type === 'interest') toast(`Credit interest: ${money(e.amount)}`, 'warn');
    if (e.type === 'passive') toast(`Passive income: <b>${money(e.amount)}</b>`, 'good');
    if (e.type === 'broke') {
      const r = G.bankruptcyBailout();
      if (r.kind === 'loan') dialogue([['mara', `You're underwater. I'm lending you $${r.amt.toLocaleString()} — once per chapter. Spend less on servers and more on learning.`]]);
      else dialogue([['mara', 'You\'re broke again and I can\'t keep bailing you out. Landlord took the apartment. Couch it is. Rebuild.']]);
    }
  }
  renderHUD();
}
function showLifeNotice(event) { toast(esc(event.text), event.kind, 4500); }
on('legacy', showLifeNotice);
on('rentEvents', ev => handleRent(ev));

function reqChips(job) {
  const r = job.req; if (!r) return [];
  const chips = [];
  if (r.rps) chips.push(`${num(r.rps)} req/s`);
  if (r.peak > 1.5) chips.push(`peak ${r.peak}×`);
  if (r.availability) chips.push(`${r.availability}% SLA`);
  if (r.latency) chips.push(`p95 < ${r.latency}ms`);
  if (r.regionsMin > 1) chips.push(`${r.regionsMin}+ regions`);
  if (r.threat >= 2) chips.push('⚠ hostile');
  return chips;
}

export function jobCard(job, story, closeDesk) {
  const kindLabel = { build: job.mode === 'signal' ? 'BROADCAST' : job.mode === 'cost' ? 'COST CUT' : 'BUILD', netlab: 'NETWORK LAB', cidr: 'SUBNETTING', audit: 'SEC AUDIT', iam: 'IAM LAB', migration: 'MIGRATION', terminal: 'TERMINAL', recon: 'RECON' }[job.type] || job.type;
  return h('button', { class: 'job ' + (story ? 'story' : ''), type: 'button', onclick: () => jobBrief(job, closeDesk) },
    h('span', { html: pixelIcon(job.client?.sprite || 'box', 40) }),
    h('div', { class: 'job-main' },
      h('div', { class: 'job-title' }, job.title),
      h('div', { class: 'job-sub' }, job.client?.name || '', ' · ', h('b', {}, kindLabel), job.workDays ? ` · ${job.workDays}d` : ''),
      h('div', { class: 'chips' }, ...reqChips(job).map(c => h('span', { class: 'chip' }, c)), ...(job.domains || []).map(d => h('span', { class: 'chip dom', style: { borderColor: DOMAINS[d].color, color: DOMAINS[d].color } }, DOMAINS[d].short)))),
    h('div', { class: 'job-pay' }, job.mode === 'signal' ? h('span', { class: 'muted' }, 'donations') : money(job.pay || 0)));
}

export function jobBrief(job, closeDesk) {
  const r = job.req;
  const body = h('div', { class: 'brief' });
  body.append(h('div', { class: 'row gap' }, h('span', { html: pixelIcon(job.client?.sprite || 'box', 64) }), h('div', {}, h('h3', {}, job.title), h('div', { class: 'muted' }, job.client?.name), h('p', {}, job.brief))));
  if (r) {
    const t = h('table', { class: 'reqtable' });
    const row = (k, v) => t.append(h('tr', {}, h('td', {}, k), h('td', {}, v)));
    row('Traffic', `${num(r.rps)} req/s baseline${r.peak > 1 ? `, peaks ${r.peak}×` : ''}`);
    row('Users', Object.entries(r.geo || { NA: 1 }).map(([g, v]) => `${g} ${Math.round(v * 100)}%`).join(' · '));
    row('Mix', `${Math.round((r.static || 0) * 100)}% static · reads ${Math.round((r.read ?? 0.8) * 100)}% of dynamic${r.async ? ` · ${Math.round(r.async * 100)}% async writes` : ''}`);
    row('SLA', `${r.availability}% availability · p95 < ${r.latency} ms`);
    if (r.rto) row('DR', `RTO ≤ ${r.rto} min · RPO ≤ ${r.rpo} min`);
    if (r.regionsMin > 1) row('Regions', `at least ${r.regionsMin}`);
    row('Contract period', `${r.days} days (you simulate the critical 8 hours)`);
    if ((r.needs || []).length) row('Must support', r.needs.map(n => NEEDS[n]).join('; '));
    if ((r.compliance || []).length) row('Compliance', r.compliance.map(c => COMPLIANCE[c]?.label).join(', ') + (job.regulated ? ' — REGULATED: any miss voids payment' : ''));
    row('Threat level', ['Low', 'Moderate', 'High', 'Extreme'][r.threat || 0]);
    if (job.budget && job.mode !== 'signal') row('Infra budget', `${money(job.budget)} over the contract (you pay it)`);
    if (job.mode === 'cost') row('Current bill', `${money(job.presetCost)} — cut it below ${money(job.budget)}`);
    body.append(t);
    if (job.hint) body.append(h('p', { class: 'hint' }, '💡 ', job.hint));
  }
  const pay = job.mode === 'signal' ? 'Pay: donations scale with viewers you keep online.' : `Pay: ${money(job.pay)} (30% upfront at deploy) · ${job.workDays || 1} days of work · ${job.xp} XP`;
  body.append(h('p', { class: 'muted' }, pay));
  const missingSkills = (job.requireSkills || []).filter(s => !S.skills.includes(s));
  const m = modal(h('div', {}, body, h('div', { class: 'row end gap' },
    h('button', { class: 'btn help-button', onclick: () => App.panels.phone({ job }) }, 'Ask a friend'),
    h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Not now'),
    missingSkills.length ? h('span', { class: 'bad' }, 'Needs skill: ' + missingSkills.join(', ')) :
      h('button', { class: 'btn', onclick: () => { if (acceptJob(job)) { m.close(); closeDesk?.(); } } }, job.type === 'build' ? 'Accept & design ▸' : 'Start ▸'))), { title: job.story ? '★ Story contract' : 'Contract', wide: true });
}

export function acceptJob(job) {
  const urgent = workBreak(S.life);
  if (urgent) {
    sfx('ui_error');
    toast(`Take a break first. ${urgent.action}.`, 'warn');
    return false;
  }
  sfx('job_accept');
  if (job.type === 'build') show('build', job);
  else App.labs.start(job);
  return true;
}
App.labs = { start: () => toast('Labs not loaded') };

on('levelup', ups => { for (const u of ups) toast(`${icon('star', 20)} <b>LEVEL ${u.level}</b> · +${u.sp} skill point${u.sp > 1 ? 's' : ''}`, 'good', 4500); renderNav(); });
on('state', () => renderHUD());
on('money', () => renderHUD());
export { esc, confirmBox, save };
