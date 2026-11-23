import { createSim, step, results } from '../src/sim/sim.js';
import { storyJob, referenceDesign, mkNode } from '../src/data/jobs.js';
import { STORY_JOBS } from '../src/data/story.js';
import { gradeBuild } from '../src/game.js';
const ALL = ['ha_quotas','k8s_scaling'];
for (const [id, s] of Object.entries(STORY_JOBS)) {
  if (s.type !== 'build') continue;
  const job = storyJob(id);
  const d = job.presetDesign ? JSON.parse(JSON.stringify(job.presetDesign)) : referenceDesign(job.req);
  // "expert" upgrades
  const g = n => d.nodes.find(x => x.id === n);
  const add = (id, cfg={}) => { if (!g(id)) d.nodes.push(mkNode(id, null, null, cfg)); };
  add('cloudwatch', {slo:true}); add('waf', {bot: job.req.threat>=3}); add('cicd', {strategy:'canary', scan:true, oidc:true}); add('terraform', {drift:true});
  add('iam'); add('secrets'); add('guardduty'); add('acm'); add('backup', {vaultLock:true, crossRegion:true});
  if (job.req.threat >= 2) { add('cloudfront'); }
  if (job.req.threat >= 3) add('shield');
  if (job.req.needs?.includes('k8s')) { const a = g('asg'); if (a) { a.id='eks'; a.cfg = { ...mkNode('eks').cfg, nodeSize:'xlarge', nodesMin: 4, nodesMax: 80, autoscaler:'karpenter', pdb:true, probes:true, replicas: 10 }; } }
  for (const n of d.nodes) { if (n.id==='rds') { n.cfg.multiAZ=true; } if (n.id==='elasticache') n.cfg.nodes=2; if (n.id==='nat') {} }
  // per-AZ NAT
  for (const r of d.regions) { const nats = d.nodes.filter(n=>n.id==='nat'&&n.region===r); if (nats.length===1) d.nodes.push(mkNode('nat', r, 1)); }
  const dns = g('route53'); if (dns) { dns.cfg.health = true; if (d.regions.length>1) dns.cfg.policy='latency'; if (job.mode==='signal') dns.cfg.secondary=true; }
  const sim = createSim(d, job, { skills: ALL });
  while (!sim.done) step(sim);
  const res = results(sim);
  const gr = gradeBuild(job, d, res);
  console.log(id.padEnd(14), 'grade', gr.grade, 'score', gr.score, 'avail', res.availability.toFixed(3), 'p95', Math.round(res.p95), 'cost', Math.round(res.cost), 'budget', job.budget, 'pay', job.pay, 'rto', res.rto, 'rpo', res.rpo, '|', gr.lines.filter(l=>!l.ok).map(l=>l.text).join(' ; '));
}
