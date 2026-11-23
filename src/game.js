// Game flow: story progression, job board, grading and payouts.
import { S, save, earn, spend, gainXP, advanceDays, payMultiplier, home, HOMES, creditLimit } from './core/state.js';
import { emit } from './core/events.js';
import { CHAPTERS, STORY_JOBS } from './data/story.js';
import { generateBoard, storyJob } from './data/jobs.js';
import { COMPLIANCE } from './sim/review.js';
import { analyze } from './sim/analyze.js';
import { HOME_SPAWN, moraleBonus, popularityBonus } from './data/life.js';
import { legacyProject } from './data/legacy.js';

export function chapter() { return CHAPTERS.find(c => c.n === S.chapter) || CHAPTERS[0]; }
export function step() { return chapter().steps[S.step] || null; }

export function gateMet(gate) {
  if (!gate) return true;
  if (gate.level && S.level < gate.level) return false;
  if (gate.cert && !S.certs.includes(gate.cert)) return false;
  if (gate.skills && !gate.skills.every(s => S.skills.includes(s))) return false;
  return true;
}

// The story job currently available (if its gate is met and not yet done)
export function currentStoryJob() {
  const st = step();
  if (!st?.job || S.flags['done_' + st.job]) return null;
  if (!gateMet(st.gate)) return null;
  return storyJob(st.job);
}

export function refreshBoard(force = false) {
  if (!force && S.board.length && S.boardDay === S.day) return;
  const n = 3 + (home().offers || 0);
  S.board = generateBoard(S, n);
  S.boardDay = S.day; S.boardRolls = (S.boardRolls || 0) + 1;
  emit('board');
}

export function waitDay() {
  const ev = advanceDays(1);
  refreshBoard(true);
  save();
  return ev;
}

// ───────────── grading ─────────────
export function gradeBuild(job, design, res) {
  const req = job.req;
  const ar = analyze(design);
  const lines = [];
  let score = 100;
  const cost = job.mode === 'cost';
  const signal = job.mode === 'signal';
  // availability
  const target = req.availability;
  const availOK = res.availability >= target - 1e-9;
  if (!availOK) {
    const nines = Math.log10(Math.max(1e-6, 100 - res.availability) / Math.max(1e-6, 100 - target));
    const pen = Math.min(55, 15 + nines * 30);
    score -= pen; lines.push({ key: 'availability', ok: false, text: `Availability ${res.availability.toFixed(3)}% (target ${target}%)`, pen });
  } else lines.push({ ok: true, text: `Availability ${res.availability.toFixed(3)}% (target ${target}%)` });
  // latency
  if (res.p95 > req.latency) { const pen = Math.min(25, (res.p95 / req.latency - 1) * 40 + 5); score -= pen; lines.push({ key: 'latency', ok: false, text: `p95 latency ${Math.round(res.p95)} ms (target < ${req.latency} ms)`, pen }); }
  else lines.push({ ok: true, text: `p95 latency ${Math.round(res.p95)} ms (target < ${req.latency} ms)` });
  // RTO/RPO
  const regionEvent = (req.incidents || []).some(i => ['region_outage', 'provider_ban', 'legal_takedown'].includes(i.type));
  if (req.rto && regionEvent) {
    const ok = res.rto != null && res.rto <= req.rto;
    if (!ok) { score -= 15; lines.push({ key: 'rto', ok: false, text: `RTO ${res.rto == null ? 'never recovered' : res.rto + ' min'} (target ≤ ${req.rto} min)`, pen: 15 }); }
    else lines.push({ ok: true, text: `RTO ${res.rto} min (target ≤ ${req.rto} min)` });
  }
  if (req.rpo && regionEvent) {
    const ok = res.rpo <= req.rpo;
    const rpoTxt = res.rpo >= 1e8 ? 'all data in lost region' : res.rpo < 1 ? '< 1 min' : Math.round(res.rpo) + ' min';
    if (!ok) { score -= 15; lines.push({ key: 'rpo', ok: false, text: `RPO ${rpoTxt} (target ≤ ${req.rpo} min)`, pen: 15 }); }
    else lines.push({ ok: true, text: `RPO ${rpoTxt} (target ≤ ${req.rpo} min)` });
  }
  // breaches
  for (const b of res.breaches) { const pen = 25 + 20 * b.severity; score -= pen; lines.push({ key: 'breach', ok: false, text: `Breach: ${b.text}`, pen }); }
  // compliance
  const missing = (req.compliance || []).filter(c => COMPLIANCE[c] && !COMPLIANCE[c].check(ar));
  for (const c of missing) { score -= 10; lines.push({ key: 'compliance', ok: false, text: `Compliance missing: ${COMPLIANCE[c].label}`, pen: 10 }); }
  if ((req.regionsMin || 1) > ar.regionsUsed.length) { score -= 20; lines.push({ key: 'regions', ok: false, text: `Required ${req.regionsMin || 1}+ region${(req.regionsMin || 1) > 1 ? 's' : ''} with resources, used ${ar.regionsUsed.length}`, pen: 20 }); }
  // cost
  if (job.budget && !signal) {
    const ratio = res.cost / job.budget;
    const w = cost ? 70 : 40;
    if (ratio > 1) { const pen = Math.min(w, (ratio - 1) * w + (cost ? 15 : 3)); score -= pen; lines.push({ key: 'cost', ok: false, text: `Infra cost ${fmt(res.cost)} vs budget ${fmt(job.budget)}`, pen }); }
    else { if (ratio < 0.7) score += 5; lines.push({ ok: true, text: `Infra cost ${fmt(res.cost)} within budget ${fmt(job.budget)}` }); }
  }
  if (res.suspended) { score = 0; lines.push({ key: 'suspended', ok: false, text: 'Account suspended for non-payment — the service went dark.', pen: 100 }); }
  let grade = score >= 95 ? 'S' : score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'F';
  if ((job.regulated || job.req.regulated) && (missing.length || res.breaches.length) && grade !== 'F') { grade = 'F'; lines.push({ key: 'regulated', ok: false, text: 'Regulated client: compliance failures or breaches void the contract.' }); }
  return { score: Math.max(0, Math.round(score)), grade, lines, missing };
}
const fmt = n => '$' + Math.round(n).toLocaleString();

const GRADE_PAY = { S: 1.15, A: 1.0, B: 0.85, C: 0.6, F: 0 };
const GRADE_XP = { S: 1.3, A: 1.1, B: 1.0, C: 0.8, F: 0.4 };

// Called when a build/run finishes. `upfront` was already paid at deploy.
export function settleBuild(job, design, res, sim) {
  const g = gradeBuild(job, design, res);
  const out = { ...g, rows: [] };
  if (job.mode === 'signal') {
    const servedAvg = sim.totals.served / Math.max(1, sim.T);
    const donations = Math.round(servedAvg * (job.donationsPerRpsServed || 1) * (job.req.days || 7));
    out.rows.push(['Supporter donations', donations]);
    earn(donations, 'Donations');
    S.notoriety = (S.notoriety || 0) + Math.round(res.windowAvail / 10) + (g.grade === 'S' ? 5 : 0);
    out.net = donations;
  } else {
    const ratedPay = job.pay * GRADE_PAY[g.grade] * (job.mode === 'cost' && S.skills.includes('cost_finops') ? 1.15 : 1);
    const gross = Math.round(ratedPay * payMultiplier(job.side));
    const fines = Math.round(res.breaches.reduce((a, b) => a + b.severity, 0) * job.pay * 0.3);
    const credits = res.availability < job.req.availability ? Math.round(job.pay * 0.15) : 0;
    const remaining = gross - job.upfront - fines - credits;
    const visibility = Math.round(ratedPay * popularityBonus(S.life));
    out.rows.push(['Contract value', job.pay], [`Grade ${g.grade} (×${GRADE_PAY[g.grade]}) + other bonuses`, gross - job.pay - visibility]);
    if (visibility) out.rows.push(['Online visibility', visibility]);
    out.rows.push(['Paid upfront at deploy', -job.upfront]);
    if (credits) out.rows.push(['SLA credits to client', -credits]);
    if (fines) out.rows.push(['Breach penalties', -fines]);
    out.rows.push(['Final payment', remaining]);
    if (remaining >= 0) earn(remaining, `Payment: ${job.title}`); else spend(-remaining, `Clawback: ${job.title}`);
    out.net = remaining + job.upfront - res.cost;
  }
  out.infra = res.cost;
  const xp = gainXP((job.xp || 100) * GRADE_XP[g.grade] * moraleBonus(S.life), job.domains || []);
  out.xp = xp.amt; out.levelUps = xp.ups;
  const repDelta = g.grade === 'F' ? -5 : g.grade === 'C' ? 0 : Math.round((job.rep || 2) * (g.grade === 'S' ? 1.5 : g.grade === 'A' ? 1 : 0.6)) - res.breaches.length * 3;
  if (!S.villain) S.rep = Math.max(0, S.rep + repDelta);
  out.rep = repDelta;
  S.stats.breaches += res.breaches.length; S.stats.jobs++; if (g.grade === 'F') S.stats.failed++;
  S.stats.infra += res.cost;
  finishJob(job, g.grade);
  return out;
}

export function settleLab(job, score) {
  const grade = score >= 0.95 ? 'S' : score >= 0.85 ? 'A' : score >= 0.7 ? 'B' : score >= 0.55 ? 'C' : 'F';
  const labBonus = S.gear.includes('laptop2') ? 1.1 : 1;
  const pay = Math.round((job.pay || 0) * Math.max(0, score) * labBonus * payMultiplier(job.side));
  if (pay) earn(pay, `Lab: ${job.title}`);
  const xp = gainXP((job.xp || 100) * (0.4 + score) * moraleBonus(S.life), job.domains || []);
  if (!S.villain && grade !== 'F') S.rep += Math.round((job.rep || 1) * score);
  finishJob(job, grade);
  return { grade, pay, xp: xp.amt, levelUps: xp.ups };
}

function finishJob(job, grade) {
  const days = Math.max(1, (job.workDays || 1) - (S.gear.includes('coffee') ? 1 : 0));
  const ev = advanceDays(days);
  S.history.unshift({ title: job.title, grade, day: S.day, story: !!job.story });
  S.history = S.history.slice(0, 40);
  S.jobsDone++;
  S.board = S.board.filter(j => j.id !== job.id);
  S.active = null;
  if (job.story && grade !== 'F') { S.flags['done_' + job.id] = true; S.step++; S.stepSeen = S.step - 1; }
  refreshBoard(true);
  legacyProject(S, job, grade, ev);
  save();
  emit('rentEvents', ev);
}

// Steps with no job auto-advance once their gate is met (after dialogue).
export function tryAdvanceStory() {
  for (let guard = 0; guard < 10; guard++) {
    const ch = chapter(); const st = step();
    if (!st) {
      const next = CHAPTERS.find(c => c.n === S.chapter + 1);
      if (!next) return null;
      S.chapter++; S.step = 0; S.stepSeen = -1; refreshBoard(true); save();
      return { type: 'chapter', chapter: next };
    }
    if (S.stepSeen < S.step) { S.stepSeen = S.step; save(); return { type: 'lines', step: st, chapter: ch }; }
    if (st.job) return null; // waiting on job
    if (!gateMet(st.gate)) return null;
    // lines-only step done
    if (st.effect) { const e = applyEffect(st.effect); S.step++; save(); if (e) return e; continue; }
    S.step++; save();
  }
  return null;
}

function applyEffect(effect) {
  if (effect === 'layoff') {
    S.flags.laidOff = true;
    const severance = Math.round(Math.max(20000, S.level * 3000));
    earn(severance, 'Severance (2 weeks)');
    S.gear = S.gear.filter(g => g !== 'agency');
    return { type: 'toast', html: `Laid off. Severance: <b>$${severance.toLocaleString()}</b>. The job board will be grim.` };
  }
  if (effect === 'villain') { S.villain = true; refreshBoard(true); return { type: 'villain' }; }
  if (effect === 'ending') return { type: 'ending' };
  return null;
}

export function startOfJob(job) {
  // upfront payment (30%) so you can afford infrastructure
  job.upfront = job.mode === 'signal' ? 0 : Math.round((job.pay || 0) * 0.3);
  if (job.upfront) earn(job.upfront, `Upfront: ${job.title}`);
  S.active = { id: job.id };
  save();
}

// Walk away from a deployed contract: hand back the upfront and take the hit.
export function abandonJob(job) {
  const upfront = S.active?.upfront ?? job.upfront ?? 0;
  if (upfront) spend(upfront, `Refund: ${job.title}`);
  if (!S.villain) S.rep = Math.max(0, S.rep - 3);
  S.stats.failed++;
  S.history.unshift({ title: job.title, grade: 'F', day: S.day, story: !!job.story, abandoned: true });
  S.history = S.history.slice(0, 40);
  if (!job.story) S.board = S.board.filter(j => j.id !== job.id);
  S.active = null;
  save();
}

export function isBroke() { return S.money < -creditLimit(); }
export function bankruptcyBailout() {
  // Mara lends you money once per chapter; otherwise you move to the couch.
  const key = 'bailout_' + S.chapter;
  if (!S.flags[key]) { S.flags[key] = true; const amt = Math.max(1500, -S.money + 1000); earn(amt, 'Loan from Mara'); return { kind: 'loan', amt }; }
  S.home = 'couch'; S.money = 200; S.rep = Math.max(0, S.rep - 10);
  Object.assign(S.life.position, HOME_SPAWN);
  return { kind: 'evicted' };
}
export function homePrice(property) {
  return S.life.legacy.properties.includes(property.id) ? 0 : (property.cost || 0);
}
export function canMoveHome(property) {
  const price = homePrice(property);
  return price ? S.money >= price : S.money >= -creditLimit(property);
}
export function moveHome(id) {
  const property = HOMES.find(option => option.id === id);
  if (!property || id === S.home || !canMoveHome(property)) return false;
  const price = homePrice(property);
  if (price) {
    spend(price, `Bought ${property.name}`);
    S.life.legacy.properties.push(id);
  }
  S.home = id;
  Object.assign(S.life.position, HOME_SPAWN);
  refreshBoard(true);
  save();
  emit('state');
  return true;
}
export { STORY_JOBS };
