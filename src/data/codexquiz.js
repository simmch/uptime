// Quick tests for each Codex entry: three questions drawn straight from that
// entry's text, so reading the page is enough to pass.
// Format: [question, [options], index of the correct option, short explanation]
const T = (q, a, c, ex) => ({ q, a, c, ex });

export const CODEX_QUIZ = {
  // ───────── NETWORKING ─────────
  vpc: [
    T("What makes a subnet public?", ["It has a public CIDR range", "Its route table sends 0.0.0.0/0 to an Internet Gateway", "It is in the first AZ", "It has a NAT Gateway inside it"], 1, "Public is purely about the route to an Internet Gateway."),
    T("How many usable IPs does a /24 subnet have on AWS?", ["256", "254", "251", "248"], 2, "AWS reserves 5 addresses in every subnet: 256 − 5 = 251."),
    T("Where should app servers and databases usually go?", ["Public subnets", "Private subnets", "The default VPC", "Directly on the Internet Gateway"], 1, "Load balancers face the internet; app servers and databases stay private."),
  ],
  cidr: [
    T("How many addresses are in a /20?", ["1,024", "4,096", "16,384", "256"], 1, "2^(32−20) = 4,096."),
    T("How many /20 subnets fit in a /16?", ["4", "8", "16", "32"], 2, "2^(20−16) = 16."),
    T("Which range is private (RFC 1918)?", ["11.0.0.0/8", "172.16.0.0/12", "192.0.2.0/24", "100.0.0.0/8"], 1, "The private ranges are 10/8, 172.16/12 and 192.168/16."),
  ],
  sg_nacl: [
    T("Which is stateful?", ["Network ACL", "Security group", "Both", "Neither"], 1, "Security groups automatically allow return traffic. NACLs do not."),
    T("You need to block one malicious IP address. What do you use?", ["A security group deny rule", "A NACL deny rule", "A route table entry", "An IAM policy"], 1, "Security groups can only allow. NACLs can deny."),
    T("A brand-new custom NACL with no rules…", ["Allows everything", "Denies everything", "Allows only HTTPS", "Copies the default NACL"], 1, "Custom NACLs deny all traffic until you add rules. The default NACL allows all."),
  ],
  nat: [
    T("What does a NAT Gateway do?", ["Lets the internet reach private instances", "Lets private instances make outbound internet connections", "Connects two VPCs", "Encrypts traffic between AZs"], 1, "Outbound only. The instances stay unreachable from outside."),
    T("Why run one NAT Gateway per AZ?", ["It is required by AWS", "A NAT Gateway is zonal: if its AZ fails, other AZs routing through it lose internet", "To double bandwidth", "To avoid data transfer charges completely"], 1, "Each NAT lives in one AZ, so one per AZ removes a cross-AZ single point of failure."),
    T("How can S3 traffic avoid NAT processing charges?", ["Use a bigger NAT", "Use a free S3 gateway endpoint", "Use a NAT instance", "Use Direct Connect"], 1, "Gateway endpoints route S3/DynamoDB traffic around the NAT for free."),
  ],
  vpce: [
    T("Which services support gateway endpoints?", ["All AWS services", "S3 and DynamoDB only", "EC2 and RDS", "Lambda and SQS"], 1, "Gateway endpoints exist only for S3 and DynamoDB."),
    T("What is a gateway endpoint's cost?", ["Free", "$0.01/hr per AZ", "$0.045/GB", "Same as a NAT Gateway"], 0, "Gateway endpoints are free route-table entries."),
    T("What lets you expose your own service to other VPCs without peering?", ["Transit Gateway", "PrivateLink", "Route 53", "A bastion host"], 1, "PrivateLink publishes a service through interface endpoints."),
  ],
  peering: [
    T("A↔B and B↔C are peered. Can A reach C?", ["Yes, peering is transitive", "No, peering is not transitive", "Only in the same region", "Only with a NAT"], 1, "Peering is one-to-one and never transitive."),
    T("How many peerings does a full mesh of 10 VPCs need?", ["10", "20", "45", "100"], 2, "N(N−1)/2 = 10×9/2 = 45."),
    T("Which is a hard requirement for VPC peering?", ["Same account", "Non-overlapping CIDRs", "Same region", "A Transit Gateway"], 1, "Peered VPCs cannot have overlapping CIDR ranges."),
  ],
  tgw: [
    T("What does Transit Gateway give you that peering doesn't?", ["Encryption", "Transitive routing between attachments", "Free data transfer", "Global DNS"], 1, "TGW is a hub router: every attachment can reach others per its route tables."),
    T("How do you stop prod from reaching dev through a TGW?", ["Separate TGW route tables", "Turn off DNS", "Use a bigger instance", "Disable the IGW"], 0, "Separate route tables segment attachments."),
    T("How is a TGW shared with other accounts?", ["IAM users", "Resource Access Manager", "S3 bucket policies", "It cannot be shared"], 1, "RAM shares the TGW across accounts."),
  ],
  // ───────── MIGRATION & HYBRID ─────────
  vpn: [
    T("How long does a Site-to-Site VPN take to set up?", ["Minutes", "Weeks", "Months", "It needs a physical install"], 0, "It runs over the internet, so it is up in minutes."),
    T("Roughly how much bandwidth does one VPN tunnel carry?", ["100 Mbps", "~1.25 Gbps", "10 Gbps", "100 Gbps"], 1, "About 1.25 Gbps per tunnel. Use ECMP on TGW for more."),
    T("A common pattern pairs VPN with Direct Connect as…", ["The primary link", "A backup link", "An encryption key store", "A DNS resolver"], 1, "VPN is the cheap, quick backup for DX."),
  ],
  dx: [
    T("Is Direct Connect encrypted by default?", ["Yes, always", "No — use MACsec or a VPN over it", "Only above 10 Gbps", "Only in the EU"], 1, "DX is private but not encrypted by default."),
    T("How long does Direct Connect take to provision?", ["Minutes", "Hours", "Weeks", "It is instant"], 2, "Physical circuits take weeks."),
    T("What lets one DX connection reach VPCs in many regions?", ["Direct Connect Gateway", "VPC peering", "CloudFront", "NAT Gateway"], 0, "A Direct Connect Gateway fans one connection out to many regions."),
  ],
  route53: [
    T("Which policy sends users to the region with the lowest latency?", ["Simple", "Weighted", "Latency", "Failover"], 2, "Latency-based routing picks the fastest region."),
    T("Without health checks, DNS during a regional outage will…", ["Fail over automatically", "Keep sending users to the dead region", "Return an error", "Switch to weighted routing"], 1, "Failover needs health checks to know a target is down."),
    T("What can alias records point to at the zone apex?", ["Only IP addresses", "AWS resources like an ALB or CloudFront", "Only other DNS names", "Nothing"], 1, "Alias records work at the apex and cost nothing per query."),
  ],
  cloudfront: [
    T("What is the key metric for a CDN?", ["CPU usage", "Cache hit ratio", "Number of regions", "Disk IOPS"], 1, "The higher the hit ratio, the less the origin sees."),
    T("What keeps an S3 bucket private while CloudFront serves it?", ["Origin Access Control", "A NAT Gateway", "Bucket versioning", "A public ACL"], 0, "OAC lets only CloudFront read the bucket."),
    T("Global users + dynamic TCP/UDP traffic points to…", ["CloudFront", "Global Accelerator", "S3", "A bigger ALB"], 1, "CloudFront for cacheable HTTP; Global Accelerator for dynamic non-HTTP."),
  ],
  globalacc: [
    T("What does Global Accelerator give you?", ["Two static anycast IPs", "A free CDN cache", "A database replica", "A VPN tunnel"], 0, "Two static anycast IPs at the edge."),
    T("Why is its failover faster than DNS failover?", ["It uses bigger servers", "There's no DNS TTL caching problem", "It skips health checks", "It only works in one region"], 1, "Users keep the same IPs; routing changes behind them in ~30 seconds."),
    T("Why do static IPs help clients?", ["They are cheaper", "They simplify firewall allow-listing", "They encrypt traffic", "They cache content"], 1, "Clients can allow-list two fixed IPs."),
  ],
  alb: [
    T("At what layer does an ALB work?", ["Layer 3", "Layer 4", "Layer 7 (HTTP)", "Layer 2"], 2, "ALB routes HTTP(S) by path, host and headers."),
    T("What happens to a target that fails health checks?", ["It keeps getting traffic", "It is removed from rotation", "The ALB shuts down", "DNS changes"], 1, "Unhealthy targets stop receiving traffic; an ASG can replace them."),
    T("Without any load balancer, which instance gets traffic?", ["All of them evenly", "Only the one DNS points at", "The newest one", "The cheapest one"], 1, "Nothing spreads the traffic without an LB."),
  ],
  nlb: [
    T("When do you need an NLB rather than an ALB?", ["HTTP path routing", "Static IPs or non-HTTP protocols at huge throughput", "Lambda targets", "WAF integration"], 1, "NLB is layer 4 with static IPs per AZ."),
    T("Does an NLB preserve the client source IP?", ["Yes", "No", "Only for HTTPS", "Only with a NAT"], 0, "NLB preserves the client IP."),
    T("What does a Gateway Load Balancer do?", ["Caches content", "Inserts third-party firewalls/appliances transparently", "Terminates TLS for Lambda", "Routes DNS"], 1, "GWLB uses GENEVE to chain appliances in the traffic path."),
  ],
  // ───────── COMPUTE ─────────
  ec2: [
    T("Which family is memory-optimized?", ["c", "r", "t", "g"], 1, "r = memory. c = compute. t = burstable. g = GPU."),
    T("What happens to instance store data when the instance stops?", ["It persists", "It is lost", "It is copied to S3", "It moves to EBS"], 1, "Instance store is ephemeral. EBS persists."),
    T("For availability, which is better?", ["Scale up: one bigger instance", "Scale out: more instances", "They are the same", "Neither helps"], 1, "One instance is a single point of failure no matter how big."),
  ],
  asg: [
    T("Which scaling policy is usually simplest and best?", ["Step scaling", "Target tracking", "Manual scaling", "Simple scaling"], 1, "Target tracking: keep average CPU at a target like 60%."),
    T("What keeps pre-initialized instances ready to cut boot time?", ["Warm pools", "Spot", "Placement groups", "Snapshots"], 0, "Warm pools hold instances that are already initialized."),
    T("Why set the ASG health check type to ELB?", ["It is cheaper", "To replace instances that fail the load balancer check, not just EC2 status checks", "To enable Spot", "To add more AZs"], 1, "An instance can be running but still failing the app health check."),
  ],
  lambda: [
    T("What is Lambda's maximum timeout?", ["1 minute", "5 minutes", "15 minutes", "1 hour"], 2, "15 minutes."),
    T("What removes cold-start latency (for a fee)?", ["More memory", "Provisioned concurrency", "A NAT Gateway", "Reserved Instances"], 1, "Provisioned concurrency keeps environments warm."),
    T("Constant high traffic all day is usually cheaper on…", ["Lambda", "Containers or EC2", "Step Functions", "API Gateway"], 1, "Lambda wins for spiky, low-average load; steady high load favors containers or EC2."),
  ],
  apigw: [
    T("Which API Gateway type is cheaper and simpler?", ["REST API", "HTTP API", "WebSocket API", "Private API"], 1, "HTTP APIs are about 70% cheaper."),
    T("What is API Gateway's default steady account throttle?", ["1,000 rps", "10,000 rps", "100,000 rps", "Unlimited"], 1, "10,000 rps steady, 5,000 burst."),
    T("API keys with per-client throttling need…", ["HTTP API", "REST API usage plans", "An ALB", "CloudFront"], 1, "Usage plans are a REST API feature."),
  ],
  fargate: [
    T("With Fargate, who manages the servers?", ["You", "AWS", "Kubernetes", "Nobody — there are none"], 1, "AWS runs the servers; you pay per task vCPU/GB."),
    T("What defines a task's image, CPU/memory and IAM role?", ["A service", "A task definition", "A cluster", "An AMI"], 1, "The task definition describes the container."),
    T("What does an ECS service do?", ["Builds images", "Keeps N tasks running behind a load balancer", "Stores secrets", "Scans for CVEs"], 1, "The service keeps the desired count running."),
  ],
  eks: [
    T("Pods are Pending with Insufficient cpu. What's missing?", ["A bigger Pod", "Something to add nodes (Cluster Autoscaler or Karpenter)", "A new namespace", "A readiness probe"], 1, "The HPA scaled pods, but nothing scaled nodes."),
    T("Which probe gates traffic until a pod is ready?", ["Liveness", "Readiness", "Startup", "Health"], 1, "Readiness gates traffic; liveness restarts stuck containers."),
    T("By default, which pods can talk to each other?", ["None", "All of them", "Only pods in kube-system", "Only same-node pods"], 1, "Everything can talk until a NetworkPolicy restricts it."),
  ],
  k8s_objects: [
    T("What runs exactly one pod per node, like a log agent?", ["Deployment", "StatefulSet", "DaemonSet", "Job"], 2, "DaemonSets place one pod on each node."),
    T("Which object gives pods stable identity and storage for databases?", ["Deployment", "StatefulSet", "ConfigMap", "Service"], 1, "StatefulSets keep identity and volumes."),
    T("How do you roll back a Deployment?", ["kubectl delete pods", "kubectl rollout undo deployment/web", "kubectl apply -f old.yaml --force", "Restart the node"], 1, "rollout undo returns to the previous ReplicaSet."),
  ],
  karpenter: [
    T("What does Karpenter watch to decide when to add nodes?", ["CPU on existing nodes", "Pending pods", "DNS queries", "CloudTrail"], 1, "It launches right-sized instances for Pending pods."),
    T("Why is it good with Spot?", ["It never uses Spot", "It diversifies across instance types, so fewer simultaneous interruptions", "It makes Spot free", "It disables interruptions"], 1, "Diversity across many Spot pools lowers risk."),
    T("What does consolidation do?", ["Merges clusters", "Bin-packs pods and removes empty nodes", "Combines Docker images", "Joins VPCs"], 1, "It saves money by removing underused nodes."),
  ],
  apprunner: [
    T("What is the main benefit of a managed platform (PaaS)?", ["Full control of servers", "The fastest path to production for small teams", "The lowest cost at huge scale", "Kubernetes compatibility"], 1, "You hand over code and it handles the rest."),
    T("What does Elastic Beanstalk create under the hood?", ["Nothing visible", "EC2, an ASG and an ELB you can see and tune", "Only Lambda functions", "A Kubernetes cluster"], 1, "Beanstalk orchestrates normal resources."),
    T("The usual trade-off of PaaS is…", ["Less control and more cost per unit at scale", "No HTTPS", "No scaling", "No logs"], 0, "Convenience costs control and money at scale."),
  ],
  sqs: [
    T("What happens to a traffic spike when a queue sits in front of a database?", ["It becomes errors", "It becomes backlog processed at a steady rate", "It is dropped", "It goes to DNS"], 1, "Queues absorb spikes."),
    T("How should the visibility timeout compare to processing time?", ["Shorter", "Longer", "Exactly zero", "It doesn't matter"], 1, "Otherwise another consumer picks up the message mid-work."),
    T("Where do repeatedly failing messages go?", ["They are deleted", "A dead-letter queue", "CloudWatch", "Back to the producer"], 1, "A DLQ catches poison messages."),
  ],
  sns: [
    T("SNS publishing to several SQS queues is called…", ["Sharding", "Fan-out", "Batching", "Polling"], 1, "Each consumer gets its own durable copy."),
    T("How can a subscriber receive only some messages?", ["Message filtering policies", "Visibility timeout", "DLQs", "Long polling"], 0, "Filter policies route subsets."),
    T("Ordered fan-out uses…", ["SNS Standard + SQS Standard", "SNS FIFO + SQS FIFO", "EventBridge only", "Kinesis only"], 1, "FIFO topics pair with FIFO queues."),
  ],
  eventbridge: [
    T("How do EventBridge rules match events?", ["By queue depth", "By content of any JSON field", "By IP address", "Randomly"], 1, "Content-based filtering."),
    T("Can EventBridge replay past events?", ["No", "Yes, with archive and replay", "Only for 1 minute", "Only from S3"], 1, "Archive and replay is built in."),
    T("Besides routing events, EventBridge can also…", ["Host websites", "Run scheduled (cron) tasks", "Store files", "Issue certificates"], 1, "Schedules are built in."),
  ],
  // ───────── DATA ─────────
  kinesis: [
    T("How much can one Kinesis shard ingest?", ["1 MB/s or 1,000 records/s", "10 MB/s", "Unlimited", "100 records/s"], 0, "1 MB/s or 1,000 records/s in; 2 MB/s out."),
    T("What is ordering guaranteed by?", ["Nothing", "Partition key (per shard)", "Timestamp across all shards", "Consumer name"], 1, "Order holds within a partition key."),
    T("What loads a stream into S3 or Redshift with no code?", ["Firehose", "Lambda", "Glue", "DMS"], 0, "Kinesis Data Firehose."),
  ],
  stepfn: [
    T("How long can a Standard workflow run?", ["5 minutes", "15 minutes", "Up to 1 year", "24 hours"], 2, "Standard: up to a year. Express: 5 minutes."),
    T("What pattern undoes earlier steps when a later one fails?", ["Saga (compensating steps)", "Fan-out", "Circuit breaker", "Blue/green"], 0, "Sagas compensate."),
    T("Which workflow type is for high-volume, short runs?", ["Standard", "Express", "Batch", "Async"], 1, "Express workflows."),
  ],
  microservices: [
    T("What makes an instance disposable?", ["A big disk", "Keeping no session state on it", "Sticky sessions", "A static IP"], 1, "Stateless services can be replaced freely."),
    T("Where should sessions go?", ["Local disk", "ElastiCache or DynamoDB", "Instance memory", "Cookies on the load balancer"], 1, "Shared stores make the web tier stateless."),
    T("How do you stop one slow service from cascading?", ["Bigger instances", "Decouple with queues or events", "More retries", "A single database"], 1, "Asynchronous decoupling isolates slowness."),
  ],
  s3: [
    T("What is S3's durability?", ["99.9%", "99.99%", "99.999999999% (11 nines)", "100%"], 2, "Eleven nines."),
    T("Compliance archive read once a year → which class?", ["Standard", "Standard-IA", "Glacier Deep Archive", "One Zone-IA"], 2, "Deep Archive is the cheapest for rare access."),
    T("What protects objects from deletion or ransomware?", ["Lifecycle rules", "Versioning + Object Lock", "Transfer Acceleration", "Intelligent-Tiering"], 1, "Object Lock makes versions immutable."),
  ],
  ebs_efs: [
    T("EBS is…", ["Shared NFS across AZs", "A block disk for one instance in one AZ", "Object storage", "A Windows share"], 1, "One instance, one AZ."),
    T("A legacy Linux app on many servers needs a shared filesystem. Use…", ["EBS", "EFS", "Instance store", "Glacier"], 1, "EFS is shared, multi-AZ NFS."),
    T("What is gp3's baseline IOPS?", ["100", "3,000", "16,000", "64,000"], 1, "3,000 IOPS baseline, tunable separately."),
  ],
  efs: [
    T("EFS is a managed…", ["Block disk", "NFS file system", "Object store", "Database"], 1, "Shared NFS."),
    T("How do instances in each AZ reach EFS?", ["Mount targets in each AZ", "VPC peering", "A NAT Gateway", "S3 endpoints"], 0, "One mount target per AZ."),
    T("Does EFS capacity need provisioning?", ["Yes, in fixed volumes", "No, it is elastic", "Only for Windows", "Only above 1 TB"], 1, "Capacity grows and shrinks automatically."),
  ],
  fsx: [
    T("Windows file shares with Active Directory → ", ["EFS", "FSx for Windows File Server", "S3", "EBS"], 1, "FSx for Windows supports SMB and AD."),
    T("Which FSx flavor is built for HPC?", ["ONTAP", "Lustre", "OpenZFS", "Windows"], 1, "Lustre is for high-performance computing."),
    T("FSx for Lustre can link directly to…", ["S3", "DynamoDB", "Route 53", "IAM"], 0, "It uses S3 as a backing data repository."),
  ],
  rds: [
    T("Does a classic Multi-AZ standby serve reads?", ["Yes", "No", "Only at night", "Only for MySQL"], 1, "Multi-AZ is for availability. Use read replicas for reads."),
    T("How is Multi-AZ replication done?", ["Synchronously", "Asynchronously", "Daily snapshots", "Manually"], 0, "Synchronous standby in another AZ."),
    T("When must RDS encryption at rest be chosen?", ["Any time", "At creation", "Only for replicas", "After the first backup"], 1, "To change it: snapshot → encrypted copy → restore."),
  ],
  aurora: [
    T("How many copies of data does Aurora storage keep?", ["2 across 2 AZs", "3 in one AZ", "6 across 3 AZs", "1 plus backups"], 2, "Six copies across three AZs."),
    T("Cross-region DR with ~1 s RPO and ~1 min RTO →", ["RDS snapshots", "Aurora Global Database", "Read replicas in one AZ", "S3 replication"], 1, "Aurora Global replicates at the storage layer."),
    T("What scales Aurora capacity in fine-grained steps?", ["Aurora Serverless v2 (ACUs)", "Backtrack", "Multi-AZ", "RDS Proxy"], 0, "Serverless v2 scales in ACUs."),
  ],
  dynamodb: [
    T("What causes throttling in DynamoDB?", ["Too many tables", "A hot partition key", "Small items", "Using sort keys"], 1, "A hot key concentrates load on one partition."),
    T("Multi-region writes with low latency everywhere →", ["DAX", "Global Tables", "Streams", "Provisioned mode"], 1, "Global Tables are multi-active."),
    T("How should DynamoDB tables be designed?", ["Fully normalized like SQL", "Around access patterns", "One table per attribute", "With joins"], 1, "Model the queries, not the entities."),
  ],
  elasticache: [
    T("A 90% cache hit ratio removes how much read load from the DB?", ["10%", "50%", "90%", "100%"], 2, "Hits never reach the database."),
    T("Which engine supports replication and Multi-AZ failover?", ["Memcached", "Redis", "Both", "Neither"], 1, "Memcached has no replication."),
    T("In cache-aside, what happens on a miss?", ["Return an error", "Read the DB and populate the cache", "Wait for the TTL", "Flush the cache"], 1, "Read from the DB, then store it."),
  ],
  redshift: [
    T("OLAP workloads are…", ["Many small transactions", "Few huge analytical scans", "Key-value lookups", "File uploads"], 1, "Analytics scans lots of data."),
    T("Reports are slowing production. Fix?", ["Bigger production DB", "Replicate to a data warehouse", "Add a NAT", "Turn off backups"], 1, "Keep OLAP off the OLTP database."),
    T("What queries data in S3 directly?", ["Athena / Redshift Spectrum", "DynamoDB", "SQS", "EFS"], 0, "Both scan S3 in place."),
  ],
  consistency: [
    T("Asynchronous replication lag equals…", ["Zero risk", "Potential data loss (RPO)", "Extra durability", "Lower cost only"], 1, "Data in the lag window can be lost."),
    T("RDS Multi-AZ replication is…", ["Synchronous", "Asynchronous", "Eventual", "Manual"], 0, "Synchronous within the region."),
    T("Does S3 offer strong read-after-write consistency?", ["Yes", "No", "Only for small objects", "Only in us-east-1"], 0, "S3 is strongly consistent."),
  ],
  // ───────── SECURITY ─────────
  iam: [
    T("What should workloads use instead of access keys?", ["Root credentials", "Roles (instance profiles, task roles, IRSA)", "Shared IAM users", "Keys in environment files"], 1, "Roles issue temporary credentials."),
    T("A resource-based policy attaches to…", ["A user", "A resource like an S3 bucket, and names a Principal", "A group", "A VPC"], 1, "Bucket and key policies are resource-based."),
    T("You see AKIA… in a repo. What does that mean?", ["Nothing", "An access key is exposed and should be treated as compromised", "MFA is enabled", "The repo is private so it's fine"], 1, "Rotate it immediately."),
  ],
  iam_eval: [
    T("An explicit Deny and an Allow both apply. Result?", ["Allowed", "Denied", "Depends on order", "Prompt for MFA"], 1, "Explicit Deny always wins."),
    T("Allowed by IAM but denied by an SCP →", ["Allowed", "Denied", "Allowed for admins", "Allowed in the management account only"], 1, "SCPs set the maximum."),
    T("Do SCPs grant permissions?", ["Yes", "No, they only limit", "Only to root", "Only cross-account"], 1, "SCPs never grant anything."),
  ],
  cross_account: [
    T("What does a role's trust policy define?", ["What the role can do", "Who can assume the role", "Which region it's in", "Its password"], 1, "Trust = who; permissions = what."),
    T("What protects against the confused-deputy problem for third parties?", ["MFA", "External ID", "A NAT", "KMS"], 1, "The vendor must pass your external ID."),
    T("To give another account access, prefer…", ["Sharing an IAM user", "A role it can assume", "Emailing access keys", "Root credentials"], 1, "Roles give temporary credentials."),
  ],
  orgs: [
    T("Nobody, even admins, may use regions outside the EU. Use…", ["An IAM policy", "An SCP", "A NACL", "A bucket policy"], 1, "SCPs cap every identity in the account."),
    T("What is the strongest blast-radius boundary?", ["Separate accounts", "Tags", "Separate subnets", "Separate IAM users"], 0, "Accounts are a hard boundary."),
    T("What automates a landing zone with guardrails?", ["Control Tower", "CloudFront", "Config only", "CodeDeploy"], 0, "Control Tower sets up accounts and guardrails."),
  ],
  kms: [
    T("In envelope encryption, what encrypts your data?", ["The KMS key directly", "A data key, which the KMS key encrypts", "Your password", "TLS"], 1, "Data keys encrypt data; KMS keys encrypt data keys."),
    T("Who must allow use of a KMS key?", ["Only IAM", "The key policy", "The VPC", "Route 53"], 1, "Key policies are resource policies."),
    T("Single-tenant FIPS 140-2 Level 3 hardware you control →", ["KMS", "CloudHSM", "Secrets Manager", "ACM"], 1, "CloudHSM."),
  ],
  acm: [
    T("Which region must CloudFront certificates be in?", ["Any", "us-east-1", "eu-west-1", "The origin's region"], 1, "CloudFront uses us-east-1 certificates."),
    T("What does ACM do with certificates on its own?", ["Nothing", "Renews them automatically", "Deletes them yearly", "Exports private keys"], 1, "Automatic renewal prevents expiry outages."),
    T("Can you export ACM public certs to install on EC2?", ["Yes", "No — terminate TLS at the LB or use Private CA", "Only with root", "Only for Windows"], 1, "Public ACM certs aren't exportable."),
  ],
  secrets: [
    T("What rotates database credentials automatically?", ["Parameter Store", "Secrets Manager", "S3", "IAM users"], 1, "Secrets Manager has built-in rotation."),
    T("How should apps get secrets?", ["Hard-coded", "Fetched at runtime using their role", "From the README", "In a public bucket"], 1, "Runtime fetch with IAM."),
    T("What is Parameter Store SecureString missing compared to Secrets Manager?", ["Encryption", "Built-in rotation", "IAM control", "An API"], 1, "It's cheaper but has no rotation."),
  ],
  waf: [
    T("SQL injection and XSS are blocked by…", ["Shield", "WAF", "NACL", "KMS"], 1, "WAF inspects layer 7."),
    T("What blocks IPs that exceed N requests per 5 minutes?", ["A rate-based rule", "A geo rule", "A NACL", "A DNS TTL"], 0, "Rate-based rules."),
    T("Where can WAF be attached?", ["EC2 directly", "CloudFront, ALB and API Gateway", "S3 buckets", "RDS"], 1, "Layer-7 entry points."),
  ],
  shield: [
    T("What does Shield Standard cost?", ["$3,000/mo", "Free and automatic", "$0.01/request", "Per GB"], 1, "Standard is free."),
    T("What does Shield Advanced add?", ["Nothing", "A 24/7 response team and cost protection", "Free EC2", "Encryption"], 1, "SRT plus bill protection."),
    T("What is an economic DDoS?", ["A cheap attack", "Autoscaling absorbs the flood but you pay for it", "Attacking billing APIs", "Stealing credit cards"], 1, "Survival costs money; cost protection matters."),
  ],
  guardduty: [
    T("Credentials being used from unusual places are detected by…", ["Config", "GuardDuty", "Inspector", "Macie"], 1, "GuardDuty analyzes CloudTrail, flow logs and DNS."),
    T("Which service finds PII in S3?", ["Macie", "Detective", "Inspector", "Security Hub"], 0, "Macie."),
    T("Which scans EC2, ECR and Lambda for CVEs?", ["GuardDuty", "Inspector", "Config", "CloudTrail"], 1, "Inspector."),
  ],
  cloudtrail: [
    T("Who deleted this resource? Check…", ["CloudWatch metrics", "CloudTrail", "VPC Flow Logs", "Cost Explorer"], 1, "CloudTrail logs every API call."),
    T("What detects tampering with CloudTrail logs?", ["Log file validation", "Versioning", "Encryption", "Lifecycle rules"], 0, "Validation proves logs weren't changed."),
    T("Are S3 object-level data events logged by default?", ["Yes", "No, they're opt-in and billed", "Only for public buckets", "Only in the EU"], 1, "Data events are opt-in."),
  ],
  awsconfig: [
    T("Continuously enforce no public buckets →", ["CloudTrail", "A Config rule + remediation", "A NACL", "Route 53"], 1, "Config evaluates and can remediate."),
    T("What bundles Config rules for frameworks like CIS or PCI?", ["Conformance packs", "SCPs", "Landing zones", "Backup plans"], 0, "Conformance packs."),
    T("What does Config record?", ["API calls", "Resource configuration history", "Packet captures", "Billing data"], 1, "Configuration over time."),
  ],
  netfw: [
    T("Allow outbound traffic only to approved domains →", ["Security groups", "Network Firewall", "Route 53", "IAM"], 1, "Domain allow-lists in Network Firewall."),
    T("Why filter egress?", ["Lower latency", "Stop malware calling home or exfiltrating data", "Free bandwidth", "Faster DNS"], 1, "Egress filtering blocks exfiltration."),
    T("What inserts third-party appliances transparently?", ["Gateway Load Balancer", "ALB", "CloudFront", "NAT"], 0, "GWLB."),
  ],
  // ───────── OPERATIONS ─────────
  ssm: [
    T("Session Manager gives shell access with…", ["Port 22 open", "No open inbound ports or SSH keys", "A bastion", "Root passwords"], 1, "Audited, keyless access."),
    T("What does an instance need for SSM?", ["A public IP", "The SSM agent and an instance role", "A bastion host", "A NAT only"], 1, "Agent + role; private subnets work via endpoints."),
    T("What modern tool replaces bastion hosts?", ["Session Manager", "CloudFront", "Direct Connect", "Route 53"], 0, "Session Manager."),
  ],
  bastion: [
    T("What is the downside of a bastion host?", ["It is too fast", "It widens the attack surface (port 22, keys)", "It can't reach private subnets", "It is free"], 1, "Open SSH and key management."),
    T("If you must run one, restrict its SG to…", ["0.0.0.0/0", "Known IPs", "All VPCs", "Port 80"], 1, "Only known source IPs."),
    T("The modern answer instead of a bastion is…", ["A bigger bastion", "SSM Session Manager", "A public database", "Telnet"], 1, "No bastion at all."),
  ],
  ransomware: [
    T("What makes backups undeletable, even by root?", ["Lifecycle rules", "AWS Backup Vault Lock (compliance mode)", "Tags", "MFA only"], 1, "Vault Lock is WORM."),
    T("Where should backups live?", ["Same account as prod", "A separate backup account with restrictive SCPs", "On the instance", "In a public bucket"], 1, "Isolation keeps attackers away from them."),
    T("The three words for ransomware recovery:", ["Fast, cheap, big", "Immutable, isolated, tested", "Public, shared, open", "Hot, warm, cold"], 1, "Immutable + isolated + tested restores."),
  ],
  residency: [
    T("Under shared responsibility, who secures what you put in the cloud?", ["The provider", "You", "Nobody", "The auditor"], 1, "The provider secures the cloud; you secure what's in it."),
    T("How do you enforce EU-only data?", ["Tags", "EU regions + an SCP denying other regions", "CloudFront", "A NAT"], 1, "SCP region deny."),
    T("Where do you get AWS compliance reports?", ["AWS Artifact", "CloudTrail", "Trusted Advisor", "Support tickets"], 0, "Artifact."),
  ],
  // ───────── RELIABILITY ─────────
  multiaz: [
    T("What is an Availability Zone?", ["A region", "One or more datacenters with independent power and networking", "An edge location", "A VPC"], 1, "AZs fail independently."),
    T("With 3 AZs, what capacity survives losing one at 100%?", ["100% of peak", "150% of peak (N/(N−1))", "33%", "300%"], 1, "3/2 = 1.5× peak."),
    T("What is static stability?", ["Never deploying", "Having enough capacity already running that an AZ loss needs no emergency scale-up", "Using one AZ", "Pinning instance sizes"], 1, "Don't depend on scaling during the failure."),
  ],
  dr: [
    T("Which DR strategy is cheapest?", ["Active-active", "Warm standby", "Pilot light", "Backup & restore"], 3, "Backup & restore: RTO/RPO of hours."),
    T("RTO 15 min, RPO 1 min, moderate budget →", ["Backup & restore", "Warm standby with Aurora Global or DynamoDB Global Tables", "Nothing", "One bigger region"], 1, "Warm standby fits."),
    T("Which strategy has RTO and RPO near zero?", ["Pilot light", "Multi-site active-active", "Backup & restore", "Warm standby"], 1, "Most expensive, fastest."),
  ],
  rto_rpo: [
    T("RPO measures…", ["How long you're down", "How much data (time) you can lose", "Cost", "Latency"], 1, "Recovery Point Objective."),
    T("Nightly backups give an RPO of up to…", ["1 minute", "1 hour", "24 hours", "0"], 2, "Up to a day of data."),
    T("How should RTO and RPO be known?", ["Assumed", "Measured in drills", "From the vendor brochure", "Guessed"], 1, "Practice proves them."),
  ],
  backup: [
    T("What does AWS Backup centralize?", ["IAM", "Backup policies across EBS, RDS, DynamoDB, EFS, S3 and more", "Billing", "DNS"], 1, "One policy engine."),
    T("What protects recovery points from deletion?", ["Vault Lock", "Lifecycle", "Tags", "Snapshots"], 0, "WORM."),
    T("How do you prove backups work?", ["Hope", "Restore testing", "Larger backups", "More regions"], 1, "Test restores."),
  ],
  quotas: [
    T("Scaling stalled at a suspiciously round number. Likely cause?", ["A quota", "A bug in the ASG", "DNS", "Encryption"], 0, "Check Service Quotas."),
    T("When should you request quota increases?", ["During the outage", "Ahead of events", "Never", "After launch"], 1, "Plan ahead."),
    T("Quotas are mostly…", ["Global", "Per region", "Per instance", "Per user"], 1, "Per region (some per account)."),
  ],
  chaos: [
    T("What runs controlled failure experiments on AWS?", ["Fault Injection Service", "Config", "Inspector", "CloudFront"], 0, "FIS."),
    T("Where should chaos engineering start?", ["Production at peak", "Staging, with a limited blast radius", "On the database first", "Nowhere"], 1, "Start small and safe."),
    T("Untested failover is…", ["Fine", "A hope, not a plan", "Faster", "Cheaper"], 1, "Test it."),
  ],
  blast: [
    T("What is a cell-based architecture?", ["One big shared stack", "Independent full stacks each serving a slice of customers", "A DNS feature", "A Lambda setting"], 1, "A bad deploy only hits one cell."),
    T("What should you avoid for blast radius?", ["Multiple accounts", "Global single points like one database or one DNS provider", "Cells", "Shuffle sharding"], 1, "Remove global single points."),
    T("Is the control plane a dependency?", ["No", "Yes", "Only on weekends", "Only for Lambda"], 1, "It can fail too."),
  ],
  multicloud: [
    T("What is the main cost of multi-cloud?", ["Nothing", "Large complexity: different IAM, networking, services", "Slower DNS", "No Kubernetes"], 1, "Complexity."),
    T("Which layers are portable across clouds?", ["Proprietary managed services", "Kubernetes, Terraform, Postgres", "IAM policies", "VPC peering"], 1, "Open tooling ports well."),
    T("Multi-cloud makes most sense when…", ["Always", "A provider might kick you off", "You have one small app", "To save money"], 1, "Usually overkill otherwise."),
  ],
  // ───────── MIGRATION ─────────
  seven_rs: [
    T("An off-the-shelf app with a SaaS version →", ["Rehost", "Repurchase", "Refactor", "Retain"], 1, "Move to the SaaS product."),
    T("Move VMs as-is with Application Migration Service →", ["Rehost (lift & shift)", "Refactor", "Retire", "Repurchase"], 0, "Lift and shift."),
    T("Self-managed Oracle DB moved to RDS →", ["Retire", "Replatform", "Relocate", "Retain"], 1, "Small changes for a managed service."),
  ],
  mgn: [
    T("How does MGN replicate servers?", ["Daily snapshots", "Continuously at the block level", "Copying files over FTP", "Manually"], 1, "Block-level continuous replication."),
    T("What does cutover downtime look like with MGN?", ["Days", "Minutes", "Weeks", "None ever"], 1, "Minutes."),
    T("Can you test launches before cutover?", ["Yes", "No", "Only once", "Only on weekends"], 0, "Test launches are built in."),
  ],
  dms: [
    T("What keeps source and target in sync until cutover?", ["Snapshots", "Change data capture (CDC)", "Manual exports", "Read replicas"], 1, "Full load + CDC."),
    T("Oracle → Aurora Postgres is…", ["Homogeneous", "Heterogeneous", "Impossible", "A rehost"], 1, "Different engines; use Schema Conversion."),
    T("During migration the source database…", ["Must be shut down", "Stays live", "Becomes read-only for a week", "Is deleted"], 1, "Minimal downtime."),
  ],
  transfer: [
    T("100 TB over 1 Gbps at 80% takes about…", ["1 day", "~12 days", "1 hour", "6 months"], 1, "Size ÷ effective bandwidth."),
    T("Online transfer would take more than about a week. Use…", ["A bigger VPN", "Snowball devices", "Email", "Direct Connect tomorrow"], 1, "Ship the data."),
    T("Managed SFTP into S3 →", ["DataSync", "Transfer Family", "Storage Gateway", "Snowball"], 1, "Transfer Family."),
  ],
  waves: [
    T("Which apps go in early waves?", ["The most complex", "Low-risk ones, to build the factory", "All at once", "Databases only"], 1, "Start safe and learn."),
    T("Why lower DNS TTLs days before cutover?", ["To save money", "So DNS changes propagate quickly", "To block users", "For encryption"], 1, "Resolvers cache for the TTL."),
    T("Tightly coupled apps should move…", ["Separately", "Together", "Never", "Last"], 1, "Keep dependencies together."),
  ],
  // ───────── COST ─────────
  purchasing: [
    T("Steady 24/7 workload for 3 years →", ["On-Demand", "Savings Plan / Reserved Instances", "Spot", "Dedicated Host"], 1, "Commit for the discount."),
    T("How much notice does Spot give before interruption?", ["None", "2 minutes", "1 hour", "1 day"], 1, "Two minutes."),
    T("Do Capacity Reservations give a discount by themselves?", ["Yes, 50%", "No, they guarantee capacity only", "Yes, 90%", "Only for Spot"], 1, "Capacity, not price."),
  ],
  spot: [
    T("Spot is never right for…", ["Batch jobs", "Stateless web behind an ASG", "A single-instance database", "CI runners"], 2, "Interruptions would take the database down."),
    T("How do you reduce Spot interruption risk?", ["Use one instance type", "Diversify across instance types and AZs", "Bid higher", "Turn off autoscaling"], 1, "Capacity-optimized diversity."),
    T("Spot instances are…", ["Reserved capacity", "Unused EC2 capacity at steep discounts", "Dedicated hardware", "Free"], 1, "Up to 90% off."),
  ],
  rightsize: [
    T("Average CPU under ~20% means…", ["Perfect sizing", "You're paying for idle capacity", "You need bigger instances", "A security issue"], 1, "Paying for air."),
    T("What recommends instance sizes from metrics?", ["Compute Optimizer", "CloudTrail", "WAF", "Route 53"], 0, "Compute Optimizer."),
    T("Graviton (ARM) instances offer about…", ["20% better price-performance", "50% worse performance", "No difference", "Free compute"], 0, "~20% better price-performance."),
  ],
  transfer_cost: [
    T("Inbound data transfer from the internet costs…", ["$0.09/GB", "Nothing", "$0.02/GB", "$0.045/GB"], 1, "Inbound is free."),
    T("Mysterious bill growth: check…", ["IAM", "NAT Gateway and data transfer line items", "DNS", "Tags"], 1, "Usual suspects."),
    T("Origin fetches from AWS to CloudFront are…", ["Free", "$0.09/GB", "$0.02/GB", "Billed double"], 0, "Free."),
  ],
  finops: [
    T("Raw line-item billing data is in…", ["Cost Explorer", "The Cost and Usage Report (CUR)", "Budgets", "CloudWatch"], 1, "CUR."),
    T("What makes costs attributable?", ["Tags and cost allocation", "Bigger budgets", "Spot", "Encryption"], 0, "Tag everything."),
    T("Cost per request, customer or order is called…", ["Unit economics", "Showback", "Chargeback", "Rightsizing"], 0, "Unit economics."),
  ],
  caching_cost: [
    T("The cheapest request is…", ["The smallest", "One that never reaches your origin", "On Spot", "Over HTTP/2"], 1, "Caches remove work."),
    T("Hot database reads → which cache layer?", ["CDN", "Redis", "Browser", "DNS"], 1, "Redis/ElastiCache."),
    T("What's the hard part of caching?", ["Buying it", "Invalidation and TTLs", "Encryption", "DNS"], 1, "Staleness control."),
  ],
  // ───────── DEPLOY & OPS ─────────
  git: [
    T("Production broke after a merge. Safest fix on a shared branch?", ["git reset --hard and force push", "git revert the merge commit", "Delete the repo", "git rebase main"], 1, "Revert makes a new undoing commit; it doesn't rewrite history."),
    T("git pull equals…", ["fetch + merge", "push + fetch", "clone + commit", "reset + merge"], 0, "Fetch then merge."),
    T("Should you rebase shared branches?", ["Yes, always", "No — it rewrites history others depend on", "Only main", "Only on Fridays"], 1, "Rebase only your own branches."),
  ],
  pr: [
    T("What does branch protection on main typically require?", ["Nothing", "Reviews and passing checks, no force-push", "Admin approval for reads", "Signed emails"], 1, "Guard main."),
    T("Which PRs get better reviews?", ["Huge ones", "Small ones", "Late-night ones", "Ones with no tests"], 1, "Small PRs."),
    T("Where can reviewers see infra changes before apply?", ["terraform plan output in the PR", "CloudTrail", "The bill", "Slack"], 0, "Plan in the PR."),
  ],
  cicd: [
    T("How should pipelines get AWS credentials?", ["Stored access keys", "OIDC federation to assume a role", "Root keys", "Hard-coded in YAML"], 1, "Short-lived credentials."),
    T("Build once, then…", ["Rebuild in each environment", "Promote the same artifact through environments", "Skip staging", "Deploy from laptops"], 1, "Same artifact everywhere."),
    T("Where do pipeline secrets belong?", ["Plaintext variables", "A secrets manager", "The README", "Commit messages"], 1, "Never plaintext."),
  ],
  deploy_strategies: [
    T("Which strategy has the smallest blast radius?", ["All-at-once", "Rolling", "Canary", "Big bang"], 2, "Only 1–10% see the new version first."),
    T("Instant switch back to the old version →", ["Blue/green", "All-at-once", "Rolling", "Manual"], 0, "Flip traffic back."),
    T("What decouples deploy from release?", ["Feature flags", "Bigger servers", "DNS TTLs", "Spot"], 0, "Ship code dark, release with a flag."),
  ],
  terraform: [
    T("What's the right order?", ["apply → plan → init", "init → plan → apply", "plan → init → apply", "init → apply → plan"], 1, "init, plan, apply."),
    T("Where should Terraform state live?", ["In Git", "A remote backend with locking (e.g., S3 + DynamoDB)", "On a laptop", "In a public bucket"], 1, "Remote and locked."),
    T("Someone changed a resource outside Terraform. This is…", ["Drift", "Import", "A module", "A workspace"], 0, "plan shows drift; apply reverts it."),
  ],
  cloudwatch: [
    T("Which are the four golden signals?", ["CPU, RAM, disk, network", "Latency, traffic, errors, saturation", "Cost, tags, users, regions", "Logs, traces, metrics, alarms"], 1, "The golden signals."),
    T("Alarm on what users feel, like…", ["CPU only", "5xx rate and p99 latency", "Disk size", "Instance count"], 1, "Symptoms beat causes."),
    T("MTTR starts with…", ["MTTD — detection time", "Cost", "DNS", "Backups"], 0, "You can't fix what you haven't detected."),
  ],
  slo: [
    T("99.9% monthly allows about how much downtime?", ["4.3 minutes", "43.2 minutes", "7.2 hours", "26 seconds"], 1, "43.2 minutes per month."),
    T("Three serial 99.9% dependencies give about…", ["99.9%", "99.7%", "99.99%", "90%"], 1, "Serial availability multiplies down."),
    T("When the error budget is spent…", ["Ship faster", "Freeze features and fix reliability", "Raise the SLO", "Ignore it"], 1, "Spend effort on reliability."),
  ],
  cli: [
    T("First command when permissions look weird?", ["aws s3 ls", "aws sts get-caller-identity", "aws configure delete", "aws iam delete-user"], 1, "Check who you are."),
    T("What selects credentials and region?", ["--profile and --region", "--user and --zone", "--key and --az", "--account only"], 0, "Profiles and regions."),
    T("CloudShell is…", ["A paid IDE", "A browser shell pre-authenticated as you", "A VPN", "A database"], 1, "Already logged in."),
  ],
};

export function codexQuiz(id) { return CODEX_QUIZ[id] || null; }
