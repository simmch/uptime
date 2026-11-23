// Incident catalog: what it is, what mitigates it, and what to learn.
// The behavior lives in sim.js; this file is the teaching layer.
export const INCIDENTS = {
  spike: {
    name: 'Traffic Spike', sprite: 'rocket', domain: 'compute', villain: false,
    text: p => `Traffic surges ${p.mult}× — ${p.reason || 'you went viral'}.`,
    mitigation: 'Auto Scaling (ASG, HPA, Fargate), Lambda, CDN offload, queues to buffer writes, pre-raised quotas.',
    codex: 'asg',
  },
  instance_fail: {
    name: 'Instance Failure', sprite: 'skull', domain: 'ha',
    text: () => 'An instance\'s underlying host failed. The VM is gone.',
    mitigation: 'Run ≥2 instances behind a load balancer in an Auto Scaling Group — it replaces failed nodes automatically.',
    codex: 'asg',
  },
  az_outage: {
    name: 'Availability Zone Outage', sprite: 'fire', domain: 'ha',
    text: p => `Power and cooling failure in ${p.region}${'abc'[p.az]}. Everything in that AZ is down.`,
    mitigation: 'Spread every tier across ≥2 AZs: ASG spanning AZs, Multi-AZ RDS or Aurora, one NAT Gateway per AZ, cache replicas.',
    codex: 'multiaz',
  },
  region_outage: {
    name: 'Regional Outage', sprite: 'fire', domain: 'ha',
    text: p => `A control-plane failure takes down ${p.region}. The entire region is unavailable.`,
    mitigation: 'Multi-region DR: replicated data (Aurora Global, DynamoDB Global Tables, S3 CRR), compute in a second region, DNS failover with health checks. Choose pilot light, warm standby or active-active by RTO/RPO.',
    codex: 'dr',
  },
  ddos_l3: {
    name: 'Volumetric DDoS (L3/L4)', sprite: 'bot', domain: 'sec', villain: true,
    text: p => `A botnet floods your network with ${fmt(p.rps)} req/s of junk packets.`,
    mitigation: 'Put CloudFront/Global Accelerator in front (Shield Standard absorbs most L3/L4). Shield Advanced for large targets.',
    codex: 'shield',
  },
  ddos_l7: {
    name: 'HTTP Flood (L7)', sprite: 'bot', domain: 'sec', villain: true,
    text: p => `${fmt(p.rps)} req/s of valid-looking HTTP requests hammer your app.`,
    mitigation: 'WAF rate-based rules, caching at the edge, autoscaling headroom. Bot Control for smarter floods.',
    codex: 'waf',
  },
  ai_flood: {
    name: 'Adaptive AI Flood', sprite: 'robot', domain: 'sec', villain: true,
    text: p => `An adaptive swarm rotates IPs and mimics real users at ${fmt(p.rps)} req/s. Rate limits barely notice.`,
    mitigation: 'WAF Bot Control (behavioral signals, CAPTCHA/challenge), edge caching, massive autoscaling headroom.',
    codex: 'waf',
  },
  sqli: {
    name: 'SQL Injection Attempt', sprite: 'hacker', domain: 'sec', villain: true,
    text: () => 'Someone is probing your login form with \' OR 1=1 -- payloads.',
    mitigation: 'WAF managed rule sets block known injection patterns (and use parameterized queries in code).',
    codex: 'waf',
  },
  cred_leak: {
    name: 'Leaked Access Keys', sprite: 'iam', domain: 'sec', villain: true,
    text: () => 'A developer pushed long-lived access keys to a public GitHub repo. Bots found them in 4 minutes.',
    mitigation: 'Use IAM roles (no long-lived keys) and Secrets Manager. GuardDuty detects crypto-mining fast. Rotate keys.',
    codex: 'secrets',
  },
  ransomware: {
    name: 'Ransomware', sprite: 'lockbox', domain: 'sec', villain: true,
    text: () => 'Attackers encrypted your database and buckets and demand payment.',
    mitigation: 'Immutable backups (Backup Vault Lock, S3 Object Lock + versioning), least privilege, threat detection.',
    codex: 'backup',
  },
  bad_deploy: {
    name: 'Bad Deployment', sprite: 'bug', domain: 'ops',
    text: () => 'A release with a null-pointer bug just shipped. Requests are failing.',
    mitigation: 'CI/CD with canary or blue/green and automatic rollback on alarms. Monitoring to detect quickly.',
    codex: 'cicd',
  },
  drift: {
    name: 'Configuration Drift', sprite: 'wrench', domain: 'ops',
    text: p => `Someone "fixed" a security group in the console. The load balancer in ${p.region} can't reach the app.`,
    mitigation: 'Infrastructure as Code (Terraform) + drift detection or AWS Config auto-remediation. No ClickOps in prod.',
    codex: 'terraform',
  },
  spot_interrupt: {
    name: 'Spot Interruption', sprite: 'clock', domain: 'cost',
    text: () => 'AWS reclaims Spot capacity with 2 minutes notice.',
    mitigation: 'Diversify instance types/AZs (Karpenter), keep an On-Demand base, use Spot only for fault-tolerant workloads.',
    codex: 'spot',
  },
  cert_expiry: {
    name: 'TLS Certificate Expired', sprite: 'medal', domain: 'sec',
    text: () => 'Your manually-installed TLS certificate expired at midnight. Browsers refuse to connect.',
    mitigation: 'ACM certificates renew automatically.',
    codex: 'acm',
  },
  public_bucket: {
    name: 'Public Bucket Exposure', sprite: 'bucket', domain: 'sec', villain: true,
    text: () => 'An intern set an S3 bucket ACL to public-read to "share a file".',
    mitigation: 'S3 Block Public Access (account-wide), AWS Config rules with auto-remediation, SCPs.',
    codex: 's3',
  },
  node_upgrade: {
    name: 'Kubernetes Node Upgrade', sprite: 'k8s', domain: 'compute',
    text: () => 'EKS node group upgrade begins draining nodes.',
    mitigation: 'PodDisruptionBudgets + readiness probes keep enough pods serving during drains.',
    codex: 'eks',
  },
  analytics_load: {
    name: 'Reporting Query Storm', sprite: 'warehouse', domain: 'data',
    text: () => 'The finance team runs month-end reports directly against production.',
    mitigation: 'Send analytics to a read replica or a warehouse (Redshift/BigQuery); keep OLAP off your OLTP database.',
    codex: 'redshift',
  },
  supply_chain: {
    name: 'Supply-Chain Attack', sprite: 'virus', domain: 'ops', villain: true,
    text: () => 'A popular npm dependency was hijacked with a credential stealer.',
    mitigation: 'Pipeline dependency/image scanning, pinned versions, OIDC short-lived deploy credentials.',
    codex: 'cicd',
  },
  priv_esc: {
    name: 'Privilege Escalation', sprite: 'crown', domain: 'sec', villain: true,
    text: () => 'A compromised developer account tries to grant itself AdministratorAccess.',
    mitigation: 'Multi-account structure with SCP guardrails, permission boundaries, CloudTrail alerts.',
    codex: 'orgs',
  },
  exfil: {
    name: 'Data Exfiltration', sprite: 'thief', domain: 'sec', villain: true,
    text: () => 'Malware on an app server is uploading your database dump to an unknown host.',
    mitigation: 'Private subnets, Network Firewall egress allow-lists, GuardDuty, VPC Flow Logs.',
    codex: 'netfw',
  },
  nat_fail: {
    name: 'NAT Gateway Zone Loss', sprite: 'nat', domain: 'net',
    text: () => 'The only NAT Gateway lived in the failed AZ. Private subnets lost outbound internet.',
    mitigation: 'One NAT Gateway per AZ, each AZ\'s route table pointing to its own NAT.',
    codex: 'nat',
  },
  quota_hit: {
    name: 'Service Quota Reached', sprite: 'warning', domain: 'ha',
    text: () => 'Scaling blocked: account vCPU limit reached.',
    mitigation: 'Request quota increases before big events. Monitor Service Quotas.',
    codex: 'quotas',
  },
  provider_ban: {
    name: 'Provider Account Terminated', sprite: 'skull', domain: 'ha', villain: true,
    text: p => `${p.providerName} terminated your account for "terms violations". Every region there is gone.`,
    mitigation: 'Multi-cloud: run copies of your stack on independent providers with independent DNS.',
    codex: 'multicloud',
  },
  domain_seizure: {
    name: 'DNS Takedown', sprite: 'dns', domain: 'net', villain: true,
    text: () => 'Your DNS provider suspends your zone. Nobody can resolve your domain.',
    mitigation: 'Secondary DNS provider with NS records at both.',
    codex: 'route53',
  },
  legal_takedown: {
    name: 'Jurisdiction Takedown', sprite: 'police', domain: 'ha', villain: true,
    text: p => `A court order in ${p.jur} forces every provider to shut your servers in that jurisdiction.`,
    mitigation: 'Spread across jurisdictions and providers so no single authority can take you down.',
    codex: 'dr',
  },
};

function fmt(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'k' : Math.round(n) + ''; }
