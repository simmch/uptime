// Side-job generator, pay estimation, and preset designs.
import { COMPONENT, defaultConfig, SIZES, SIZE_ORDER, DB_SIZES, DB_ORDER } from './components.js';
import { STORY_JOBS, CHARS } from './story.js';
import { estimate } from '../sim/review.js';
import { mulberry32, pick, randInt } from '../sim/rng.js';

let uidc = 0;
export const newUid = () => 'n' + Date.now().toString(36).slice(-4) + (++uidc).toString(36);
export const mkNode = (id, region = null, az = null, cfg = {}) => ({ uid: newUid(), id, region, az, cfg: { ...defaultConfig(COMPONENT[id]), ...cfg } });

const LABOR = [250, 2500, 15000, 80000, 120000];

const PRIMARY = { NA: 'us-east-1', EU: 'eu-west-1', APAC: 'ap-southeast-1', SA: 'sa-east-1' };
const SECOND = { NA: 'us-west-2', EU: 'eu-central-1', APAC: 'ap-northeast-1', SA: 'us-east-1' };

// A sensible reference architecture used to price contracts.
export function referenceDesign(req) {
  const geos = Object.entries(req.geo || { NA: 1 }).sort((a, b) => b[1] - a[1]).map(g => g[0]);
  let primary = PRIMARY[geos[0]];
  if (req.compliance?.includes('residencyEU')) primary = 'eu-west-1';
  const nReg = Math.max(req.regionsMin || 1, 1);
  const regions = [primary];
  for (const g of geos.slice(1)) if (regions.length < nReg && !regions.includes(PRIMARY[g])) regions.push(PRIMARY[g]);
  while (regions.length < nReg) regions.push(SECOND[geos[0]] && !regions.includes(SECOND[geos[0]]) ? SECOND[geos[0]] : ['us-west-2', 'eu-central-1', 'ap-northeast-1'].find(r => !regions.includes(r)));
  const nodes = [];
  const priv = req.compliance?.includes('private');
  const peak = req.rps * (req.peak || 1);
  const dyn = req.rps * (1 - (req.static || 0));
  const highAvail = (req.availability || 99) >= 99.9;
  for (const r of regions) {
    const share = 1 / regions.length;
    nodes.push(mkNode('vpc', r, null, { private: !!priv }));
    if (priv || req.needs?.includes('outbound') && priv) { nodes.push(mkNode('nat', r, 0)); if (highAvail) nodes.push(mkNode('nat', r, 1)); }
    if ((req.static || 0) < 1) {
      if (dyn * share * (req.peak || 1) < 60 && !highAvail) {
        nodes.push(mkNode('ec2', r, 0, { size: dyn < 15 ? 'micro' : 'medium', count: 1 }));
      } else {
        const size = dyn * share > 20000 ? '4xlarge' : dyn * share > 2000 ? 'xlarge' : 'large';
        const per = SIZES[size].cap * 0.6;
        nodes.push(mkNode('alb', r));
        nodes.push(mkNode('asg', r, null, { size, min: Math.max(2, Math.ceil(dyn * share * 0.7 / per)), max: Math.ceil(peak * share * 1.3 / per) + 2 }));
      }
      if (req.stateful !== false) {
        const writes = dyn * share * (1 - (req.read ?? 0.8)) * (req.peak || 1);
        const dbSize = DB_ORDER.find(s => DB_SIZES[s].w > writes * 1.3) || '16xlarge';
        if (regions.length > 1) { if (r === primary) nodes.push(mkNode('aurora', r, null, { size: dbSize === 'small' ? 'large' : dbSize, replicas: 1, global: true })); }
        else nodes.push(mkNode('rds', r, 0, { size: dbSize, multiAZ: highAvail }));
      }
      if (dyn * share > 400) nodes.push(mkNode('elasticache', r, null, { nodes: highAvail ? 2 : 1 }));
      if ((req.async || 0) > 0.15) nodes.push(mkNode('sqs', r));
    }
    if ((req.static || 0) > 0.2) nodes.push(mkNode('s3', r));
    for (const n of req.needs || []) {
      const m = { sharedFiles: 'efs', windowsFiles: 'fsx', fanout: 'sns', events: 'eventbridge', stream: 'kinesis', workflow: 'stepfn', analytics: 'redshift' }[n];
      if (m && r === primary) nodes.push(mkNode(m, r));
      if (n === 'hybrid' && r === primary) nodes.push(mkNode('vpn', r));
    }
  }
  if ((req.static || 0) > 0.3 || regions.length > 1) nodes.push(mkNode('cloudfront'));
  nodes.push(mkNode('route53', null, null, { policy: regions.length > 1 ? 'latency' : 'simple', health: regions.length > 1 }));
  nodes.push(mkNode('cloudwatch'));
  if ((req.threat || 0) >= 1 && req.tier >= 1) nodes.push(mkNode('waf'));
  const compMap = { encryptAtRest: 'kms', encryptInTransit: 'acm', audit: 'cloudtrail', leastPriv: 'iam', secrets: 'secrets', threatDetect: 'guardduty', backup: 'backup', multiAccount: 'orgs', waf: 'waf', iac: 'terraform', cicd: 'cicd', monitoring: 'cloudwatch' };
  for (const c of req.compliance || []) { const id = compMap[c]; if (id && !nodes.some(n => n.id === id)) nodes.push(mkNode(id)); }
  return { regions, nodes };
}

export function priceJob(job, ctx = {}) {
  const ref = referenceDesign(job.req);
  const est = estimate(ref, job, ['ha_quotas']);
  const tier = job.req.tier || 0;
  const labor = LABOR[tier] * (0.8 + (job.seed % 100) / 250);
  job.refCost = Math.round(est.total);
  job.budget = Math.round(est.total * (job.req.budgetFactor || 1.6));
  if (!job.pay) job.pay = Math.round((est.total * 2.0 + labor) / 10) * 10;
  return job;
}

// ───────────── side job templates ─────────────
const T0 = [
  { client: 'Smile Dental', sprite: 'hospital', title: 'Appointment booking for a dentist', req: { rps: [5, 20], static: 0.6, read: 0.8, availability: 99, latency: 600 }, domains: ['compute', 'data'] },
  { client: 'Lotus Yoga', sprite: 'plant', title: 'Class schedule & sign-ups', req: { rps: [5, 25], peak: 3, static: 0.5, read: 0.75, availability: 99, latency: 600 }, domains: ['compute'] },
  { client: 'The Daily Acorn', sprite: 'notebook', title: 'Local news site', req: { rps: [30, 120], peak: 4, static: 0.85, read: 0.95, availability: 99, latency: 400, stateful: true }, domains: ['net', 'data'], skill: 'net_cdn' },
  { client: 'Mo\'s Pizza', sprite: 'cake', title: 'Friday night ordering', req: { rps: [20, 80], peak: 6, peakAt: 0.75, static: 0.4, read: 0.6, availability: 99.5, latency: 500 }, domains: ['compute', 'cost'], skill: 'compute_asg' },
  { client: 'Lens & Light Photo', sprite: 'tv', title: 'Photo gallery with archive', req: { rps: [5, 30], static: 0.9, read: 0.95, availability: 99, latency: 800, dataGB: 500, archiveGB: 5000 }, domains: ['data', 'cost'], skill: 'data_s3' },
  { client: 'HackNight Crew', sprite: 'laptop', title: 'Hackathon judging app (spiky)', req: { rps: [10, 40], peak: 10, peakAt: 0.8, peakWidth: 0.04, static: 0.2, read: 0.6, availability: 99, latency: 600 }, domains: ['compute'], skill: 'compute_serverless' },
  { client: 'Grandma\'s Etsy', sprite: 'shop', title: 'Handmade goods storefront', req: { rps: [8, 40], peak: 2, static: 0.7, read: 0.85, availability: 99, latency: 500, threat: 1 }, domains: ['compute', 'sec'] },
  { client: 'Podcast Pals', sprite: 'radio', title: 'Podcast feed & downloads', req: { rps: [20, 90], peak: 3, static: 0.95, read: 0.98, availability: 99, latency: 500, dataGB: 300, stateful: false }, domains: ['net', 'data'], skill: 'net_cdn' },
];
const T1 = [
  { client: 'PipeCRM', sprite: 'notice', title: 'B2B SaaS CRM', req: { rps: [300, 1500], static: 0.25, read: 0.75, async: 0.2, availability: 99.9, latency: 300, threat: 1 }, domains: ['compute', 'data'] },
  { client: 'QuizRush', sprite: 'book', title: 'Edtech: finals-week surge', req: { rps: [400, 2000], peak: 6, static: 0.3, read: 0.7, availability: 99.9, latency: 300, threat: 1 }, domains: ['compute', 'cost'] },
  { client: 'Scribe AI', sprite: 'lightbulb', title: 'AI meeting notes (heavy async)', req: { rps: [200, 900], static: 0.1, read: 0.5, async: 0.7, availability: 99.5, latency: 400, needs: ['outbound'] }, domains: ['compute'], skill: 'compute_queues' },
  { client: 'GoRide', sprite: 'trucks', title: 'Ride-share MVP across 2 continents', req: { rps: [500, 2500], static: 0.15, read: 0.6, async: 0.3, availability: 99.9, latency: 260, geo: { NA: 0.6, EU: 0.4 }, threat: 1 }, domains: ['net', 'ha'] },
  { client: 'CoinNest', sprite: 'wallet', title: 'Crypto wallet backend', req: { rps: [300, 1200], static: 0.1, read: 0.6, availability: 99.9, latency: 300, threat: 2, compliance: ['encryptAtRest', 'secrets', 'leastPriv', 'audit'] }, domains: ['sec'], regulated: true, skill: 'sec_secrets' },
  { client: 'FanBet', sprite: 'gamepad', title: 'Live sports odds (game-time spike)', req: { rps: [600, 3000], peak: 7, peakAt: 0.6, static: 0.2, read: 0.85, availability: 99.9, latency: 200, threat: 2 }, domains: ['compute', 'sec'] },
  { client: 'Recipely', sprite: 'coffee', title: 'Recipe social network', req: { rps: [400, 2000], static: 0.6, read: 0.9, availability: 99.5, latency: 300, needs: ['fanout'] }, domains: ['net', 'compute'], skill: 'compute_queues' },
  { client: 'ShipShape', sprite: 'box', title: 'Containerized logistics API', req: { rps: [500, 2000], static: 0.1, read: 0.7, async: 0.3, availability: 99.9, latency: 250, needs: ['containers'] }, domains: ['compute'], skill: 'compute_containers' },
];
const T2 = [
  { client: 'Bulwark Insurance', sprite: 'castle', title: 'Claims portal (regulated)', req: { rps: [3000, 9000], static: 0.2, read: 0.7, async: 0.4, availability: 99.95, latency: 300, threat: 2, compliance: ['encryptAtRest', 'encryptInTransit', 'audit', 'private', 'backup'], needs: ['workflow'] }, domains: ['sec', 'compute'], regulated: true },
  { client: 'MegaMart', sprite: 'cart', title: 'Store inventory with on-prem POS', req: { rps: [5000, 15000], static: 0.2, read: 0.7, async: 0.3, availability: 99.9, latency: 250, needs: ['hybrid', 'analytics'] }, domains: ['mig', 'data'], skill: 'net_hybrid' },
  { client: 'SkyWays Air', sprite: 'rocket', title: 'Airline check-in (holiday surge)', req: { rps: [4000, 12000], peak: 3, static: 0.3, read: 0.8, availability: 99.95, latency: 250, threat: 2 }, domains: ['ha', 'compute'] },
  { client: 'Banque Lumière', sprite: 'bank', title: 'EU bank (data residency)', req: { rps: [3000, 10000], static: 0.15, read: 0.75, availability: 99.95, latency: 250, geo: { EU: 1 }, threat: 2, compliance: ['residencyEU', 'encryptAtRest', 'encryptInTransit', 'audit', 'private', 'threatDetect'] }, domains: ['sec', 'ha'], regulated: true },
  { client: 'State University', sprite: 'book', title: 'Learning platform + file shares', req: { rps: [2000, 8000], peak: 2.5, static: 0.35, read: 0.8, availability: 99.9, latency: 300, needs: ['sharedFiles'], compliance: ['sso'] }, domains: ['data', 'sec'], skill: 'data_files' },
  { client: 'Archivum Media', sprite: 'tv', title: 'Broadcast media archive', req: { rps: [2000, 6000], static: 0.8, read: 0.95, availability: 99.9, latency: 300, dataGB: 50000, archiveGB: 2000000 }, domains: ['data', 'cost'], skill: 'data_s3' },
];
const T3 = [
  { client: 'Axiom Maps', sprite: 'map', title: 'Global maps tiles', req: { rps: [60000, 150000], static: 0.8, read: 0.97, availability: 99.95, latency: 150, geo: { NA: 0.35, EU: 0.3, APAC: 0.3, SA: 0.05 }, regionsMin: 2 }, domains: ['net', 'cost'] },
  { client: 'Axiom Music', sprite: 'radio', title: 'Streaming catalog + plays', req: { rps: [80000, 200000], static: 0.5, read: 0.85, async: 0.4, availability: 99.95, latency: 200, geo: { NA: 0.4, EU: 0.35, APAC: 0.25 }, needs: ['stream'], regionsMin: 2 }, domains: ['compute', 'data'] },
  { client: 'Axiom Ride', sprite: 'trucks', title: 'Dispatch with active-active writes', req: { rps: [50000, 120000], static: 0.1, read: 0.6, async: 0.3, availability: 99.99, latency: 150, geo: { NA: 0.5, EU: 0.3, APAC: 0.2 }, regionsMin: 3, threat: 2 }, domains: ['ha', 'data'], skill: 'ha_global' },
];
const T4 = [
  { client: 'The Ledger Leaks', sprite: 'scroll', title: 'Mirror leaked documents', req: { rps: [20000, 80000], static: 0.9, read: 0.99, availability: 99.5, latency: 300, geo: { NA: 0.3, EU: 0.3, APAC: 0.3, SA: 0.1 }, threat: 3, randomIncidents: 2 }, domains: ['ha', 'net'] },
  { client: 'Free Radio Collective', sprite: 'antenna', title: 'Pirate radio relay', req: { rps: [30000, 120000], static: 0.85, read: 0.98, availability: 99.5, latency: 300, geo: { NA: 0.3, EU: 0.3, APAC: 0.3, SA: 0.1 }, threat: 3, incidents: [{ type: 'domain_seizure', at: 0.5, dur: 0.1 }] }, domains: ['net', 'ha'] },
  { client: 'Dropbox for Whistleblowers', sprite: 'lockbox', title: 'Secure anonymous drop box', req: { rps: [5000, 20000], static: 0.3, read: 0.5, availability: 99.9, latency: 400, threat: 3, compliance: ['encryptAtRest', 'encryptInTransit', 'private'] }, domains: ['sec'] },
];
const TEMPLATES = [T0, T1, T2, T3, T4];

const LAB_GIGS = [
  { type: 'netlab', title: 'Fix a broken VPC', sprite: 'router', skill: 'net_subnets', domains: ['net'], tier: 0 },
  { type: 'cidr', title: 'Subnet planning session', sprite: 'calendar', skill: 'net_subnets', domains: ['net'], tier: 0 },
  { type: 'audit', title: 'Security review', sprite: 'eye', skill: 'sec_waf', domains: ['sec'], tier: 1 },
  { type: 'iam', title: 'IAM permission puzzle', sprite: 'iam', skill: 'sec_iam_adv', domains: ['sec'], tier: 1 },
  { type: 'migration', title: 'Migration assessment', sprite: 'trucks', skill: 'mig_basics', domains: ['mig'], tier: 1 },
  { type: 'terminal', title: 'Pipeline & Git firefight', sprite: 'terminal', skill: 'ops_git', domains: ['ops'], tier: 0 },
  { type: 'terminal', title: 'Kubernetes on-call shift', sprite: 'k8s', skill: 'k8s_basics', domains: ['compute', 'ops'], tier: 1, k8s: true },
  { type: 'terminal', title: 'Terraform module review', sprite: 'terraform', skill: 'ops_terraform', domains: ['ops'], tier: 0, tf: true },
];

export function generateBoard(state, n = 4) {
  const rng = mulberry32((state.day * 7919 + state.jobsDone * 104729 + (state.boardRolls || 0) * 31) >>> 0);
  const tier = Math.min(4, state.villain ? 4 : Math.max(0, (state.chapter || 1) - 1));
  const offers = [];
  const skills = new Set(state.skills);
  const tiers = tier >= 4 ? [4, 4, 3] : tier === 0 ? [0] : [tier, tier, tier - 1];
  for (let i = 0; i < n; i++) {
    const tTier = tiers[i % tiers.length];
    const pool = TEMPLATES[tTier].filter(t => !t.skill || skills.has(t.skill));
    if (!pool.length) continue;
    const tpl = pick(rng, pool);
    offers.push(makeSideJob(tpl, tTier, rng, state));
  }
  // labs
  const labs = LAB_GIGS.filter(l => skills.has(l.skill) && l.tier <= Math.max(1, tier));
  for (let i = 0; i < Math.min(2, labs.length); i++) {
    const l = pick(rng, labs);
    if (offers.some(o => o.type === l.type && o.title === l.title)) continue;
    offers.push(makeLabJob(l, Math.max(tier, l.tier), rng, state));
  }
  return offers;
}

function rangeVal(rng, v) { return Array.isArray(v) ? Math.round(v[0] + rng() * (v[1] - v[0])) : v; }

function makeSideJob(tpl, tier, rng, state) {
  const seed = Math.floor(rng() * 1e9);
  const req = { geo: { NA: 1 }, days: 30, threat: tier >= 2 ? 1 : 0, tier, randomIncidents: tier === 0 ? 1 : 2, dataGB: 20, ...tpl.req };
  req.rps = rangeVal(rng, tpl.req.rps);
  req.peak = tpl.req.peak || +(1.2 + rng() * 1.3).toFixed(1);
  if (tier >= 1 && !tpl.req.geo && req.latency >= 250 && rng() < 0.35) req.geo = { NA: 0.6, EU: 0.4 };
  if (tier >= 2 && rng() < 0.3) req.incidents = [{ type: 'az_outage', at: 0.3 + rng() * 0.4, dur: 0.12 }];
  const job = {
    id: 'side_' + seed.toString(36), seed, type: 'build', side: true, tier,
    title: tpl.title, client: { name: tpl.client, sprite: tpl.sprite }, domains: tpl.domains, regulated: !!tpl.regulated,
    brief: `${tpl.client} needs: ${tpl.title.toLowerCase()}. ~${req.rps.toLocaleString()} req/s${req.peak > 2 ? `, peaks ${req.peak}×` : ''}. Target ${req.availability}% availability, p95 < ${req.latency} ms.`,
    req, workDays: [2, 4, 6, 8, 6][tier], xp: Math.round([90, 500, 1400, 3500, 5000][tier] * (0.8 + rng() * 0.4)), rep: [2, 3, 4, 5, 0][tier],
    expires: state.day + randInt(rng, 3, 7),
  };
  if (state.villain) job.donationsPerRpsServed = 0.8, job.villain = true;
  priceJob(job);
  if (state.chapter === 5 && !state.villain) { job.pay = Math.round(job.pay * 0.35); job.brief += ' (Autopilot underbid everyone. This is what\'s left.)'; }
  return job;
}

function makeLabJob(l, tier, rng, state) {
  const seed = Math.floor(rng() * 1e9);
  const pay = [300, 2500, 12000, 40000, 60000][tier] * (0.8 + rng() * 0.4);
  const job = { id: 'lab_' + seed.toString(36), seed, type: l.type, side: true, tier, title: l.title, client: { name: 'Contract gig', sprite: l.sprite },
    domains: l.domains, pay: Math.round(pay / 10) * 10, xp: [80, 350, 900, 2000, 2500][tier], rep: 1, workDays: 1, expires: state.day + 5,
    brief: { netlab: 'A client\'s network is broken. Diagnose and fix it without opening security holes.', cidr: 'Plan IP space for a new environment.', audit: 'Review a cloud account for misconfigurations.', iam: 'Explain how these permission requests resolve.', migration: 'Recommend migration strategies for an app portfolio.', terminal: 'Hands-on keyboard: fix it from the command line.' }[l.type] };
  if (l.type === 'terminal') job.challenges = l.k8s ? ['k8s_scale', 'k8s_rollback', 'k8s_debug'] : l.tf ? ['tf_basics', 'tf_drift'] : ['git_basics', 'git_hotfix', 'ci_secret'];
  if (l.type === 'audit') job.count = 8 + tier * 2;
  if (l.type === 'iam') job.count = 4 + tier;
  if (l.type === 'migration') job.portfolio = pick(rng, ['retail', 'hospital']);
  return job;
}

export function storyJob(id) {
  const s = STORY_JOBS[id];
  if (!s) return null;
  const c = CHARS[s.client];
  const job = { id, story: true, seed: hash(id), ...JSON.parse(JSON.stringify(s)), client: { name: c.title || c.name, sprite: c.sprite, char: s.client } };
  if (job.type === 'build') {
    job.req.tier ??= 0;
    const p = job.pay || 0; job.pay = 0; priceJob(job); job.pay = Math.max(p, job.pay);
    if (job.mode === 'cost' && job.preset) { job.presetDesign = PRESETS[job.preset](); const est = estimate(job.presetDesign, job, ['ha_quotas']); job.presetCost = Math.round(est.total); job.budget = Math.round(est.total * (job.req.budgetFactor || 0.55)); }
  }
  return job;
}
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export const PRESETS = {
  bloated_ads: () => ({
    regions: ['us-east-1', 'eu-west-1'],
    nodes: [
      mkNode('route53', null, null, { policy: 'latency', health: true }), mkNode('cloudwatch'),
      ...['us-east-1', 'eu-west-1'].flatMap(r => [
        mkNode('vpc', r, null, { private: true }), mkNode('nat', r, 0), mkNode('alb', r),
        mkNode('asg', r, null, { size: '4xlarge', min: 14, max: 30, target: 30 }),
        mkNode('rds', r, 0, { size: '16xlarge', multiAZ: true, replicas: 2 }),
        mkNode('s3', r, null, { class: 'standard' }),
      ]),
    ],
  }),
};
