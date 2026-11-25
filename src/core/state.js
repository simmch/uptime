// Game state, economy, progression and persistence.
import { STARTER_SKILLS, SKILL } from '../data/skills.js';
import { DOMAIN_IDS } from '../data/domains.js';
import { emit } from './events.js';
import { freshLife, popularityBonus, restoreLife, useTime } from '../data/life.js';
import { legacyDay } from '../data/legacy.js';
import { fileSave, newerSave, unpackSave } from './save.js';

const SAVE_KEY = 'uptime_save_v1';
const BACKUP_DB = 'uptime';
const BACKUP_STORE = 'kv';

export const CERTS = {
  ccp: { name: 'Cloud Practitioner', short: 'CCP', fee: 100, lvl: 3, q: 10, diff: [1, 1], domains: null, pass: 0.7, sp: 1, payBonus: 0.05, eq: 'Azure AZ-900 · Google Cloud Digital Leader' },
  tfa: { name: 'Terraform Associate', short: 'TFA', fee: 70, lvl: 6, q: 8, diff: [1, 2], domains: ['ops'], tags: ['terraform', 'git'], pass: 0.7, sp: 1, payBonus: 0.03, needSkill: 'ops_terraform', eq: 'HashiCorp Certified: Terraform Associate' },
  saa: { name: 'Solutions Architect – Associate', short: 'SAA', fee: 150, lvl: 8, q: 15, diff: [1, 2], domains: null, pass: 0.72, sp: 2, payBonus: 0.1, eq: 'Azure AZ-305 · Google Professional Cloud Architect (partly)' },
  cka: { name: 'Kubernetes Administrator', short: 'CKA', fee: 395, lvl: 11, q: 10, diff: [1, 3], tags: ['k8s'], pass: 0.66, sp: 2, payBonus: 0.06, needSkill: 'k8s_basics', eq: 'CNCF CKA (vendor-neutral)' },
  scs: { name: 'Security – Specialty', short: 'SCS', fee: 300, lvl: 14, q: 12, diff: [2, 3], domains: ['sec'], pass: 0.75, sp: 2, payBonus: 0.08, eq: 'Azure AZ-500 · Google Professional Cloud Security Engineer' },
  sap: { name: 'Solutions Architect – Professional', short: 'SAP', fee: 300, lvl: 16, q: 20, diff: [2, 3], domains: null, pass: 0.75, sp: 3, payBonus: 0.15, eq: 'Azure AZ-305 + design depth · Google Professional Cloud Architect' },
  dop: { name: 'DevOps Engineer – Professional', short: 'DOP', fee: 300, lvl: 18, q: 12, diff: [2, 3], domains: ['ops', 'ha'], pass: 0.75, sp: 2, payBonus: 0.08, eq: 'Azure AZ-400 · Google Professional Cloud DevOps Engineer' },
  principal: { name: 'Principal Engineer Review Board', short: 'PRB', fee: 0, lvl: 24, q: 16, diff: [3, 3], domains: null, pass: 0.8, sp: 4, payBonus: 0.2, eq: 'Not a certificate — a promotion committee. Breadth, depth, judgment.' },
};

export const HOMES = [
  { id: 'couch', name: 'Friend\'s couch', rent: 120, perk: 'No perks. At least it\'s free-ish.', offers: 0 },
  { id: 'studio', name: 'Studio apartment', rent: 300, cost: 600, perk: '+1 job offer on the board.', offers: 1 },
  { id: 'apartment', name: 'One-bedroom with a home office', rent: 650, cost: 3000, perk: '+1 job offer, +5% XP.', offers: 2, xp: 0.05 },
  { id: 'condo', name: 'Downtown condo', rent: 1600, cost: 25000, perk: '+2 job offers, +10% XP, +$5k credit line.', offers: 3, xp: 0.1, credit: 5000 },
  { id: 'house', name: 'House with a server closet', rent: 4200, cost: 180000, perk: '+3 offers, +15% XP, +$50k credit line.', offers: 4, xp: 0.15, credit: 50000 },
  { id: 'penthouse', name: 'Penthouse', rent: 15000, cost: 900000, perk: '+4 offers, +20% XP, +$400k credit line.', offers: 5, xp: 0.2, credit: 400000 },
];

export const GEAR = [
  { id: 'laptop2', name: 'Refurbished ThinkPad', cost: 450, desc: 'Labs pay +10%.', sprite: 'laptop' },
  { id: 'monitor', name: 'Second monitor', cost: 300, desc: 'Run speed up to 8×.', sprite: 'tv' },
  { id: 'chair', name: 'Ergonomic chair', cost: 700, desc: '+5% XP from everything.', sprite: 'officechair' },
  { id: 'coffee', name: 'Espresso machine', cost: 900, desc: 'Work days on jobs −1 (min 1).', sprite: 'coffee' },
  { id: 'card', name: 'Business credit card', cost: 0, desc: '+$2,500 credit line. 2%/week interest on negative balance.', sprite: 'wallet', credit: 2500 },
  { id: 'homelab', name: 'Homelab server rack', cost: 4000, desc: 'Practice: +10% domain XP.', sprite: 'server' },
  { id: 'llc', name: 'Form an LLC', cost: 1500, desc: 'Clients trust you: +8% pay on side jobs.', sprite: 'notice' },
  { id: 'agency', name: 'Hire a junior engineer', cost: 30000, desc: 'Earn passive $ each week from small gigs (≈$1,500/wk). Salary included.', sprite: 'user', lvl: 12 },
  { id: 'botfarm', name: 'Supporter network', cost: 50000, desc: 'Villain only: passive donations ≈$6,000/wk.', sprite: 'antenna', villain: true },
];

export const TITLES = [
  [1, 'Freelance Tinkerer'], [3, 'Junior Cloud Engineer'], [6, 'Cloud Engineer'],
  [10, 'Solutions Architect – Associate', 'saa'], [14, 'Senior Cloud Engineer'],
  [18, 'Solutions Architect – Professional', 'sap'], [22, 'Staff Engineer'],
  [26, 'Principal Engineer', 'principal'], [32, 'Distinguished Engineer', 'principal'],
];

// Early levels are cheap so a brand-new player can unlock load balancers, auto
// scaling and the other basics within the first few jobs and Codex tests. The
// discount fades out by level 12, where the original curve takes over.
export function xpForLevel(l) {
  if (l <= 1) return 0;
  const discount = Math.min(1, 0.3 + 0.07 * (l - 2));
  return Math.round((100 * Math.pow(l, 1.9) - 100) * discount);
}

export function newState(name = 'Chris') {
  return {
    v: 1, name, money: 1200, day: 1, xp: 0, level: 1, sp: 1, rep: 0,
    skills: [...STARTER_SKILLS], certs: [], chapter: 1, step: 0, stepSeen: -1,
    flags: {}, villain: false, ending: null,
    jobsDone: 0, history: [], codexRead: [], codexTests: {}, domainXP: Object.fromEntries(DOMAIN_IDS.map(d => [d, 0])),
    home: 'couch', gear: [], blueprints: [],
    board: [], boardDay: 0, boardRolls: 0, active: null,
    stats: { earned: 0, spent: 0, infra: 0, breaches: 0, incidents: 0, jobs: 0, failed: 0 },
    notoriety: 0, settings: { speed: 1, sound: true },
    life: freshLife(),
    created: Date.now(),
  };
}

export let S = null;
export function setState(s) {
  s.life = restoreLife(s.life);
  s.codexTests ||= {};
  // Older saves were levelled on a steeper curve: apply any levels they're now owed.
  while (s.xp >= xpForLevel(s.level + 1)) { s.level++; s.sp += 1 + (s.level % 5 === 0 ? 1 : 0); }
  const properties = s.life.legacy.properties;
  if (s.home !== 'couch' && HOMES.some(option => option.id === s.home) && !properties.includes(s.home)) properties.push(s.home);
  S = s;
  emit('state');
}

let backupChain = Promise.resolve();
let databasePromise = null;

function readLocal() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? unpackSave(raw) : null;
  } catch { return null; }
}

function database() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('indexedDB unavailable'));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(BACKUP_DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(BACKUP_STORE)) req.result.createObjectStore(BACKUP_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { databasePromise = null; reject(req.error); };
    });
  }
  return databasePromise;
}

// A second copy. localStorage is what the title screen reads, and some browsers
// drop it when the site has cached a lot of music. The backup brings it back.
function writeBackup(json) {
  backupChain = backupChain.then(async () => {
    const db = await database();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(BACKUP_STORE, 'readwrite');
      const store = tx.objectStore(BACKUP_STORE);
      if (json == null) store.delete(SAVE_KEY);
      else store.put(json, SAVE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }).catch(() => {});
  return backupChain;
}

async function readBackup() {
  await backupChain;
  const db = await database();
  const json = await new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, 'readonly');
    const req = tx.objectStore(BACKUP_STORE).get(SAVE_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
  return json ? unpackSave(json) : null;
}

// Progress lives in memory until an account stores it. save() stamps the
// moment and lets a signed-in session copy it to the account.
export function save({ remote = true } = {}) {
  if (!S) return false;
  S.savedAt = Date.now();
  if (remote) emit('saved');
  return true;
}

export function load() { return readLocal(); }

export function clearState() { S = null; }

// Drop any game left on this device. Returns it once so a current visit can
// still offer to put that game on an account.
export async function discardLocal() {
  const local = readLocal();
  let backup = null;
  try { backup = await readBackup(); } catch { /* storage unavailable */ }
  const best = newerSave(local, backup);
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  await writeBackup(null);
  return best;
}

export function wipe() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  return writeBackup(null);
}
export function exportSave() { return btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }
export function saveFile() { return fileSave(S); }
export function importSave(str) {
  const next = unpackSave(str);
  if (!next) throw new Error('Invalid save');
  setState(next);
  return save();
}

// ───────────── economy ─────────────
export function home() { return HOMES.find(h => h.id === S.home) || HOMES[0]; }
export function creditLimit(property = home()) {
  let c = property.credit || 0;
  for (const g of S.gear) c += GEAR.find(x => x.id === g)?.credit || 0;
  return c;
}
export function canSpend(amt) { return S.money - amt >= -creditLimit(); }
export function spend(amt, reason) {
  S.money -= amt; S.stats.spent += amt;
  emit('money', { delta: -amt, reason });
}
export function earn(amt, reason) {
  S.money += amt; S.stats.earned += Math.max(0, amt);
  emit('money', { delta: amt, reason });
}
export function payMultiplier(side) {
  let m = 1;
  for (const c of S.certs) m += CERTS[c]?.payBonus || 0;
  m += Math.min(0.5, S.rep / 200);
  m += popularityBonus(S.life);
  if (side && S.gear.includes('llc')) m += 0.08;
  return m;
}
export function xpMultiplier() {
  let m = 1 + (home().xp || 0);
  if (S.gear.includes('chair')) m += 0.05;
  return m;
}

// Advance the calendar, charging rent each 7 days. Returns events.
export function advanceDays(n, { wearNeeds = true } = {}) {
  const events = [];
  if (wearNeeds) useTime(S.life, n * 112);
  for (let i = 0; i < n; i++) {
    S.day++;
    if (S.day % 7 === 1) {
      const rent = home().rent;
      spend(rent, 'Rent');
      events.push({ type: 'rent', amount: rent, owned: S.home !== 'couch' });
      if (S.money < 0 && S.gear.includes('card')) { const interest = Math.round(-S.money * 0.02); spend(interest, 'Credit card interest'); events.push({ type: 'interest', amount: interest }); }
      if (S.gear.includes('agency') && !S.villain) { earn(1500, 'Junior engineer gigs'); events.push({ type: 'passive', amount: 1500 }); }
      if (S.gear.includes('botfarm') && S.villain) { earn(6000, 'Supporter donations'); events.push({ type: 'passive', amount: 6000 }); }
      if (S.money < -creditLimit()) events.push({ type: 'broke' });
    }
    legacyDay(S, events);
  }
  S.board = S.board.filter(j => !j.expires || j.expires >= S.day);
  emit('state');
  return events;
}

// ───────────── xp & levels ─────────────
export function gainXP(amount, domains = []) {
  const amt = Math.round(amount * xpMultiplier());
  S.xp += amt;
  const per = domains.length ? amt / domains.length : 0;
  const homelab = S.gear.includes('homelab') ? 1.1 : 1;
  for (const d of domains) S.domainXP[d] = (S.domainXP[d] || 0) + Math.round(per * homelab);
  const ups = [];
  while (S.xp >= xpForLevel(S.level + 1)) {
    S.level++;
    const sp = 1 + (S.level % 5 === 0 ? 1 : 0);
    S.sp += sp;
    ups.push({ level: S.level, sp });
  }
  if (ups.length) emit('levelup', ups);
  emit('state');
  return { amt, ups };
}

export function title() {
  let t = TITLES[0][1];
  for (const [lvl, name, cert] of TITLES) if (S.level >= lvl && (!cert || S.certs.includes(cert))) t = name;
  if (S.villain) t = S.notoriety > 50 ? 'Architect of the Signal' : 'Rogue Architect';
  return t;
}

// ───────────── skills ─────────────
export function skillState(id) {
  const s = SKILL[id];
  if (S.skills.includes(id)) return 'owned';
  if (s.story === 'villain' && !S.villain) return 'locked-story';
  if (s.lvl > S.level) return 'locked-level';
  if (!s.req.every(r => S.skills.includes(r))) return 'locked-req';
  if (S.sp < s.sp) return 'no-sp';
  if (!canSpend(s.price)) return 'no-money';
  return 'available';
}
export function learnSkill(id) {
  const s = SKILL[id];
  if (skillState(id) !== 'available') return false;
  S.sp -= s.sp; spend(s.price, `Course: ${s.name}`);
  S.skills.push(id);
  gainXP(30 + s.tier * 20, [s.domain]);
  emit('skill', id); save();
  return true;
}

export function domainLevel(d) { return Math.floor(Math.sqrt((S.domainXP[d] || 0) / 60)); }
