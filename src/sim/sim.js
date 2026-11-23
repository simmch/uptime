// UPTIME traffic & failure simulator.
// One run = an 8-hour "critical window" (240 ticks × 2 minutes) of a contract.
// Costs per tick are extrapolated over the contract's days. Availability
// counts window error-minutes against the whole contract, plus the
// normal-hours error rate extrapolated over the rest of the contract.
import { COMPONENT, SIZES, DB_SIZES, CACHE_SIZES, PURCHASE } from '../data/components.js';
import { REGION, GEO_LATENCY, GEOS, PROVIDERS } from '../data/regions.js';
import { analyze, COMPUTE_KINDS, regionNodes, isEU } from './analyze.js';
import { INCIDENTS } from './incidents.js';
import { mulberry32, pick, randInt } from './rng.js';

export const TICKS = 240;
export const TICK_MIN = 2;

const qf = u => 1 / (1 - Math.min(Math.max(u, 0), 0.95));
const POD_RPS = 150, TASK_RPS_PER_VCPU = 150, APPRUNNER_RPS = 140;
const LAMBDA_DUR = { '128': 0.25, '512': 0.1, '1769': 0.05 };
const EGRESS_PER_RPS = 0.0622;      // $/day per rps of dynamic responses (~8KB @ $0.09/GB)
const STATIC_EGRESS_PER_RPS = 0.30; // $/day per rps of static assets (~40KB)

export function createSim(design, job, ctx = {}) {
  const ar = analyze(design);
  const req = job.req;
  const rng = mulberry32(job.seed || 1);
  const days = req.days || 30;
  const skills = new Set(ctx.skills || []);
  const sim = {
    ar, job, req, design, rng, t: 0, T: TICKS, days, done: false, suspended: false,
    regionDown: {}, azDown: {}, dnsUnhealthy: {}, regionErrStreak: {}, manualRegion: null,
    rt: {}, incidents: [], log: [], hist: { demand: [], served: [], errRate: [], p95: [], cost: [], attack: [], money: [] },
    totals: { legit: 0, served: 0, errMinWindow: 0, normalLegit: 0, normalServed: 0, cost: 0, costByCat: {}, breaches: [], dataLossMin: 0, rto: null, setup: 0 },
    attack: { l3: 0, l7: 0, smart: 0 },
    mods: { spikeMult: 1, computeErr: {}, dbReadPenalty: 1, featureErr: 0, blockUntil: -1, dnsDown: false, outboundDown: {}, sgBroken: {}, minerCostDay: 0 },
    backlog: 0, prevLoad: {}, prevConcurrency: {}, lastMetrics: null, detectDelay: ar.has('monitor') ? 1 : 8,
    ctx, skills,
  };
  for (const r of design.regions) { sim.azDown[r] = [0, 0, 0]; sim.regionDown[r] = 0; }
  initRuntime(sim);
  scheduleIncidents(sim);
  return sim;
}

// ───────────── runtime per node ─────────────
function initRuntime(sim) {
  for (const n of sim.design.nodes) {
    const c = COMPONENT[n.id]; if (!c) continue;
    const cfg = n.cfg || {};
    const rt = { failed: false, lost: 0 };
    switch (c.kind) {
      case 'asg': {
        rt.instances = [];
        const azs = Math.max(1, Math.min(3, cfg.azs || 3));
        for (let i = 0; i < Math.max(cfg.min, 1); i++) rt.instances.push({ az: i % azs, ready: 0 });
        if (cfg.min === 0) rt.instances = [];
        break;
      }
      case 'fargate': rt.tasks = []; for (let i = 0; i < cfg.min; i++) rt.tasks.push({ az: i % 3, ready: 0 }); break;
      case 'eks': {
        rt.nodes = []; for (let i = 0; i < cfg.nodesMin; i++) rt.nodes.push({ az: i % 3, ready: 0 });
        rt.pods = cfg.replicas; break;
      }
      case 'apprunner': rt.inst = [{ ready: 0 }]; break;
      case 'rds': rt.primaryAz = n.az ?? 0; rt.downUntil = 0; rt.failoverAt = -1; break;
      case 'aurora': rt.downUntil = 0; break;
      case 'cache': rt.downUntil = 0; break;
    }
    sim.rt[n.uid] = rt;
  }
}

// ───────────── incident scheduling ─────────────
function scheduleIncidents(sim) {
  const { req, rng, ar } = sim;
  const list = [];
  const add = (type, at, dur, params = {}) => list.push({ type, at: Math.round(at), dur: Math.round(dur), params, state: 'pending' });
  for (const s of req.incidents || []) add(s.type, s.at * TICKS, (s.dur || 0.1) * TICKS, { ...s.params });
  // random incidents based on threat & tier
  const threat = req.threat ?? 1;
  const pool = [];
  pool.push(['instance_fail', 2]);
  if (req.tier >= 1) pool.push(['bad_deploy', 2], ['az_outage', 1.2]);
  if (threat >= 1) pool.push(['ddos_l7', 1.2], ['sqli', 1]);
  if (threat >= 2) pool.push(['ddos_l3', 1], ['cred_leak', 1], ['public_bucket', 0.6]);
  if (threat >= 3) pool.push(['ransomware', 0.7], ['ai_flood', 0.8], ['exfil', 0.6]);
  if (ar.has('eks')) pool.push(['node_upgrade', 1.2]);
  if (!ar.has('terraform') && req.tier >= 1) pool.push(['drift', 0.8]);
  if (req.needs?.includes('analytics')) pool.push(['analytics_load', 2]);
  const hasSpot = sim.design.nodes.some(n => n.cfg?.purchase === 'spot' || n.cfg?.spot);
  if (hasSpot) pool.push(['spot_interrupt', 2.5]);
  if (req.tier >= 2 && !ar.has('acm')) pool.push(['cert_expiry', 0.6]);
  const count = req.randomIncidents ?? Math.min(1 + Math.floor(threat), 4);
  const used = new Set(list.map(i => i.type));
  for (let k = 0; k < count && pool.length; k++) {
    const tot = pool.reduce((a, p) => a + p[1], 0);
    let x = rng() * tot, choice = pool[0][0];
    for (const p of pool) { x -= p[1]; if (x <= 0) { choice = p[0]; break; } }
    if (used.has(choice)) continue;
    used.add(choice);
    const at = (0.15 + rng() * 0.7) * TICKS;
    const durs = { az_outage: [30, 60], ddos_l7: [15, 35], ddos_l3: [10, 30], ai_flood: [20, 40], node_upgrade: [6, 10], analytics_load: [20, 30], spot_interrupt: [8, 14] };
    const [a, b] = durs[choice] || [10, 20];
    add(choice, at, randInt(rng, a, b), {});
  }
  // fill params
  for (const inc of list) fillParams(sim, inc);
  list.sort((a, b) => a.at - b.at);
  sim.incidents = list;
}

function fillParams(sim, inc) {
  const { rng, design, req } = sim;
  const p = inc.params;
  const used = sim.ar.regionsUsed.length ? sim.ar.regionsUsed : design.regions;
  const base = req.rps * (req.peak || 1);
  switch (inc.type) {
    case 'az_outage': p.region ??= used[0]; p.az ??= azWithMostStuff(sim, p.region); break;
    case 'region_outage': p.region ??= used[0]; break;
    case 'ddos_l3': p.rps ??= Math.round(base * (8 + rng() * 12)); break;
    case 'ddos_l7': p.rps ??= Math.round(base * (2 + rng() * 3)); break;
    case 'ai_flood': p.rps ??= Math.round(base * (3 + rng() * 4)); break;
    case 'spike': p.mult ??= 3; break;
    case 'drift': p.region ??= used[0]; break;
    case 'provider_ban': p.provider ??= 'aws'; p.providerName = PROVIDERS[p.provider].name; break;
    case 'legal_takedown': p.jur ??= 'US'; break;
  }
}

function azWithMostStuff(sim, region) {
  const count = [0, 0, 0];
  for (const n of sim.design.nodes) if (n.region === region && n.az != null) count[n.az] += COMPONENT[n.id].kind === 'rds' ? 3 : 1;
  let best = 0; for (let i = 1; i < 3; i++) if (count[i] > count[best]) best = i;
  return best;
}

// ───────────── logging ─────────────
function log(sim, level, text, extra = {}) {
  sim.log.push({ t: sim.t, level, text, ...extra });
}

// ───────────── incident start/end ─────────────
function startIncident(sim, inc) {
  const { ar, rng } = sim;
  const p = inc.params;
  const meta = INCIDENTS[inc.type];
  inc.state = 'active';
  inc.end = sim.t + inc.dur;
  inc.detectAt = sim.t + sim.detectDelay;
  log(sim, meta.villain && (sim.req.villainTag ?? true) ? 'attack' : 'incident', meta.text(p), { incident: inc.type, codex: meta.codex });
  const hasGlobal = k => !!ar.global[k]?.length;
  const cw = ar.g('monitor');
  switch (inc.type) {
    case 'spike': sim.mods.spikeMult *= p.mult; break;
    case 'instance_fail': {
      const cands = sim.design.nodes.filter(n => ['ec2', 'asg'].includes(COMPONENT[n.id].kind));
      if (!cands.length) { inc.mitigated = 'No VMs to fail.'; break; }
      const n = pick(rng, cands); const rt = sim.rt[n.uid];
      if (COMPONENT[n.id].kind === 'ec2') {
        rt.lost = Math.min((rt.lost || 0) + 1, n.cfg.count); inc.node = n.uid;
        if (cw) { rt.replaceAt = sim.t + 4; inc.end = sim.t + 4; inc.autoFix = 'CloudWatch status-check alarm triggered EC2 auto-recovery onto healthy hardware.'; }
        else { inc.needsAction = 'replace'; inc.end = TICKS + 1; inc.persistent = true; }
      }
      else if (rt.instances.length) { rt.instances.splice(0, 1); inc.mitigated = 'Auto Scaling Group will launch a replacement.'; inc.end = sim.t + 1; }
      break;
    }
    case 'az_outage': sim.azDown[p.region][p.az] = inc.end; break;
    case 'region_outage': sim.regionDown[p.region] = TICKS + 1; inc.end = TICKS + 1; inc.rtoStart = sim.t; sim.rtoWatch = inc; dataLossForRegion(sim, p.region); break;
    case 'ddos_l3': sim.attack.l3 += p.rps; break;
    case 'ddos_l7': sim.attack.l7 += p.rps; break;
    case 'ai_flood': sim.attack.smart += p.rps; break;
    case 'sqli': {
      const waf = ar.g('waf');
      if (waf && waf.cfg.managed !== false) inc.mitigated = 'WAF managed rules blocked the injection.';
      else breach(sim, inc, 'Customer table dumped via SQL injection.');
      inc.end = sim.t + 1; break;
    }
    case 'cred_leak': {
      if (hasGlobal('iam') && hasGlobal('secrets')) { inc.mitigated = 'No long-lived keys existed — workloads use IAM roles and Secrets Manager.'; inc.end = sim.t + 1; break; }
      sim.mods.minerCostDay += 800 * Math.max(1, sim.req.tier);
      inc.needsAction = 'rotate';
      if (hasGlobal('guardduty')) { inc.end = sim.t + 4; inc.autoFix = 'GuardDuty flagged CryptoCurrency:EC2/BitcoinTool; keys revoked automatically.'; }
      else { inc.end = sim.t + 40; breach(sim, inc, 'Attackers used leaked keys to read data and mine crypto on your account.', 0.5); }
      break;
    }
    case 'ransomware': {
      const b = ar.g('backup');
      const s3 = sim.design.nodes.find(n => n.id === 's3');
      if ((b && b.cfg.vaultLock) || (s3 && s3.cfg.objectLock && s3.cfg.versioning && b)) {
        inc.mitigated = 'Immutable backups survived. Restoring clean copies.'; sim.mods.dbDownUntil = sim.t + 12;
      } else if (b && rng() < 0.5) {
        inc.mitigated = 'Backups existed and the attackers missed them. Restoring (slowly).'; sim.mods.dbDownUntil = sim.t + 25;
      } else {
        sim.mods.dbDownUntil = sim.t + 60; breach(sim, inc, b ? 'Attackers deleted your mutable backups before encrypting. Data lost.' : 'No backups. Data encrypted and lost.', 1);
        sim.totals.dataLossMin = Math.max(sim.totals.dataLossMin, 1440);
      }
      inc.end = sim.mods.dbDownUntil; break;
    }
    case 'bad_deploy': {
      const ci = ar.g('cicd');
      const strat = ci?.cfg.strategy || 'none';
      const detect = cw ? (cw.cfg.slo || cw.cfg.tracing ? 1 : 2) : 8;
      if (strat === 'canary' && cw) { inc.errFrac = 0.05; inc.end = sim.t + detect + 1; inc.autoFix = 'Canary alarms tripped; pipeline auto-rolled back.'; }
      else if (strat === 'bluegreen') { inc.errFrac = 1; inc.end = sim.t + detect + 1; inc.autoFix = 'Traffic shifted back to the blue environment.'; }
      else if (strat === 'rolling') { inc.errFrac = 0.5; inc.end = sim.t + detect + 10; inc.needsAction = 'rollback'; }
      else { inc.errFrac = 1; inc.end = sim.t + detect + (ci ? 15 : 40); inc.needsAction = 'rollback'; }
      sim.mods.deployErr = inc.errFrac; break;
    }
    case 'drift': {
      const tf = ar.g('terraform'), cfgR = ar.g('config');
      if (tf?.cfg.drift || cfgR) { inc.end = sim.t + 2; inc.autoFix = tf?.cfg.drift ? 'Drift detection reverted the change.' : 'AWS Config auto-remediation reverted the change.'; }
      else if (tf) { inc.end = sim.t + 20; inc.needsAction = 'reapply'; }
      else { inc.end = sim.t + 45; inc.needsAction = 'investigate'; }
      sim.mods.sgBroken[p.region] = true; break;
    }
    case 'spot_interrupt': {
      for (const n of sim.design.nodes) {
        const rt = sim.rt[n.uid], c = COMPONENT[n.id];
        if (c.kind === 'asg' && n.cfg.purchase === 'spot') rt.instances.splice(0, Math.ceil(rt.instances.length * 0.6));
        if (c.kind === 'ec2' && n.cfg.purchase === 'spot') rt.lost = n.cfg.count;
        if (c.kind === 'eks' && n.cfg.spot) { const k = n.cfg.autoscaler === 'karpenter' ? 0.2 : 0.6; rt.nodes.splice(0, Math.ceil(rt.nodes.length * k)); }
        if (c.kind === 'fargate' && n.cfg.spot) rt.tasks.splice(0, Math.ceil(rt.tasks.length * 0.5));
      }
      inc.end = sim.t + 1; break;
    }
    case 'cert_expiry': {
      if (hasGlobal('acm')) { inc.mitigated = 'ACM renewed the certificate automatically.'; inc.end = sim.t + 1; }
      else { sim.mods.tlsDown = true; inc.needsAction = 'renew'; inc.end = sim.t + 30; }
      break;
    }
    case 'public_bucket': {
      const s3s = sim.design.nodes.filter(n => n.id === 's3');
      if (!s3s.length) { inc.mitigated = 'No buckets to expose.'; }
      else if (s3s.every(n => n.cfg.blockPublic) || hasGlobal('config')) inc.mitigated = 'Block Public Access refused the ACL change.';
      else breach(sim, inc, 'Customer documents were publicly readable for hours.', 0.6);
      inc.end = sim.t + 1; break;
    }
    case 'node_upgrade': {
      const eks = sim.design.nodes.filter(n => n.id === 'eks');
      if (!eks.length) { inc.end = sim.t + 1; break; }
      inc.eksErr = eks.every(n => n.cfg.pdb && n.cfg.probes) ? 0 : eks.every(n => n.cfg.pdb || n.cfg.probes) ? 0.15 : 0.45;
      if (inc.eksErr === 0) inc.mitigated = 'PDBs + readiness probes kept pods serving through the drain.';
      break;
    }
    case 'analytics_load': {
      if (ar.has('redshift')) { inc.mitigated = 'Reports ran on the warehouse.'; inc.end = sim.t + 1; }
      else if (sim.design.nodes.some(n => (n.id === 'rds' && n.cfg.replicas > 0) || (n.id === 'aurora' && n.cfg.replicas > 0))) { sim.mods.dbReadPenalty = 0.8; inc.mitigated = 'Reports ran on a read replica (partially).'; }
      else sim.mods.dbReadPenalty = 0.35;
      break;
    }
    case 'supply_chain': {
      const ci = ar.g('cicd');
      if (ci?.cfg.scan) { inc.mitigated = 'Dependency scanning blocked the malicious version.'; }
      else if (ci?.cfg.oidc && hasGlobal('iam')) { inc.mitigated = 'Stealer found nothing: OIDC credentials expire in minutes.'; }
      else breach(sim, inc, 'Build secrets and deploy keys were stolen from your pipeline.', 0.7);
      inc.end = sim.t + 1; break;
    }
    case 'priv_esc': {
      const orgs = ar.g('orgs'), iam = ar.g('iam');
      if (orgs || iam?.cfg.boundaries) inc.mitigated = orgs ? 'SCP guardrail denied iam:AttachUserPolicy.' : 'Permission boundary capped the escalation.';
      else breach(sim, inc, 'Attacker became admin and disabled CloudTrail.', 0.8);
      inc.end = sim.t + 1; break;
    }
    case 'exfil': {
      const vpcs = sim.design.nodes.filter(n => n.id === 'vpc');
      const fw = ar.has('netfw');
      if (fw) inc.mitigated = 'Network Firewall egress allow-list dropped the upload.';
      else if (vpcs.length && vpcs.every(v => v.cfg.private) && !ar.has('nat')) inc.mitigated = 'Private subnets have no route to the internet.';
      else if (hasGlobal('guardduty')) { inc.mitigated = 'GuardDuty caught it mid-transfer; partial leak.'; breach(sim, inc, 'Partial data exfiltration before containment.', 0.3); }
      else breach(sim, inc, 'Full database dump exfiltrated.', 1);
      inc.end = sim.t + 1; break;
    }
    case 'provider_ban': {
      for (const r of sim.design.regions) if (REGION[r].provider === p.provider) sim.regionDown[r] = TICKS + 1;
      inc.end = TICKS + 1; inc.rtoStart = sim.t; sim.rtoWatch = inc; break;
    }
    case 'domain_seizure': {
      const dns = ar.g('dns');
      if (dns?.cfg.secondary) { inc.mitigated = 'Secondary DNS provider kept answering.'; inc.end = sim.t + 1; }
      else { sim.mods.dnsDown = true; }
      break;
    }
    case 'legal_takedown': {
      for (const r of sim.design.regions) if (REGION[r].jur === p.jur || (p.jur === 'EU' && isEU(r))) sim.regionDown[r] = TICKS + 1;
      inc.end = TICKS + 1; inc.rtoStart = sim.t; sim.rtoWatch = inc; break;
    }
  }
  if (inc.mitigated) log(sim, 'good', '✔ ' + inc.mitigated);
}

function endIncident(sim, inc) {
  inc.state = 'done';
  const p = inc.params;
  switch (inc.type) {
    case 'spike': sim.mods.spikeMult /= p.mult; break;
    case 'ddos_l3': sim.attack.l3 -= p.rps; break;
    case 'ddos_l7': sim.attack.l7 -= p.rps; break;
    case 'ai_flood': sim.attack.smart -= p.rps; break;
    case 'cred_leak': sim.mods.minerCostDay = 0; break;
    case 'bad_deploy': sim.mods.deployErr = 0; break;
    case 'drift': sim.mods.sgBroken[p.region] = false; break;
    case 'cert_expiry': sim.mods.tlsDown = false; break;
    case 'analytics_load': sim.mods.dbReadPenalty = 1; break;
    case 'domain_seizure': sim.mods.dnsDown = false; break;
    case 'instance_fail': break;
  }
  if (inc.autoFix) log(sim, 'good', '✔ ' + inc.autoFix);
  else if (!inc.mitigated) log(sim, 'info', `${INCIDENTS[inc.type].name} resolved.`);
  sim.attack.l3 = Math.max(0, sim.attack.l3); sim.attack.l7 = Math.max(0, sim.attack.l7); sim.attack.smart = Math.max(0, sim.attack.smart);
}

function breach(sim, inc, text, severity = 1) {
  sim.totals.breaches.push({ type: inc.type, text, severity });
  log(sim, 'breach', '☠ BREACH: ' + text, { codex: INCIDENTS[inc.type].codex });
}

// Estimate RPO when a whole region is lost.
function dataLossForRegion(sim, region) {
  const nodes = sim.design.nodes.filter(n => n.region === region);
  const hasDb = nodes.some(n => ['rds', 'aurora', 'dynamodb'].includes(COMPONENT[n.id].kind));
  if (!hasDb) return;
  let rpo = Infinity;
  for (const n of nodes) {
    if (n.id === 'aurora' && n.cfg.global) rpo = Math.min(rpo, 0.02);
    if (n.id === 'dynamodb' && n.cfg.global) rpo = Math.min(rpo, 0.02);
    if (n.id === 'rds' && n.cfg.crossRegionReplica) rpo = Math.min(rpo, 1);
  }
  const b = sim.ar.g('backup');
  if (b?.cfg.crossRegion) rpo = Math.min(rpo, 1440);
  if (rpo === Infinity) rpo = 1e9; // total loss until region returns
  sim.totals.dataLossMin = Math.max(sim.totals.dataLossMin, rpo);
}

// ───────────── manual actions ─────────────
export function availableActions(sim) {
  const acts = [];
  const cheap = sim.skills.has('ops_incident') ? 0.5 : 1;
  const active = sim.incidents.filter(i => i.state === 'active' && sim.t >= i.detectAt);
  for (const inc of active) {
    if (inc.actionDone) continue;
    if (inc.needsAction === 'rollback') acts.push({ id: 'rollback', label: 'Roll back release', cost: 150 * cheap, inc });
    if (inc.needsAction === 'replace') acts.push({ id: 'replace', label: 'Replace dead instance', cost: 40 * cheap, inc });
    if (inc.needsAction === 'reapply') acts.push({ id: 'reapply', label: 'terraform apply (restore SG)', cost: 60 * cheap, inc });
    if (inc.needsAction === 'investigate') acts.push({ id: 'investigate', label: 'Investigate & fix SG manually', cost: 250 * cheap, inc });
    if (inc.needsAction === 'rotate') acts.push({ id: 'rotate', label: 'Revoke & rotate keys', cost: 100 * cheap, inc });
    if (inc.needsAction === 'renew') acts.push({ id: 'renew', label: 'Buy & install new cert', cost: 120 * cheap, inc });
    if (['ddos_l7', 'ai_flood'].includes(inc.type) && sim.t > sim.mods.blockUntil) acts.push({ id: 'block', label: 'Emergency IP blocklist', cost: 200 * cheap, inc });
  }
  // DB restore when a single-AZ RDS is stuck in a dead AZ
  for (const n of sim.design.nodes) {
    if (n.id !== 'rds') continue;
    const rt = sim.rt[n.uid];
    if (rt.stuck && !rt.restoring && n.cfg.pitr) acts.push({ id: 'restore', label: 'Restore DB to another AZ (PITR)', cost: 200 * cheap, node: n });
  }
  // manual DNS failover
  const dns = sim.ar.g('dns');
  const prim = sim.design.regions[0];
  if (sim.regionDown[prim] && sim.design.regions.length > 1 && !sim.manualRegion && (!dns || dns.cfg.policy === 'simple' || !dns.cfg.health))
    acts.push({ id: 'failover', label: 'Manually repoint DNS to DR region', cost: 300 * cheap });
  // scale out
  for (const n of sim.design.nodes) {
    const k = COMPONENT[n.id].kind;
    if (['ec2', 'asg', 'eks', 'fargate'].includes(k) && sim.lastMetrics?.util?.[n.region] > 0.85)
      acts.push({ id: 'scale', label: `Scale out ${COMPONENT[n.id].name} (${n.region})`, cost: 30 * cheap, node: n });
  }
  return acts;
}

export function doAction(sim, act) {
  const t = sim.t;
  switch (act.id) {
    case 'rollback': act.inc.end = Math.min(act.inc.end, t + (sim.ar.has('cicd') ? 4 : 10)); act.inc.actionDone = true; log(sim, 'info', 'Rolling back to previous release…'); break;
    case 'replace': { const rt = sim.rt[act.inc.node]; rt.replaceAt = t + 4; act.inc.actionDone = true; act.inc.end = t + 4; log(sim, 'info', 'Launching a replacement instance…'); break; }
    case 'reapply': act.inc.end = Math.min(act.inc.end, t + 3); act.inc.actionDone = true; log(sim, 'info', 'terraform apply: 1 to change.'); break;
    case 'investigate': act.inc.end = Math.min(act.inc.end, t + 12); act.inc.actionDone = true; log(sim, 'info', 'Digging through the console to find what changed…'); break;
    case 'rotate': act.inc.end = Math.min(act.inc.end, t + 2); act.inc.actionDone = true; log(sim, 'info', 'Keys revoked. Terminating rogue instances.'); break;
    case 'renew': act.inc.end = Math.min(act.inc.end, t + 6); act.inc.actionDone = true; log(sim, 'info', 'Requesting a certificate from the CA…'); break;
    case 'block': sim.mods.blockUntil = t + 25; log(sim, 'info', 'Blocking the top attacking IP ranges.'); break;
    case 'restore': { const rt = sim.rt[act.node.uid]; rt.restoring = true; rt.restoreAt = t + 20; sim.totals.dataLossMin = Math.max(sim.totals.dataLossMin, 5); log(sim, 'info', 'Restoring latest snapshot + transaction logs into a healthy AZ (~40 min)…'); break; }
    case 'failover': sim.manualRegion = sim.design.regions.find(r => !sim.regionDown[r]); sim.manualFailoverAt = t + 5; log(sim, 'info', `Updating DNS records to ${sim.manualRegion}. Waiting for TTLs to expire…`); break;
    case 'scale': {
      const n = act.node, rt = sim.rt[n.uid], k = COMPONENT[n.id].kind;
      if (k === 'ec2') n.cfg.count = Math.min(10, n.cfg.count + 1);
      if (k === 'asg') { n.cfg.max += 2; n.cfg.min = Math.min(n.cfg.max, n.cfg.min + 2); }
      if (k === 'eks') { n.cfg.nodesMax += 2; n.cfg.nodesMin += 2; rt.nodes.push({ az: 0, ready: t + 4 }, { az: 1, ready: t + 4 }); }
      if (k === 'fargate') { n.cfg.max += 4; n.cfg.min += 2; }
      log(sim, 'info', `Scaling out ${COMPONENT[n.id].name}.`); break;
    }
  }
}

// ───────────── demand curve ─────────────
export function demandAt(req, t) {
  const diurnal = 0.78 + 0.22 * Math.sin((t / TICKS) * Math.PI * 2 - Math.PI / 2 + 1.2);
  let peak = 1;
  if (req.peak && req.peak > 1) {
    const c = (req.peakAt ?? 0.55) * TICKS, w = (req.peakWidth ?? 0.06) * TICKS;
    peak = 1 + (req.peak - 1) * Math.exp(-((t - c) ** 2) / (2 * w * w));
  }
  return req.rps * diurnal * peak;
}

// ───────────── capacity ─────────────
function azUp(sim, region, az) { return !sim.regionDown[region] && !(sim.azDown[region]?.[az] > sim.t); }

function nodeCapacity(sim, n) {
  const c = COMPONENT[n.id], cfg = n.cfg, rt = sim.rt[n.uid], t = sim.t;
  if (sim.regionDown[n.region]) return { cap: 0, units: 0 };
  switch (c.kind) {
    case 'ec2': {
      if (!azUp(sim, n.region, n.az)) return { cap: 0, units: 0 };
      if (rt.replaceAt && t >= rt.replaceAt) { rt.lost = 0; rt.replaceAt = 0; }
      const k = Math.max(0, cfg.count - (rt.lost || 0));
      return { cap: k * SIZES[cfg.size].cap, units: k, unitCap: SIZES[cfg.size].cap };
    }
    case 'asg': {
      const ok = rt.instances.filter(i => i.ready <= t && azUp(sim, n.region, i.az)).length;
      return { cap: ok * SIZES[cfg.size].cap, units: ok, unitCap: SIZES[cfg.size].cap };
    }
    case 'fargate': {
      const per = TASK_RPS_PER_VCPU * parseFloat(cfg.task);
      const ok = rt.tasks.filter(i => i.ready <= t && azUp(sim, n.region, i.az)).length;
      return { cap: ok * per, units: ok, unitCap: per };
    }
    case 'eks': {
      const slots = Math.max(1, Math.floor(SIZES[cfg.nodeSize].vcpu * 0.85));
      const readyNodes = rt.nodes.filter(i => i.ready <= t && azUp(sim, n.region, i.az)).length;
      const pods = Math.min(rt.pods, readyNodes * slots);
      rt.runningPods = pods;
      return { cap: pods * POD_RPS, units: pods, unitCap: POD_RPS };
    }
    case 'lambda': {
      const conc = parseInt(cfg.quota, 10);
      return { cap: conc / LAMBDA_DUR[cfg.mem], units: conc, unitCap: 1 / LAMBDA_DUR[cfg.mem], regional: true };
    }
    case 'apprunner': {
      const ok = rt.inst.filter(i => i.ready <= t).length;
      return { cap: ok * APPRUNNER_RPS, units: ok, unitCap: APPRUNNER_RPS, regional: true };
    }
  }
  return { cap: 0, units: 0 };
}

// ───────────── scaling ─────────────
function scale(sim, n, load) {
  const c = COMPONENT[n.id], cfg = n.cfg, rt = sim.rt[n.uid], t = sim.t;
  const quotaVcpu = sim.skills.has('ha_quotas') ? 1e9 : (sim.req.tier >= 2 ? 2048 : 512);
  const healthyAzs = [0, 1, 2].filter(a => azUp(sim, n.region, a));
  if (sim.regionDown[n.region]) return;
  if (c.kind === 'asg') {
    rt.instances = rt.instances.filter(i => azUp(sim, n.region, i.az));
    const per = SIZES[cfg.size].cap * (cfg.target / 100);
    let desired = Math.ceil(load / per);
    if (cfg.predictive) desired = Math.max(desired, Math.ceil(demandAt(sim.req, t + 8) * (1 - (sim.req.static || 0)) / per));
    let max = cfg.max;
    const quotaMax = Math.floor(quotaVcpu / SIZES[cfg.size].vcpu);
    if (max > quotaMax) { max = quotaMax; if (desired > quotaMax && !sim.quotaLogged) { sim.quotaLogged = true; log(sim, 'incident', INCIDENTS.quota_hit.text(), { codex: 'quotas' }); } }
    desired = Math.max(cfg.min, Math.min(max, desired));
    const azs = healthyAzs.filter(a => a < (cfg.azs || 3));
    if (!azs.length) return;
    const warm = cfg.warmpool ? 1 : 3;
    while (rt.instances.length < desired) {
      const counts = azs.map(a => rt.instances.filter(i => i.az === a).length);
      const az = azs[counts.indexOf(Math.min(...counts))];
      rt.instances.push({ az, ready: t + warm });
    }
    if (rt.instances.length > desired && t % 3 === 0) rt.instances.pop();
  } else if (c.kind === 'fargate') {
    rt.tasks = rt.tasks.filter(i => azUp(sim, n.region, i.az));
    const per = TASK_RPS_PER_VCPU * parseFloat(cfg.task) * 0.7;
    const desired = Math.max(cfg.min, Math.min(cfg.max, Math.ceil(load / per)));
    while (rt.tasks.length < desired) rt.tasks.push({ az: healthyAzs[rt.tasks.length % healthyAzs.length], ready: t + 2 });
    if (rt.tasks.length > desired && t % 2 === 0) rt.tasks.pop();
  } else if (c.kind === 'eks') {
    rt.nodes = rt.nodes.filter(i => azUp(sim, n.region, i.az));
    const slots = Math.max(1, Math.floor(SIZES[cfg.nodeSize].vcpu * 0.85));
    let desiredPods = cfg.hpa ? Math.ceil(load / (POD_RPS * 0.7)) : cfg.replicas;
    desiredPods = Math.max(cfg.replicas, desiredPods);
    rt.pods = desiredPods;
    if (cfg.autoscaler !== 'none') {
      const needNodes = Math.ceil(desiredPods / slots);
      const quotaNodes = Math.floor(quotaVcpu / SIZES[cfg.nodeSize].vcpu);
      const target = Math.max(cfg.nodesMin, Math.min(cfg.nodesMax, needNodes, quotaNodes));
      const warm = cfg.autoscaler === 'karpenter' ? 2 : 4;
      while (rt.nodes.length < target) rt.nodes.push({ az: healthyAzs[rt.nodes.length % healthyAzs.length], ready: t + warm });
      if (rt.nodes.length > target && t % 4 === 0) rt.nodes.pop();
    } else {
      while (rt.nodes.length < cfg.nodesMin) rt.nodes.push({ az: healthyAzs[rt.nodes.length % healthyAzs.length], ready: t + 4 });
    }
  } else if (c.kind === 'apprunner') {
    const desired = Math.max(1, Math.min(cfg.max, Math.ceil(load / (APPRUNNER_RPS * 0.7))));
    while (rt.inst.length < desired) rt.inst.push({ ready: t + 2 });
    if (rt.inst.length > desired && t % 2 === 0) rt.inst.pop();
  }
}

// ───────────── routing ─────────────
function routableRegions(sim) {
  const { ar, design } = sim;
  return design.regions.filter(r => regionNodes(ar, r, COMPUTE_KINDS).length || ar.byRegion[r].kinds.s3);
}

function route(sim) {
  const { ar, req } = sim;
  const dns = ar.g('dns');
  const ga = ar.has('globalacc');
  const policy = ga ? 'latency' : (dns?.cfg.policy || 'simple');
  const health = ga || !!dns?.cfg.health;
  const regs = routableRegions(sim);
  const routes = {};
  if (!regs.length) return routes;
  const known = r => !(health && sim.dnsUnhealthy[r]);
  const geoShare = req.geo || { NA: 1 };
  for (const g of GEOS) {
    const share = geoShare[g] || 0;
    if (!share) continue;
    let targets;
    if (sim.manualRegion && sim.t >= (sim.manualFailoverAt || 0)) targets = [sim.manualRegion];
    else if (policy === 'simple') targets = [regs[0]];
    else if (policy === 'failover') targets = [regs.find(known) || regs[0]];
    else if (policy === 'weighted') { targets = regs.filter(known); if (!targets.length) targets = regs; }
    else {
      let cands = regs.filter(known);
      if (policy === 'geo' && req.compliance?.includes('residencyEU')) cands = cands.filter(isEU);
      if (!cands.length) cands = regs;
      cands.sort((a, b) => GEO_LATENCY[g][REGION[a].geo] - GEO_LATENCY[g][REGION[b].geo]);
      targets = [cands[0]];
    }
    routes[g] = targets.map(r => ({ region: r, w: share / targets.length }));
  }
  return routes;
}

// ───────────── database lookup ─────────────
function dbFor(sim, region) {
  const { ar } = sim;
  const local = regionNodes(ar, region, ['rds', 'aurora', 'dynamodb']);
  if (local.length) return { node: local[0], local: true };
  for (const r of sim.design.regions) {
    if (r === region) continue;
    const remote = regionNodes(ar, r, ['rds', 'aurora', 'dynamodb']);
    if (!remote.length) continue;
    const n = remote[0];
    if (n.id === 'aurora' && n.cfg.global) return { node: n, globalReplica: true, home: r };
    if (n.id === 'dynamodb' && n.cfg.global) return { node: n, globalTable: true, home: r };
    if (n.id === 'rds' && n.cfg.crossRegionReplica) return { node: n, crossReplica: true, home: r };
    return { node: n, remote: true, home: r };
  }
  return null;
}

function dbState(sim, d) {
  // returns { up, rCap, wCap, writeRemote, latencyExtra }
  const n = d.node, cfg = n.cfg, rt = sim.rt[n.uid], t = sim.t;
  const home = d.home || n.region;
  const homeUp = !sim.regionDown[home];
  let up = true, rCap = 0, wCap = 0;
  if (sim.mods.dbDownUntil && t < sim.mods.dbDownUntil) return { up: false, rCap: 0, wCap: 0 };
  if (n.id === 'rds') {
    const s = DB_SIZES[cfg.size];
    if (rt.restoring && t >= rt.restoreAt) { rt.restoring = false; rt.stuck = false; rt.primaryAz = [0, 1, 2].find(a => azUp(sim, n.region, a)) ?? rt.primaryAz; log(sim, 'good', '✔ Database restored in a healthy AZ.'); }
    if (!azUp(sim, n.region, rt.primaryAz)) {
      if (cfg.multiAZ) {
        if (rt.failoverAt < 0) { rt.failoverAt = t + (cfg.proxy ? 1 : 1); log(sim, 'info', 'RDS Multi-AZ: failing over to standby (~60-120s)…'); }
        if (t >= rt.failoverAt) { rt.primaryAz = [0, 1, 2].find(a => a !== rt.primaryAz && azUp(sim, n.region, a)); rt.failoverAt = -1; log(sim, 'good', '✔ Standby promoted. DNS endpoint now points to new primary.'); }
        up = false;
      } else { up = false; if (!rt.stuck) { rt.stuck = true; log(sim, 'incident', 'Single-AZ database is down with its AZ.', { codex: 'rds' }); } }
    } else if (rt.stuck && !rt.restoring) { rt.stuck = false; log(sim, 'good', '✔ AZ recovered — database back online.'); }
    if (up) {
      const replicasUp = Math.min(cfg.replicas || 0, [0, 1, 2].filter(a => azUp(sim, n.region, a)).length);
      rCap = s.r * (1 + 0.9 * replicasUp) * (cfg.proxy ? 1.15 : 1); wCap = s.w * (cfg.proxy ? 1.15 : 1);
    }
    if (d.crossReplica) { if (!homeUp) { up = false; } rCap = s.r; wCap = s.w; return { up: up || false, rCap, wCap, writeRemote: true, home }; }
  } else if (n.id === 'aurora') {
    const s = DB_SIZES[cfg.size];
    if (sim.regionDown[n.region]) up = false;
    if (cfg.serverless) { rCap = 90000; wCap = 25000; }
    else { rCap = s.r * 1.3 * (1 + (cfg.replicas || 0)); wCap = s.w * 1.5; }
    if (d.globalReplica) {
      if (!homeUp) { // managed failover promotes this secondary
        if (!rt.promotedAt) { rt.promotedAt = t + 1; log(sim, 'info', 'Aurora Global: promoting secondary region to primary…'); }
        return { up: t >= rt.promotedAt, rCap: s.r * 1.3, wCap: s.w * 1.5 };
      }
      return { up: true, rCap: s.r * 1.3, wCap: s.w * 1.5, writeRemote: true, home };
    }
  } else if (n.id === 'dynamodb') {
    up = !sim.regionDown[n.region] || d.globalTable;
    rCap = cfg.mode === 'provisioned' ? (rt.provR ||= sim.req.rps * 2) : 1e9;
    wCap = cfg.mode === 'provisioned' ? (rt.provW ||= sim.req.rps * 1) : 1e9;
    if (d.globalTable) return { up: true, rCap, wCap };
  }
  if (d.remote) { if (!homeUp) return { up: false, rCap: 0, wCap: 0 }; return { up, rCap, wCap, remoteAll: true, home }; }
  return { up, rCap, wCap };
}

// ───────────── the tick ─────────────
export function step(sim) {
  if (sim.done) return;
  const { ar, req, design } = sim;
  const t = sim.t;

  for (const inc of sim.incidents) {
    if (inc.state === 'pending' && inc.at <= t) startIncident(sim, inc);
    if (inc.state === 'active') {
      if (inc.type === 'node_upgrade' && inc.eksErr) sim.mods.eksErr = inc.eksErr;
      if (t >= inc.end) { endIncident(sim, inc); if (inc.type === 'node_upgrade') sim.mods.eksErr = 0; }
    }
  }
  // AZ recovery logging
  for (const r of design.regions) sim.azDown[r] = sim.azDown[r].map(v => (v && v <= t ? 0 : v));

  const demand = demandAt(req, t) * sim.mods.spikeMult;
  const routes = sim.mods.dnsDown || sim.suspended ? {} : route(sim);

  // build per-region load
  const regLoad = {};
  for (const [g, list] of Object.entries(routes)) for (const { region, w } of list) {
    (regLoad[region] ||= { legit: 0, byGeo: {} });
    regLoad[region].legit += demand * w;
    regLoad[region].byGeo[g] = (regLoad[region].byGeo[g] || 0) + demand * w;
  }
  const servingRegions = Object.keys(regLoad);
  const nServing = Math.max(1, servingRegions.length);

  let served = 0, legitTotal = demand, costDay = 0;
  const cat = {};
  const addCost = (k, v) => { if (!v || !isFinite(v)) return; cat[k] = (cat[k] || 0) + v; costDay += v; };
  const latSamples = [];
  const util = {};

  const dbLoadAcc = {};
  const blocked = t <= sim.mods.blockUntil ? 0.4 : 1;
  const waf = ar.g('waf');
  const cdn = ar.g('cdn');
  const ga = ar.has('globalacc');
  const shield = ar.has('shield');

  // ---- per region
  for (const r of design.regions) {
    const R = ar.byRegion[r];
    const pm = REGION[r].priceMult;
    const L = regLoad[r] || { legit: 0, byGeo: {} };
    const down = !!sim.regionDown[r] || sim.suspended;
    const computeNodes = regionNodes(ar, r, COMPUTE_KINDS);
    const hasLB = !!(R.kinds.lb?.length || R.kinds.apigw?.length);
    const s3 = R.kinds.s3?.[0];

    const staticShare = req.static || 0;
    let staticLoad = L.legit * staticShare;
    let dynLoad = L.legit - staticLoad;
    let edgeServed = 0;
    if (cdn) { const hit = cdn.cfg.originShield ? 0.97 : 0.93; edgeServed += staticLoad * hit; staticLoad *= (1 - hit); }
    if (cdn?.cfg.cacheDynamic) { const c = dynLoad * (req.read ?? 0.8) * 0.35; edgeServed += c; dynLoad -= c; }
    const originStatic = staticLoad;
    let staticServed = 0;
    if (!down && s3) staticServed = originStatic; // S3 serves static

    // attacks hit serving regions evenly
    let l3 = servingRegions.includes(r) ? sim.attack.l3 / nServing : 0;
    let l7 = servingRegions.includes(r) ? sim.attack.l7 / nServing : 0;
    let smart = servingRegions.includes(r) ? sim.attack.smart / nServing : 0;
    if (shield) l3 = 0; else if (cdn || ga) l3 *= 0.06;
    if (waf) { if (waf.cfg.rate !== false) l7 *= 0.1; smart *= waf.cfg.bot ? 0.12 : (waf.cfg.rate !== false ? 0.75 : 1); }
    if (cdn) { l7 *= 0.7; smart *= 0.85; } // some floods hit cached paths
    l7 *= blocked; smart *= blocked;
    const attackLoad = l7 + smart + l3 * 0.35;

    // compute capacity
    let cap = 0, caps = [];
    for (const n of computeNodes) { const c = nodeCapacity(sim, n); caps.push({ n, ...c }); cap += c.cap; }
    if (!hasLB && caps.length) {
      // Without a load balancer, clients can only reach one VM. (Lambda/App Runner bring their own front door.)
      const regional = caps.filter(c => c.regional);
      if (regional.length) cap = regional.reduce((a, c) => a + c.cap, 0);
      else { const first = caps.find(c => c.units > 0); cap = first ? first.unitCap || 0 : 0; if (computeNodes.length && caps.some(c => c.units > 1) && !sim.noLbLogged) { sim.noLbLogged = true; log(sim, 'warn', `No load balancer in ${r}: only one server receives traffic.`, { codex: 'alb' }); } }
    }
    if (sim.mods.sgBroken[r] && hasLB) cap = 0;
    if (down) cap = 0;

    const asyncFrac = req.async || 0;
    const readFrac = req.read ?? 0.8;
    const hasQueue = !!(R.kinds.queue?.length || R.kinds.sns?.length || R.kinds.eventbridge?.length || R.kinds.kinesis?.length);
    const heavyAsync = hasQueue ? 0 : dynLoad * (1 - readFrac) * asyncFrac * 2; // inline processing is expensive
    const computeLoad = dynLoad + (s3 ? 0 : originStatic * 0.3) + heavyAsync + attackLoad + (hasQueue ? sim.backlog / TICKS * 0 : 0);
    const u = cap > 0 ? computeLoad / cap : (computeLoad > 0 ? 99 : 0);
    util[r] = u;
    let computeOk = cap <= 0 ? 0 : Math.min(1, cap / Math.max(computeLoad, 1e-9));
    if (sim.mods.deployErr) computeOk *= (1 - sim.mods.deployErr);
    if (sim.mods.eksErr && computeNodes.some(n => n.id === 'eks')) computeOk *= (1 - sim.mods.eksErr);
    if (sim.mods.tlsDown) computeOk = 0;
    if (!s3 && originStatic > 0) staticServed = originStatic * (cap > 0 ? Math.min(1, cap / Math.max(computeLoad, 1)) : 0) * (sim.mods.tlsDown ? 0 : 1);

    // scaling decisions use this tick's load (applied next tick via warmup)
    for (const n of computeNodes) {
      const share = cap > 0 ? (nodeCapacity(sim, n).cap / cap) : 1 / computeNodes.length;
      scale(sim, n, computeLoad * (isFinite(share) && share > 0 ? share : 1 / computeNodes.length));
    }

    // database & cache
    const dynServedCompute = dynLoad * computeOk;
    let dbOk = 1, dbLatency = 0, crossRegionMs = 0;
    const needsDb = req.stateful !== false && dynLoad > 0;
    let reads = dynServedCompute * readFrac;
    let writes = dynServedCompute * (1 - readFrac);
    if (needsDb && dynServedCompute > 0) {
      const d = dbFor(sim, r);
      const cacheNode = R.kinds.cache?.[0];
      let hits = 0, cacheUp = false;
      if (cacheNode) {
        const crt = sim.rt[cacheNode.uid];
        cacheUp = !down && (cacheNode.cfg.nodes > 1 || azUp(sim, r, 0));
        if (cacheUp) { const ccap = CACHE_SIZES[cacheNode.cfg.size].ops * cacheNode.cfg.nodes; hits = Math.min(reads * 0.85, ccap); }
        else if (!crt.logged) { crt.logged = true; log(sim, 'incident', 'Cache node lost with its AZ — every read now hits the database.', { codex: 'elasticache' }); }
      }
      const dbReads = (reads - hits);
      if (!d) { dbOk = 0; if (!sim.noDbLogged) { sim.noDbLogged = true; log(sim, 'warn', 'App needs a database but none exists.', { codex: 'rds' }); } }
      else {
        const st = dbState(sim, d);
        const asyncW = writes * asyncFrac;
        let wLoad = writes;
        if (hasQueue) { wLoad = writes - asyncW; sim.backlog += asyncW; }
        if (!st.up) {
          // cached reads still work; queued async writes wait safely
          const okFrac = (hits + (hasQueue ? asyncW : 0)) / Math.max(reads + writes, 1e-9);
          dbOk = okFrac;
        } else {
          const rCap = st.rCap * sim.mods.dbReadPenalty;
          const spareW = Math.max(0, st.wCap - wLoad);
          if (hasQueue && sim.backlog > 0) { const drain = Math.min(sim.backlog, spareW); sim.backlog -= drain; wLoad += drain; }
          const ru = dbReads / Math.max(rCap, 1e-9), wu = wLoad / Math.max(st.wCap, 1e-9);
          const dbU = Math.max(ru, wu);
          util[r + ':db'] = dbU;
          dbOk = dbU <= 1 ? 1 : 1 / dbU;
          dbLatency = 6 * qf(dbU);
          if (st.remoteAll || st.writeRemote) crossRegionMs = 2 * GEO_LATENCY[REGION[r].geo][REGION[st.home].geo] * (st.remoteAll ? 1 : (1 - readFrac));
          if (d.node.id === 'dynamodb') dbLatency = 4;
          // DynamoDB provisioned autoscaling lag
          if (d.node.id === 'dynamodb' && d.node.cfg.mode === 'provisioned') {
            const rt = sim.rt[d.node.uid];
            rt.provR = rt.provR * 0.7 + Math.max(dbReads * 1.4, sim.req.rps * 0.3) * 0.3;
            rt.provW = rt.provW * 0.7 + Math.max(wLoad * 1.4, sim.req.rps * 0.1) * 0.3;
          }
        }
        // accumulate DB load for costing after the region loop
        const acc = (dbLoadAcc[d.node.uid] ||= { reads: 0, writes: 0 });
        acc.reads += dbReads; acc.writes += writes;
      }
      // cache hit latency mix
      const hitShare = reads > 0 ? hits / (reads + writes) : 0;
      dbLatency = dbLatency * (1 - hitShare) + 1 * hitShare;
    }

    // features the client needs
    let featureOk = 1;
    for (const need of req.needs || []) featureOk *= needMet(sim, r, need) ? 1 : (NEED_PENALTY[need] ?? 0.9);
    if (sim.mods.outboundDown[r]) featureOk *= 0.85;

    const dynServed = dynServedCompute * dbOk * featureOk;
    const regionServed = edgeServed + staticServed + dynServed;
    served += regionServed;

    // latency samples per geo
    if (L.legit > 0) {
      const lambdaNode = computeNodes.find(n => n.id === 'lambda');
      let computeMs = 22 * qf(u);
      if (lambdaNode) {
        const prev = sim.prevConcurrency[r] || 0;
        const conc = dynLoad * LAMBDA_DUR[lambdaNode.cfg.mem];
        const cold = Math.max(0, conc - Math.max(prev, lambdaNode.cfg.provisioned)) / Math.max(conc, 1);
        sim.prevConcurrency[r] = conc;
        computeMs = 15 + Math.min(1, cold * 4) * 450 + (LAMBDA_DUR[lambdaNode.cfg.mem] * 300);
      }
      if (computeNodes.some(n => n.id === 'eks' && n.cfg.mesh)) computeMs += 3;
      for (const [g, gl] of Object.entries(L.byGeo)) {
        const rtt = 2 * GEO_LATENCY[g][REGION[r].geo] * (ga ? 0.75 : 1);
        const dynMs = rtt + 12 + computeMs + dbLatency + crossRegionMs;
        const statMs = cdn ? 2 * GEO_LATENCY[g][g] * 0.6 + 8 : rtt + 10;
        latSamples.push([dynMs, gl * (1 - staticShare)]);
        latSamples.push([statMs, gl * staticShare]);
      }
    }

    // ---- costs (per day) ----
    for (const n of R.nodes) {
      const c = COMPONENT[n.id], cfg = n.cfg, rt = sim.rt[n.uid];
      switch (c.kind) {
        case 'ec2': addCost('compute', SIZES[cfg.size].day * cfg.count * PURCHASE[cfg.purchase || 'ondemand'].mult * pm); break;
        case 'asg': addCost('compute', SIZES[cfg.size].day * rt.instances.length * PURCHASE[cfg.purchase || 'ondemand'].mult * pm); break;
        case 'fargate': addCost('compute', rt.tasks.length * parseFloat(cfg.task) * 1.19 * (cfg.spot ? 0.3 : 1) * pm); break;
        case 'eks': addCost('compute', (2.4 + rt.nodes.length * SIZES[cfg.nodeSize].day * (cfg.spot ? 0.35 : 1)) * pm); break;
        case 'lambda': {
          const mem = parseInt(cfg.mem, 10) / 1024, dur = LAMBDA_DUR[cfg.mem];
          const share = dynLoad / Math.max(computeNodes.length, 1);
          addCost('compute', share * 86400 * (0.2e-6 + mem * dur * 0.0000166667) * pm + cfg.provisioned * mem * 86400 * 0.0000041667 * pm);
          break;
        }
        case 'apprunner': addCost('compute', (rt.inst.length * 1.85 + 0.25) * pm); break;
        case 'lb': addCost('network', (c.day + c.perRps * (dynLoad + attackLoad)) * pm); break;
        case 'apigw': addCost('network', dynLoad * (cfg.type === 'http' ? 0.0864 : 0.3024) * pm); break;
        case 'cache': addCost('data', CACHE_SIZES[cfg.size].day * cfg.nodes * pm); break;
        case 's3': {
          const gb = req.dataGB || 20, arch = req.archiveGB || 0;
          const cls = cfg.class === 'ia' ? 0.0125 : cfg.class === 'intelligent' ? 0.017 : 0.023;
          const archCost = cfg.lifecycle ? 0.004 : cls;
          addCost('storage', ((gb * cls + arch * archCost) / 30 + originStatic * 0.0346 + (cfg.crr ? gb * 0.02 / 30 + 0.1 : 0)) * pm);
          break;
        }
        case 'efs': addCost('storage', 50 * 0.3 / 30 * pm); break;
        case 'fsx': case 'redshift': case 'tgw': case 'peering': case 'vpn': case 'netfw': case 'mgn': case 'dms': addCost(c.kind === 'netfw' ? 'security' : 'network', (c.day || 0) * pm); break;
        case 'dx': addCost('network', c.day * (cfg.redundant ? 2 : 1) * pm); break;
        case 'nat': {
          const priv = R.kinds.vpc?.[0]?.cfg.private;
          const outboundRps = req.needs?.includes('outbound') ? dynLoad * 0.15 : dynLoad * 0.02;
          const s3ViaNatGB = priv && !R.kinds.vpce ? (req.dataGB || 20) * 0.5 + dynLoad * 0.35 : 0;
          addCost('network', (1.08 + outboundRps * 0.031 + s3ViaNatGB * 0.045) * pm); break;
        }
        case 'vpce': addCost('network', 0.24 * pm); break;
        case 'queue': case 'sns': case 'eventbridge': addCost('messaging', (c.perRps || 0) * dynLoad * (1 - readFrac) * Math.max(asyncFrac, 0.1) * pm); break;
        case 'kinesis': addCost('messaging', (0.36 * cfg.shards + 0.0012 * dynLoad) * pm); break;
        case 'stepfn': addCost('messaging', 0.2 * dynLoad * 0.05 * pm); break;
      }
    }
    // egress
    const egressDyn = (dynServed) * EGRESS_PER_RPS * pm;
    const egressStatic = cdn ? 0 : staticServed * STATIC_EGRESS_PER_RPS * pm;
    addCost('transfer', egressDyn + egressStatic);
    // cross-AZ chatter in multi-AZ designs
    if (computeNodes.length) addCost('transfer', dynServed * 0.0046 * pm);
  }

  // database costs (once per DB node, with its accumulated load)
  for (const n of design.nodes) {
    if (!['rds', 'aurora', 'dynamodb'].includes(n.id)) continue;
    const a = dbLoadAcc[n.uid] || { reads: 0, writes: 0 };
    addDbCost(sim, n, a.reads, a.writes, addCost, REGION[n.region]?.priceMult || 1);
  }

  // global costs
  for (const [kind, list] of Object.entries(ar.global)) for (const n of list) {
    const c = COMPONENT[n.id], cfg = n.cfg;
    switch (kind) {
      case 'cdn': addCost('network', 0.5 + demand * (req.static || 0) * 0.20 + demand * 0.01); break;
      case 'waf': addCost('security', 0.35 + 0.0518 * (demand + sim.attack.l7 + sim.attack.smart) + (cfg.bot ? 0.33 + 0.0864 * demand : 0)); break;
      case 'monitor': addCost('ops', 0.3 + 0.0004 * demand * (cfg.tracing ? 2 : 1)); break;
      case 'guardduty': addCost('security', 1.5 + 0.0002 * demand); break;
      case 'backup': addCost('ops', 0.5 + (req.dataGB || 20) * (cfg.crossRegion ? 0.07 : 0.05) / 30); break;
      case 'dns': addCost('network', 0.02 + demand * 0.0346 + (cfg.health ? 0.03 * design.regions.length : 0) + (cfg.secondary ? 2 : 0)); break;
      default: addCost(kind === 'shield' || ['kms', 'secrets', 'cloudtrail', 'config', 'iam', 'acm', 'orgs'].includes(kind) ? 'security' : 'ops', c.day || 0);
    }
  }
  addCost('security', sim.mods.minerCostDay);

  // region health detection for DNS
  for (const r of design.regions) {
    const unhealthy = sim.regionDown[r] || (util[r] === 99);
    sim.regionErrStreak[r] = unhealthy ? (sim.regionErrStreak[r] || 0) + 1 : 0;
    const need = ga ? 1 : 2;
    if (sim.regionErrStreak[r] >= need && !sim.dnsUnhealthy[r]) { sim.dnsUnhealthy[r] = true; if (ar.g('dns')?.cfg.health || ga) log(sim, 'info', `Health checks: ${r} marked unhealthy. Shifting traffic…`); }
    if (!unhealthy && sim.dnsUnhealthy[r]) sim.dnsUnhealthy[r] = false;
  }

  served = Math.min(served, legitTotal);
  const errRate = legitTotal > 0 ? 1 - served / legitTotal : 0;
  const incidentActive = sim.incidents.some(i => i.state === 'active') || sim.attack.l3 + sim.attack.l7 + sim.attack.smart > 0;
  const spiking = demand > req.rps * 1.35;
  sim.totals.legit += legitTotal; sim.totals.served += served;
  sim.totals.errMinWindow += errRate * TICK_MIN;
  if (!incidentActive && !spiking) { sim.totals.normalLegit += legitTotal; sim.totals.normalServed += served; }

  // RTO tracking
  if (sim.rtoWatch && sim.totals.rto == null && sim.t > sim.rtoWatch.rtoStart && errRate < 0.1) {
    sim.totals.rto = (sim.t - sim.rtoWatch.rtoStart) * TICK_MIN;
    log(sim, 'good', `✔ Service restored. RTO ≈ ${sim.totals.rto} min.`);
  }

  // p95 latency
  latSamples.sort((a, b) => a[0] - b[0]);
  const wsum = latSamples.reduce((a, s) => a + s[1], 0);
  let acc = 0, p95 = 0;
  for (const s of latSamples) { acc += s[1]; if (acc >= wsum * 0.95) { p95 = s[0]; break; } }
  if (!latSamples.length) p95 = 0;

  const tickCost = costDay * sim.days / TICKS;
  sim.totals.cost += tickCost;
  for (const [k, v] of Object.entries(cat)) sim.totals.costByCat[k] = (sim.totals.costByCat[k] || 0) + v * sim.days / TICKS;

  const m = { t, demand, served, errRate, p95, costDay, tickCost, util, attack: sim.attack.l3 + sim.attack.l7 + sim.attack.smart, backlog: sim.backlog, regLoad };
  sim.lastMetrics = m;
  if (!sim.latencyAcc) sim.latencyAcc = [];
  if (errRate < 0.5) sim.latencyAcc.push(p95);
  const H = sim.hist;
  H.demand.push(demand); H.served.push(served); H.errRate.push(errRate); H.p95.push(p95); H.cost.push(costDay); H.attack.push(m.attack);

  // pay as you go
  if (sim.ctx.charge && !sim.suspended) {
    const ok = sim.ctx.charge(tickCost);
    if (!ok) { sim.suspended = true; log(sim, 'breach', '💸 Payment failed. Your cloud account is SUSPENDED. All resources stopped.'); }
  }

  sim.t++;
  if (sim.t >= TICKS) sim.done = true;
  return m;
}

const NEED_PENALTY = { sharedFiles: 0.6, windowsFiles: 0.6, analytics: 1, fanout: 0.85, events: 0.85, stream: 0.8, workflow: 0.85, hybrid: 0.5, outbound: 0.85, k8s: 1, serverless: 1, containers: 1 };

export function needMet(sim, region, need) {
  const { ar } = sim;
  const R = ar.byRegion[region];
  const k = kind => !!R?.kinds[kind]?.length || !!ar.global[kind]?.length;
  switch (need) {
    case 'sharedFiles': return k('efs') || k('fsx');
    case 'windowsFiles': return k('fsx');
    case 'analytics': return true; // handled through the analytics_load incident
    case 'fanout': return k('sns') || k('eventbridge');
    case 'events': return k('eventbridge');
    case 'stream': return k('kinesis');
    case 'workflow': return k('stepfn');
    case 'hybrid': return ar.has('vpn') || ar.has('dx');
    case 'outbound': {
      const vpc = R?.kinds.vpc?.[0];
      if (!vpc?.cfg.private) return true;
      return k('nat');
    }
    case 'k8s': return ar.has('eks');
    case 'serverless': return ar.has('lambda');
    case 'containers': return ar.has('eks') || ar.has('fargate');
  }
  return true;
}

function addDbCost(sim, n, reads, writes, addCost, pm) {
  const cfg = n.cfg, gb = sim.req.dataGB || 20;
  if (n.id === 'rds') {
    const s = DB_SIZES[cfg.size];
    addCost('data', (s.day * (cfg.multiAZ ? 2 : 1) + s.day * (cfg.replicas || 0) + gb * 0.115 / 30 * (cfg.multiAZ ? 2 : 1) + (cfg.proxy ? s.day * 0.15 : 0) + (cfg.crossRegionReplica ? s.day + writes * 0.002 : 0)) * pm);
  } else if (n.id === 'aurora') {
    const s = DB_SIZES[cfg.size];
    const inst = cfg.serverless ? Math.max(1.44, (reads / 2000 + writes / 700) * 4.1 * 1.25) : s.day * 1.2 * (1 + (cfg.replicas || 0));
    const secondaries = cfg.global ? sim.design.regions.filter(r => r !== n.region && !sim.ar.byRegion[r].kinds.aurora).length : 0;
    addCost('data', (inst + gb * 0.1 / 30 + writes * 0.0173 + secondaries * (s.day * 1.2 + writes * 0.0173 + gb * 0.1 / 30)) * pm);
  } else if (n.id === 'dynamodb') {
    const extra = cfg.global ? Math.max(0, sim.design.regions.length - 1) : 0;
    addCost('data', ((reads * 0.0216 + writes * 0.108 * (1 + 1.5 * extra)) * (cfg.mode === 'provisioned' ? 0.25 : 1) + gb * 0.25 / 30 * (1 + extra) + (cfg.dax ? 3 : 0)) * pm);
  }
}


// ───────────── final results ─────────────
export function results(sim) {
  const { req, totals } = sim;
  const totalMin = (req.days || 30) * 1440;
  const windowMin = TICKS * TICK_MIN;
  const normalErr = totals.normalLegit > 0 ? 1 - totals.normalServed / totals.normalLegit : 0;
  let errMin = totals.errMinWindow + normalErr * (totalMin - windowMin);
  // Something still broken at the end (e.g. a dead server nobody replaced) stays broken.
  const unresolved = sim.incidents.some(i => i.persistent && !i.actionDone);
  if (unresolved) { const last = sim.hist.errRate.slice(-10); errMin += (last.reduce((a, b) => a + b, 0) / Math.max(1, last.length)) * (totalMin - windowMin) * 0.25; }
  const availability = Math.max(0, 100 * (1 - errMin / totalMin));
  const lat = (sim.latencyAcc || []).slice().sort((a, b) => a - b);
  const p95 = lat.length ? lat[Math.floor(lat.length * 0.95) - 1] || lat[lat.length - 1] : 9999;
  return {
    availability, errMin, p95, cost: totals.cost, costByCat: totals.costByCat,
    breaches: totals.breaches, rto: totals.rto, rpo: totals.dataLossMin, suspended: sim.suspended,
    windowAvail: totals.legit ? 100 * totals.served / totals.legit : 100,
  };
}
