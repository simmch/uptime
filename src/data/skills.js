// Skill tree: 8 domains × tiers. Each skill costs skill points (SP) and a
// course fee ($). Some require a minimum level or a certification.
// `perk` is a free-text description of non-component effects the sim reads.
const S = (id, domain, tier, name, sp, price, lvl, req, desc, extra = {}) =>
  ({ id, domain, tier, name, sp, price, lvl, req, desc, ...extra });

export const SKILLS = [
  // ── NETWORKING ──
  S('net_basics', 'net', 0, 'Networking 101', 0, 0, 1, [], 'IP, ports, DNS, HTTP, VPC basics. Starter skill.', { starter: true }),
  S('net_subnets', 'net', 1, 'Subnets & Routing', 1, 120, 2, ['net_basics'], 'Public vs private subnets, route tables, IGW, NAT Gateway. Unlocks private subnets, NAT, Network Lab.'),
  S('net_cdn', 'net', 1, 'Content Delivery', 1, 150, 3, ['net_basics'], 'CloudFront caching, TTLs, origins. Unlocks CDN.'),
  S('net_dns', 'net', 2, 'DNS Routing Policies', 1, 200, 5, ['net_subnets'], 'Failover, latency, weighted, geolocation routing and health checks.'),
  S('net_private', 'net', 2, 'Private Connectivity', 1, 250, 7, ['net_subnets'], 'VPC endpoints & PrivateLink. Keep traffic off the internet; skip NAT charges.'),
  S('net_nlb', 'net', 2, 'Layer-4 Load Balancing', 1, 200, 8, ['compute_lb'], 'Network Load Balancer for TCP/UDP and extreme throughput.'),
  S('net_peering', 'net', 3, 'VPC Peering', 1, 300, 9, ['net_private'], 'Non-transitive VPC-to-VPC links; CIDR planning.'),
  S('net_tgw', 'net', 3, 'Transit Gateway', 2, 600, 13, ['net_peering'], 'Hub-and-spoke routing for many VPCs and accounts.'),
  S('net_hybrid', 'net', 3, 'Hybrid Networking & BGP', 2, 700, 14, ['net_tgw'], 'Site-to-Site VPN, BGP route propagation, on-prem integration.'),
  S('net_global', 'net', 4, 'Global Edge Networking', 2, 1500, 20, ['net_dns', 'net_cdn'], 'Global Accelerator, anycast, multi-region traffic steering.'),

  // ── COMPUTE ──
  S('compute_basics', 'compute', 0, 'Virtual Machines', 0, 0, 1, [], 'EC2 instances, sizes, AMIs. Starter skill.', { starter: true }),
  S('compute_lb', 'compute', 1, 'Load Balancing', 1, 100, 2, ['compute_basics'], 'Application Load Balancer, target groups, health checks.'),
  S('compute_asg', 'compute', 1, 'Auto Scaling', 1, 150, 3, ['compute_lb'], 'Auto Scaling Groups across AZs, target tracking policies.'),
  S('compute_paas', 'compute', 1, 'Managed Platforms', 1, 100, 2, ['compute_basics'], 'App Runner / Beanstalk — deploy from a repo with zero server management.'),
  S('compute_serverless', 'compute', 2, 'Serverless', 1, 250, 5, ['compute_asg'], 'Lambda + API Gateway. Pay-per-request compute, cold starts, concurrency.'),
  S('compute_queues', 'compute', 2, 'Queues & Decoupling', 1, 250, 5, ['compute_asg'], 'SQS & SNS: async processing, buffering spikes, fan-out, DLQs.'),
  S('compute_containers', 'compute', 2, 'Containers', 1, 300, 6, ['compute_asg'], 'Docker images, ECS, Fargate, ECR.'),
  S('compute_events', 'compute', 3, 'Event-Driven Architecture', 2, 500, 10, ['compute_queues', 'compute_serverless'], 'EventBridge, Kinesis, Step Functions, sagas.'),
  S('k8s_basics', 'compute', 3, 'Kubernetes Fundamentals', 2, 600, 9, ['compute_containers'], 'Pods, Deployments, Services, Ingress, namespaces, EKS. Unlocks kubectl terminal.'),
  S('k8s_scaling', 'compute', 3, 'Kubernetes Autoscaling', 1, 500, 11, ['k8s_basics'], 'HPA on CPU/custom metrics; Cluster Autoscaler; requests & limits.'),
  S('k8s_ops', 'compute', 4, 'Kubernetes Operations', 1, 700, 13, ['k8s_basics'], 'Probes, PodDisruptionBudgets, rolling updates, node upgrades, Helm.'),
  S('k8s_security', 'compute', 4, 'Kubernetes Security', 2, 900, 15, ['k8s_ops', 'sec_iam_adv'], 'RBAC, NetworkPolicies, IRSA/Pod Identity, Pod Security Standards.'),
  S('k8s_karpenter', 'compute', 4, 'Karpenter', 1, 800, 16, ['k8s_scaling'], 'Just-in-time, bin-packed node provisioning with Spot diversity.'),
  S('k8s_mesh', 'compute', 5, 'Service Mesh & Platform Eng', 2, 2000, 22, ['k8s_security'], 'Istio/Linkerd mTLS, retries, traffic splitting; internal developer platforms.'),

  // ── DATA ──
  S('data_basics', 'data', 0, 'Databases 101', 0, 0, 1, [], 'RDS, S3, SQL vs NoSQL basics. Starter skill.', { starter: true }),
  S('data_s3', 'data', 1, 'S3 Storage Classes', 1, 120, 3, ['data_basics'], 'Standard, IA, Intelligent-Tiering, Glacier and lifecycle policies.'),
  S('data_rds_ha', 'data', 1, 'RDS High Availability', 1, 200, 4, ['data_basics'], 'Multi-AZ standby (sync) vs read replicas (async). Failover behavior.'),
  S('data_cache', 'data', 2, 'Caching', 1, 250, 5, ['data_basics'], 'ElastiCache Redis: cache-aside, TTLs, eviction, hot keys.'),
  S('data_nosql', 'data', 2, 'NoSQL & DynamoDB', 1, 300, 7, ['data_rds_ha'], 'Partition keys, access patterns, on-demand vs provisioned.'),
  S('data_files', 'data', 2, 'File Storage', 1, 200, 6, ['data_basics'], 'EBS vs EFS vs FSx: block, NFS, SMB, Lustre.'),
  S('data_aurora', 'data', 3, 'Aurora', 2, 600, 10, ['data_rds_ha'], 'Shared storage across 3 AZs, 15 replicas, fast failover, Serverless v2.'),
  S('data_perf', 'data', 3, 'Database Performance', 1, 500, 12, ['data_cache', 'data_aurora'], 'RDS Proxy, connection pooling, query tuning, DAX, Serverless v2.'),
  S('data_analytics', 'data', 3, 'Analytics & Warehousing', 2, 700, 12, ['data_nosql'], 'Redshift, Athena, data lakes — keep OLAP off OLTP.'),

  // ── SECURITY ──
  S('sec_basics', 'sec', 0, 'Security Fundamentals', 0, 0, 1, [], 'Shared responsibility, IAM basics, CloudTrail. Starter skill.', { starter: true }),
  S('sec_encrypt', 'sec', 1, 'Encryption', 1, 150, 3, ['sec_basics'], 'KMS at rest, ACM/TLS in transit, envelope encryption.'),
  S('sec_secrets', 'sec', 1, 'Secrets Management', 1, 150, 3, ['sec_basics'], 'Secrets Manager, rotation, never commit keys.'),
  S('sec_waf', 'sec', 1, 'Web Application Firewall', 1, 200, 4, ['sec_basics'], 'AWS WAF managed rules, SQLi/XSS, rate limiting. Unlocks Security Audit lab.'),
  S('sec_detect', 'sec', 2, 'Threat Detection', 1, 350, 7, ['sec_waf'], 'GuardDuty, Config rules, Security Hub, VPC Flow Logs.'),
  S('sec_iam_adv', 'sec', 2, 'Advanced IAM', 2, 450, 8, ['sec_secrets'], 'Policy evaluation logic, resource policies, AssumeRole, cross-account, boundaries. Unlocks IAM puzzles.'),
  S('sec_shield', 'sec', 3, 'DDoS Resilience', 1, 500, 10, ['sec_waf'], 'Shield Advanced, absorbing volumetric attacks, scaling to survive.'),
  S('sec_bot', 'sec', 3, 'Bot Mitigation', 1, 600, 12, ['sec_shield'], 'WAF Bot Control, CAPTCHA, credential-stuffing defense.'),
  S('sec_ransomware', 'sec', 3, 'Ransomware Defense', 1, 600, 12, ['sec_detect'], 'Immutable backups, Object Lock, Vault Lock, isolated recovery accounts.'),
  S('sec_org', 'sec', 4, 'Multi-Account Governance', 2, 1200, 15, ['sec_iam_adv'], 'Organizations, SCPs, Control Tower landing zones, Identity Center.'),
  S('sec_netfw', 'sec', 4, 'Network Firewalls', 1, 900, 16, ['sec_detect', 'net_tgw'], 'Network Firewall, inspection VPCs, egress filtering.'),

  // ── RELIABILITY / DR ──
  S('ha_basics', 'ha', 0, 'Availability Basics', 0, 0, 1, [], 'Regions, AZs, SLAs, nines. Starter skill.', { starter: true }),
  S('ha_multiaz', 'ha', 1, 'Multi-AZ Design', 1, 150, 3, ['ha_basics'], 'Spread every tier across AZs. Eliminate single points of failure. Unlocks deeper preflight review.'),
  S('ha_backup', 'ha', 1, 'Backup & Restore', 1, 200, 4, ['ha_basics'], 'AWS Backup, RPO/RTO, retention, restore testing.'),
  S('ha_multiregion', 'ha', 2, 'Multi-Region DR', 2, 800, 9, ['ha_multiaz', 'ha_backup'], 'Pilot light, warm standby, cross-region replicas. Unlocks a 2nd region.', { regions: 2 }),
  S('ha_quotas', 'ha', 2, 'Quotas & Limits', 1, 300, 8, ['ha_multiaz'], 'Service quotas, throttling, request increases before launch day.'),
  S('ha_chaos', 'ha', 3, 'Chaos Engineering', 1, 900, 14, ['ha_multiregion'], 'Fault Injection Service, game days, Resilience Hub.'),
  S('ha_global', 'ha', 3, 'Global Active-Active', 2, 2500, 18, ['ha_multiregion', 'net_dns'], 'Aurora Global, DynamoDB Global Tables, multi-region writes. Up to 4 regions.', { regions: 4 }),
  S('ha_planet', 'ha', 4, 'Planet-Scale Architecture', 3, 8000, 26, ['ha_global'], 'Cell-based architecture, shuffle sharding, static stability. Up to 7 regions.', { regions: 7 }),
  S('ha_multicloud', 'ha', 5, 'Multi-Cloud Survival', 3, 15000, 30, ['ha_planet'], 'Run on AWS, Azure and GCP at once. Secondary DNS providers.', { regions: 10, story: 'villain' }),

  // ── MIGRATION ──
  S('mig_basics', 'mig', 1, 'Migration Strategy (7 Rs)', 1, 300, 6, ['compute_basics'], 'Retire, Retain, Rehost, Relocate, Replatform, Repurchase, Refactor. Unlocks Migration Planner.'),
  S('mig_tools', 'mig', 2, 'Migration Tooling', 1, 500, 9, ['mig_basics'], 'Application Discovery, MGN, DMS, SCT, DataSync, Snow Family.'),
  S('mig_dx', 'mig', 3, 'Direct Connect', 2, 900, 14, ['mig_tools', 'net_hybrid'], 'Dedicated links, LAGs, redundant DX, VPN backup.'),
  S('mig_waves', 'mig', 3, 'Wave Planning & Cutover', 1, 800, 15, ['mig_tools'], 'Dependency mapping, move groups, cutover runbooks, rollback plans.'),

  // ── COST ──
  S('cost_basics', 'cost', 1, 'Cloud Billing Basics', 1, 50, 2, ['compute_basics'], 'Cost Explorer, Budgets, tagging. Shows live cost estimate in Build.'),
  S('cost_rightsize', 'cost', 1, 'Right-Sizing', 1, 150, 4, ['cost_basics'], 'Compute Optimizer, matching size to load. Shows capacity estimate in preflight.'),
  S('cost_commit', 'cost', 2, 'Savings Plans & RIs', 1, 300, 7, ['cost_rightsize'], 'Commitment discounts for steady baseline load.'),
  S('cost_spot', 'cost', 2, 'Spot Instances', 1, 300, 8, ['cost_rightsize'], 'Up to 90% off for interruptible, diversified workloads.'),
  S('cost_cache', 'cost', 2, 'Edge & Cache Economics', 1, 250, 6, ['net_cdn'], 'Cache dynamic content, origin shield, cut data transfer costs.'),
  S('cost_scaling', 'cost', 3, 'Advanced Scaling', 1, 600, 12, ['cost_spot', 'compute_asg'], 'Predictive scaling, warm pools, scheduled actions.'),
  S('cost_finops', 'cost', 3, 'FinOps Practice', 2, 1000, 15, ['cost_commit'], 'Unit economics, CUR, showback. +15% pay on cost-graded jobs.'),

  // ── OPS ──
  S('ops_git', 'ops', 0, 'Git Fundamentals', 0, 0, 1, [], 'Commits, branches, merges. Starter skill — unlocks the Terminal.', { starter: true }),
  S('ops_terraform', 'ops', 1, 'Terraform', 1, 250, 4, ['ops_git'], 'Providers, resources, plan/apply, state. Setup costs -40%, see your design as HCL.'),
  S('ops_cicd', 'ops', 1, 'CI/CD Pipelines', 1, 250, 5, ['ops_git'], 'GitHub Actions / CodePipeline, build-test-deploy, environments.'),
  S('ops_deploy', 'ops', 2, 'Deployment Strategies', 1, 400, 8, ['ops_cicd'], 'Blue/green, canary, automatic rollback on alarms.'),
  S('ops_observability', 'ops', 2, 'Observability & SLOs', 1, 400, 8, ['ops_cicd'], 'Tracing, SLOs, error budgets, burn-rate alerting.'),
  S('ops_ssm', 'ops', 2, 'Systems Manager', 1, 250, 7, ['ops_terraform'], 'Session Manager, Patch Manager, Run Command, automation.'),
  S('ops_tf_adv', 'ops', 3, 'Terraform at Scale', 2, 800, 12, ['ops_terraform'], 'Modules, workspaces, remote state, drift detection, import. Save blueprints.'),
  S('ops_pipesec', 'ops', 3, 'Secure Pipelines', 1, 700, 13, ['ops_deploy', 'sec_secrets'], 'OIDC federation, image scanning, signed artifacts, supply chain.'),
  S('ops_incident', 'ops', 3, 'Incident Command', 1, 600, 10, ['ops_observability'], 'Runbooks & on-call. Manual incident actions cost 50% less.'),
];
export const SKILL = Object.fromEntries(SKILLS.map(s => [s.id, s]));

// Things not tied to components
export const STARTER_SKILLS = SKILLS.filter(s => s.starter).map(s => s.id);

export function maxRegions(skills) {
  let n = 1;
  for (const id of skills) if (SKILL[id]?.regions) n = Math.max(n, SKILL[id].regions);
  return n;
}
