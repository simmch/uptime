// Lab content: Network Lab, CIDR drills, Security Audit, IAM evaluation,
// Migration Planner, and Recon (threat modeling).
import { mulberry32, pick, randInt } from '../sim/rng.js';

// ═══════════════════════ NETWORK LAB ═══════════════════════
// Each scenario: editable fields, and tests that must produce the expected
// outcome. A hop list explains why traffic passes or fails.
const hop = (name, ok, why) => ({ name, ok, why });

function inboundWeb(v, { nacl = true } = {}) {
  const h = [];
  h.push(hop('Internet Gateway', v.igw === 'attached', v.igw === 'attached' ? 'IGW attached to VPC.' : 'No Internet Gateway attached — the VPC has no door to the internet.'));
  h.push(hop('Public route table', v.rt_public === 'igw', v.rt_public === 'igw' ? '0.0.0.0/0 → igw.' : `0.0.0.0/0 → ${v.rt_public}. Return traffic can't reach the internet.`));
  h.push(hop('Public IP', v.web_ip !== 'none', v.web_ip !== 'none' ? 'Instance has a public/Elastic IP.' : 'No public IP — unreachable from the internet.'));
  if (nacl) {
    const inOk = ['allow 443', 'allow all'].includes(v.nacl_in);
    const outOk = ['allow 1024-65535', 'allow all'].includes(v.nacl_out);
    h.push(hop('NACL inbound', inOk, inOk ? 'Port 443 allowed in.' : 'NACL blocks inbound 443.'));
    h.push(hop('NACL outbound', outOk, outOk ? 'Ephemeral ports allowed out for responses.' : 'NACLs are stateless: responses leave on ephemeral ports 1024-65535, which are blocked.'));
  }
  const sgOk = ['80,443 from 0.0.0.0/0', 'all traffic from 0.0.0.0/0'].includes(v.sg_web);
  h.push(hop('Security group', sgOk, sgOk ? 'Inbound 443 allowed (stateful — responses automatic).' : `SG only allows: ${v.sg_web}.`));
  return h;
}

export const NET_SCENARIOS = {
  private_no_nat: {
    title: 'Private app can\'t reach the payment API',
    desc: 'The app server lives in a private subnet (no public IP). It must call https://api.payments.example (443). Calls time out.',
    diagram: ['Internet', 'IGW', 'Public subnet (NAT GW)', 'Private subnet → app-1'],
    fields: [
      { id: 'rt_private', group: 'Route tables', label: 'Private RT: 0.0.0.0/0 →', options: ['none', 'igw', 'nat-a'], value: 'none' },
      { id: 'nat_subnet', group: 'Gateways', label: 'NAT Gateway subnet', options: ['public-a', 'private-a'], value: 'public-a' },
      { id: 'app_ip', group: 'Instances', label: 'app-1 public IP', options: ['none', 'assign public IP'], value: 'none', insecure: ['assign public IP'] },
      { id: 'sg_app_out', group: 'Security groups', label: 'app-1 SG outbound', options: ['all traffic', '443 to 0.0.0.0/0', 'none'], value: 'all traffic' },
    ],
    tests: [{ label: 'app-1 → internet :443', expect: true, run: v => {
      const h = [];
      const sg = v.sg_app_out !== 'none'; h.push(hop('SG outbound', sg, sg ? 'Outbound allowed.' : 'Outbound blocked by SG.'));
      if (v.rt_private === 'igw') { const ip = v.app_ip !== 'none'; h.push(hop('Route → IGW', ip, ip ? 'Works, but the instance is now directly exposed (it\'s effectively a public subnet).' : 'Route goes to the IGW, but an instance without a public IP can\'t use an IGW. That\'s what NAT is for.')); return h; }
      h.push(hop('Private route table', v.rt_private === 'nat-a', v.rt_private === 'nat-a' ? '0.0.0.0/0 → NAT Gateway.' : 'No default route. Packets have nowhere to go.'));
      h.push(hop('NAT placement', v.nat_subnet === 'public-a', v.nat_subnet === 'public-a' ? 'NAT sits in a public subnet with a route to the IGW.' : 'A NAT Gateway in a private subnet has no path to the internet itself.'));
      return h;
    } }],
    insecureCheck: v => (v.rt_private === 'igw' || v.app_ip !== 'none') ? 'You exposed the app server directly to the internet. Private workloads should go out through NAT.' : null,
    lesson: 'Private subnet + outbound internet = route 0.0.0.0/0 to a NAT Gateway that lives in a public subnet.', codex: 'nat',
  },
  sg_missing_443: {
    title: 'Website times out',
    desc: 'The web server in a public subnet has an Elastic IP. Visitors to https://site get a timeout. SSH works fine.',
    fields: [
      { id: 'igw', group: 'Gateways', label: 'Internet Gateway', options: ['attached', 'detached'], value: 'attached' },
      { id: 'rt_public', group: 'Route tables', label: 'Public RT: 0.0.0.0/0 →', options: ['igw', 'none'], value: 'igw' },
      { id: 'web_ip', group: 'Instances', label: 'web-1 IP', options: ['elastic IP', 'none'], value: 'elastic IP' },
      { id: 'sg_web', group: 'Security groups', label: 'web-1 SG inbound', options: ['22 from 0.0.0.0/0', '80,443 from 0.0.0.0/0', 'all traffic from 0.0.0.0/0', 'none'], value: '22 from 0.0.0.0/0', insecure: ['all traffic from 0.0.0.0/0', '22 from 0.0.0.0/0'] },
    ],
    tests: [{ label: 'internet → web-1 :443', expect: true, run: v => inboundWeb(v, { nacl: false }) }],
    insecureCheck: v => v.sg_web === 'all traffic from 0.0.0.0/0' ? 'Opening ALL ports to the world fixes it, but exposes every service. Allow only 80/443.' : null,
    lesson: 'Security groups allow only what you list. Open only the ports you serve — and stop exposing SSH; use Session Manager.', codex: 'sg_nacl',
  },
  nacl_ephemeral: {
    title: 'Requests arrive, responses vanish',
    desc: 'VPC Flow Logs show inbound 443 ACCEPT, but browsers still time out. Someone "hardened" the subnet\'s network ACL.',
    fields: [
      { id: 'igw', group: 'Gateways', label: 'Internet Gateway', options: ['attached', 'detached'], value: 'attached' },
      { id: 'rt_public', group: 'Route tables', label: 'Public RT: 0.0.0.0/0 →', options: ['igw', 'none'], value: 'igw' },
      { id: 'web_ip', group: 'Instances', label: 'web-1 IP', options: ['elastic IP', 'none'], value: 'elastic IP' },
      { id: 'nacl_in', group: 'Network ACLs', label: 'NACL inbound', options: ['allow 443', 'allow all', 'deny all'], value: 'allow 443' },
      { id: 'nacl_out', group: 'Network ACLs', label: 'NACL outbound', options: ['allow 443', 'allow 1024-65535', 'allow all'], value: 'allow 443' },
      { id: 'sg_web', group: 'Security groups', label: 'web-1 SG inbound', options: ['80,443 from 0.0.0.0/0', 'none'], value: '80,443 from 0.0.0.0/0' },
    ],
    tests: [{ label: 'internet → web-1 :443', expect: true, run: v => inboundWeb(v) }],
    insecureCheck: v => v.nacl_in === 'allow all' ? 'Allowing all inbound at the NACL undoes the subnet hardening.' : null,
    lesson: 'NACLs are stateless. Responses go back to the client\'s ephemeral port (1024-65535), so outbound must allow it.', codex: 'sg_nacl',
  },
  igw_missing: {
    title: 'Brand-new VPC, nothing works',
    desc: 'A junior engineer built a VPC by hand. The public web server can\'t be reached and can\'t reach anything.',
    fields: [
      { id: 'igw', group: 'Gateways', label: 'Internet Gateway', options: ['detached', 'attached'], value: 'detached' },
      { id: 'rt_public', group: 'Route tables', label: 'Public RT: 0.0.0.0/0 →', options: ['none', 'igw', 'nat-a'], value: 'none' },
      { id: 'web_ip', group: 'Instances', label: 'web-1 IP', options: ['none', 'elastic IP'], value: 'none' },
      { id: 'sg_web', group: 'Security groups', label: 'web-1 SG inbound', options: ['80,443 from 0.0.0.0/0', 'none'], value: '80,443 from 0.0.0.0/0' },
    ],
    tests: [{ label: 'internet → web-1 :443', expect: true, run: v => inboundWeb(v, { nacl: false }) }],
    lesson: 'Internet access needs all three: an attached IGW, a 0.0.0.0/0 route to it, and a public IP on the instance.', codex: 'vpc',
  },
  s3_endpoint: {
    title: 'No internet allowed — but we need S3',
    desc: 'Compliance forbids any internet path from the data subnet. The batch job must still read s3://ledger-data. There is no NAT and there must not be.',
    fields: [
      { id: 'rt_s3', group: 'Route tables', label: 'Private RT: S3 prefix list →', options: ['none', 'vpce-s3 (gateway endpoint)'], value: 'none' },
      { id: 'rt_private', group: 'Route tables', label: 'Private RT: 0.0.0.0/0 →', options: ['none', 'nat-a'], value: 'none', insecure: ['nat-a'] },
      { id: 'ep_policy', group: 'Endpoints', label: 'Endpoint policy', options: ['deny all', 'allow s3:GetObject on ledger-data/*', 'allow s3:* on *'], value: 'deny all', insecure: ['allow s3:* on *'] },
      { id: 'role', group: 'IAM', label: 'batch role permissions', options: ['none', 's3:GetObject on ledger-data/*'], value: 'none' },
    ],
    tests: [
      { label: 'batch → s3://ledger-data', expect: true, run: v => {
        const viaNat = v.rt_private === 'nat-a';
        const h = [hop('Route to S3', v.rt_s3 !== 'none' || viaNat, v.rt_s3 !== 'none' ? 'Gateway endpoint route for the S3 prefix list.' : viaNat ? 'Via NAT and the internet (violates the requirement).' : 'No route to S3.')];
        if (v.rt_s3 !== 'none' && !viaNat) h.push(hop('Endpoint policy', v.ep_policy !== 'deny all', v.ep_policy !== 'deny all' ? 'Endpoint policy permits the request.' : 'Endpoint policy denies everything.'));
        h.push(hop('IAM role', v.role !== 'none', v.role !== 'none' ? 'Role allows s3:GetObject.' : 'Role has no S3 permissions.'));
        return h;
      } },
      { label: 'batch → internet', expect: false, run: v => [hop('Default route', v.rt_private === 'nat-a', v.rt_private === 'nat-a' ? 'Internet reachable through NAT — compliance violation.' : 'No internet path. Good.')] },
    ],
    insecureCheck: v => v.ep_policy === 'allow s3:* on *' ? 'Endpoint policy allows any bucket — a data-exfiltration path to attacker buckets.' : null,
    lesson: 'Gateway endpoints give private subnets S3/DynamoDB access with no internet path; endpoint policies limit which buckets.', codex: 'vpce',
  },
  peering_routes: {
    title: 'Peered, but silent',
    desc: 'app (VPC A 10.0.0.0/16) must reach Postgres (VPC B 10.1.0.0/16) on 5432. The peering connection pcx-1 is Active. Connections hang.',
    fields: [
      { id: 'rt_a', group: 'Route tables', label: 'VPC A RT: 10.1.0.0/16 →', options: ['none', 'pcx-1', 'igw'], value: 'none' },
      { id: 'rt_b', group: 'Route tables', label: 'VPC B RT: 10.0.0.0/16 →', options: ['none', 'pcx-1'], value: 'none' },
      { id: 'sg_db', group: 'Security groups', label: 'db SG inbound 5432 from', options: ['10.1.0.0/16', '10.0.0.0/16', '0.0.0.0/0'], value: '10.1.0.0/16', insecure: ['0.0.0.0/0'] },
    ],
    tests: [{ label: 'app (A) → db (B) :5432', expect: true, run: v => [
      hop('A → B route', v.rt_a === 'pcx-1', v.rt_a === 'pcx-1' ? 'Route to 10.1.0.0/16 via pcx-1.' : 'VPC A has no route to VPC B.'),
      hop('DB security group', v.sg_db !== '10.1.0.0/16', v.sg_db !== '10.1.0.0/16' ? 'Allows the peer CIDR.' : 'SG only allows VPC B\'s own range.'),
      hop('B → A return route', v.rt_b === 'pcx-1', v.rt_b === 'pcx-1' ? 'Return route via pcx-1.' : 'Responses have no route back to 10.0.0.0/16.'),
    ] }],
    insecureCheck: v => v.sg_db === '0.0.0.0/0' ? 'Database open to 0.0.0.0/0. Scope it to the peer CIDR (or SG reference).' : null,
    lesson: 'Peering needs routes on BOTH sides plus security groups that allow the peer\'s CIDR.', codex: 'peering',
  },
  peering_overlap: {
    title: 'Peering request rejected',
    desc: 'Creating a peering between VPC A and VPC B fails. Both teams used the default from a tutorial.',
    fields: [
      { id: 'cidr_a', group: 'VPCs', label: 'VPC A CIDR', options: ['10.0.0.0/16'], value: '10.0.0.0/16' },
      { id: 'cidr_b', group: 'VPCs', label: 'VPC B CIDR (re-IP)', options: ['10.0.0.0/16', '10.0.128.0/17', '10.2.0.0/16'], value: '10.0.0.0/16' },
      { id: 'rt_a', group: 'Route tables', label: 'VPC A RT: B\'s CIDR →', options: ['none', 'pcx-1'], value: 'none' },
      { id: 'rt_b', group: 'Route tables', label: 'VPC B RT: A\'s CIDR →', options: ['none', 'pcx-1'], value: 'none' },
    ],
    tests: [{ label: 'A ↔ B', expect: true, run: v => {
      const overlap = v.cidr_b !== '10.2.0.0/16';
      return [hop('CIDR overlap', !overlap, overlap ? `${v.cidr_b} overlaps 10.0.0.0/16. Peering can't route overlapping ranges.` : 'Ranges are disjoint.'), hop('Routes', v.rt_a === 'pcx-1' && v.rt_b === 'pcx-1', 'Both sides need routes to the peering connection.')];
    } }],
    lesson: 'Plan IP space up front. Overlapping CIDRs can\'t be peered (or routed via TGW) without NAT tricks.', codex: 'cidr',
  },
  db_public: {
    title: 'The auditor\'s red flag',
    desc: 'The app works — but the database sits in a public subnet with 5432 open to the world. Lock it down without breaking the app.',
    fields: [
      { id: 'db_subnet', group: 'Instances', label: 'DB subnet', options: ['public-a', 'private-a'], value: 'public-a' },
      { id: 'db_public', group: 'Instances', label: 'DB publicly accessible', options: ['yes', 'no'], value: 'yes' },
      { id: 'sg_db', group: 'Security groups', label: 'DB SG inbound 5432 from', options: ['0.0.0.0/0', 'sg-web (reference)', 'none'], value: '0.0.0.0/0' },
    ],
    tests: [
      { label: 'web → db :5432', expect: true, run: v => [hop('DB SG', v.sg_db !== 'none', v.sg_db !== 'none' ? 'Web tier allowed.' : 'Nothing allowed — app broken.')] },
      { label: 'internet → db :5432', expect: false, run: v => { const exposed = v.db_subnet === 'public-a' && v.db_public === 'yes' && v.sg_db === '0.0.0.0/0'; const partly = v.db_subnet === 'public-a' && v.db_public === 'yes' && v.sg_db !== 'none' && v.sg_db === '0.0.0.0/0'; return [hop('Exposure', exposed || partly, exposed ? 'Public subnet + public endpoint + SG open to the world = exposed.' : 'Not reachable from the internet.')]; } },
    ],
    insecureCheck: v => (v.db_subnet === 'public-a' || v.db_public === 'yes') ? 'Defense in depth: databases belong in private subnets with public access off, even if the SG is tight.' : null,
    lesson: 'Databases: private subnet, not publicly accessible, SG that references the app tier\'s SG.', codex: 'sg_nacl',
  },
};

// ═══════════════════════ CIDR DRILLS ═══════════════════════
export function cidrQuestions(seed, n = 5) {
  const rng = mulberry32(seed);
  const qs = [];
  const opts = (correct, gen) => { const s = new Set([correct]); let guard = 0; while (s.size < 4 && guard++ < 50) s.add(gen()); const a = [...s]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return { a, c: a.indexOf(correct) }; };
  const makers = [
    () => { const p = randInt(rng, 20, 28); const ans = 2 ** (32 - p) - 5; const o = opts(String(ans), () => String(2 ** (32 - p) - pick(rng, [0, 2, 3, 4, 1]) + pick(rng, [0, 0, 16, -16]))); return { q: `How many usable IPs does a /${p} subnet have in AWS?`, ...o, ex: `2^(32−${p}) = ${2 ** (32 - p)}, minus 5 AWS-reserved = ${ans}.` }; },
    () => { const a = randInt(rng, 16, 20), b = randInt(rng, a + 2, 26); const ans = 2 ** (b - a); const o = opts(String(ans), () => String(2 ** (b - a + pick(rng, [-1, 1, 2, -2])))); return { q: `How many /${b} subnets fit in a /${a}?`, ...o, ex: `2^(${b}−${a}) = ${ans}.` }; },
    () => { const x = randInt(rng, 0, 50); const third = randInt(rng, 0, 255); const p = pick(rng, [20, 22, 24]); const block = 2 ** (24 - p) || 1; const base = Math.floor(third / block) * block; const inside = rng() < 0.5; const tThird = inside ? base + randInt(rng, 0, block - 1) : (base + block + randInt(rng, 0, 3)) % 256; const ans = inside ? 'Yes' : 'No'; return { q: `Is 10.${x}.${tThird}.${randInt(rng, 1, 254)} inside 10.${x}.${base}.0/${p}?`, a: ['Yes', 'No'], c: ans === 'Yes' ? 0 : 1, ex: `A /${p} covers ${block} values of the third octet: 10.${x}.${base}.0 – 10.${x}.${base + block - 1}.255.` }; },
    () => { const hosts = randInt(rng, 20, 2000); let p = 28; while (2 ** (32 - p) - 5 < hosts) p--; const o = opts('/' + p, () => '/' + (p + pick(rng, [-2, -1, 1, 2]))); return { q: `Smallest AWS subnet prefix that fits ${hosts} hosts?`, ...o, ex: `/${p} gives ${2 ** (32 - p) - 5} usable; /${p + 1} gives only ${2 ** (31 - p) - 5}.` }; },
    () => { const pairs = [['10.0.0.0/16', '10.0.128.0/17', true], ['10.0.0.0/16', '10.1.0.0/16', false], ['172.16.0.0/12', '172.20.0.0/16', true], ['192.168.0.0/24', '192.168.1.0/24', false], ['10.0.0.0/8', '10.250.0.0/16', true], ['10.0.0.0/20', '10.0.16.0/20', false]]; const [a, b, ov] = pick(rng, pairs); return { q: `Do ${a} and ${b} overlap?`, a: ['Yes', 'No'], c: ov ? 0 : 1, ex: ov ? `${b} lies inside ${a}.` : 'Disjoint ranges — they could be peered.' }; },
    () => { const o = opts('172.16.0.0/12', () => pick(rng, ['100.64.0.0/10', '172.32.0.0/12', '192.0.2.0/24', '169.254.0.0/16', '172.16.0.0/16'])); return { q: 'Which is an RFC 1918 private range?', ...o, ex: 'Private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16.' }; },
  ];
  for (let i = 0; i < n; i++) qs.push(pick(rng, makers)());
  return qs;
}

// ═══════════════════════ SECURITY AUDIT ═══════════════════════
export const FINDINGS = [
  { res: 'S3 bucket "customer-invoices"', detail: 'Bucket policy: { "Principal": "*", "Action": "s3:GetObject" }', bad: true, fixes: ['Delete the bucket', 'Enable Block Public Access and serve via CloudFront OAC or signed URLs', 'Enable versioning', 'Add a lifecycle rule'], fix: 1, why: 'Public read on private data. Block Public Access; grant access explicitly.' },
  { res: 'IAM user "deploy-bot"', detail: 'Access key created 914 days ago, used daily from GitHub Actions', bad: true, fixes: ['Rotate the key yearly', 'Replace with GitHub OIDC → IAM role (no long-lived keys)', 'Add MFA to the bot', 'Move the key to a .env file'], fix: 1, why: 'Long-lived keys leak. OIDC federation issues short-lived credentials.' },
  { res: 'Security group "web-sg"', detail: 'Inbound: 22/tcp from 0.0.0.0/0', bad: true, fixes: ['Change to port 2222', 'Remove the rule and use Systems Manager Session Manager', 'Add a NACL allow rule', 'Enable Flow Logs'], fix: 1, why: 'SSH open to the world is brute-forced constantly. Session Manager needs no inbound ports.' },
  { res: 'Root user', detail: 'MFA: not enabled. Last used: 3 days ago', bad: true, fixes: ['Delete the root user', 'Enable hardware MFA on root and stop using it day-to-day', 'Create access keys for root', 'Rename the account'], fix: 1, why: 'Root can do anything and can\'t be restricted by IAM. Lock it away.' },
  { res: 'CloudTrail', detail: 'Trail enabled in us-east-1 only; log file validation off', bad: true, fixes: ['Disable it to save money', 'Enable a multi-region (organization) trail with log file validation to a locked log account', 'Send logs to the same account\'s bucket', 'Turn on X-Ray'], fix: 1, why: 'Attackers operate in regions you aren\'t watching.' },
  { res: 'RDS "orders-db"', detail: 'Encrypted: false · Publicly accessible: true', bad: true, fixes: ['Toggle encryption on', 'Snapshot → encrypted copy → restore into private subnets with public access off', 'Add a read replica', 'Increase instance size'], fix: 1, why: 'Encryption is set at creation; and a DB should never be public.' },
  { res: 'IAM role "app-role"', detail: 'Policy: { "Effect": "Allow", "Action": "*", "Resource": "*" }', bad: true, fixes: ['Attach AdministratorAccess instead', 'Scope to the specific actions/resources used (Access Analyzer can generate it)', 'Add a second policy', 'Add a tag'], fix: 1, why: 'A compromise of the app becomes a compromise of the account.' },
  { res: 'EBS default encryption', detail: 'Disabled in all regions', bad: true, fixes: ['Ignore', 'Enable EBS encryption by default (per region) with a KMS key', 'Use instance store', 'Enable snapshots'], fix: 1, why: 'One setting ensures every new volume is encrypted.' },
  { res: 'Lambda "process-payment"', detail: 'Env var STRIPE_SECRET=sk_live_51H…', bad: true, fixes: ['Base64 encode it', 'Store in Secrets Manager and fetch at runtime with the function role', 'Move it to the code', 'Rename the variable'], fix: 1, why: 'Secrets in env vars show up in consoles, logs and IaC state.' },
  { res: 'GuardDuty', detail: 'Not enabled in any region', bad: true, fixes: ['Install antivirus on EC2', 'Enable GuardDuty organization-wide with a delegated admin', 'Enable Shield', 'Enable Inspector only'], fix: 1, why: 'Threat detection costs little and catches stolen credentials and mining.' },
  { res: 'Backup vault "prod"', detail: 'Backups in the same account as production; no vault lock', bad: true, fixes: ['Increase retention', 'Copy to a separate backup account and enable Vault Lock (compliance mode)', 'Take more snapshots', 'Enable versioning on EBS'], fix: 1, why: 'Ransomware operators delete backups in the compromised account.' },
  { res: 'S3 bucket "terraform-state"', detail: 'Versioning off · no state locking table', bad: true, fixes: ['Commit state to Git', 'Enable versioning, encryption and DynamoDB (or native) state locking', 'Make it public for the team', 'Use local state'], fix: 1, why: 'State corruption and concurrent applies destroy infra.' },
  { res: 'Organization SCPs', detail: 'Only FullAWSAccess attached', bad: true, fixes: ['Leave as is', 'Add guardrails: deny leaving org, deny disabling CloudTrail/GuardDuty, deny unused regions', 'Delete FullAWSAccess', 'Use IAM users instead'], fix: 1, why: 'Without guardrails, a compromised account admin can blind you.' },
  { res: 'ALB "public-web"', detail: 'Listener: HTTP :80 only, no redirect', bad: true, fixes: ['Add port 8080', 'Add HTTPS :443 with an ACM cert and redirect 80→443', 'Use an NLB', 'Disable the ALB'], fix: 1, why: 'Encryption in transit.' },
  { res: 'EKS cluster "prod"', detail: 'API endpoint public, open to 0.0.0.0/0; no audit logging', bad: true, fixes: ['Delete the cluster', 'Make the endpoint private (or restrict CIDRs) and enable control-plane audit logs', 'Add more nodes', 'Enable Fargate'], fix: 1, why: 'The Kubernetes API is a high-value target.' },
  // fine ones
  { res: 'S3 bucket "static-site"', detail: 'Private bucket, served through CloudFront with Origin Access Control', bad: false, why: 'Correct pattern.' },
  { res: 'IAM role "ecs-task-orders"', detail: 'Allows dynamodb:GetItem/PutItem on table/orders only', bad: false, why: 'Least privilege.' },
  { res: 'RDS "billing-db"', detail: 'Encrypted with CMK · Multi-AZ · private subnets · IAM auth', bad: false, why: 'Good.' },
  { res: 'Security group "db-sg"', detail: 'Inbound 5432 from sg-app only', bad: false, why: 'SG references keep access tight.' },
  { res: 'KMS key "data-key"', detail: 'Automatic rotation on; key policy grants only app roles decrypt', bad: false, why: 'Good.' },
  { res: 'CloudFront "cdn"', detail: 'HTTPS only, TLS 1.2+, WAF attached', bad: false, why: 'Good.' },
  { res: 'Secrets Manager "db-creds"', detail: 'Rotation every 30 days via Lambda', bad: false, why: 'Good.' },
  { res: 'Config', detail: 'Recorder on in all regions; conformance pack CIS deployed', bad: false, why: 'Good.' },
  { res: 'VPC "prod"', detail: 'Flow logs to a central log bucket; NAT per AZ', bad: false, why: 'Good.' },
  { res: 'IAM Identity Center', detail: 'Federated with corporate IdP; permission sets per role; MFA enforced', bad: false, why: 'Good.' },
  { res: 'ECR repository "api"', detail: 'Scan on push enabled; immutable tags', bad: false, why: 'Good.' },
  { res: 'Backup plan "daily"', detail: 'Cross-account copy to backup account; vault lock compliance mode, 35 days', bad: false, why: 'Good.' },
];

export function auditSet(seed, count = 10) {
  const rng = mulberry32(seed);
  const bad = FINDINGS.filter(f => f.bad), good = FINDINGS.filter(f => !f.bad);
  const nb = Math.ceil(count * 0.6);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  return shuffle([...shuffle(bad).slice(0, nb), ...shuffle(good).slice(0, count - nb)]).map(f => {
    if (!f.bad) return f;
    const order = shuffle(f.fixes.map((x, i) => i));
    return { ...f, fixes: order.map(i => f.fixes[i]), fix: order.indexOf(f.fix) };
  });
}

// ═══════════════════════ IAM EVALUATION ═══════════════════════
const j = o => JSON.stringify(o, null, 2);
export const IAM_PUZZLES = [
  { title: 'Explicit deny', policies: [
    ['Identity policy · role/app', j({ Version: '2012-10-17', Statement: [{ Effect: 'Allow', Action: 's3:*', Resource: '*' }] })],
    ['Bucket policy · prod-data', j({ Statement: [{ Effect: 'Deny', Principal: '*', Action: 's3:DeleteObject', Resource: 'arn:aws:s3:::prod-data/*' }] })]],
    request: 'role/app (same account) → s3:DeleteObject on prod-data/report.csv', answer: 'Deny',
    reasons: ['No identity policy allows it', 'Explicit Deny in the bucket policy overrides any Allow', 'SCP blocks S3', 'Buckets deny by default'], reason: 1 },
  { title: 'Resource policy alone (same account)', policies: [
    ['Identity policy · user/analyst', '(no policies attached)'],
    ['Bucket policy · reports', j({ Statement: [{ Effect: 'Allow', Principal: { AWS: 'arn:aws:iam::111122223333:user/analyst' }, Action: 's3:GetObject', Resource: 'arn:aws:s3:::reports/*' }] })]],
    request: 'user/analyst in account 111122223333 → s3:GetObject on reports/q3.pdf (bucket in same account)', answer: 'Allow',
    reasons: ['Within one account, an Allow in either the identity OR resource policy is enough', 'Users always need identity policies', 'Implicit deny wins', 'Bucket policies only work cross-account'], reason: 0 },
  { title: 'Cross-account needs both sides', policies: [
    ['Identity policy · role/etl (account B)', '(no S3 permissions)'],
    ['Bucket policy · lake (account A)', j({ Statement: [{ Effect: 'Allow', Principal: { AWS: 'arn:aws:iam::BBBBBBBBBBBB:role/etl' }, Action: 's3:GetObject', Resource: 'arn:aws:s3:::lake/*' }] })]],
    request: 'role/etl in account B → s3:GetObject on lake/day1.parquet in account A', answer: 'Deny',
    reasons: ['The bucket policy is enough', 'Cross-account requires an Allow on BOTH sides — B\'s identity policy is missing', 'Explicit deny', 'Roles can\'t access S3 cross-account'], reason: 1 },
  { title: 'SCP ceiling', policies: [
    ['SCP on OU "Workloads"', j({ Statement: [{ Effect: 'Deny', Action: '*', Resource: '*', Condition: { StringNotEquals: { 'aws:RequestedRegion': ['eu-west-1', 'eu-central-1'] } } }] })],
    ['Identity policy · role/admin', j({ Statement: [{ Effect: 'Allow', Action: '*', Resource: '*' }] })]],
    request: 'role/admin in a Workloads account → ec2:RunInstances in us-east-1', answer: 'Deny',
    reasons: ['Admins bypass SCPs', 'The SCP denies all actions outside the EU regions', 'EC2 is a global service', 'No resource policy'], reason: 1 },
  { title: 'SCPs don\'t grant', policies: [
    ['SCP', j({ Statement: [{ Effect: 'Allow', Action: 'dynamodb:*', Resource: '*' }] })],
    ['Identity policy · role/worker', '(only sqs:* allowed)']],
    request: 'role/worker → dynamodb:PutItem', answer: 'Deny',
    reasons: ['The SCP allows DynamoDB', 'SCPs only set the maximum; the identity policy must also allow it', 'DynamoDB requires a resource policy', 'Explicit deny'], reason: 1 },
  { title: 'Permission boundary', policies: [
    ['Permissions boundary on role/dev', j({ Statement: [{ Effect: 'Allow', Action: ['s3:*', 'cloudwatch:*'], Resource: '*' }] })],
    ['Identity policy · role/dev', j({ Statement: [{ Effect: 'Allow', Action: ['s3:*', 'iam:CreateUser'], Resource: '*' }] })]],
    request: 'role/dev → iam:CreateUser', answer: 'Deny',
    reasons: ['Identity policy allows it', 'Effective permissions are the intersection of the boundary and the identity policy', 'IAM actions always need MFA', 'Boundaries only apply to users'], reason: 1 },
  { title: 'AssumeRole trust', policies: [
    ['Trust policy · role/deployer (account A)', j({ Statement: [{ Effect: 'Allow', Principal: { AWS: 'arn:aws:iam::CCCCCCCCCCCC:root' }, Action: 'sts:AssumeRole', Condition: { StringEquals: { 'sts:ExternalId': 'acme-42' } } }] })],
    ['Identity policy · role/ci (account C)', j({ Statement: [{ Effect: 'Allow', Action: 'sts:AssumeRole', Resource: 'arn:aws:iam::AAAAAAAAAAAA:role/deployer' }] })]],
    request: 'role/ci in account C calls sts:AssumeRole on role/deployer WITHOUT an ExternalId', answer: 'Deny',
    reasons: ['Account C is trusted, so it works', 'The trust policy condition requires ExternalId acme-42', 'Cross-account roles are not allowed', 'CI needs MFA'], reason: 1 },
  { title: 'Condition keys', policies: [
    ['Identity policy · user/ops', j({ Statement: [{ Effect: 'Allow', Action: 'ec2:StopInstances', Resource: '*', Condition: { StringEquals: { 'aws:ResourceTag/env': 'dev' } } }] })]],
    request: 'user/ops → ec2:StopInstances on an instance tagged env=prod', answer: 'Deny',
    reasons: ['Allowed — Resource is *', 'The condition only matches resources tagged env=dev; nothing allows prod, so implicit deny', 'Explicit deny on prod', 'EC2 needs a resource policy'], reason: 1 },
  { title: 'KMS key policy', policies: [
    ['Identity policy · role/app', j({ Statement: [{ Effect: 'Allow', Action: 'kms:Decrypt', Resource: '*' }] })],
    ['Key policy · data-key', j({ Statement: [{ Effect: 'Allow', Principal: { AWS: 'arn:aws:iam::111122223333:role/security' }, Action: 'kms:*', Resource: '*' }] })]],
    request: 'role/app → kms:Decrypt with data-key (same account). The key policy does NOT include the "Enable IAM policies" root statement.', answer: 'Deny',
    reasons: ['Identity policy allows it', 'KMS key policies must allow access (directly or by delegating to IAM via the account root); this one doesn\'t', 'Decrypt is always allowed', 'SCP'], reason: 1 },
];

// ═══════════════════════ MIGRATION PORTFOLIOS ═══════════════════════
export const SEVEN_RS = [
  { id: 'retire', name: 'Retire', desc: 'Decommission — no longer needed.' },
  { id: 'retain', name: 'Retain', desc: 'Keep on-prem for now.' },
  { id: 'rehost', name: 'Rehost', desc: 'Lift & shift VMs as-is.' },
  { id: 'relocate', name: 'Relocate', desc: 'Move VMware as-is (VMC on AWS).' },
  { id: 'replatform', name: 'Replatform', desc: 'Small changes to use managed services.' },
  { id: 'repurchase', name: 'Repurchase', desc: 'Switch to SaaS.' },
  { id: 'refactor', name: 'Refactor', desc: 'Re-architect cloud-native.' },
];
export const PORTFOLIOS = {
  halcyon: { name: 'Halcyon Logistics datacenter', apps: [
    { name: 'FleetTrack', desc: 'Core tracking app, Java monolith on 40 VMs. Needs to scale 10× for peak season; the business wants faster feature delivery.', best: ['refactor'], ok: ['replatform'], why: 'Strategic, needs elasticity and agility → re-architect (or replatform first).' },
    { name: 'HR Portal 2009', desc: 'Old intranet app. Usage logs show 3 logins in the last year; HR moved to Workday.', best: ['retire'], ok: [], why: 'Unused → turn it off.' },
    { name: 'Warehouse VMs', desc: '120 Windows/Linux VMs, stable, nobody wants to touch the code. Must move before the lease ends.', best: ['rehost'], ok: ['relocate'], why: 'Fast, low-risk lift & shift with MGN.' },
    { name: 'Billing DB', desc: 'Self-managed PostgreSQL 13 on a physical server. DBAs spend 30% of their time patching and doing backups.', best: ['replatform'], ok: [], why: 'Move to RDS/Aurora PostgreSQL — managed ops, same engine.' },
    { name: 'Email & calendar', desc: 'On-prem Exchange cluster.', best: ['repurchase'], ok: [], why: 'Commodity → SaaS (Microsoft 365 / Google Workspace).' },
    { name: 'Mainframe ledger', desc: 'COBOL mainframe. Upgraded last year; regulators require extensive certification for any change.', best: ['retain'], ok: [], why: 'Recent investment + regulatory risk → keep for now, revisit later.' },
    { name: 'vSphere analytics cluster', desc: '200 VMs managed with vSphere tooling the ops team loves. Needs to move in 8 weeks.', best: ['relocate'], ok: ['rehost'], why: 'VMware Cloud on AWS moves VMware estates without conversion.' },
  ], transfer: { tb: 300, mbps: 1000, weeks: 3, answer: 'snowball', why: '300 TB over 1 Gbps at ~80% ≈ 35 days. Too slow for 3 weeks → Snowball Edge devices (with DataSync for the delta).' } },
  retail: { name: 'Regional retail chain', apps: [
    { name: 'E-commerce site', desc: 'PHP monolith on 6 VMs; Black Friday crashes every year.', best: ['replatform'], ok: ['refactor', 'rehost'], why: 'Containerize/Beanstalk + RDS + autoscaling quickly; refactor later.' },
    { name: 'POS back office', desc: 'Vendor-supported Windows app; vendor now offers a SaaS edition.', best: ['repurchase'], ok: [], why: 'Vendor SaaS.' },
    { name: 'Old loyalty app', desc: 'Replaced by the new e-commerce loyalty feature. Still running "just in case".', best: ['retire'], ok: [], why: '' },
    { name: 'Inventory DB', desc: 'SQL Server Enterprise on a big physical box.', best: ['replatform'], ok: ['rehost'], why: 'RDS for SQL Server (or Babelfish/Aurora as a later step).' },
    { name: 'Store camera NVRs', desc: 'Video recorders in each store with local disks; low latency to cameras required.', best: ['retain'], ok: [], why: 'Edge workloads stay local (or use Outposts/Snow later).' },
  ], transfer: { tb: 8, mbps: 1000, weeks: 2, answer: 'datasync', why: '8 TB at ~100 MB/s ≈ 1 day. Online transfer with DataSync is fine.' } },
  hospital: { name: 'County hospital IT', apps: [
    { name: 'Patient portal', desc: 'Custom .NET app with seasonal spikes (flu season), wants mobile features.', best: ['refactor'], ok: ['replatform'], why: '' },
    { name: 'PACS imaging archive', desc: '2 PB of images, rarely accessed after 1 year, must be kept 10 years.', best: ['replatform'], ok: ['rehost'], why: 'S3 + lifecycle to Glacier dramatically cuts cost.' },
    { name: 'Lab instrument controllers', desc: 'Connected directly to lab machines over serial cables.', best: ['retain'], ok: [], why: 'Physical dependency.' },
    { name: 'Ticketing system', desc: 'Old self-hosted helpdesk, the team wants ServiceNow.', best: ['repurchase'], ok: [], why: '' },
    { name: 'Fax gateway', desc: 'Nobody has used it since 2021.', best: ['retire'], ok: [], why: '' },
    { name: 'Scheduling VMs', desc: '12 Linux VMs, stable, documented, low change rate.', best: ['rehost'], ok: ['replatform'], why: '' },
  ], transfer: { tb: 2000, mbps: 10000, weeks: 6, answer: 'snowball', why: '2 PB over 10 Gbps ≈ 23 days at full rate — realistic utilization makes it ~4-5 weeks; with no slack, many Snowball Edge devices in parallel are safer. (DX alone takes weeks to provision.)' } },
};
export const TRANSFER_OPTS = [
  { id: 'datasync', name: 'DataSync over the existing link' },
  { id: 'snowball', name: 'Snowball Edge devices (offline)' },
  { id: 'dx', name: 'Order a new Direct Connect first' },
  { id: 'email', name: 'Upload through the S3 console' },
];

// ═══════════════════════ RECON (threat modeling) ═══════════════════════
export const VECTORS = [
  { id: 'flood_l3', name: 'Volumetric flood', counter: 'CDN / Global Accelerator / Shield at the edge' },
  { id: 'flood_l7', name: 'HTTP request flood', counter: 'WAF rate limits + caching + autoscaling headroom' },
  { id: 'az', name: 'Wait for an AZ failure', counter: 'Every tier Multi-AZ' },
  { id: 'region', name: 'Wait for a regional failure', counter: 'Multi-region with health-checked failover' },
  { id: 'dns', name: 'DNS provider takedown', counter: 'Secondary DNS provider' },
  { id: 'creds', name: 'Hunt for leaked long-lived keys', counter: 'IAM roles / OIDC, Secrets Manager, GuardDuty' },
  { id: 'ransom', name: 'Ransomware vs. mutable backups', counter: 'Immutable, isolated backups' },
  { id: 'supply', name: 'Poisoned dependency in CI', counter: 'Dependency scanning, pinned versions, OIDC' },
  { id: 'quota', name: 'Exhaust a service quota at peak', counter: 'Pre-raised quotas, static stability' },
];
export const RECON_TARGETS = {
  helix_bank: { name: 'Helix Bank (Autopilot-managed)', arch: ['CloudFront + WAF + Shield Advanced at the edge', 'EKS across 3 AZs, Karpenter, PDBs', 'Aurora PostgreSQL — single region, us-east-1, Multi-AZ', 'Route 53, single region, no DR region', 'AWS Backup with Vault Lock', 'GitHub Actions with OIDC + image scanning'], weak: ['region'], why: 'Everything is multi-AZ and hardened — but it\'s all in ONE region. A regional event takes the bank down.' },
  axiom_support: { name: 'Axiom Support Portal', arch: ['Global Accelerator, WAF with Bot Control', 'Active-active in us-east-1 and eu-west-1', 'DynamoDB Global Tables', 'Backups: daily snapshots in the same account, no lock', 'Admins use IAM users with access keys for scripts'], weak: ['ransom', 'creds'], why: 'Long-lived admin keys + mutable backups in the same account = the ransomware playbook.' },
  citygrid: { name: 'CityGrid transit API', arch: ['Single ALB → ASG (max 20, vCPU quota default)', 'Multi-AZ RDS', 'No CDN, no WAF', 'Monthly peak on New Year\'s Eve'], weak: ['flood_l3', 'flood_l7', 'quota'], why: 'No edge layer and no WAF: floods go straight to an ASG capped by default quotas.' },
  axiom_ads: { name: 'Axiom Ads (post-"optimization")', arch: ['Autopilot cut costs: single NAT Gateway, single cache node', 'ASG on 100% Spot, one instance type', 'Single-AZ RDS "for savings"'], weak: ['az'], why: 'Cost-cutting removed redundancy: one AZ failure takes NAT, cache, and the DB.' },
  helix_bank_v2: { name: 'Helix Bank (after the "fix")', arch: ['Now two regions with Aurora Global', 'DNS hosted at a single provider', 'Edge: CloudFront + Shield', 'Health checks enabled'], weak: ['dns'], why: 'All that redundancy behind ONE DNS provider.' },
  medcorp: { name: 'MedCorp records', arch: ['Private subnets everywhere, Network Firewall egress', 'Organizations + SCPs, GuardDuty, Vault Lock backups', 'Multi-AZ, warm standby region', 'CI pulls unpinned dependencies from public registries; no scanning'], weak: ['supply'], why: 'A fortress whose build pipeline trusts strangers.' },
};
