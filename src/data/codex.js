// The Codex: in-game reference. Each entry is short, accurate, exam-relevant.
// `comp` links to a component for its AWS/Azure/GCP names.
const E = (id, domain, title, body, facts, tip, extra = {}) => ({ id, domain, title, body, facts, tip, ...extra });

export const CODEX = [
  // ───────── NETWORKING ─────────
  E('vpc', 'net', 'VPC & Subnets', 'A Virtual Private Cloud is an isolated network in one region. You carve its CIDR into subnets, each living in exactly one Availability Zone. A subnet is "public" only because its route table sends 0.0.0.0/0 to an Internet Gateway.', [
    'VPC CIDR: /16 (65,536 IPs) down to /28 (16 IPs). Plan non-overlapping ranges if you will ever peer or connect on-prem.',
    'AWS reserves 5 IPs in every subnet (network, router, DNS, future, broadcast). A /24 gives 251 usable.',
    'Public subnet = route 0.0.0.0/0 → IGW. Private subnet = no IGW route (outbound via NAT, if any).',
    'Put load balancers in public subnets; app servers and databases in private subnets.',
    'VPC Flow Logs capture accepted/rejected traffic metadata for troubleshooting and security.',
  ], 'If an instance "has a public IP but isn\'t reachable", check: IGW attached, route table, security group, NACL — in that order.', { comp: 'vpc' }),
  E('cidr', 'net', 'CIDR Math', 'CIDR notation a.b.c.d/n means the first n bits are the network. The remaining 32−n bits number the hosts: 2^(32−n) addresses.', [
    '/16 = 65,536 · /20 = 4,096 · /24 = 256 · /26 = 64 · /28 = 16 addresses.',
    'Splitting a /16 into /20s gives 2^(20−16) = 16 subnets.',
    '10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16 are private (RFC 1918) ranges.',
    'Two ranges overlap if one\'s network address falls inside the other.',
  ], 'Exam trick: "how many usable IPs in a /27 on AWS?" → 32 − 5 = 27.'),
  E('sg_nacl', 'net', 'Security Groups vs NACLs', 'Security groups are stateful firewalls attached to network interfaces: allow rules only, and return traffic is automatically allowed. Network ACLs are stateless subnet-level filters with numbered allow AND deny rules, evaluated in order.', [
    'SG: stateful, allow-only, instance level, can reference other SGs ("allow from the ALB\'s SG").',
    'NACL: stateless — you must allow return traffic on ephemeral ports 1024-65535 explicitly.',
    'NACL rules evaluate lowest number first; first match wins.',
    'Default NACL allows everything; custom NACLs deny everything until you add rules.',
  ], 'Blocking one malicious IP? NACL deny rule (SGs can\'t deny).'),
  E('nat', 'net', 'NAT Gateway', 'A managed service that lets instances in private subnets start outbound connections to the internet (updates, third-party APIs) while staying unreachable from outside. It lives in a public subnet in ONE AZ.', [
    'Zonal: if its AZ fails, private subnets in other AZs that route through it lose internet. Use one NAT per AZ.',
    'Cost: ~$0.045/hour plus $0.045 per GB processed — it adds up fast for S3 traffic.',
    'Use free S3/DynamoDB gateway endpoints so that traffic skips the NAT entirely.',
    'NAT instance (DIY EC2) is cheaper but you manage HA, patching and bandwidth.',
  ], 'Private instance can\'t download updates? Check route 0.0.0.0/0 → NAT, and the NAT\'s own subnet routes to the IGW.', { comp: 'nat' }),
  E('vpce', 'net', 'VPC Endpoints & PrivateLink', 'Endpoints give private subnets a path to AWS services without the internet. Gateway endpoints (S3, DynamoDB) are free route-table entries. Interface endpoints (PrivateLink) are ENIs with private IPs for most other services and for third-party SaaS.', [
    'Gateway endpoint: S3 and DynamoDB only, free, works via route tables.',
    'Interface endpoint: ~$0.01/hr per AZ + data; supports security groups and private DNS.',
    'Endpoint policies restrict which buckets/actions can be reached through the endpoint.',
    'PrivateLink lets you expose your own service to other VPCs/accounts without peering.',
  ], 'Requirement "no traffic over the internet" + S3 → gateway endpoint.', { comp: 'vpce' }),
  E('peering', 'net', 'VPC Peering', 'A one-to-one private connection between two VPCs (same or different accounts/regions). Traffic stays on the AWS backbone.', [
    'Not transitive: A↔B and B↔C does NOT let A reach C.',
    'CIDRs cannot overlap.',
    'Both sides need route table entries pointing at the peering connection, and SGs must allow the peer CIDR.',
    'Beyond a handful of VPCs, a full mesh becomes unmanageable → Transit Gateway.',
  ], 'N VPCs fully meshed need N(N−1)/2 peerings. 10 VPCs = 45.', { comp: 'peering' }),
  E('tgw', 'net', 'Transit Gateway', 'A regional hub router. Attach VPCs, VPNs and Direct Connect gateways; route tables on the TGW decide who talks to whom. Inter-region peering links TGWs.', [
    'Transitive routing between all attachments (unlike VPC peering).',
    'Separate TGW route tables enable segmentation (prod can\'t reach dev).',
    'Shareable across accounts via Resource Access Manager.',
    'Charged per attachment-hour and per GB processed.',
  ], 'Many VPCs + on-prem + segmentation → Transit Gateway.', { comp: 'tgw' }),
  E('vpn', 'mig', 'Site-to-Site VPN', 'Two IPsec tunnels from a Virtual Private Gateway or Transit Gateway to your on-prem customer gateway, over the internet. Minutes to set up.', [
    '~1.25 Gbps per tunnel; ECMP across tunnels on TGW for more.',
    'Supports static routes or BGP (dynamic).',
    'Latency varies with the internet. Encrypted by default.',
    'Common pattern: VPN as backup for Direct Connect.',
  ], 'Need connectivity today with modest bandwidth → VPN. Consistent, high bandwidth → Direct Connect.', { comp: 'vpn' }),
  E('dx', 'mig', 'Direct Connect', 'A dedicated physical connection from your datacenter or colo to AWS. Predictable latency, 1–100 Gbps, lower data-transfer-out rates. Provisioning takes weeks.', [
    'NOT encrypted by default — use MACsec or run a VPN over it if required.',
    'For resilience: two connections at two DX locations (maximum resiliency: 4).',
    'Direct Connect Gateway connects one DX to VPCs in many regions.',
    'Uses BGP to exchange routes.',
  ], 'Migrating 500 TB with a 2-week deadline? DX takes weeks to provision — consider Snowball.', { comp: 'dx' }),
  E('route53', 'net', 'DNS & Route 53 Routing', 'Route 53 is a global DNS service with routing policies and health checks. It is how traffic gets steered between regions.', [
    'Simple: one answer. Weighted: split by percentage (canaries, A/B).',
    'Latency: send users to the lowest-latency region. Geolocation: by user location (compliance, localization).',
    'Failover: primary/secondary, driven by health checks.',
    'Alias records point to AWS resources (ALB, CloudFront) at no query cost and work at the zone apex.',
    'DNS failover speed depends on health-check interval + TTL caching in resolvers.',
  ], 'Without health checks, DNS keeps sending users to a dead region.', { comp: 'route53' }),
  E('cloudfront', 'net', 'CDN (CloudFront)', 'A content delivery network caches responses at hundreds of edge locations near users. Static assets come from cache in milliseconds; the origin (S3, ALB) sees a fraction of the traffic.', [
    'Cache hit ratio is the key metric. Origin Shield adds a central cache tier to raise it further.',
    'TTLs and cache keys (headers, cookies, query strings) control what is cached.',
    'Shield Standard (free) absorbs most L3/L4 DDoS at the edge.',
    'Origin Access Control keeps S3 buckets private while CloudFront serves them.',
    'Data transfer from origin to CloudFront is free.',
  ], 'Global users + static content → CloudFront. Global users + dynamic TCP/UDP → Global Accelerator.', { comp: 'cloudfront' }),
  E('globalacc', 'net', 'Global Accelerator', 'Gives you two static anycast IPs. Users enter the AWS backbone at the nearest edge, then ride it to the healthiest regional endpoint.', [
    'Improves latency/jitter for dynamic and non-HTTP traffic.',
    'Regional failover in ~30 seconds — no DNS TTL caching problem.',
    'Static IPs simplify firewall allow-listing for clients.',
  ], 'Fast regional failover without DNS caching delays → Global Accelerator.', { comp: 'globalacc' }),
  E('alb', 'net', 'Application Load Balancer', 'Layer-7 load balancer: routes HTTP(S) by path, host, headers; terminates TLS; health-checks targets; spans multiple AZs automatically.', [
    'Targets: instances, IPs, Lambda functions, containers (dynamic ports).',
    'Health checks remove unhealthy targets; ASG can replace them (health_check_type = ELB).',
    'Integrates with WAF and ACM certificates.',
    'Without an LB, only the instance that DNS points at gets traffic.',
  ], 'HTTP path-based routing to microservices → ALB.', { comp: 'alb' }),
  E('nlb', 'net', 'Network Load Balancer', 'Layer-4 (TCP/UDP/TLS) load balancer for millions of requests per second with ultra-low latency. Supports static/Elastic IPs per AZ.', [
    'Preserves client source IP.', 'Use for non-HTTP protocols, extreme throughput, or static IP requirements.',
    'Gateway Load Balancer (GWLB) is a third type: inserts third-party firewalls/appliances transparently (GENEVE).',
  ], 'Need a static IP for a load balancer → NLB.', { comp: 'nlb' }),
  // ───────── COMPUTE ─────────
  E('ec2', 'compute', 'EC2 Instances', 'Virtual machines. You choose the instance family (t burstable, m general, c compute, r memory, g/p GPU), size and AMI. One instance lives in one AZ and fails with it.', [
    'Families: t (burstable), m (general), c (compute), r (memory), i (storage), g/p (GPU).',
    'Placement groups: cluster (low latency, one AZ), spread (max 7 per AZ on distinct hardware), partition (big distributed systems).',
    'Instance store is ephemeral; EBS persists independently of the instance.',
    'A single instance is a single point of failure no matter how big it is.',
  ], 'Scale out (more instances) beats scale up (bigger instance) for availability.', { comp: 'ec2' }),
  E('asg', 'compute', 'Auto Scaling Groups', 'An ASG keeps a fleet of identical instances between min and max, spread across AZs, replacing unhealthy ones and scaling on metrics.', [
    'Target tracking: "keep average CPU at 60%" — the simplest, usually best policy.',
    'Step/simple scaling react to alarms; scheduled scaling for known events; predictive scaling learns daily patterns.',
    'New instances take minutes to boot. Warm pools keep pre-initialized instances ready.',
    'ASG with ELB health checks replaces instances that fail the LB check, not just EC2 status checks.',
    'Mixed instances policy: On-Demand base + Spot across many types.',
  ], 'Spiky but predictable (lunch rush) → scheduled/predictive scaling + target tracking.', { comp: 'asg' }),
  E('lambda', 'compute', 'Lambda & Serverless', 'Run functions on events without servers. Billed per request and per GB-second. Scales to thousands of concurrent executions in seconds.', [
    'Default 1,000 concurrent executions per region (soft quota). Max timeout 15 minutes.',
    'Cold starts add latency when new execution environments spin up; provisioned concurrency keeps them warm (for a fee).',
    'Cheap at low/spiky volume; at high steady volume, containers or instances are usually cheaper.',
    'Memory setting also scales CPU (1,769 MB ≈ 1 vCPU).',
  ], 'Unpredictable, spiky, low-average traffic → Lambda. Constant high traffic → containers/EC2.', { comp: 'lambda' }),
  E('apigw', 'compute', 'API Gateway', 'Managed front door for APIs: authentication (Cognito, IAM, JWT), throttling, usage plans, request validation, caching.', [
    'REST API: richer features, $3.50/M requests. HTTP API: simpler, ~70% cheaper.',
    'Default account throttle: 10,000 rps steady, 5,000 burst.',
    'At very high volume, an ALB in front of Lambda/containers can be far cheaper.',
  ], 'API keys + per-client throttling (usage plans) → API Gateway REST API.', { comp: 'apigw' }),
  E('fargate', 'compute', 'Containers: ECS & Fargate', 'ECS orchestrates Docker containers. With Fargate, AWS runs the servers — you pay per task vCPU/GB. With the EC2 launch type you manage the instances.', [
    'Task definition = container image, CPU/memory, env, IAM task role.',
    'Service = keeps N tasks running behind a load balancer; scales with Application Auto Scaling.',
    'Fargate Spot: up to 70% off for interruptible tasks.',
    'Images live in ECR; scan them on push.',
  ], 'Containers without managing servers or Kubernetes → ECS on Fargate.', { comp: 'fargate' }),
  E('eks', 'compute', 'Kubernetes (EKS)', 'Kubernetes schedules Pods (one or more containers) onto Nodes. Deployments keep N replicas; Services give them a stable address; Ingress exposes HTTP. EKS runs the control plane for $0.10/hr.', [
    'Pod requests/limits tell the scheduler how much CPU/memory a pod needs.',
    'HorizontalPodAutoscaler scales pods on metrics; Cluster Autoscaler or Karpenter add nodes when pods are Pending.',
    'Readiness probes gate traffic; liveness probes restart stuck containers.',
    'PodDisruptionBudgets limit how many pods can be evicted at once during drains/upgrades.',
    'IRSA / EKS Pod Identity give pods IAM roles without node-wide credentials.',
    'NetworkPolicies restrict pod-to-pod traffic (default: everything can talk).',
  ], 'Pods Pending with "Insufficient cpu"? HPA scaled pods but nothing scaled nodes.', { comp: 'eks' }),
  E('k8s_objects', 'compute', 'Kubernetes Objects Cheat Sheet', 'The core API objects you will use daily.', [
    'Pod → smallest unit. Deployment → ReplicaSet → Pods (rolling updates, rollbacks).',
    'Service: ClusterIP (internal), NodePort, LoadBalancer. Ingress: HTTP routing to Services.',
    'ConfigMap/Secret: configuration. Namespace: isolation boundary for names, quotas, RBAC.',
    'StatefulSet: stable identity + storage (databases). DaemonSet: one pod per node (log agents).',
    'Job/CronJob: run to completion / on a schedule.',
    'kubectl rollout undo deployment/web — roll back to the previous ReplicaSet.',
  ], 'kubectl get pods -A, describe, logs, rollout status — the on-call toolkit.'),
  E('karpenter', 'compute', 'Karpenter', 'An open-source node provisioner for Kubernetes. It watches Pending pods and launches right-sized instances in seconds, choosing across many instance types and Spot pools, and consolidates underused nodes.', [
    'Faster than Cluster Autoscaler (no node groups to resize).', 'Diversifies Spot across instance types → fewer simultaneous interruptions.',
    'Consolidation bin-packs pods and removes empty nodes to save money.',
  ], 'Spot + Kubernetes + cost → Karpenter.'),
  E('apprunner', 'compute', 'Managed Platforms (PaaS)', 'App Runner, Elastic Beanstalk, Azure App Service, Cloud Run: give it code or an image and it handles servers, load balancing, scaling and deploys.', [
    'Fastest path to production for small teams.', 'Less control; usually more expensive per unit of compute at scale.',
    'Beanstalk still creates EC2/ASG/ELB under the hood — you can see and tune them.',
  ], '"Developers want to deploy without managing infrastructure" → PaaS.', { comp: 'apprunner' }),
  E('sqs', 'compute', 'Queues & Decoupling (SQS)', 'A queue sits between producers and consumers. Producers return immediately; consumers work at their own pace. Spikes become backlog instead of errors.', [
    'Standard: nearly unlimited throughput, at-least-once delivery, best-effort order.',
    'FIFO: ordered, exactly-once processing, 300 msg/s (3,000 with batching; higher in high-throughput mode).',
    'Visibility timeout hides a message while a consumer works on it; set it longer than processing time.',
    'Dead-letter queue catches messages that fail repeatedly.',
    'Scale consumers on queue depth (ApproximateNumberOfMessagesVisible).',
  ], '"Database overwhelmed by write spikes" → put a queue in front and write at a steady rate.', { comp: 'sqs' }),
  E('sns', 'compute', 'Pub/Sub Fan-out (SNS)', 'Publish once, deliver to many subscribers: SQS queues, Lambda, HTTP, email, SMS.', [
    'SNS → multiple SQS queues = classic fan-out: each consumer gets its own durable copy.',
    'Message filtering policies route subsets to subscribers.', 'SNS FIFO pairs with SQS FIFO for ordered fan-out.',
  ], 'One event must trigger several independent processes → SNS + SQS fan-out.', { comp: 'sns' }),
  E('eventbridge', 'compute', 'EventBridge', 'A serverless event bus. Rules match events by content and route them to targets. Also schedules (cron) and SaaS partner events.', [
    'Content-based filtering on any JSON field.', 'Archive and replay events.', 'Schema registry for event contracts.', 'Cross-account event buses.',
  ], 'Loosely coupled microservices reacting to business events → EventBridge.', { comp: 'eventbridge' }),
  E('kinesis', 'data', 'Streams (Kinesis)', 'An ordered, replayable log split into shards. Many consumers read the same data independently. Retention 24h to 365 days.', [
    'Each shard: 1 MB/s or 1,000 records/s in, 2 MB/s out.', 'Ordering is per partition key (per shard).',
    'Firehose loads streams into S3/Redshift/OpenSearch with no code.', 'MSK = managed Kafka for the same pattern.',
  ], 'Real-time clickstream/IoT analytics with replay → Kinesis. Simple work queue → SQS.', { comp: 'kinesis' }),
  E('stepfn', 'compute', 'Step Functions', 'State machines that orchestrate Lambda, containers and 200+ AWS services with retries, timeouts, parallel branches and error handling.', [
    'Standard workflows: up to 1 year, exactly-once. Express: high-volume, short (5 min), at-least-once.',
    'The saga pattern: compensating steps undo earlier ones when a later step fails.',
  ], 'Multi-step order processing with retries and human approval → Step Functions.', { comp: 'stepfn' }),
  E('microservices', 'compute', 'Monoliths, Microservices & State', 'Stateless services keep no session data on the instance — anything can serve any request, so you can scale out and replace freely. Stateful pieces (sessions, uploads) go to shared stores.', [
    'Move sessions to ElastiCache/DynamoDB; files to S3/EFS — then instances are disposable.',
    'Microservices: independent deploys and scaling, at the cost of network calls and operational complexity.',
    'Decouple with queues/events so one slow service doesn\'t cascade.',
    'A well-structured monolith is a fine start; split along real boundaries when teams/scale demand it.',
  ], 'Sticky sessions are a smell. Externalize state.'),
  // ───────── DATA ─────────
  E('s3', 'data', 'S3 & Storage Classes', 'Object storage with 99.999999999% durability. Buckets hold objects up to 5 TB. Storage classes trade retrieval speed/cost for storage price.', [
    'Standard → Standard-IA (min 30 days, retrieval fee) → One Zone-IA → Glacier Instant/Flexible/Deep Archive.',
    'Intelligent-Tiering moves objects automatically for unknown access patterns.',
    'Lifecycle rules transition or expire objects by age.',
    'Block Public Access (account + bucket) prevents accidental exposure. Versioning + Object Lock protect against deletion/ransomware.',
    'Cross-Region Replication (CRR) copies objects to another region (needs versioning).',
  ], 'Compliance archive accessed once a year → Glacier Deep Archive with lifecycle.', { comp: 's3' }),
  E('ebs_efs', 'data', 'Block vs File vs Object', 'EBS = block disk for one instance in one AZ. EFS = managed NFS shared across instances and AZs. FSx = Windows SMB, Lustre for HPC, NetApp ONTAP, OpenZFS. S3 = object storage via API.', [
    'EBS gp3: baseline 3,000 IOPS, tune IOPS/throughput separately. io2 for high IOPS. Snapshots go to S3.',
    'EFS scales automatically and is multi-AZ; costs more per GB than EBS.',
    'FSx for Windows integrates with Active Directory.',
    'Instance store: fastest, but data is lost when the instance stops.',
  ], 'Legacy app on many servers needs a shared filesystem → EFS (Linux) or FSx for Windows.', { comp: 'efs' }),
  E('efs', 'data', 'EFS', 'Managed NFS file system shared by many instances across AZs.', ['Elastic capacity; Standard and Infrequent Access classes.', 'Mount targets in each AZ.'], 'Shared POSIX filesystem across AZs → EFS.', { comp: 'efs' }),
  E('fsx', 'data', 'FSx', 'Managed third-party file systems: Windows File Server (SMB + AD), Lustre (HPC), NetApp ONTAP, OpenZFS.', ['FSx for Lustre can link to S3 for HPC scratch.'], 'Windows shares with AD → FSx for Windows File Server.', { comp: 'fsx' }),
  E('rds', 'data', 'RDS & Multi-AZ', 'Managed relational databases (PostgreSQL, MySQL, MariaDB, SQL Server, Oracle). AWS handles patching, backups and failover.', [
    'Multi-AZ: synchronous standby in another AZ; automatic failover in ~60-120 s. The standby does NOT serve reads (classic Multi-AZ).',
    'Read replicas: asynchronous copies that serve reads; can be cross-region; can be promoted.',
    'Automated backups + transaction logs enable point-in-time restore (PITR) within the retention period.',
    'RDS Proxy pools connections (great for Lambda) and speeds failover.',
    'Encryption at rest must be chosen at creation (snapshot → copy encrypted → restore to change).',
  ], 'Multi-AZ = availability. Read replicas = read scaling (and cross-region DR).', { comp: 'rds' }),
  E('aurora', 'data', 'Aurora', 'AWS\'s cloud-native MySQL/PostgreSQL. Storage is a shared, self-healing volume with 6 copies across 3 AZs; compute instances attach to it.', [
    'Up to 15 low-lag replicas; failover to a replica in ~30 s.',
    'Aurora Serverless v2 scales capacity in fine-grained ACUs.',
    'Aurora Global Database: storage-level replication to up to 5 secondary regions, typically <1 s lag; promote a secondary in about a minute.',
    'Backtrack (MySQL) rewinds a cluster in place.',
  ], 'Cross-region DR with RPO of ~1 second and RTO ~1 minute → Aurora Global Database.', { comp: 'aurora' }),
  E('dynamodb', 'data', 'DynamoDB', 'Serverless key-value/document database with single-digit-millisecond latency at any scale. Design tables around access patterns, not normalization.', [
    'Partition key spreads data; a hot key throttles. Sort key enables range queries.',
    'On-demand: pay per request, instant scaling (handles 2× previous peak). Provisioned + auto scaling: cheaper for steady load.',
    'Global Tables: multi-region, multi-active replication (last-writer-wins).',
    'DAX: in-memory cache for microsecond reads. Streams: change data capture to Lambda.',
    'PITR: continuous backups for 35 days.',
  ], 'Multi-region writes with low latency everywhere → DynamoDB Global Tables.', { comp: 'dynamodb' }),
  E('elasticache', 'data', 'Caching (ElastiCache)', 'Redis or Memcached in memory. Cache-aside: check cache, on miss read DB and populate. A 90% hit ratio removes 90% of read load from the database.', [
    'Redis: replication, Multi-AZ failover, persistence, data structures. Memcached: simple, multithreaded, no replication.',
    'TTLs bound staleness. Watch for thundering herds when a hot key expires or the cache dies.',
    'Session storage for stateless web tiers.',
  ], 'Read-heavy DB at high CPU → cache (or read replicas).', { comp: 'elasticache' }),
  E('redshift', 'data', 'Data Warehousing', 'Columnar MPP data warehouse for analytics. Runs heavy aggregations without touching production databases.', [
    'OLTP (many small transactions) vs OLAP (few huge scans) — keep them separate.',
    'Redshift Spectrum / Athena query data in S3 directly.', 'Serverless option bills per RPU-hour.',
  ], 'Reports slowing production → replicate to a warehouse.', { comp: 'redshift' }),
  E('consistency', 'data', 'Consistency, Durability, Replication', 'Synchronous replication waits for the copy (no data loss, more latency, usually within a region). Asynchronous replication returns immediately (lag = potential data loss = RPO).', [
    'RDS Multi-AZ: synchronous. Read replicas, cross-region replication: asynchronous.',
    'DynamoDB reads are eventually consistent by default; strongly consistent reads cost 2× and are in-region only.',
    'S3 provides strong read-after-write consistency.',
  ], 'Zero data loss across regions is expensive; most designs accept seconds of RPO.'),
  // ───────── SECURITY ─────────
  E('iam', 'sec', 'IAM: Users, Roles, Policies', 'Identities (users, roles) get permissions from JSON policies: Effect, Action, Resource, Condition. Roles issue temporary credentials via STS — prefer them to long-lived access keys.', [
    'Identity-based policies attach to users/groups/roles. Resource-based policies attach to resources (S3 bucket policy, KMS key policy) and name a Principal.',
    'Instance profiles, ECS task roles, IRSA give workloads roles — no keys on disk.',
    'Least privilege: grant only needed actions on specific resources. Use Access Analyzer to find unused permissions.',
    'Root user: lock it away with MFA; never use it day-to-day.',
  ], 'Never put access keys in code. If you see AKIA... in a repo, it\'s already compromised.', { comp: 'iam' }),
  E('iam_eval', 'sec', 'Policy Evaluation Logic', 'AWS starts from implicit deny and evaluates every applicable policy.', [
    '1) An explicit Deny anywhere wins. Always.',
    '2) SCPs (Organizations) and permission boundaries set the MAXIMUM — an action must be allowed by them AND by an identity/resource policy.',
    '3) Within one account, an Allow in either the identity policy OR the resource policy is enough.',
    '4) Cross-account: the caller\'s identity policy must allow it AND the resource policy (or role trust policy) must allow the caller\'s account/principal.',
    'SCPs never grant permissions and don\'t affect the management account.',
  ], 'Allowed by IAM but denied by SCP → denied. Allowed by bucket policy for same-account principal with no identity policy → allowed.'),
  E('cross_account', 'sec', 'Cross-Account Access & AssumeRole', 'Account A creates a role whose trust policy names account B (or a principal in B). B\'s identity calls sts:AssumeRole (needs permission to do so) and receives temporary credentials for A\'s role.', [
    'Trust policy = who can assume. Permissions policy = what the role can do.',
    'External ID protects against the confused-deputy problem for third parties.',
    'Prefer roles over sharing users or keys between accounts.',
  ], 'Third-party vendor needs access to your account → role with external ID.'),
  E('orgs', 'sec', 'Organizations, SCPs & Landing Zones', 'AWS Organizations groups accounts into OUs. Service Control Policies cap what any identity in an account can do. Control Tower automates a landing zone: log archive + audit accounts, guardrails, Account Factory.', [
    'Separate accounts = hard blast-radius boundary (prod, dev, security, logging).',
    'SCP examples: deny leaving the org, deny disabling CloudTrail, deny regions outside the EU.',
    'IAM Identity Center (SSO) federates your IdP and gives people role-based access to many accounts.',
    'Consolidated billing aggregates usage for volume discounts and shares Savings Plans/RIs.',
  ], 'Enforce "nobody can use regions outside the EU, even admins" → SCP.', { comp: 'orgs' }),
  E('kms', 'sec', 'Encryption with KMS', 'KMS manages keys. Services use envelope encryption: a data key encrypts your data; the KMS key encrypts the data key.', [
    'AWS-managed vs customer-managed keys (CMK): CMKs let you control key policy, rotation, and cross-account use.',
    'Key policies are resource policies — the key policy must allow use.',
    'Automatic yearly rotation for customer-managed symmetric keys.',
    'CloudHSM for single-tenant, FIPS 140-2 Level 3 hardware you control.',
  ], 'Need to audit and revoke who can decrypt data → customer-managed KMS key + CloudTrail.', { comp: 'kms' }),
  E('acm', 'sec', 'TLS & Certificates (ACM)', 'Encryption in transit. ACM issues free public certificates for ALB, CloudFront and API Gateway and renews them automatically.', [
    'CloudFront certificates must be in us-east-1.', 'ACM can\'t export public certs to install on EC2 directly — terminate TLS at the LB or use ACM Private CA.',
    'Enforce HTTPS with redirect rules and HSTS.',
  ], 'Expired-certificate outage → move to ACM auto-renewal.', { comp: 'acm' }),
  E('secrets', 'sec', 'Secrets Management', 'Secrets Manager stores credentials encrypted with KMS, controls access with IAM, and rotates them automatically (e.g., RDS passwords via Lambda).', [
    'SSM Parameter Store SecureString: cheaper, no built-in rotation.', 'Apps fetch secrets at runtime using their role.',
    'Scan repos (git-secrets, GitHub secret scanning) to catch leaks.',
  ], 'Rotate database credentials automatically → Secrets Manager.', { comp: 'secrets' }),
  E('waf', 'sec', 'WAF', 'Layer-7 web application firewall for CloudFront, ALB, API Gateway. Rules match IPs, geo, headers, body patterns, rates.', [
    'Managed rule groups: Core rule set, SQLi, known bad inputs, IP reputation.',
    'Rate-based rules block IPs exceeding N requests per 5 minutes.',
    'Bot Control and CAPTCHA/Challenge actions fight credential stuffing and scrapers.',
  ], 'SQL injection / XSS / HTTP floods → WAF. Volumetric L3/L4 floods → Shield + CloudFront.', { comp: 'waf' }),
  E('shield', 'sec', 'DDoS Resilience', 'Shield Standard (free, automatic) protects against common L3/L4 attacks at the edge. Shield Advanced ($3k/mo) adds L7 detection, 24/7 Shield Response Team, and cost protection for scaling during attacks.', [
    'Best practice architecture: CloudFront / Global Accelerator / Route 53 at the edge, ALB, autoscaling, WAF.',
    'Reduce attack surface: no public instances, security groups only from the LB.',
    'Economic DDoS: autoscaling absorbs floods but you pay for it — cost protection matters.',
  ], 'Need DDoS response team + bill protection → Shield Advanced.', { comp: 'shield' }),
  E('guardduty', 'sec', 'Detection: GuardDuty, Config, Security Hub', 'GuardDuty analyzes CloudTrail, VPC Flow Logs and DNS logs with threat intelligence and ML. Config records resource configuration and evaluates rules. Security Hub aggregates findings.', [
    'GuardDuty findings: crypto-mining, unusual API calls, credential exfiltration, port scanning.',
    'Config rules + SSM Automation = auto-remediation (e.g., close public bucket).',
    'Detective helps investigate; Inspector scans EC2/ECR/Lambda for CVEs; Macie finds PII in S3.',
  ], 'Detect compromised credentials being used from unusual places → GuardDuty.', { comp: 'guardduty' }),
  E('cloudtrail', 'sec', 'CloudTrail', 'Logs every API call in your account: identity, time, source IP, parameters. The foundation of auditing and forensics.', [
    'Organization trail captures all accounts into a central log archive.',
    'Log file validation detects tampering. Send to a separate, locked-down account.',
    'Data events (S3 object-level, Lambda invokes) are opt-in and billed.',
  ], '"Who deleted this?" → CloudTrail.', { comp: 'cloudtrail' }),
  E('awsconfig', 'sec', 'AWS Config', 'Tracks configuration history and evaluates resources against rules continuously, with optional automatic remediation.', ['Conformance packs bundle rules for frameworks (CIS, PCI).'], 'Continuously enforce "no public buckets" → Config rule + remediation.', { comp: 'awsconfig' }),
  E('netfw', 'sec', 'Network Firewall & Inspection', 'Managed stateful firewall with Suricata-compatible rules and domain allow-lists, deployed in an inspection VPC (often behind Transit Gateway).', [
    'Egress filtering stops malware from calling home or exfiltrating to arbitrary hosts.',
    'Gateway Load Balancer inserts third-party appliances transparently.',
  ], 'Allow outbound only to approved domains → Network Firewall.', { comp: 'netfw' }),
  E('ssm', 'ops', 'Systems Manager', 'Session Manager gives audited shell access with no open inbound ports or SSH keys. Patch Manager, Run Command and Automation operate fleets.', ['Requires the SSM agent and an instance role; works in private subnets via VPC endpoints.'], 'Replace bastion hosts → Session Manager.', { comp: 'ssm' }),
  E('bastion', 'sec', 'Bastion Hosts', 'A public jump server for SSH into private instances. It expands the attack surface (port 22 open, keys to manage).', ['If you must: restrict SG to known IPs, MFA, short-lived certs.'], 'Modern answer: SSM Session Manager, no bastion.', { comp: 'bastion' }),
  E('ransomware', 'sec', 'Ransomware Defense', 'Attackers who get admin access encrypt data and delete backups. Recovery depends on backups they cannot touch.', [
    'AWS Backup Vault Lock (compliance mode) makes recovery points undeletable, even by root.',
    'S3 Object Lock (WORM) + versioning.', 'Separate backup account with restrictive SCPs.', 'Least privilege + detection to stop the attack early.',
  ], 'Immutable + isolated + tested restores.'),
  E('residency', 'sec', 'Compliance & Data Residency', 'Regulations (GDPR, HIPAA, PCI DSS, SOC 2) constrain where data lives and how it is protected. The cloud provider secures the cloud; you secure what you put in it (shared responsibility).', [
    'Data residency: keep data in approved regions; enforce with SCPs denying other regions.',
    'AWS Artifact provides compliance reports.', 'Encrypt, log, restrict, and prove it (Config, Audit Manager).',
  ], 'EU-only data → EU regions + SCP region deny.'),
  // ───────── HA / DR ─────────
  E('multiaz', 'ha', 'Multi-AZ Design', 'An Availability Zone is one or more datacenters with independent power and networking. Regions have 3+ AZs connected by low-latency links. Spreading every tier across AZs survives a datacenter loss.', [
    'Compute: ASG across ≥2 AZs. Data: Multi-AZ RDS / Aurora / DynamoDB (multi-AZ by default).',
    'Networking: one NAT Gateway per AZ; load balancers span AZs.',
    'Static stability: provision enough capacity that losing an AZ doesn\'t require scaling up in a hurry.',
  ], 'For N AZs, run ≥ N/(N−1) of your peak capacity so losing one still leaves 100%.'),
  E('dr', 'ha', 'Disaster Recovery Strategies', 'Four classic strategies trade cost for recovery speed when a whole region fails.', [
    'Backup & Restore: backups copied to another region; rebuild on disaster. RTO hours, RPO hours. Cheapest.',
    'Pilot Light: data continuously replicated; core infrastructure off/minimal. RTO tens of minutes.',
    'Warm Standby: scaled-down but running copy in the DR region; scale up and fail over. RTO minutes.',
    'Multi-site Active-Active: full capacity serving in multiple regions. RTO ~0, RPO ~0, most expensive.',
    'Fail over with Route 53 health checks / Global Accelerator; practice regularly.',
  ], 'RTO 15 min, RPO 1 min, moderate budget → warm standby with Aurora Global or DynamoDB Global Tables.'),
  E('rto_rpo', 'ha', 'RTO & RPO', 'RTO (Recovery Time Objective): how long you can be down. RPO (Recovery Point Objective): how much data (time) you can lose.', [
    'RPO is driven by replication/backup frequency. Nightly backup → RPO up to 24 h.',
    'RTO is driven by detection + decision + failover/restore time.',
    'Both must be measured in drills, not assumed.',
  ], 'Lower RTO/RPO = higher cost. Match the business need.'),
  E('backup', 'ha', 'AWS Backup', 'Central backup policies across EBS, RDS, Aurora, DynamoDB, EFS, S3 and more, with cross-region and cross-account copies.', [
    'Backup plans: schedules, retention, lifecycle to cold storage.', 'Vault Lock: WORM protection against deletion.', 'Restore testing to prove backups work.',
  ], 'Centralized, policy-based, auditable backups → AWS Backup.', { comp: 'backup' }),
  E('quotas', 'ha', 'Service Quotas & Limits', 'Every account has limits: vCPUs per instance family, Lambda concurrency, API rates, EIPs. Hitting them during a launch = outage.', [
    'Request increases in Service Quotas ahead of events; monitor usage with CloudWatch.', 'Quotas are per region (and some per account).',
  ], 'Scaling stalled at a suspiciously round number → quota.'),
  E('chaos', 'ha', 'Chaos Engineering', 'Inject failures deliberately (kill instances, add latency, fail an AZ) to verify your system and runbooks hold. AWS Fault Injection Service runs controlled experiments; Resilience Hub assesses RTO/RPO.', ['Start in staging, define steady state, limit blast radius, automate rollback.'], 'Untested failover is a hope, not a plan.', { comp: 'chaos' }),
  E('blast', 'ha', 'Blast Radius & Cells', 'Limit how much one failure can hurt: separate accounts, regions, cells (independent full stacks serving a slice of customers), shuffle sharding.', ['Cell-based architecture: a bad deploy or poison request only hits one cell.', 'Avoid global single points: one database, one config service, one DNS provider.'], 'The control plane is a dependency too.'),
  E('multicloud', 'ha', 'Multi-Cloud', 'Running on multiple providers avoids provider-level failures and lock-in, at a large cost in complexity: different IAM, networking, managed services.', ['Portable layers: Kubernetes, Terraform, Postgres, object storage APIs.', 'DNS: use two providers with both listed as nameservers.', 'Data gravity and egress costs make active-active multi-cloud expensive.'], 'Usually overkill — unless a provider might kick you off.'),
  // ───────── MIGRATION ─────────
  E('seven_rs', 'mig', 'The 7 Rs of Migration', 'Each application gets a strategy based on value, effort and constraints.', [
    'Retire: turn it off (no longer needed). Retain: keep on-prem for now (recent investment, compliance, not ready).',
    'Rehost (lift & shift): move VMs as-is (Application Migration Service). Fast.',
    'Relocate: move a VMware environment as-is (VMware Cloud on AWS).',
    'Replatform (lift, tinker & shift): small changes for managed services, e.g., to RDS or Beanstalk.',
    'Repurchase: move to SaaS (CRM → Salesforce).',
    'Refactor/Re-architect: rebuild cloud-native for agility/scale. Most effort, most benefit.',
  ], 'Commercial off-the-shelf app with a SaaS version → Repurchase. Self-managed Oracle DB → Replatform to RDS.'),
  E('mgn', 'mig', 'Application Migration Service', 'Continuously replicates on-prem servers at the block level to a staging area, then launches them as EC2 instances at cutover with minutes of downtime.', ['Test launches before cutover.', 'Successor of CloudEndure / SMS.'], 'Lift-and-shift hundreds of servers with minimal downtime → MGN.', { comp: 'mgn' }),
  E('dms', 'mig', 'Database Migration Service', 'Migrates databases with full load + change data capture (CDC), keeping source and target in sync until cutover. Schema Conversion Tool / DMS SC converts between engines.', ['Homogeneous (Postgres→RDS Postgres) vs heterogeneous (Oracle→Aurora Postgres) migrations.', 'Source DB stays live during migration.'], 'Minimal-downtime DB migration → DMS with CDC.', { comp: 'dms' }),
  E('transfer', 'mig', 'Moving Data: Online vs Offline', 'Transfer time = data size ÷ effective bandwidth. 100 TB over a 1 Gbps link at 80% utilization takes ~12 days.', [
    'DataSync: online transfers from NFS/SMB/HDFS to S3/EFS/FSx with scheduling and verification.',
    'Transfer Family: managed SFTP/FTPS into S3.', 'Storage Gateway: hybrid file/volume/tape access backed by S3.',
    'Snowball Edge (~80 TB usable each): offline shipping when the network is too slow. Snowmobile retired; use many Snowballs.',
  ], 'Rule of thumb: if online transfer takes more than about a week, ship Snowballs.'),
  E('waves', 'mig', 'Migration Waves & Cutover', 'Group applications by dependencies into waves. Early waves are low-risk to build the factory; complex ones later.', ['Discovery (Application Discovery Service, Migration Hub) maps dependencies.', 'Cutover runbook: freeze, final sync, DNS switch, validation, rollback criteria.', 'Lower TTLs days before cutover so DNS changes propagate quickly.'], 'Move tightly coupled apps together.'),
  // ───────── COST ─────────
  E('purchasing', 'cost', 'Purchasing Models', 'On-Demand: no commitment. Savings Plans: commit $/hour for 1-3 years (Compute SP flexible across families, regions, Fargate, Lambda; EC2 Instance SP cheaper but tied to a family/region). Reserved Instances: specific type. Spot: spare capacity up to 90% off, 2-minute interruption notice.', [
    'Cover steady baseline with Savings Plans; burst with On-Demand; fault-tolerant work on Spot.',
    'Capacity Reservations guarantee capacity in an AZ (no discount by themselves).',
    'Dedicated Hosts for per-socket licensing.',
  ], 'Steady 24/7 workload for 3 years → Savings Plan / RI. Batch jobs that can restart → Spot.'),
  E('spot', 'cost', 'Spot Instances', 'Unused EC2 capacity at steep discounts. AWS can reclaim it with two minutes notice.', ['Diversify across instance types and AZs (capacity-optimized allocation).', 'Great for stateless web behind ASG with On-Demand base, batch, CI, Kubernetes with Karpenter.', 'Never for single-instance databases.'], 'Interruptions are normal — design for them.'),
  E('rightsize', 'cost', 'Right-Sizing & Utilization', 'Match capacity to load. Idle capacity is the biggest cloud waste. Compute Optimizer recommends sizes from CloudWatch metrics.', ['Average CPU under ~20% → you are paying for air.', 'Scale out horizontally and let autoscaling follow demand instead of sizing for peak.', 'Graviton (ARM) instances: ~20% better price-performance.'], 'Measure, then resize. Repeat.'),
  E('transfer_cost', 'cost', 'Data Transfer Costs', 'Inbound is free. Outbound to the internet ~$0.09/GB. Cross-AZ ~$0.01/GB each way. Cross-region ~$0.02/GB. NAT Gateway processing $0.045/GB on top.', ['CloudFront origin fetches from AWS are free; CloudFront egress is cheaper at volume.', 'Gateway endpoints avoid NAT charges for S3/DynamoDB.', 'Keep chatty services in the same AZ when it\'s safe.'], 'Mysterious bill growth → check NAT Gateway and data transfer line items.'),
  E('finops', 'cost', 'FinOps & Cost Visibility', 'Cost Explorer visualizes spend; Budgets alert on thresholds; the Cost and Usage Report (CUR) is the raw line-item data. Tags and cost allocation make costs attributable.', ['Unit economics: cost per request/customer/order.', 'Anomaly Detection flags unusual spend.', 'Showback/chargeback drives accountability.'], 'You can\'t optimize what you can\'t attribute — tag everything.'),
  E('caching_cost', 'cost', 'Caching for Cost & Speed', 'Every layer of cache (browser, CDN, API, Redis, DAX) removes work from more expensive layers below.', ['CDN for static and cacheable API responses.', 'Redis for hot DB reads.', 'Cache invalidation and TTLs are the hard part.'], 'The cheapest request is the one that never reaches your origin.'),
  // ───────── OPS ─────────
  E('git', 'ops', 'Git Fundamentals', 'Git tracks snapshots (commits) of your files. Branches are movable pointers to commits. Merging combines histories.', [
    'git init / clone · git status · git add <file> (stage) · git commit -m "msg".',
    'git branch feature && git switch feature (or git checkout -b feature).',
    'git merge feature brings feature\'s commits into the current branch; conflicts must be resolved by hand.',
    'git rebase main replays your commits on top of main (linear history; don\'t rebase shared branches).',
    'git revert <sha> creates a new commit undoing one — safe on shared branches. git reset rewrites history.',
    'git push origin feature · git pull = fetch + merge.',
  ], 'Production broke after a merge? git revert the merge commit, push, investigate calmly.'),
  E('pr', 'ops', 'Pull Requests & Code Review', 'A pull request proposes merging a branch. CI runs tests; teammates review; branch protection enforces rules.', ['Protect main: require reviews, passing checks, no force-push.', 'Small PRs get better reviews.', 'terraform plan output in PR comments shows infra changes before apply.'], 'Infra changes deserve code review as much as app code.'),
  E('cicd', 'ops', 'CI/CD Pipelines', 'Continuous Integration builds and tests every change; Continuous Delivery/Deployment promotes artifacts through environments automatically. GitHub Actions, CodePipeline + CodeBuild + CodeDeploy, GitLab CI.', [
    'Build once, promote the same artifact (dev → staging → prod).',
    'Use OIDC federation from GitHub Actions to assume an AWS role — no stored access keys.',
    'Store secrets in a secrets manager, not in pipeline variables in plaintext.',
    'Scan dependencies and images; sign artifacts.',
  ], 'Leaked pipeline keys → switch to OIDC short-lived credentials.', { comp: 'cicd' }),
  E('deploy_strategies', 'ops', 'Deployment Strategies', 'How you release decides how much a bad release hurts.', [
    'All-at-once: fastest, 100% blast radius, downtime risk.',
    'Rolling: replace instances in batches; partial blast radius; mixed versions during rollout.',
    'Blue/Green: stand up a full new environment, switch traffic, switch back instantly if needed. Costs double during deploy.',
    'Canary: send 1-10% to the new version, watch alarms, auto-rollback or proceed. Smallest blast radius.',
    'Feature flags decouple deploy from release.',
  ], 'Minimize impact of bad releases with fast rollback → canary with CloudWatch alarms.'),
  E('terraform', 'ops', 'Terraform & IaC', 'Declare infrastructure in HCL; Terraform builds a dependency graph, plans the diff against state, and applies it.', [
    'terraform init (providers, backend) → plan (preview) → apply. destroy removes everything.',
    'State maps code to real resources. Store it remotely (S3 + DynamoDB lock / Terraform Cloud) — never in Git.',
    'Modules package reusable patterns; workspaces/directories separate environments.',
    'Drift: someone changed a resource outside Terraform. plan shows it; apply reverts it.',
    'terraform import brings existing resources under management.',
    'CloudFormation/CDK (AWS), Bicep (Azure), Pulumi are alternatives.',
  ], 'Two engineers ran apply at once and corrupted state → remote backend with locking.', { comp: 'terraform' }),
  E('cloudwatch', 'ops', 'Monitoring, Alarms & Observability', 'Metrics, logs and traces tell you what\'s broken before customers do. CloudWatch collects metrics and logs, alarms trigger actions; X-Ray/OpenTelemetry traces requests across services.', [
    'Golden signals: latency, traffic, errors, saturation.',
    'Alarm on symptoms users feel (5xx rate, p99 latency), not just causes (CPU).',
    'SLO = target (99.9% of requests succeed); error budget = allowed failure; burn-rate alerts fire when you\'re spending it too fast.',
    'Synthetic canaries test from outside; Container Insights for EKS/ECS.',
  ], 'MTTR starts with MTTD — detection time.', { comp: 'cloudwatch' }),
  E('slo', 'ops', 'SLOs and Error Budgets', 'An SLO turns "reliable" into a number. 99.9% monthly = 43.2 minutes of allowed downtime. 99.99% = 4.3 minutes. 99.999% = 26 seconds.', ['Availability compounds: three serial 99.9% dependencies ≈ 99.7%.', 'Redundant parallel components multiply unavailability: two 99% components ≈ 99.99%.', 'When the error budget is spent, freeze features and fix reliability.'], 'Each extra nine costs roughly 10× more.'),
  E('cli', 'ops', 'AWS CLI & CloudShell', 'Everything in the console is an API call; the CLI calls them directly. CloudShell is a browser shell pre-authenticated as you.', ['aws sts get-caller-identity — who am I?', 'aws s3 ls / cp / sync', 'aws ec2 describe-instances --filters Name=tag:env,Values=prod', '--profile and --region select credentials and region.', 'aws sso login for Identity Center users.'], 'First command when permissions look weird: aws sts get-caller-identity.'),
];

export const CODEX_BY_ID = Object.fromEntries(CODEX.map(e => [e.id, e]));
// aliases used by incidents/review
const ALIAS = { awsconfig: 'awsconfig', asg: 'asg', spot: 'spot', quotas: 'quotas', multicloud: 'multicloud' };
export function codexEntry(id) { return CODEX_BY_ID[ALIAS[id] || id] || null; }
