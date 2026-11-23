// The 8 core learning domains. Every skill, codex entry, quiz question,
// lab and component belongs to one of these.
export const DOMAINS = {
  net: {
    id: 'net', name: 'Networking & Connectivity', short: 'NET', color: '#4fc3f7', sprite: 'router',
    blurb: 'VPCs, subnets, CIDR, routing, gateways, DNS, CDN, load balancers, hybrid links.',
    gameplay: 'Design networks, connect services, diagnose unreachable resources, build hybrid links.',
  },
  compute: {
    id: 'compute', name: 'Compute & App Architecture', short: 'CMP', color: '#ffb74d', sprite: 'server',
    blurb: 'EC2, Auto Scaling, Lambda, ECS/Fargate, EKS/Kubernetes, API Gateway, messaging, microservices.',
    gameplay: 'Build and scale applications with the right compute and integration services.',
  },
  data: {
    id: 'data', name: 'Storage, Databases & Data', short: 'DAT', color: '#81c784', sprite: 'db',
    blurb: 'S3 and storage classes, EBS/EFS/FSx, RDS/Aurora, DynamoDB, caching, warehousing, replication.',
    gameplay: 'Choose storage and databases by latency, durability, cost and availability.',
  },
  sec: {
    id: 'sec', name: 'Security, IAM & Governance', short: 'SEC', color: '#e57373', sprite: 'waf',
    blurb: 'IAM, policies, cross-account roles, Organizations/SCPs, KMS, WAF/Shield, detection, compliance.',
    gameplay: 'Secure environments, evaluate permissions, and fix misconfigurations.',
  },
  ha: {
    id: 'ha', name: 'Reliability & Disaster Recovery', short: 'REL', color: '#ba68c8', sprite: 'lighthouse',
    blurb: 'Multi-AZ vs multi-region, RTO/RPO, backup, pilot light, warm standby, active-active, blast radius.',
    gameplay: 'Survive AZ and regional outages and meet business continuity targets.',
  },
  mig: {
    id: 'mig', name: 'Migration & Hybrid Cloud', short: 'MIG', color: '#4db6ac', sprite: 'trucks',
    blurb: 'The 7 Rs, discovery, MGN, DMS, Snow Family, DataSync, waves, cutover, hybrid networking.',
    gameplay: 'Move an enterprise from on-prem to cloud under budget, downtime and security limits.',
  },
  cost: {
    id: 'cost', name: 'Cost Optimization & Performance', short: 'CST', color: '#fff176', sprite: 'coins',
    blurb: 'Purchasing models, Savings Plans, Spot, right-sizing, data transfer, lifecycle, caching.',
    gameplay: 'Hit performance and availability targets while minimizing total cost.',
  },
  ops: {
    id: 'ops', name: 'Deployment & Operations', short: 'OPS', color: '#90a4ae', sprite: 'terraform',
    blurb: 'Git, pull requests, CI/CD, Terraform/CloudFormation, deployment strategies, monitoring, automation.',
    gameplay: 'Ship infrastructure as code, run pipelines, deploy safely, troubleshoot failed releases.',
  },
};
export const DOMAIN_IDS = Object.keys(DOMAINS);
