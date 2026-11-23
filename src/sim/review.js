// Pre-flight "Well-Architected" review and cost/capacity estimates.
import { COMPONENT, SIZES, DB_SIZES, CACHE_SIZES } from '../data/components.js';
import { REGION } from '../data/regions.js';
import { analyze, COMPUTE_KINDS, regionNodes, isEU } from './analyze.js';
import { createSim, step, needMet, TICKS } from './sim.js';

export const COMPLIANCE = {
  encryptAtRest: { label: 'Encryption at rest', check: ar => ar.has('kms'), fix: 'Add KMS.', codex: 'kms' },
  encryptInTransit: { label: 'Encryption in transit (TLS)', check: ar => ar.has('acm'), fix: 'Add ACM certificates.', codex: 'acm' },
  audit: { label: 'Audit logging', check: ar => ar.has('cloudtrail'), fix: 'Enable CloudTrail.', codex: 'cloudtrail' },
  private: { label: 'Private networking', check: ar => ar.design.nodes.filter(n => n.id === 'vpc').every(v => v.cfg.private) && ar.design.nodes.some(n => n.id === 'vpc'), fix: 'Enable private subnets on every VPC.', codex: 'vpc' },
  leastPriv: { label: 'Least-privilege IAM', check: ar => ar.has('iam'), fix: 'Add IAM roles.', codex: 'iam' },
  secrets: { label: 'Secrets management', check: ar => ar.has('secrets'), fix: 'Add Secrets Manager.', codex: 'secrets' },
  threatDetect: { label: 'Threat detection', check: ar => ar.has('guardduty'), fix: 'Add GuardDuty.', codex: 'guardduty' },
  residencyEU: { label: 'EU data residency', check: ar => ar.regionsUsed.length > 0 && ar.regionsUsed.every(isEU), fix: 'Only use EU regions.', codex: 'residency' },
  backup: { label: 'Managed backups', check: ar => ar.has('backup'), fix: 'Add AWS Backup.', codex: 'backup' },
  multiAccount: { label: 'Multi-account governance', check: ar => ar.has('orgs'), fix: 'Add Organizations + SCPs.', codex: 'orgs' },
  sso: { label: 'Single sign-on', check: ar => ar.global.orgs?.[0]?.cfg.sso, fix: 'Enable IAM Identity Center in Organizations.', codex: 'orgs' },
  waf: { label: 'Web application firewall', check: ar => ar.has('waf'), fix: 'Add WAF.', codex: 'waf' },
  noSSH: { label: 'No SSH exposure', check: ar => !ar.has('bastion'), fix: 'Remove the bastion; use Systems Manager.', codex: 'ssm' },
  flowLogs: { label: 'Network flow logs', check: ar => ar.design.nodes.filter(n => n.id === 'vpc').every(v => v.cfg.flowlogs), fix: 'Enable VPC Flow Logs.', codex: 'vpc' },
  iac: { label: 'Infrastructure as code', check: ar => ar.has('terraform'), fix: 'Manage it with Terraform.', codex: 'terraform' },
  cicd: { label: 'Automated deployments', check: ar => ar.has('cicd'), fix: 'Add a CI/CD pipeline.', codex: 'cicd' },
  monitoring: { label: 'Monitoring & alarms', check: ar => ar.has('monitor'), fix: 'Add monitoring.', codex: 'cloudwatch' },
};

export const NEEDS = {
  sharedFiles: 'Shared POSIX filesystem (EFS/FSx)',
  windowsFiles: 'Windows SMB shares (FSx)',
  analytics: 'Heavy analytics/reporting (warehouse or replica)',
  fanout: 'Fan-out notifications (SNS/EventBridge)',
  events: 'Event routing between services (EventBridge)',
  stream: 'High-volume ordered event stream (Kinesis)',
  workflow: 'Multi-step workflow orchestration (Step Functions)',
  hybrid: 'Connectivity to on-prem datacenter (VPN/Direct Connect)',
  outbound: 'Calls third-party APIs (outbound internet)',
  k8s: 'Client mandates Kubernetes',
  serverless: 'Client mandates serverless',
  containers: 'App ships as containers',
};

export function review(design, job, skills) {
  const ar = analyze(design);
  const req = job.req;
  const sk = new Set(skills || []);
  const items = []; // {level: 'error'|'warn'|'ok'|'tip', text, codex}
  const E = (text, codex) => items.push({ level: 'error', text, codex });
  const W = (text, codex) => items.push({ level: 'warn', text, codex });
  const T = (text, codex) => items.push({ level: 'tip', text, codex });
  const deep = sk.has('ha_multiaz');

  if (!design.nodes.length) E('Nothing deployed yet.');
  for (const r of design.regions) {
    const R = ar.byRegion[r];
    const nonVpc = R.nodes.filter(n => n.id !== 'vpc');
    if (nonVpc.length && !R.kinds.vpc) E(`${r}: resources need a VPC first.`, 'vpc');
    const comp = regionNodes(ar, r, COMPUTE_KINDS);
    const units = comp.reduce((a, n) => a + (n.id === 'ec2' ? n.cfg.count : 2), 0);
    const hasLB = R.kinds.lb || R.kinds.apigw;
    if (comp.some(n => ['asg', 'fargate', 'eks'].includes(n.id)) && !hasLB) E(`${r}: ASG/containers/Kubernetes need a load balancer in front.`, 'alb');
    else if (units > 1 && !hasLB && comp.every(n => n.id === 'ec2')) W(`${r}: multiple servers but no load balancer — only one will get traffic.`, 'alb');
    const ec2AZs = new Set(comp.filter(n => n.id === 'ec2').map(n => n.az));
    if (deep && comp.length && comp.every(n => n.id === 'ec2') && ec2AZs.size === 1) W(`${r}: all compute in one AZ — an AZ outage takes you down.`, 'multiaz');
    for (const n of comp) if (n.id === 'asg' && n.cfg.azs < 2 && deep) W(`${r}: Auto Scaling Group spans only 1 AZ.`, 'multiaz');
    for (const n of R.kinds.rds || []) if (!n.cfg.multiAZ && req.availability >= 99.9) W(`${r}: single-AZ RDS is a single point of failure for a ${req.availability}% SLA.`, 'rds');
    for (const n of R.kinds.rds || []) if (!n.cfg.pitr) W(`${r}: RDS backups are disabled.`, 'backup');
    const vpc = R.kinds.vpc?.[0];
    if (vpc?.cfg.private && (req.needs || []).includes('outbound') && !R.kinds.nat) E(`${r}: private subnets need a NAT Gateway to call external APIs.`, 'nat');
    if (deep && R.kinds.nat?.length === 1 && comp.length) W(`${r}: one NAT Gateway — if its AZ fails, other AZs lose outbound.`, 'nat');
    if (vpc?.cfg.private && R.kinds.nat && R.kinds.s3 && !R.kinds.vpce) T(`${r}: S3 traffic flows through NAT ($0.045/GB). A free gateway endpoint avoids it.`, 'vpce');
    for (const c of R.kinds.cache || []) if (c.cfg.nodes < 2 && deep) W(`${r}: single cache node — losing it sends every read to the DB.`, 'elasticache');
    if (R.kinds.eks) for (const n of R.kinds.eks) { if (!n.cfg.pdb && sk.has('k8s_ops')) T(`${r}: EKS without PodDisruptionBudgets — node upgrades will drop pods.`, 'eks'); if (n.cfg.autoscaler === 'none' && sk.has('k8s_scaling')) T(`${r}: EKS nodes won't scale — HPA pods may stay Pending.`, 'eks'); }
    if (R.kinds.bastion) W(`${r}: SSH bastion exposes port 22 to the internet.`, 'bastion');
  }
  if (!ar.regionsUsed.length && design.nodes.some(n => COMPONENT[n.id].scope !== 'global')) E('Pick a region and add a VPC.');
  const anyCompute = design.regions.some(r => regionNodes(ar, r, COMPUTE_KINDS).length);
  if ((req.static ?? 0) < 1 && !anyCompute) E('No compute: dynamic requests have nowhere to run.', 'ec2');
  if ((req.static ?? 0) >= 1 && !anyCompute && !ar.has('s3')) E('Static site needs an S3 bucket (or a server).', 's3');
  if (req.stateful !== false && (req.static ?? 0) < 1 && !design.nodes.some(n => ['rds', 'aurora', 'dynamodb'].includes(n.id))) E('This app stores data but has no database.', 'rds');
  if ((req.async || 0) > 0.2 && !design.nodes.some(n => ['queue', 'sns', 'eventbridge', 'kinesis'].includes(COMPONENT[n.id].kind))) W('Heavy background work runs inline — a queue would decouple it.', 'sqs');
  if ((req.static || 0) > 0.3 && !ar.has('cdn')) T('Lots of static content — a CDN would cut latency and origin load.', 'cloudfront');
  if (Object.keys(req.geo || {}).length > 1 && ar.regionsUsed.length < 2 && !ar.has('cdn')) T('Users are spread globally; consider a CDN or more regions.', 'cloudfront');
  if (design.regions.length > 1) {
    const dns = ar.g('dns');
    if (!dns && !ar.has('globalacc')) W('Multiple regions but no DNS routing — only the first region gets traffic.', 'route53');
    else if (dns && !dns.cfg.health && !ar.has('globalacc')) W('No health checks: DNS will keep sending users to a dead region.', 'route53');
  }
  if ((req.threat || 0) >= 1 && !ar.has('waf') && sk.has('sec_waf')) W('Expect attacks — no WAF in front.', 'waf');
  if ((req.threat || 0) >= 2 && !ar.has('cdn') && !ar.has('shield') && !ar.has('globalacc')) W('No edge layer to absorb volumetric DDoS.', 'shield');
  if (!ar.has('monitor')) W('No monitoring — you will detect incidents late.', 'cloudwatch');
  for (const need of req.needs || []) {
    const met = design.regions.some(r => needMet({ ar }, r, need)) || (need === 'analytics' && ar.has('redshift'));
    if (!met && need !== 'analytics') E(`Requirement: ${NEEDS[need]}.`);
    if (need === 'analytics' && !met) W(`Requirement: ${NEEDS[need]}.`, 'redshift');
  }
  for (const c of req.compliance || []) {
    const def = COMPLIANCE[c];
    if (def && !def.check(ar)) E(`Compliance: ${def.label} — ${def.fix}`, def.codex);
  }
  if ((req.regionsMin || 1) > ar.regionsUsed.length) E(`Client requires ${req.regionsMin}+ regions.`, 'dr');

  // capacity estimate (right-sizing skill)
  let est = null;
  if (sk.has('cost_basics')) est = estimate(design, job, skills);
  if (est && sk.has('cost_rightsize')) {
    if (est.peakUtil > 1.05) W(`Capacity: peak load ≈ ${Math.round(est.peakUtil * 100)}% of compute capacity. You'll drop requests.`, 'rightsize');
    else if (est.avgUtil < 0.2 && est.costPerDay > 5) T(`Capacity: average utilization only ≈ ${Math.round(est.avgUtil * 100)}%. You're over-provisioned.`, 'rightsize');
  }
  if (!items.some(i => i.level === 'error' || i.level === 'warn')) items.push({ level: 'ok', text: 'No blocking issues found.' });
  return { items, est, blocking: items.some(i => i.level === 'error') };
}

// Run a fast incident-free simulation to estimate cost and utilization.
export function estimate(design, job, skills) {
  const quiet = { ...job, req: { ...job.req, incidents: [], randomIncidents: 0, threat: 0 } };
  const d = JSON.parse(JSON.stringify(design));
  const sim = createSim(d, quiet, { skills });
  let cost = 0, peakU = 0, sumU = 0, n = 0, err = 0;
  for (let i = 0; i < TICKS; i += 1) {
    const m = step(sim);
    cost += m.costDay; err += m.errRate;
    const us = Object.entries(m.util).filter(([k]) => !k.includes(':')).map(([, v]) => v).filter(v => v < 50);
    const u = us.length ? Math.max(...us) : 0;
    peakU = Math.max(peakU, u); sumU += u; n++;
  }
  return { costPerDay: cost / TICKS, total: (cost / TICKS) * (job.req.days || 30), peakUtil: peakU, avgUtil: sumU / Math.max(n, 1), errRate: err / TICKS };
}
