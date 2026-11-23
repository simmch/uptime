import { COMPONENT } from '../data/components.js';
import { REGION } from '../data/regions.js';

// Index a design for quick lookups by both the sim and the reviewer.
export function analyze(design) {
  const byRegion = {};
  const global = {};
  for (const r of design.regions) byRegion[r] = { region: r, kinds: {}, nodes: [] };
  for (const n of design.nodes) {
    const comp = COMPONENT[n.id];
    if (!comp) continue;
    if (comp.scope === 'global') {
      (global[comp.kind] ||= []).push(n);
    } else if (byRegion[n.region]) {
      byRegion[n.region].nodes.push(n);
      (byRegion[n.region].kinds[comp.kind] ||= []).push(n);
    }
  }
  const has = k => !!global[k]?.length || Object.values(byRegion).some(r => r.kinds[k]?.length);
  const g = k => global[k]?.[0];
  const regionsUsed = design.regions.filter(r => byRegion[r].nodes.length > 0);
  return { byRegion, global, has, g, regionsUsed, design };
}

export const COMPUTE_KINDS = ['ec2', 'asg', 'fargate', 'eks', 'lambda', 'apprunner'];
export const DB_KINDS = ['rds', 'aurora', 'dynamodb'];

export function regionHas(ar, region, kind) {
  return !!ar.byRegion[region]?.kinds[kind]?.length;
}
export function regionNodes(ar, region, kinds) {
  const r = ar.byRegion[region];
  if (!r) return [];
  return kinds.flatMap(k => r.kinds[k] || []);
}

export const EU_JUR = ['EU', 'NL', 'BE'];
export const isEU = regionId => EU_JUR.includes(REGION[regionId]?.jur);
