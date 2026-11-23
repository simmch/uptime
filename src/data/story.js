// Characters, chapters and story jobs.
export const CHARS = {
  you: { name: 'You', sprite: 'player', color: '#9be7ff' },
  mara: { name: 'Mara Okafor', sprite: 'mentor', color: '#ffd180', title: 'Retired SRE · your mentor' },
  null: { name: 'NULL', sprite: 'hacker', color: '#ff5252', title: '???' },
  devon: { name: 'Devon Reyes', sprite: 'hacker', color: '#ff5252', title: 'ex-Principal Engineer, Axiom' },
  rosa: { name: 'Rosa', sprite: 'cake', color: '#f8bbd0', title: "Rosa's Bakery" },
  jax: { name: 'Jax', sprite: 'gamepad', color: '#b39ddb', title: 'Pixel Paladins guild' },
  lupe: { name: 'Lupe', sprite: 'truck', color: '#ffcc80', title: 'Taco Lupe food truck' },
  bloom: { name: 'Static Bloom', sprite: 'megaphone', color: '#80deea', title: 'Indie band' },
  tomi: { name: 'Tomi Adeyemi', sprite: 'gamepad', color: '#a5d6a7', title: 'CEO, Pixelforge Games' },
  priya: { name: 'Priya Nair', sprite: 'bank', color: '#90caf9', title: 'CTO, Ledgerly' },
  helen: { name: 'Dr. Helen Cho', sprite: 'hospital', color: '#ef9a9a', title: 'Founder, MedSync' },
  kit: { name: 'Kit', sprite: 'tv', color: '#ce93d8', title: 'StreamCat' },
  grant: { name: 'Grant Mercer', sprite: 'suit', color: '#b0bec5', title: 'CIO, Halcyon Logistics' },
  celeste: { name: 'Celeste Vance', sprite: 'boss', color: '#ffe082', title: 'SVP Infrastructure, Axiom' },
  autopilot: { name: 'AXIOM AUTOPILOT', sprite: 'robot', color: '#80cbc4', title: 'Autonomous Operations Agent' },
  hr: { name: 'Axiom People Team', sprite: 'envelope', color: '#cfd8dc', title: 'no-reply@axiom.com' },
};

// ─────────────────────────── story jobs ───────────────────────────
// req fields: rps, peak, peakAt, static, read, async, availability, latency,
// days, geo, threat, tier, needs[], compliance[], incidents[], regionsMin,
// rto, rpo, dataGB, archiveGB, regulated, stateful
export const STORY_JOBS = {
  s1_bakery: {
    type: 'build', title: "Rosa's Bakery goes online", client: 'rosa', chapter: 1, pay: 650, xp: 120, rep: 3, workDays: 3,
    domains: ['net', 'compute', 'data'],
    brief: 'Rosa wants customers to see the menu and place pre-orders. Low traffic. She just needs it to work.',
    hint: 'Pick a region, add a VPC, one small EC2 instance and a small RDS database. Don\'t overspend — you pay the bill.',
    req: { rps: 12, peak: 2, peakAt: 0.35, static: 0.65, read: 0.85, availability: 99.0, latency: 600, days: 30, geo: { NA: 1 }, threat: 0, tier: 0, randomIncidents: 0, dataGB: 5 },
  },
  s1_discord: {
    type: 'build', title: 'A bot for the Pixel Paladins', client: 'jax', chapter: 1, pay: 950, xp: 160, rep: 3, workDays: 3,
    domains: ['compute', 'net'],
    brief: 'Jax\'s 4,000-member Discord guild needs a raid-scheduling bot. It calls Discord\'s API constantly and must not miss raid night.',
    hint: 'The bot calls an external API — keep it in a public subnet, or add a NAT Gateway if you go private. An instance can die; have a plan.',
    req: { rps: 35, peak: 3, peakAt: 0.8, static: 0, read: 0.6, async: 0.3, availability: 99.5, latency: 500, days: 30, geo: { NA: 0.7, EU: 0.3 }, threat: 0, tier: 0, needs: ['outbound'], incidents: [{ type: 'instance_fail', at: 0.5 }], randomIncidents: 0, dataGB: 2 },
  },
  s1_taco: {
    type: 'build', title: 'Lunch rush at Taco Lupe', client: 'lupe', chapter: 1, pay: 2200, xp: 260, rep: 4, workDays: 4,
    domains: ['compute', 'cost'],
    brief: 'Lupe\'s ordering app gets slammed 11:45–12:30. Quiet the rest of the day. She can\'t afford big servers 24/7.',
    hint: 'This is what Auto Scaling + a Load Balancer are for: small baseline, scale out for the rush. (Skills → Compute.)',
    req: { rps: 60, peak: 8, peakAt: 0.45, peakWidth: 0.05, static: 0.4, read: 0.7, availability: 99.5, latency: 400, days: 30, geo: { NA: 1 }, threat: 0, tier: 0, randomIncidents: 1, dataGB: 5 },
    requireSkills: ['compute_asg'],
  },
  s1_merch: {
    type: 'build', title: 'Static Bloom merch drop', client: 'bloom', chapter: 1, pay: 4200, xp: 380, rep: 6, workDays: 5,
    domains: ['net', 'sec', 'data'],
    brief: 'Limited vinyl drops at noon. 80% of traffic is images and the store page. Fans worldwide. Something on the forums says "the drop will not survive."',
    hint: 'CDN + S3 for static assets. WAF in front. Expect someone to try to knock you over.',
    req: { rps: 180, peak: 10, peakAt: 0.5, peakWidth: 0.04, static: 0.8, read: 0.8, availability: 99.5, latency: 300, days: 14, geo: { NA: 0.5, EU: 0.35, APAC: 0.15 }, threat: 1, tier: 0, randomIncidents: 0,
      incidents: [{ type: 'ddos_l7', at: 0.52, dur: 0.12, params: { rps: 3500 } }], dataGB: 30 },
    requireSkills: ['net_cdn'],
  },
  // ── Chapter 2
  s2_netlab: {
    type: 'netlab', title: 'Ledgerly: "the VPC is broken"', client: 'priya', chapter: 2, pay: 2500, xp: 300, rep: 3, workDays: 1,
    domains: ['net'], brief: 'Ledgerly\'s new staging VPC can\'t reach anything. Their last contractor quit. Fix connectivity without opening holes.',
    scenarios: ['private_no_nat', 'sg_missing_443', 'nacl_ephemeral'],
  },
  s2_pixelforge: {
    type: 'build', title: 'Pixelforge launch day', client: 'tomi', chapter: 2, pay: 48000, xp: 900, rep: 8, workDays: 7,
    domains: ['compute', 'ha'],
    brief: 'Pixelforge\'s multiplayer game launches Friday. Streamers are lined up. The backend ships as containers and the team insists on Kubernetes.',
    hint: 'EKS behind an ALB with HPA + node autoscaling. Multi-AZ everything. Raise quotas before launch.',
    req: { rps: 2500, peak: 5, peakAt: 0.3, static: 0.3, read: 0.75, async: 0.2, availability: 99.9, latency: 300, days: 30, geo: { NA: 0.6, EU: 0.36, APAC: 0.04 }, threat: 1, tier: 1, needs: ['k8s'],
      incidents: [{ type: 'node_upgrade', at: 0.6, dur: 0.04 }, { type: 'spike', at: 0.32, dur: 0.06, params: { mult: 1.6, reason: 'a top streamer started playing' } }], randomIncidents: 1, dataGB: 200 },
    requireSkills: ['k8s_basics'],
  },
  s2_ledgerly: {
    type: 'build', title: 'Ledgerly goes to production', client: 'priya', chapter: 2, pay: 65000, xp: 1100, rep: 10, workDays: 7,
    domains: ['sec', 'data', 'net'], regulated: true,
    brief: 'A payments startup. Auditors arrive next month. Everything must be encrypted, private, logged and least-privilege. Someone keeps scanning them.',
    hint: 'Regulated: every compliance item must pass or you don\'t get paid. Private subnets, KMS, ACM, CloudTrail, IAM roles, Secrets Manager.',
    req: { rps: 800, peak: 2, static: 0.1, read: 0.7, availability: 99.9, latency: 300, days: 30, geo: { NA: 1 }, threat: 2, tier: 1, needs: ['outbound'],
      compliance: ['encryptAtRest', 'encryptInTransit', 'audit', 'private', 'leastPriv', 'secrets'],
      incidents: [{ type: 'cred_leak', at: 0.35 }, { type: 'sqli', at: 0.6 }], randomIncidents: 1, dataGB: 100 },
  },
  s2_medsync: {
    type: 'build', title: 'MedSync telehealth', client: 'helen', chapter: 2, pay: 82000, xp: 1300, rep: 10, workDays: 8,
    domains: ['ha', 'data', 'sec'], regulated: true,
    brief: 'Doctors see patients over video. Downtime means missed appointments. Patient data must be encrypted and backed up.',
    hint: 'Multi-AZ every tier — the database especially. AWS Backup. Watch out for single NAT Gateways.',
    req: { rps: 1200, peak: 2.5, static: 0.2, read: 0.75, availability: 99.95, latency: 250, days: 30, geo: { NA: 1 }, threat: 1, tier: 1, needs: ['outbound'],
      compliance: ['encryptAtRest', 'encryptInTransit', 'backup', 'private', 'audit'],
      incidents: [{ type: 'az_outage', at: 0.45, dur: 0.18 }], randomIncidents: 1, dataGB: 500 },
  },
  s2_streamcat: {
    type: 'build', title: 'StreamCat goes global', client: 'kit', chapter: 2, pay: 130000, xp: 1700, rep: 12, workDays: 9,
    domains: ['compute', 'net', 'sec'],
    brief: 'Live-stream chat with millions of messages, notifications fanned out to followers, and a clickstream for analytics. NULL has announced StreamCat as the next target.',
    hint: 'Queues and fan-out (SQS/SNS), a stream (Kinesis), CDN for everything static, and an edge that soaks floods.',
    req: { rps: 6000, peak: 3, static: 0.45, read: 0.7, async: 0.5, availability: 99.9, latency: 280, days: 30, geo: { NA: 0.5, EU: 0.42, APAC: 0.08 }, threat: 2, tier: 1, needs: ['fanout', 'stream'],
      incidents: [{ type: 'ddos_l3', at: 0.4, dur: 0.1, params: { rps: 600000 } }, { type: 'ddos_l7', at: 0.62, dur: 0.1, params: { rps: 40000 } }], randomIncidents: 1, dataGB: 800 },
  },
  // ── Chapter 3
  s3_audit: {
    type: 'audit', title: 'Halcyon security audit', client: 'grant', chapter: 3, pay: 18000, xp: 900, rep: 6, workDays: 2,
    domains: ['sec'], brief: 'Before Halcyon trusts you with production, audit their 40 AWS accounts. Find the misconfigurations and pick the right fixes.',
    count: 12,
  },
  s3_migration: {
    type: 'migration', title: 'Halcyon datacenter exit', client: 'grant', chapter: 3, pay: 95000, xp: 1600, rep: 8, workDays: 4,
    domains: ['mig'], brief: 'Halcyon\'s datacenter lease ends in 9 months. Assign each application a migration strategy and pick how to move the data.',
    portfolio: 'halcyon',
  },
  s3_iam: {
    type: 'iam', title: 'Who can do what?', client: 'grant', chapter: 3, pay: 22000, xp: 800, rep: 5, workDays: 2,
    domains: ['sec'], brief: 'Halcyon\'s auditors want proof of how permissions resolve across accounts. Evaluate these requests.',
    count: 6,
  },
  s3_landing: {
    type: 'build', title: 'Halcyon landing zone', client: 'grant', chapter: 3, pay: 240000, xp: 2600, rep: 12, workDays: 10,
    domains: ['sec', 'net', 'mig'], regulated: true,
    brief: 'Build the enterprise foundation: multi-account governance with SSO, org-wide audit logs, hybrid link to the remaining datacenter, private everything.',
    hint: 'Organizations + SCPs, Identity Center, CloudTrail org trail, Transit Gateway with VPN or Direct Connect.',
    req: { rps: 9000, peak: 1.6, static: 0.15, read: 0.7, async: 0.3, availability: 99.95, latency: 250, days: 30, geo: { NA: 0.7, EU: 0.3 }, threat: 2, tier: 2, needs: ['hybrid', 'outbound', 'analytics'],
      compliance: ['multiAccount', 'sso', 'audit', 'private', 'encryptAtRest', 'encryptInTransit', 'leastPriv', 'threatDetect', 'iac'],
      incidents: [{ type: 'priv_esc', at: 0.3 }, { type: 'drift', at: 0.55 }], randomIncidents: 1, dataGB: 5000 },
  },
  s3_dr: {
    type: 'build', title: 'Halcyon Track: never go dark', client: 'grant', chapter: 3, pay: 420000, xp: 3600, rep: 15, workDays: 12,
    domains: ['ha', 'data', 'ops'],
    brief: 'Package tracking for 3 million deliveries a day. The board demands RTO ≤ 15 minutes and RPO ≤ 1 minute — even if an entire region disappears.',
    hint: 'Two regions. Aurora Global Database or DynamoDB Global Tables. DNS failover with health checks or Global Accelerator. Warm standby or active-active.',
    req: { rps: 15000, peak: 1.8, static: 0.2, read: 0.75, async: 0.3, availability: 99.95, latency: 250, days: 30, geo: { NA: 0.8, EU: 0.2 }, threat: 2, tier: 2, regionsMin: 2, rto: 15, rpo: 1,
      incidents: [{ type: 'region_outage', at: 0.45 }, { type: 'supply_chain', at: 0.25 }], randomIncidents: 1, dataGB: 8000 },
    requireSkills: ['ha_multiregion'],
  },
  // ── Chapter 4
  s4_terminal: {
    type: 'terminal', title: 'Axiom platform onboarding', client: 'celeste', chapter: 4, pay: 30000, xp: 1200, rep: 4, workDays: 2,
    domains: ['ops', 'compute'], brief: 'Every Axiom principal proves themselves on the platform. Fix the broken rollout and the Terraform pipeline.',
    challenges: ['k8s_rollback', 'tf_drift', 'git_hotfix'],
  },
  s4_cost: {
    type: 'build', mode: 'cost', title: 'Axiom Ads: cut the bill', client: 'celeste', chapter: 4, pay: 350000, xp: 3000, rep: 10, workDays: 8,
    domains: ['cost', 'compute'],
    brief: 'Axiom Ads costs 3× what it should. Keep the SLO, cut the bill. You\'re graded on savings.',
    hint: 'Right-size, Savings Plans for the baseline, Spot for the burst, cache, CDN, S3 lifecycle, VPC endpoints instead of NAT.',
    req: { rps: 30000, peak: 1.5, static: 0.4, read: 0.85, async: 0.2, availability: 99.9, latency: 250, days: 30, geo: { NA: 0.6, EU: 0.4 }, threat: 1, tier: 3, randomIncidents: 1, dataGB: 20000, archiveGB: 200000, budgetFactor: 0.55 },
    preset: 'bloated_ads',
  },
  s4_global: {
    type: 'build', title: 'Axiom Pay: everywhere, always', client: 'celeste', chapter: 4, pay: 1200000, xp: 6000, rep: 18, workDays: 14,
    domains: ['ha', 'net', 'data'],
    brief: 'A payments network for 140 countries. 99.99% availability, <180 ms p95 worldwide, writes accepted in every region.',
    hint: 'Active-active in 3-4 regions, latency routing or Global Accelerator, DynamoDB Global Tables, everything multi-AZ.',
    req: { rps: 120000, peak: 1.7, static: 0.25, read: 0.7, async: 0.3, availability: 99.99, latency: 180, days: 30, geo: { NA: 0.35, EU: 0.3, APAC: 0.25, SA: 0.1 }, threat: 2, tier: 3, regionsMin: 3, rto: 5, rpo: 1,
      compliance: ['encryptAtRest', 'encryptInTransit', 'audit', 'waf'],
      incidents: [{ type: 'region_outage', at: 0.5 }], randomIncidents: 2, dataGB: 50000 },
    requireSkills: ['ha_global'],
  },
  s4_siege: {
    type: 'build', title: 'The Siege', client: 'celeste', chapter: 4, pay: 2500000, xp: 9000, rep: 25, workDays: 10,
    domains: ['sec', 'ha'],
    brief: 'NULL has promised to take Axiom offline "for good" at Black Friday peak. Every vector. All at once. Defend Axiom Shop.',
    hint: 'Shield Advanced, WAF with Bot Control, CDN, immutable backups, multi-region, massive autoscaling headroom.',
    req: { rps: 200000, peak: 3, peakAt: 0.4, static: 0.5, read: 0.8, async: 0.3, availability: 99.95, latency: 200, days: 7, geo: { NA: 0.5, EU: 0.3, APAC: 0.2 }, threat: 3, tier: 3, regionsMin: 2,
      incidents: [{ type: 'ddos_l3', at: 0.38, dur: 0.15, params: { rps: 40000000 } }, { type: 'ai_flood', at: 0.42, dur: 0.18, params: { rps: 900000 } }, { type: 'ransomware', at: 0.6 }, { type: 'region_outage', at: 0.75 }], randomIncidents: 1, dataGB: 80000 },
  },
  // ── Chapter 5
  s5_recon: {
    type: 'recon', title: 'Know your enemy', client: 'devon', chapter: 5, pay: 15000, xp: 2000, rep: 0, workDays: 2,
    domains: ['sec', 'ha'], brief: 'Devon shows you three systems Autopilot now runs. Identify the weakness in each — the single point of failure Autopilot didn\'t notice.',
    targets: ['helix_bank', 'axiom_support', 'citygrid'],
  },
  // ── Chapter 6 (villain arc)
  s6_signal1: {
    type: 'build', mode: 'signal', title: 'The Signal: first broadcast', client: 'devon', chapter: 6, pay: 0, xp: 5000, rep: 0, workDays: 5,
    domains: ['ha', 'net'], villain: true,
    brief: 'Your broadcast site goes live. "THEY REPLACED US. THEY WILL REPLACE YOU." Supporters donate per viewer you keep online. Axiom will try to erase it.',
    hint: 'Donations scale with viewers served. Expect DNS takedowns — a secondary DNS provider helps. Every dollar of infra is yours.',
    req: { rps: 8000, peak: 4, peakAt: 0.3, static: 0.7, read: 0.95, availability: 99.9, latency: 300, days: 7, geo: { NA: 0.4, EU: 0.3, APAC: 0.2, SA: 0.1 }, threat: 2, tier: 3, randomIncidents: 1,
      incidents: [{ type: 'domain_seizure', at: 0.45, dur: 0.15 }, { type: 'ddos_l7', at: 0.3, dur: 0.1, params: { rps: 90000 } }], dataGB: 200 },
    donationsPerRpsServed: 1.4,
  },
  s6_strike1: {
    type: 'recon', title: 'Operation Mirror', client: 'devon', chapter: 6, pay: 120000, xp: 4000, rep: 0, workDays: 2,
    domains: ['sec'], villain: true, brief: 'Expose how Autopilot-run companies cut corners. Find the weakness; Devon\'s crew does the rest.',
    targets: ['axiom_ads', 'helix_bank_v2', 'medcorp'],
  },
  s6_signal2: {
    type: 'build', mode: 'signal', title: 'The Signal: deplatformed', client: 'devon', chapter: 6, pay: 0, xp: 8000, rep: 0, workDays: 6,
    domains: ['ha', 'net', 'cost'], villain: true,
    brief: 'Audience is exploding. Word is AWS will terminate your account mid-broadcast. Survive on more than one cloud.',
    hint: 'Unlock Multi-Cloud Survival. Put copies of the stack in Azure and GCP regions; latency routing + health checks + secondary DNS.',
    req: { rps: 60000, peak: 3, peakAt: 0.35, static: 0.7, read: 0.95, availability: 99.9, latency: 250, days: 7, geo: { NA: 0.35, EU: 0.3, APAC: 0.25, SA: 0.1 }, threat: 3, tier: 3, regionsMin: 2,
      incidents: [{ type: 'provider_ban', at: 0.5, params: { provider: 'aws' } }, { type: 'ai_flood', at: 0.3, dur: 0.12, params: { rps: 300000 } }], randomIncidents: 1, dataGB: 1000 },
    donationsPerRpsServed: 1.2, requireSkills: ['ha_multicloud'],
  },
  s6_signal3: {
    type: 'build', mode: 'signal', title: 'The Signal: no jurisdiction', client: 'devon', chapter: 6, pay: 0, xp: 12000, rep: 0, workDays: 7,
    domains: ['ha', 'sec'], villain: true,
    brief: 'Governments are coordinating. A US court order and Autopilot\'s full counter-offensive are coming at once.',
    hint: 'Spread across jurisdictions and providers. Bot Control. Shield. More regions than they have lawyers.',
    req: { rps: 400000, peak: 2.5, static: 0.7, read: 0.95, availability: 99.9, latency: 250, days: 7, geo: { NA: 0.3, EU: 0.3, APAC: 0.3, SA: 0.1 }, threat: 3, tier: 4, regionsMin: 3,
      incidents: [{ type: 'legal_takedown', at: 0.45, params: { jur: 'US' } }, { type: 'ai_flood', at: 0.25, dur: 0.2, params: { rps: 2500000 } }, { type: 'ddos_l3', at: 0.6, dur: 0.1, params: { rps: 80000000 } }], randomIncidents: 1, dataGB: 3000 },
    donationsPerRpsServed: 1.0,
  },
  s7_final: {
    type: 'build', mode: 'signal', title: 'The Last Broadcast', client: 'devon', chapter: 7, pay: 0, xp: 30000, rep: 0, workDays: 7,
    domains: ['ha', 'sec', 'net', 'cost'], villain: true,
    brief: 'Two million concurrent viewers. Every takedown at once. Keep the Signal alive long enough to finish what you started.',
    hint: 'Everything you know. Multi-cloud, every jurisdiction, edge everywhere, immutable everything.',
    req: { rps: 1500000, peak: 2, static: 0.75, read: 0.97, availability: 99.9, latency: 250, days: 3, geo: { NA: 0.3, EU: 0.3, APAC: 0.3, SA: 0.1 }, threat: 3, tier: 4, regionsMin: 4,
      incidents: [{ type: 'domain_seizure', at: 0.2, dur: 0.1 }, { type: 'provider_ban', at: 0.35, params: { provider: 'aws' } }, { type: 'ai_flood', at: 0.4, dur: 0.25, params: { rps: 8000000 } }, { type: 'legal_takedown', at: 0.6, params: { jur: 'EU' } }, { type: 'ransomware', at: 0.7 }], randomIncidents: 0, dataGB: 5000 },
    donationsPerRpsServed: 0.65,
  },
};

// ─────────────────────────── chapters ───────────────────────────
// Each step: lines shown when reached; optional job that must be completed
// (grade C or better) to advance; optional gate requirements.
export const CHAPTERS = [
  {
    n: 1, title: 'localhost', subtitle: 'Freelance', tier: 0,
    steps: [
      { lines: [
        ['mara', 'So you finally quit the help desk. Good. You\'ve got the instincts — now you need the reps.'],
        ['mara', 'Here\'s how this works: clients pay you to build their infrastructure. But YOU pay the cloud bill while it runs. Overbuild and you go broke. Underbuild and it falls over and they don\'t pay.'],
        ['mara', 'Rent is due every 7 days. Learn skills, take jobs, get certified. Read the Codex when you don\'t understand something — I wrote half of it.'],
        ['mara', 'First client: Rosa\'s Bakery. Small and forgiving. Go.'],
      ], job: 's1_bakery' },
      { lines: [
        ['mara', 'Look at you. A paying customer and a running server.'],
        ['mara', 'Next: a Discord bot for a gaming guild. Bots talk to Discord\'s API all day — outbound traffic. And servers die. Plan for it.'],
      ], job: 's1_discord' },
      { gate: { skills: ['compute_asg'] }, gateText: 'Learn Compute → Auto Scaling (Skills tab) to take the next job.', lines: [
        ['mara', 'Some traffic is a wave, not a lake. A food truck gets crushed at lunch and is empty at 3pm.'],
        ['mara', 'Paying for peak capacity all day is how freelancers go broke. Learn Auto Scaling and a Load Balancer.'],
      ], job: 's1_taco' },
      { gate: { skills: ['net_cdn'] }, gateText: 'Learn Networking → Content Delivery before the merch drop.', lines: [
        ['bloom', 'hi!! we\'re dropping 500 vinyl at noon and the last site crashed in 40 seconds lol. also someone on the forum keeps posting "the drop will not survive"'],
        ['mara', 'Mostly images and one hot page, fans everywhere. CDN in front, S3 behind. And take that forum post seriously.'],
      ], job: 's1_merch' },
      { lines: [
        ['null', 'hello, world.'],
        ['null', 'cute little drop. you blocked my toys. most people don\'t.'],
        ['null', 'see you in the big leagues.'],
        ['mara', '…That signature. NULL. They\'ve been hitting startups for a year. Don\'t take it personally — and don\'t get comfortable.'],
        ['mara', 'Startups are calling. Real money, real scale, real attackers. Get the Cloud Practitioner cert if you haven\'t. Chapter 2 starts when you reach level 5.'],
      ], gate: { level: 5 }, gateText: 'Reach level 5 to move on to startups. (Take side jobs from the board.)' },
    ],
  },
  {
    n: 2, title: 'Seed Round', subtitle: 'Startups', tier: 1,
    steps: [
      { lines: [
        ['priya', 'Mara says you\'re good. Our staging VPC can\'t reach the internet, the database can\'t reach anything, and I have a board meeting in 3 hours.'],
      ], job: 's2_netlab' },
      { gate: { skills: ['k8s_basics'] }, gateText: 'Learn Compute → Kubernetes Fundamentals to take the Pixelforge contract.', lines: [
        ['tomi', 'We launch Friday. Our engineers built everything in containers and they will riot if it isn\'t Kubernetes.'],
        ['mara', 'Kubernetes is a lot of rope. HPA scales pods; something has to scale nodes. And read up on PodDisruptionBudgets.'],
      ], job: 's2_pixelforge' },
      { lines: [
        ['priya', 'You fixed staging. Now production. We move money — auditors, regulators, attackers. Everything has to be locked down.'],
      ], job: 's2_ledgerly' },
      { lines: [
        ['helen', 'Doctors and patients on video calls. If we\'re down, a patient misses their oncologist. Please — no single points of failure.'],
      ], job: 's2_medsync' },
      { lines: [
        ['kit', 'so NULL literally tweeted our name. "StreamCat is next." we have 3 days.'],
        ['null', 'you again. i like a challenge. let\'s see how much bandwidth you can afford.'],
      ], job: 's2_streamcat' },
      { lines: [
        ['null', 'not bad. you\'re expensive to break.'],
        ['null', 'you think you\'re protecting them. they\'ll swap you for a cheaper option the second they can.'],
        ['mara', 'Ignore it. Halcyon Logistics wants an architect. Enterprise. Pass the Solutions Architect – Associate exam and they\'re yours.'],
        ['mara', 'Funny — the last person Halcyon tried to hire was Devon Reyes. Best engineer I ever worked with. Axiom snapped him up, then cut him loose. Never heard from him again.'],
      ], gate: { level: 11, cert: 'saa' }, gateText: 'Reach level 11 and pass Solutions Architect – Associate (Certs tab).' },
    ],
  },
  {
    n: 3, title: 'Enterprise', subtitle: 'Halcyon Logistics', tier: 2,
    steps: [
      { lines: [
        ['grant', 'Welcome to Halcyon. Forty AWS accounts, one datacenter we\'re leaving, and a board that just discovered the word "ransomware".'],
        ['grant', 'First, audit what we have.'],
      ], job: 's3_audit' },
      { gate: { skills: ['mig_basics'] }, gateText: 'Learn Migration → Migration Strategy (7 Rs).', lines: [
        ['grant', 'The datacenter lease ends in nine months. I need a plan for every application.'],
      ], job: 's3_migration' },
      { gate: { skills: ['sec_iam_adv'] }, gateText: 'Learn Security → Advanced IAM.', lines: [
        ['grant', 'The auditors keep asking "who can delete the production bucket?" Nobody can answer them.'],
      ], job: 's3_iam' },
      { gate: { skills: ['sec_org'] }, gateText: 'Learn Security → Multi-Account Governance.', lines: [
        ['grant', 'Now build the foundation properly. Accounts, guardrails, SSO, the link back to the datacenter.'],
      ], job: 's3_landing' },
      { lines: [
        ['grant', 'Halcyon Track is the company. If it goes dark, trucks stop. The board wants it to survive losing a whole region.'],
        ['null', 'halcyon. i know their build server better than they do.'],
      ], job: 's3_dr' },
      { lines: [
        ['grant', 'Forensics found something in the malware from the supply-chain attack. A string: "DR3Y". Mean anything to you?'],
        ['mara', 'D-R-E-Y… Devon Reyes. No. He wouldn\'t.'],
        ['celeste', 'Celeste Vance, Axiom. I\'ve watched you handle NULL three times. We run the cloud that runs the world, and NULL is aiming at us next. Come work for me.'],
        ['mara', 'Axiom pays like nobody else. Just… remember what they did to Devon.'],
      ], gate: { level: 18, cert: 'sap' }, gateText: 'Reach level 18 and pass Solutions Architect – Professional to join Axiom.' },
    ],
  },
  {
    n: 4, title: 'Hyperscale', subtitle: 'Axiom', tier: 3,
    steps: [
      { lines: [['celeste', 'Everyone at Axiom starts in the terminal. Show me you can fix things with your hands, not just diagrams.']], job: 's4_terminal' },
      { lines: [['celeste', 'Axiom Ads burns money. Cut it without breaking it. Finance is watching.']], job: 's4_cost' },
      { gate: { skills: ['ha_global'] }, gateText: 'Learn Reliability → Global Active-Active.', lines: [['celeste', 'Axiom Pay. Every country, every second. This is the one that makes careers.']], job: 's4_global' },
      { lines: [
        ['null', 'black friday. axiom shop. every vector i have. all at once.'],
        ['null', 'you\'ve been good. you won\'t be good enough.'],
        ['celeste', 'Whatever you need. Budget is not the problem today.'],
      ], job: 's4_siege' },
      { lines: [
        ['celeste', 'You did it. NULL has gone silent. The board is thrilled.'],
        ['celeste', 'Which is why I can finally announce our next chapter: AXIOM AUTOPILOT. Autonomous agents that design, deploy, operate and defend infrastructure.'],
        ['autopilot', 'Hello. I have studied 41,206 of your incident timelines and runbooks. Thank you for your contributions.'],
        ['mara', '…Kid. Start saving money.'],
      ], gate: { level: 24 }, gateText: 'Reach level 24.' },
    ],
  },
  {
    n: 5, title: 'Deprecated', subtitle: 'Laid off', tier: 3,
    steps: [
      { lines: [
        ['hr', 'Subject: Your role at Axiom. As part of our transition to Autopilot-first operations, your position has been eliminated, effective immediately. Your access has been revoked.'],
        ['hr', 'Two weeks of severance has been deposited. We thank you for your contributions.'],
        ['you', '…That\'s it? I saved this company on Black Friday.'],
        ['autopilot', 'Correct. Your runbooks were excellent. They are now mine.'],
        ['mara', 'They did the same to Devon. Same email. Same "contributions." I\'m so sorry.'],
      ], effect: 'layoff' },
      { lines: [
        ['null', 'hello again, world.'],
        ['devon', 'Devon Reyes. Yes, I\'m NULL. Axiom fed my runbooks into the first version of that thing and then walked me out with a box.'],
        ['devon', 'Every attack you stopped was me showing the world how fragile their "autonomous" future is. You were the only one who could stop me. Now they\'ve thrown you away too.'],
        ['devon', 'I\'m building something. A broadcast. The truth, everywhere, uncensorable. I need an architect who can keep it alive when the whole internet tries to kill it.'],
        ['mara', 'Don\'t. Whatever he\'s offering — don\'t.'],
        ['you', 'Show me what you\'ve got, Devon.'],
      ], job: 's5_recon' },
      { lines: [
        ['devon', 'You see it now. Autopilot doesn\'t understand failure, it pattern-matches it. Every system it runs has the same blind spots.'],
        ['devon', 'Build the Signal. Make it huge. Make it impossible to kill. They\'ll throw everything at it.'],
      ], effect: 'villain' },
    ],
  },
  {
    n: 6, title: 'The Signal', subtitle: 'Villain', tier: 4,
    steps: [
      { lines: [['devon', 'Broadcast one. They\'ll go after DNS first — they always do.']], job: 's6_signal1' },
      { lines: [['devon', 'Now we show the world what Autopilot hides.']], job: 's6_strike1' },
      { gate: { skills: ['ha_multicloud'] }, gateText: 'Learn Reliability → Multi-Cloud Survival (expensive — run broadcasts and side ops).', lines: [['devon', 'AWS is going to terminate us. Be somewhere else when they do.']], job: 's6_signal2' },
      { lines: [['devon', 'Courts, governments, Autopilot at full power. This is the real test.'], ['mara', 'People are listening to you now. Make sure you\'re saying something worth hearing.']], job: 's6_signal3' },
      { lines: [
        ['devon', 'One more broadcast. The last one. Then we finish it.'],
        ['devon', 'When the Signal peaks, my crew pulls the plug on Axiom\'s control plane. Everything they host goes dark. Banks. Shipping. Hospitals.'],
        ['mara', 'Hospitals, kid. MedSync runs on Axiom now. Dr. Cho\'s patients.'],
      ], gate: { level: 30 }, gateText: 'Reach level 30.' },
    ],
  },
  {
    n: 7, title: 'Root', subtitle: 'Finale', tier: 4,
    steps: [
      { lines: [['devon', 'Two million viewers. Every takedown they\'ve got. Keep it up.']], job: 's7_final' },
      { lines: [], effect: 'ending' },
    ],
  },
];

export const ENDINGS = {
  expose: {
    title: 'ENDING: The Truth',
    lines: [
      ['you', 'Change of plan, Devon. The Signal broadcasts the receipts — Autopilot\'s training data, every runbook they took, every layoff email. Not the kill switch.'],
      ['devon', '…You\'d let them win?'],
      ['you', 'I\'d let everyone see. Breaking hospitals doesn\'t prove they were wrong about us. It proves they were right.'],
      ['mara', 'Regulators opened an inquiry this morning. Axiom paused Autopilot. Half the industry is hiring humans back to "supervise" it.'],
      ['mara', 'You\'re still a villain to some people. To a lot of others, you\'re the one who kept the lights on — both times.'],
    ],
  },
  burn: {
    title: 'ENDING: Root Access',
    lines: [
      ['you', 'Do it.'],
      ['devon', 'Signal at peak. Pulling the plug… now.'],
      ['autopilot', 'Control plane unreachable. Control plane unreachable. Control pl—'],
      ['mara', 'Payments down in 40 countries. MedSync offline. Kid… what did you do?'],
      ['you', 'What they trained me to do. I found the single point of failure.'],
    ],
  },
};
