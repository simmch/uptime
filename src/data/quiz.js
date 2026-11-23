// Question bank. d = domain, l = difficulty 1-3, t = tags, c = index of correct answer.
const Q = (d, l, q, a, c, ex, t = []) => ({ d, l, q, a, c, ex, t });

export const QUIZ = [
  // ───────── NETWORKING ─────────
  Q('net', 1, 'What makes a subnet "public" in AWS?', ['It has a public CIDR range', 'Its route table has 0.0.0.0/0 pointing to an Internet Gateway', 'Instances in it have security groups allowing 0.0.0.0/0', 'It is in the first AZ of the region'], 1, 'A subnet is public purely because of its route to an IGW.'),
  Q('net', 1, 'How many usable IP addresses does a /24 subnet have in AWS?', ['256', '254', '251', '248'], 2, '256 minus the 5 addresses AWS reserves = 251.'),
  Q('net', 1, 'Instances in a private subnet need to download OS patches from the internet. What should you add?', ['An Internet Gateway route in the private subnet', 'A NAT Gateway in a public subnet and a route to it', 'A VPC peering connection', 'An Elastic IP on each instance'], 1, 'NAT allows outbound-initiated traffic while keeping instances unreachable from outside.'),
  Q('net', 2, 'Security groups are ____; network ACLs are ____.', ['stateless; stateful', 'stateful; stateless', 'both stateful', 'both stateless'], 1, 'SGs automatically allow return traffic. NACLs need explicit rules both ways, including ephemeral ports.'),
  Q('net', 2, 'You must block a single malicious IP address from reaching every instance in a subnet. What is the most direct control?', ['Security group deny rule', 'Network ACL deny rule', 'IAM policy', 'Route table blackhole'], 1, 'Security groups cannot deny; NACLs can.'),
  Q('net', 2, 'VPC A is peered with B, and B is peered with C. Can A reach C through B?', ['Yes, peering is transitive', 'Only if CIDRs don\'t overlap', 'No — peering is not transitive', 'Only within the same region'], 2, 'Use Transit Gateway for transitive routing.'),
  Q('net', 2, 'Private subnets send 5 TB/month to S3 through a NAT Gateway and the bill is high. Cheapest fix?', ['Larger NAT Gateway', 'S3 gateway VPC endpoint', 'Move instances to public subnets', 'Use S3 Transfer Acceleration'], 1, 'Gateway endpoints for S3 are free and bypass NAT processing charges.'),
  Q('net', 2, 'Which Route 53 routing policy sends users to the region with the lowest network latency?', ['Geolocation', 'Weighted', 'Latency-based', 'Multivalue'], 2, 'Latency routing uses AWS measurements between user networks and regions.'),
  Q('net', 2, 'Your company needs a consistent 10 Gbps private link from its datacenter to AWS. Which service?', ['Site-to-Site VPN', 'Direct Connect', 'Global Accelerator', 'VPC peering'], 1, 'Direct Connect provides dedicated bandwidth; VPN runs over the internet (~1.25 Gbps per tunnel).'),
  Q('net', 3, 'Direct Connect traffic must be encrypted. What should you do?', ['Nothing, DX is encrypted by default', 'Use MACsec on supported connections or run an IPsec VPN over DX', 'Enable KMS on the DX gateway', 'Use CloudFront'], 1, 'DX is private but not encrypted by default.'),
  Q('net', 3, 'A partner needs to consume your internal service from their VPC without VPC peering or exposing it publicly. Best option?', ['Transit Gateway', 'PrivateLink (endpoint service behind an NLB)', 'Public ALB with IP allow-list', 'Site-to-Site VPN'], 1, 'PrivateLink exposes a service via interface endpoints in the consumer VPC.'),
  Q('net', 3, 'Users report a ~5 minute delay before traffic moves to the DR region after a failure, despite Route 53 health checks. What helps most?', ['Lower the DNS TTL or use Global Accelerator', 'Add more health checks', 'Use weighted routing', 'Increase instance size'], 0, 'Resolvers cache DNS for the TTL; Global Accelerator uses anycast IPs and avoids DNS caching.'),
  Q('net', 1, 'Which service caches content at edge locations close to users?', ['Route 53', 'CloudFront', 'Direct Connect', 'Transit Gateway'], 1, 'CloudFront is AWS\'s CDN (Azure Front Door, Google Cloud CDN).'),
  Q('net', 2, 'Which load balancer should you use when clients need a static IP address per AZ?', ['ALB', 'NLB', 'Classic ELB', 'Gateway LB'], 1, 'NLB supports Elastic IPs per AZ.'),
  Q('net', 3, 'Twelve VPCs across three accounts plus on-prem need any-to-any connectivity with prod/dev segmentation. Best design?', ['Full mesh VPC peering', 'Transit Gateway with separate route tables, shared via RAM', 'One giant VPC', 'VPN from each VPC to on-prem'], 1, 'TGW scales hub-and-spoke routing with segmentation.'),

  // ───────── COMPUTE ─────────
  Q('compute', 1, 'Which feature automatically replaces failed EC2 instances and adjusts capacity with demand?', ['Elastic Load Balancing', 'EC2 Auto Scaling', 'CloudWatch Logs', 'Systems Manager'], 1, 'ASGs maintain capacity and scale on policies.'),
  Q('compute', 1, 'Traffic arrives in unpredictable bursts and is near zero most of the day. Which compute is usually cheapest?', ['Reserved EC2 instances', 'AWS Lambda', 'Dedicated Hosts', 'A large single EC2 instance'], 1, 'Pay-per-request with no idle cost.'),
  Q('compute', 2, 'A database is overwhelmed by write bursts from an order-intake service. Orders can be processed seconds later. Best fix?', ['Bigger database', 'Insert SQS between intake and processing', 'Add read replicas', 'Use CloudFront'], 1, 'Queues absorb spikes and let consumers write at a sustainable rate.'),
  Q('compute', 2, 'Lambda function p99 latency spikes after quiet periods. Fix with least code change?', ['Increase timeout', 'Provisioned concurrency', 'Use an SQS trigger', 'Reserved concurrency'], 1, 'Provisioned concurrency keeps execution environments initialized (no cold starts).'),
  Q('compute', 2, 'One event must notify billing, shipping and analytics, each processing independently and durably. Pattern?', ['One SQS queue with three consumers', 'SNS topic fanning out to three SQS queues', 'Three Lambda functions polling a DB', 'Step Functions parallel state only'], 1, 'Fan-out gives each consumer its own durable queue.'),
  Q('compute', 2, 'Which SQS setting prevents a message from being processed twice while a consumer is still working on it?', ['Delay seconds', 'Visibility timeout', 'Retention period', 'Long polling'], 1, 'Visibility timeout hides the message; set it longer than processing time.'),
  Q('compute', 2, 'Messages must be processed exactly once and in order per customer. Which queue?', ['SQS Standard', 'SQS FIFO with MessageGroupId = customer', 'SNS standard topic', 'Kinesis with one shard per message'], 1, 'FIFO queues preserve order within a message group.'),
  Q('compute', 1, 'What is the main benefit of making web servers stateless?', ['They run faster', 'Any instance can serve any request, so you can scale and replace freely', 'They need no database', 'They are more secure'], 1, 'Externalize sessions to Redis/DynamoDB.'),
  Q('compute', 3, 'Order processing has 6 steps with retries, a human approval, and compensating actions on failure. Best service?', ['SQS with Lambda', 'Step Functions Standard workflow', 'EventBridge rules', 'Kinesis Data Streams'], 1, 'Step Functions orchestrates long-running workflows with error handling (saga pattern).'),
  Q('compute', 2, 'Developers want to run containers without managing servers or Kubernetes. Choose:', ['EKS on EC2', 'ECS on Fargate', 'EC2 with Docker', 'Elastic Beanstalk on Windows'], 1, 'Fargate is serverless compute for containers.'),
  Q('compute', 3, 'API traffic is a constant 20,000 rps 24/7 on Lambda + API Gateway REST and the bill is huge. Most cost-effective change?', ['Raise Lambda memory', 'Move to containers behind an ALB (or at least HTTP API)', 'Enable API caching', 'Use provisioned concurrency'], 1, 'At steady high volume per-request pricing loses to provisioned compute.'),
  Q('compute', 1, 'Which service routes events between AWS services, SaaS apps and your microservices using content-based rules?', ['SNS', 'EventBridge', 'SQS', 'CloudTrail'], 1, ''),
  // Kubernetes
  Q('compute', 1, 'In Kubernetes, which object keeps a desired number of identical Pods running and supports rolling updates?', ['Service', 'Deployment', 'ConfigMap', 'Namespace'], 1, 'Deployment → ReplicaSet → Pods.', ['k8s']),
  Q('compute', 1, 'Which kubectl command shows why a pod is stuck Pending?', ['kubectl logs', 'kubectl describe pod <name>', 'kubectl apply', 'kubectl top nodes'], 1, 'describe shows Events like "0/3 nodes available: insufficient cpu".', ['k8s']),
  Q('compute', 2, 'HPA scaled a Deployment to 40 replicas but 25 are Pending with "Insufficient cpu". What is missing?', ['A Service', 'Node autoscaling (Cluster Autoscaler or Karpenter)', 'A liveness probe', 'A larger Docker image'], 1, 'HPA scales pods; something must add nodes.', ['k8s']),
  Q('compute', 2, 'During node upgrades, all replicas of a service were evicted at once. What prevents this?', ['ResourceQuota', 'PodDisruptionBudget', 'NetworkPolicy', 'HPA'], 1, 'A PDB limits voluntary disruptions.', ['k8s']),
  Q('compute', 2, 'Traffic is sent to pods before the app finishes warming up, causing errors. Add a:', ['Liveness probe', 'Readiness probe', 'Startup taint', 'PriorityClass'], 1, 'Readiness gates Service endpoints; liveness restarts stuck containers.', ['k8s']),
  Q('compute', 2, 'How should pods in EKS get AWS permissions?', ['Node instance profile with admin rights', 'Access keys in a Kubernetes Secret', 'IAM Roles for Service Accounts (IRSA) / EKS Pod Identity', 'Hard-coded in the image'], 2, 'Per-pod roles, short-lived credentials.', ['k8s']),
  Q('compute', 2, 'Which command rolls a Deployment back to its previous version?', ['kubectl rollout undo deployment/web', 'kubectl delete deployment web', 'kubectl revert web', 'kubectl apply --previous'], 0, '', ['k8s']),
  Q('compute', 3, 'By default, can any pod talk to any other pod across namespaces in Kubernetes?', ['No, namespaces isolate network traffic', 'Yes, unless NetworkPolicies (and a CNI that enforces them) restrict it', 'Only with a Service Mesh', 'Only in the default namespace'], 1, 'Namespaces are not network boundaries.', ['k8s']),
  Q('compute', 3, 'You want fast, cost-optimized node provisioning that bin-packs pods and diversifies Spot instance types. Use:', ['Cluster Autoscaler with one node group', 'Karpenter', 'Vertical Pod Autoscaler', 'Fargate profiles only'], 1, '', ['k8s']),
  Q('compute', 3, 'A Service of type LoadBalancer on EKS (with the AWS Load Balancer Controller) creates by default:', ['An ALB', 'An NLB', 'A CloudFront distribution', 'An API Gateway'], 1, 'Ingress objects create ALBs; LoadBalancer Services create NLBs.', ['k8s']),

  // ───────── DATA ─────────
  Q('data', 1, 'RDS Multi-AZ primarily provides:', ['Read scaling', 'High availability via a synchronous standby and automatic failover', 'Cross-region DR', 'Lower cost'], 1, 'Classic Multi-AZ standby does not serve reads.'),
  Q('data', 1, 'Read-heavy app overloads the primary database. Which two options scale reads? (best single answer)', ['Multi-AZ standby', 'Read replicas and/or ElastiCache', 'Larger EBS volume', 'S3 Transfer Acceleration'], 1, ''),
  Q('data', 1, 'Which S3 storage class is cheapest for data accessed once or twice a year with a 12-hour retrieval being acceptable?', ['S3 Standard', 'S3 Standard-IA', 'S3 Glacier Deep Archive', 'S3 One Zone-IA'], 2, ''),
  Q('data', 2, 'Objects are frequently accessed for 30 days, rarely after, and must be kept 7 years. Lowest effort + cost?', ['Manually move objects yearly', 'Lifecycle rule: Standard → IA at 30 days → Glacier Deep Archive at 90 days, expire at 7 years', 'Keep in Standard', 'Use EBS snapshots'], 1, ''),
  Q('data', 2, 'Many Linux instances across AZs need a shared POSIX file system. Choose:', ['EBS Multi-Attach', 'EFS', 'S3', 'Instance store'], 1, 'EBS is AZ-bound; EFS is a regional NFS.'),
  Q('data', 2, 'A key-value workload needs single-digit ms latency at any scale and multi-region active-active writes. Choose:', ['RDS MySQL with read replicas', 'DynamoDB Global Tables', 'Aurora single region', 'ElastiCache Memcached'], 1, ''),
  Q('data', 2, 'Cross-region DR for a relational DB with RPO ≈ 1 second and RTO ≈ 1 minute:', ['Nightly snapshots copied cross-region', 'Aurora Global Database', 'RDS Multi-AZ', 'DMS full load weekly'], 1, 'Storage-level replication, typically <1 s lag.'),
  Q('data', 2, 'DynamoDB table throttles because one celebrity user gets 80% of traffic. Root cause?', ['Too little storage', 'Hot partition key', 'Wrong region', 'Missing GSI'], 1, 'Distribute load with high-cardinality keys, write sharding, or caching (DAX).'),
  Q('data', 3, 'You need to change an unencrypted RDS instance to encrypted at rest. How?', ['Toggle encryption in the console', 'Snapshot → copy snapshot with encryption → restore new instance', 'Enable KMS on the subnet group', 'Add a read replica with encryption'], 1, 'Encryption is set at creation.'),
  Q('data', 2, 'Monthly finance reports slow down the production OLTP database. Best long-term fix?', ['Run reports at night', 'Bigger primary', 'Replicate data to a warehouse (Redshift) or at least a read replica', 'Add an SQS queue'], 2, 'Keep OLAP off OLTP.'),
  Q('data', 1, 'S3 durability is designed for:', ['99.9%', '99.99%', '99.999999999% (11 nines)', '100%'], 2, ''),
  Q('data', 3, 'A Lambda-based API exhausts database connections during spikes. Best fix?', ['Larger DB instance', 'RDS Proxy', 'More Lambda memory', 'Multi-AZ'], 1, 'RDS Proxy pools and shares connections.'),
  Q('data', 2, 'Cache-aside pattern means:', ['Writes go to cache, DB updated later', 'App reads cache; on miss reads DB and populates cache', 'DB pushes changes to cache', 'Cache is the source of truth'], 1, ''),

  // ───────── SECURITY ─────────
  Q('sec', 1, 'Best way to give an EC2 application access to an S3 bucket?', ['Store access keys in the app config', 'Attach an IAM role (instance profile) with a least-privilege policy', 'Make the bucket public', 'Use the root user\'s keys'], 1, ''),
  Q('sec', 1, 'Under the shared responsibility model, who patches the guest OS on EC2?', ['AWS', 'The customer', 'Both equally', 'Nobody'], 1, 'AWS secures the cloud; you secure what you run in it.'),
  Q('sec', 2, 'An identity policy allows s3:DeleteObject, but an SCP on the account denies it. Result?', ['Allowed — identity policy wins', 'Denied — SCPs cap permissions and explicit deny wins', 'Allowed for the root user only', 'Depends on the bucket policy'], 1, ''),
  Q('sec', 2, 'A user in account B must read a bucket in account A. What is required?', ['Only a bucket policy in A allowing B', 'Only an identity policy in B', 'Both: B\'s identity policy allows it AND A\'s bucket policy (or an assumed role in A) allows B', 'A VPC peering connection'], 2, 'Cross-account requires both sides.'),
  Q('sec', 2, 'Protect a web app from SQL injection and HTTP floods from single IPs:', ['Security groups', 'AWS WAF managed rules + rate-based rule', 'NACLs', 'KMS'], 1, ''),
  Q('sec', 2, 'Database passwords must rotate every 30 days automatically:', ['SSM Parameter Store', 'Secrets Manager with rotation', 'KMS key rotation', 'IAM password policy'], 1, ''),
  Q('sec', 2, 'Which service detects compromised EC2 instances mining crypto and unusual API activity?', ['Inspector', 'GuardDuty', 'Macie', 'Artifact'], 1, 'Inspector = vulnerabilities, Macie = sensitive data in S3.'),
  Q('sec', 2, 'Ensure no one in member accounts can ever disable CloudTrail:', ['IAM policy on each user', 'SCP denying cloudtrail:StopLogging/DeleteTrail', 'Config rule', 'MFA'], 1, ''),
  Q('sec', 3, 'Ransomware actors with admin access delete backups before encrypting data. Strongest protection?', ['Daily snapshots', 'AWS Backup Vault Lock in compliance mode (+ backups in a separate account)', 'Versioning only', 'Multi-AZ'], 1, 'Compliance-mode locks cannot be removed, even by root.'),
  Q('sec', 2, 'Engineers need console access to 30 accounts using corporate credentials:', ['IAM users in every account', 'IAM Identity Center federated with the corporate IdP', 'Share the root user', 'Access keys per account'], 1, ''),
  Q('sec', 3, 'A third-party SaaS vendor needs to assume a role in your account. How do you prevent the confused-deputy problem?', ['Require MFA', 'Use an external ID condition in the role trust policy', 'Use a resource-based policy on IAM', 'Use an SCP'], 1, ''),
  Q('sec', 1, 'Which AWS service provides free, auto-renewing public TLS certificates for load balancers?', ['KMS', 'ACM', 'Secrets Manager', 'CloudHSM'], 1, ''),
  Q('sec', 3, 'Permissions boundaries are used to:', ['Grant extra permissions', 'Set the maximum permissions an identity-based policy can grant to a user/role (e.g., for delegated admins)', 'Replace SCPs', 'Encrypt data'], 1, ''),
  Q('sec', 2, 'Find S3 buckets containing PII like credit card numbers:', ['GuardDuty', 'Macie', 'Config', 'Shield'], 1, ''),

  // ───────── HA / DR ─────────
  Q('ha', 1, 'An Availability Zone is:', ['A separate AWS account', 'One or more discrete datacenters with independent power/networking within a region', 'An edge location', 'A VPC'], 1, ''),
  Q('ha', 1, 'RPO measures:', ['How long you can be down', 'How much data (time) you can afford to lose', 'Requests per operation', 'Recovery cost'], 1, 'RTO = time to recover.'),
  Q('ha', 2, 'Which DR strategy keeps a scaled-down but fully functional copy running in another region?', ['Backup & restore', 'Pilot light', 'Warm standby', 'Multi-site active-active'], 2, 'Pilot light keeps only the core (data) running.'),
  Q('ha', 2, 'Cheapest DR strategy where RTO of 24 hours is acceptable:', ['Active-active', 'Warm standby', 'Backup & restore with cross-region copies', 'Pilot light'], 2, ''),
  Q('ha', 2, 'An app runs 4 instances in one AZ behind an ALB. What single change most improves availability?', ['Bigger instances', 'Spread the ASG across multiple AZs', 'Add CloudFront', 'Use Spot'], 1, ''),
  Q('ha', 2, 'One NAT Gateway serves private subnets in three AZs. Risk?', ['None, NAT is regional', 'If its AZ fails, the other AZs lose outbound internet', 'It doubles cost', 'It breaks VPC endpoints'], 1, 'NAT Gateways are zonal — deploy one per AZ.'),
  Q('ha', 3, 'Requirement: survive a full region failure with RTO < 1 min and zero downtime for reads and writes globally. Choose:', ['Pilot light + Route 53 failover', 'Active-active multi-region with DynamoDB Global Tables and latency routing + health checks', 'Multi-AZ RDS', 'Backups to S3 in another region'], 1, ''),
  Q('ha', 2, 'Three serial dependencies each with 99.9% availability give approximately:', ['99.9%', '99.97%', '99.7%', '99.99%'], 2, '0.999³ ≈ 0.997.'),
  Q('ha', 3, 'Your launch-day ASG stopped scaling at exactly 64 vCPUs. Most likely cause?', ['Health check failure', 'EC2 vCPU service quota', 'Target tracking misconfigured', 'AZ outage'], 1, 'Request quota increases before events.'),
  Q('ha', 3, '"Static stability" in AWS architecture means:', ['Never changing infrastructure', 'Pre-provisioning enough capacity so the system keeps working without needing to make changes (like scaling) during a failure', 'Using static websites', 'Pinning AMIs'], 1, ''),
  Q('ha', 1, 'Route 53 can automatically fail over to a DR region when combined with:', ['CloudTrail', 'Health checks', 'KMS', 'NAT Gateways'], 1, ''),
  Q('ha', 2, '99.99% monthly availability allows roughly how much downtime per month?', ['43 minutes', '4.3 minutes', '26 seconds', '7 hours'], 1, ''),

  // ───────── MIGRATION ─────────
  Q('mig', 1, 'Moving VMs as-is to EC2 with minimal changes is called:', ['Refactor', 'Rehost (lift and shift)', 'Repurchase', 'Retire'], 1, ''),
  Q('mig', 1, 'Replacing a self-hosted CRM with a SaaS CRM is:', ['Rehost', 'Replatform', 'Repurchase', 'Retain'], 2, ''),
  Q('mig', 2, 'Moving a self-managed MySQL server to Amazon RDS MySQL without changing the app is:', ['Rehost', 'Replatform', 'Refactor', 'Relocate'], 1, 'Lift, tinker and shift to a managed service.'),
  Q('mig', 2, 'An app was upgraded on-prem last month and the business wants to revisit in two years:', ['Retire', 'Retain', 'Rehost', 'Refactor'], 1, ''),
  Q('mig', 2, 'Migrate a 5 TB Oracle DB to Aurora PostgreSQL with minimal downtime:', ['Export/import over a weekend', 'Schema Conversion Tool + DMS with full load and CDC', 'Snowball', 'MGN'], 1, ''),
  Q('mig', 2, '200 TB must move to S3 within 2 weeks over a 500 Mbps link. Best approach?', ['DataSync over the link', 'AWS Snowball Edge devices', 'Direct Connect order', 'S3 Transfer Acceleration'], 1, '500 Mbps ≈ 5.4 TB/day at full rate → ~37 days. Ship it.'),
  Q('mig', 2, 'Which service continuously replicates on-prem servers to AWS for lift-and-shift cutover?', ['DMS', 'Application Migration Service (MGN)', 'DataSync', 'Storage Gateway'], 1, ''),
  Q('mig', 3, 'Before a DNS-based cutover, you should:', ['Raise TTLs', 'Lower TTLs days in advance', 'Disable health checks', 'Delete the old records'], 1, 'So clients pick up the new records quickly.'),
  Q('mig', 2, 'Discover on-prem servers, utilization and dependencies to plan waves:', ['Application Discovery Service / Migration Hub', 'Trusted Advisor', 'Config', 'X-Ray'], 0, ''),
  Q('mig', 3, 'A VMware-based datacenter must move quickly with no re-platforming and keep vSphere tooling:', ['Rehost via MGN', 'Relocate to VMware Cloud on AWS', 'Refactor to containers', 'Repurchase'], 1, ''),
  Q('mig', 1, 'Which service provides SFTP endpoints backed by S3 for partner file drops?', ['Transfer Family', 'DataSync', 'Snowcone', 'EFS'], 0, ''),

  // ───────── COST ─────────
  Q('cost', 1, 'Which purchase option gives the deepest discount but can be interrupted?', ['Reserved Instances', 'Savings Plans', 'Spot Instances', 'Dedicated Hosts'], 2, ''),
  Q('cost', 2, 'A steady 24/7 baseline will run 3 years but may move from EC2 to Fargate. Best commitment?', ['EC2 Instance Savings Plan', 'Compute Savings Plan', 'Standard RI', 'Spot'], 1, 'Compute SPs apply across EC2, Fargate and Lambda.'),
  Q('cost', 2, 'Average CPU on a fleet of c5.4xlarge instances is 8%. First action?', ['Buy RIs for them', 'Right-size (smaller instances or fewer) and autoscale', 'Move to Spot', 'Add CloudFront'], 1, 'Don\'t commit to waste.'),
  Q('cost', 2, 'Largest unexpected line item is "NAT Gateway — data processed". Likely fix?', ['Bigger NAT', 'VPC gateway endpoints for S3/DynamoDB traffic', 'More AZs', 'Public subnets for databases'], 1, ''),
  Q('cost', 1, 'Which tool alerts you when spending is forecast to exceed a threshold?', ['Cost Explorer', 'AWS Budgets', 'CloudTrail', 'Trusted Advisor'], 1, ''),
  Q('cost', 2, 'Static images are 70% of traffic and egress costs are high. Best combined cost+performance change?', ['Bigger instances', 'Serve from S3 via CloudFront', 'Use EFS', 'Enable Multi-AZ'], 1, ''),
  Q('cost', 3, 'Data transfer between two AZs in the same region is:', ['Free', 'Charged per GB in each direction', 'Charged only for EC2', 'Charged at internet egress rates'], 1, '~$0.01/GB each way.'),
  Q('cost', 2, 'Why do tags matter for cost management?', ['They speed up instances', 'Cost allocation: attribute spend to teams/products/environments', 'They encrypt data', 'They are required by IAM'], 1, ''),
  Q('cost', 3, 'An HTTP flood makes your Auto Scaling Group scale to 10× and the bill explodes. Which mitigates both availability and cost?', ['Remove autoscaling', 'WAF rate limiting + CloudFront in front (and Shield Advanced cost protection)', 'Bigger instances', 'Disable the ALB'], 1, 'Block bad traffic before it reaches scaling compute.'),
  Q('cost', 2, 'Which instance family generally gives ~20% better price-performance for compatible workloads?', ['x86 m5', 'Graviton (ARM) m7g/c7g', 'p4d', 't2'], 1, ''),

  // ───────── OPS / GIT / TERRAFORM ─────────
  Q('ops', 1, 'Which Git command creates a new branch and switches to it?', ['git branch -d feature', 'git checkout -b feature (or git switch -c feature)', 'git merge feature', 'git push feature'], 1, '', ['git']),
  Q('ops', 1, 'You staged files and want to record them in history:', ['git add', 'git commit -m "message"', 'git push', 'git stash'], 1, '', ['git']),
  Q('ops', 2, 'A bad commit is already on the shared main branch. Safest way to undo it?', ['git reset --hard HEAD~1 && git push --force', 'git revert <sha> and push', 'Delete the repository', 'git checkout <sha>'], 1, 'revert adds a new commit; no history rewrite for teammates.', ['git']),
  Q('ops', 2, 'git pull is equivalent to:', ['git fetch + git merge (or rebase if configured)', 'git push + git fetch', 'git clone', 'git commit + git push'], 0, '', ['git']),
  Q('ops', 2, 'Two branches edited the same lines. During merge Git reports a conflict. You must:', ['Run git merge --force', 'Edit the files to resolve conflict markers, git add them, then commit', 'Delete one branch', 'Run git revert'], 1, '', ['git']),
  Q('ops', 1, 'Which Terraform command shows what will change without changing anything?', ['terraform apply', 'terraform plan', 'terraform init', 'terraform show'], 1, '', ['terraform']),
  Q('ops', 2, 'Two engineers ran terraform apply simultaneously and corrupted state. Prevent with:', ['Local state files in Git', 'Remote backend with state locking (S3 + DynamoDB, or Terraform Cloud)', 'terraform fmt', 'More modules'], 1, '', ['terraform']),
  Q('ops', 2, 'A security group was changed manually in the console. What does the next terraform plan show?', ['Nothing', 'Drift — a change to bring the resource back to the code', 'An error', 'A destroy of the VPC'], 1, '', ['terraform']),
  Q('ops', 2, 'Bring an existing manually-created S3 bucket under Terraform management:', ['terraform taint', 'terraform import (or an import block)', 'terraform refresh', 'Recreate it'], 1, '', ['terraform']),
  Q('ops', 3, 'Where should Terraform state NOT be stored?', ['S3 with encryption', 'Terraform Cloud', 'A public Git repository', 'Azure Storage with locking'], 2, 'State can contain secrets.', ['terraform']),
  Q('ops', 1, 'Which deployment strategy shifts a small percentage of traffic to the new version first?', ['All-at-once', 'Canary', 'Recreate', 'Rolling with no health checks'], 1, ''),
  Q('ops', 2, 'Blue/green deployment main advantage:', ['Cheapest', 'Instant rollback by switching traffic back to the old environment', 'No testing needed', 'No load balancer needed'], 1, ''),
  Q('ops', 2, 'GitHub Actions needs to deploy to AWS without storing long-lived keys:', ['Store keys as GitHub secrets', 'OIDC federation: the workflow assumes an IAM role', 'Use the root user', 'Hard-code keys in the workflow'], 1, ''),
  Q('ops', 2, 'Which service records configuration changes and API activity for auditing "who changed the SG"?', ['CloudWatch Metrics', 'CloudTrail', 'X-Ray', 'Inspector'], 1, ''),
  Q('ops', 3, 'An SLO of 99.9% with burn-rate alerting will page when:', ['CPU > 80%', 'The error budget is being consumed much faster than sustainable (e.g., 14× over 1 hour)', 'Any single error occurs', 'Deploys happen'], 1, ''),
  Q('ops', 1, 'First command to check which identity your AWS CLI is using:', ['aws iam list-users', 'aws sts get-caller-identity', 'aws configure list-profiles', 'aws whoami'], 1, ''),
  Q('ops', 2, 'Gain shell access to private EC2 instances with no SSH keys or open inbound ports:', ['Bastion host', 'Systems Manager Session Manager', 'EC2 Instance Connect over the internet', 'Public IPs'], 1, ''),
];

export function drawQuestions({ n = 10, domains = null, diff = [1, 3], tags = null, rng = Math.random } = {}) {
  let pool = QUIZ.filter(q => q.l >= diff[0] && q.l <= diff[1]);
  if (domains) pool = pool.filter(q => domains.includes(q.d));
  if (tags) pool = pool.filter(q => tags.some(t => q.t.includes(t)) || (domains && domains.includes(q.d)));
  pool = pool.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, n);
}
