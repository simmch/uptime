// The phone uses authored answers tied to the simulator's terminology.
export const FRIENDS = [
  { id: 'mara', name: 'Mara Okafor', sprite: 'mentor', role: 'Cloud fundamentals', unlock: 'Available from day one', level: 1 },
  { id: 'nico', name: 'Nico Park', sprite: 'user', role: 'Networking and app design', unlock: 'Finish the bakery contract or reach level 2', level: 2, domains: ['net', 'compute', 'data'] },
  { id: 'samira', name: 'Samira Reed', sprite: 'oldman', role: 'Reliability and deployments', unlock: 'Reach level 4 or start chapter 2', level: 4, chapter: 2, domains: ['ha', 'ops', 'cost'] },
  { id: 'imani', name: 'Imani Brooks', sprite: 'suit', role: 'Security and migrations', unlock: 'Reach level 7 or start chapter 3', level: 7, chapter: 3, domains: ['sec', 'mig', 'data'] },
];

export function isFriendAvailable(friend, state) {
  return state.level >= friend.level || (friend.chapter && state.chapter >= friend.chapter) ||
    (friend.id === 'nico' && state.flags.done_s1_bakery);
}

const question = (id, domain, title, keywords, plain, tryThis, codex, specialist = false) =>
  ({ id, domain, title, keywords, plain, tryThis, codex, specialist });

export const QUESTIONS = [
  question('first-steps', 'general', 'Where do I start on a contract?', 'begin first project job build contract how to start rosa bakery lost',
    'Start with what the customer needs the app to do. Rosa needs to show a menu and take orders. Her traffic and uptime target tell you how much infrastructure is reasonable.',
    'Read the contract, make a small design, then open Review before deploying. Keep an eye on the contract budget.'),
  question('vpc', 'net', 'What is a VPC?', 'vpc virtual private cloud network foundation regional area',
    'A VPC is your private section of a cloud provider’s network. You choose its address range and how things inside can reach each other and the internet.',
    'Place a VPC in the region first. Then place things like EC2 and RDS inside that region’s network.', 'vpc'),
  question('region', 'ha', 'What are regions and availability zones?', 'region regions az zone availability zones datacenter multi az tiles',
    'A region is a broad geographic area. An availability zone, or AZ, is an isolated location inside a region. A failure in one zone can leave the other zones working.',
    'The three small tiles on each region platform represent its AZs. Use more than one AZ when losing a single location would cause too much downtime.', 'multiaz'),
  question('subnet', 'net', 'What are subnets and CIDR?', 'subnet route routing ip address cidr public private nat gateway internet reachability',
    'A subnet is a smaller block of addresses inside your VPC. CIDR notation tells you how big an address block is. Routes decide where traffic from the block can go.',
    'Put internet-facing entry points where they can reach the internet. Keep databases private. Try the Network Lab to trace what a route actually does.', 'cidr'),
  question('availability', 'ha', 'What do SLA and uptime mean?', 'sla slo availability uptime nines success errors failure percentage availability target',
    'Availability tells you how much of the service worked when people tried to use it. An SLA is the promise you make to the customer. Higher targets allow fewer failed requests.',
    'Compare the contract’s target with the availability in your results. Add reliability where the report shows a single failure can take the whole app down.', 'slo'),
  question('latency', 'ha', 'What does p95 latency mean?', 'p95 latency percentile slow ms milliseconds response time performance lag',
    'Line up 100 requests from fastest to slowest. The 95th gives you a rough idea of what p95 measures. It tells you what slower customers experience.',
    'Compare the reported p95 with the contract limit. Check whether compute is overloaded or users are far away before adding more services.', 'slo'),
  question('traffic', 'compute', 'What are requests per second and peak traffic?', 'rps traffic demand req requests per second spike peak capacity users overload',
    'A request is one thing the app is asked to do, like load a menu. Requests per second measure how fast those arrive. The peak is the busy period your design has to withstand.',
    'Compare demand and served requests in the run. If they separate during a peak, find which part of the design ran out of capacity.', 'asg'),
  question('compute', 'compute', 'What are EC2, servers, and compute?', 'ec2 server vm virtual machine instance compute run code backend application',
    'Compute is the machine power that runs your code. EC2 is a rented virtual computer. In a simple web app it handles requests and sends data back to the user.',
    'Put EC2 on an AZ tile and select it to adjust size. Start small when the contract lists low traffic.', 'ec2'),
  question('data', 'data', 'Should I use a database or object storage?', 'database databases storage rds sql relational s3 object store orders state data files',
    'A relational database is good for records you query or update, such as customer orders. Object storage is good for separate files, such as photos and downloadable menus.',
    'Use RDS for records when your contract needs a database. Consider S3 for file-heavy sites if you have the skill.', 'rds'),
  question('balance', 'net', 'Why use a load balancer?', 'alb nlb lb load balancer load balancing distribute requests spread traffic',
    'A load balancer is a front door that sends incoming requests to healthy copies of your app. It can stop sending new requests to a broken copy.',
    'Use an ALB for web traffic when you have multiple app servers. Place healthy copies in different AZs if the design must survive an outage.', 'alb'),
  question('cost', 'cost', 'Why am I paying a cloud bill?', 'money budget cost pricing cloud bill wallet profit price estimate infra spend expensive',
    'Cloud services charge while you use them. Your contract can pay more than the bill, but it’s easy to spend the payout on machines the app never needed.',
    'Check Cost and Review before deploying. Start with enough headroom for the stated peak. Buy bigger instances when measurements give you a reason.', 'rightsize'),
  question('monitor', 'ops', 'Why can’t I see errors or latency?', 'monitor monitoring logs observability cloudwatch alert metrics question marks unknown',
    'Monitoring measures what your app is doing. Without it, you may see the bill before you know requests are failing.',
    'Learn monitoring and add the monitoring component when the job calls for faster diagnosis. Read the event log and check which metric changed first.', 'cloudwatch'),
  question('backup', 'ha', 'Are backups the same as failover?', 'backup restore failover data loss rto rpo disaster recovery',
    'A backup is a copy you can restore from. Failover is switching work to another healthy copy. Failover gets you running again. A backup helps recover data that was lost or damaged.',
    'If a contract lists RTO and RPO, check the time you can be down and how much recent data you can lose. Test restoring a copy.', 'rto_rpo'),
  question('dns', 'net', 'What are DNS and a CDN?', 'dns domain route53 cdn cloudfront cache edge website content delivery',
    'DNS tells a browser where to connect for a site name. A CDN serves copies of content from locations closer to users. The request for a checkout or order still needs the app behind it.',
    'Look at the share of static requests in the contract. Static, global traffic is a good reason to consider a CDN.', 'cloudfront'),
  question('iam', 'sec', 'What are IAM and least privilege?', 'iam permission roles policy identity least privilege access denied auth',
    'Identity and access management controls who can do what. A role is a set of permissions a person or service can use. Least privilege means allowing only the actions needed for that task.',
    'In the IAM lab, identify the caller, the requested action, and the target resource. Then check which policies allow or deny that combination.', 'iam'),
  question('scale', 'compute', 'How does auto scaling handle a lunch rush?', 'autoscale autoscaling auto scaling asg capacity scaling policy minimum maximum baseline taco traffic spike',
    'An Auto Scaling group adjusts how many copies of the app are running. New servers take time to get ready, so a scheduled peak can need capacity before the rush starts.',
    'Set enough minimum capacity for quiet traffic and allow room to scale at the peak. Check the run to see whether new capacity arrived in time.', 'asg'),
  question('kubernetes', 'compute', 'What is Kubernetes doing for me?', 'k8s kubernetes eks containers pods replicas deployment cluster requests',
    'Kubernetes keeps the requested number of app copies running in containers. A Pod is the unit it schedules. A Deployment describes the desired copies and how they roll out.',
    'Inspect your app’s replicas, resource requests, and health checks. Adding replicas won’t help if the cluster has no room to run them.', 'k8s_objects', true),
  question('connections', 'net', 'Security groups or network ACLs?', 'security groups group nacle acl stateful stateless sg nacl firewall connection networking',
    'Security groups protect resources and remember established connections. Network ACLs apply at the subnet boundary and evaluate traffic in both directions.',
    'When a return packet never arrives, check rules on the return path in the Network Lab before adding wide-open allowances.', 'sg_nacl', true),
  question('cache', 'data', 'When would I add a cache?', 'cache caching redis elasticache read hit speed database repeat',
    'A cache remembers results that are expensive to fetch again. It helps most when many people ask for the same thing. It needs rules about when an old answer becomes stale.',
    'Try a cache on a read-heavy workload and compare how much work the database did before and after.', 'elasticache', true),
  question('terraform', 'ops', 'What is Terraform, and what is state?', 'terraform iac infrastructure code state plan apply drift import',
    'Terraform describes infrastructure in files. It uses state to keep track of the resources those files correspond to. A plan previews the changes it intends to make.',
    'Open the Terraform view for your design. Pick one component and match it to a generated resource block before trying a Terraform lab.', 'terraform', true),
  question('deployment', 'ops', 'How do I ship an update safely?', 'deployment deploy releases rollback canary rolling blue green cicd pipeline',
    'Send a new version to a small share of users first. Watch the errors and latency. If those get worse, stop or roll back before the rest of your users see the update.',
    'Compare the run’s incident timing with the deployment strategy in the design. Add monitoring so you can spot trouble quickly.', 'deploy_strategies', true),
  question('recovery', 'ha', 'What are RTO and RPO?', 'rto rpo recovery time objective point objective loss failover outage regions',
    'RTO asks how fast you need to be back. RPO asks how much recent work you can lose. A fast restart can still lose a lot of data if your last backup was yesterday.',
    'If the job names a recovery goal, pick a recovery strategy and check both measures during the outage.', 'rto_rpo'),
  question('migration', 'mig', 'How do I plan a migration?', 'migration 7rs rehost replatform refactor modernize move cutover waves',
    'Inventory what runs today and which systems depend on each other. Move a small group first. More invasive changes can be useful, but they need time and testing.',
    'In the Migration Planner, start with downtime allowed, dependencies, and the amount of code change the team can handle.', 'seven_rs', true),
  question('encryption', 'sec', 'What does encryption at rest or in transit mean?', 'encryption encrypted kms tls certificate compliance in transit at rest keys',
    'Encryption at rest protects stored data. Encryption in transit protects data as it moves between systems. Keys and certificates are how those systems control who can read the data or prove their identity.',
    'Check the contract for both requirements. A database setting for stored data and HTTPS for network connections meet different needs.', 'kms', true),
  question('rightsize', 'cost', 'How do I right-size a design?', 'rightsize right size cost optimization savings spot utilization cpu money efficient',
    'Match the resource to the work that actually arrives. A bigger instance can handle more load, but it costs more even when most of it sits idle.',
    'Look at peak and average utilization together. Reserve steady capacity where it makes sense and compare the full bill after changing one thing.', 'rightsize', true),
  question('data-transfer', 'mig', 'Do I move the data online or offline?', 'data transfer migration datasync snow network bulk bandwidth dataset copy petabytes',
    'An online transfer uses a network connection. An offline transfer ships a storage device. The better choice depends on data size, usable bandwidth, and how quickly you need the data moved.',
    'Estimate the transfer time before choosing. In the Migration Planner, use the given bandwidth and deadline alongside the data volume.', 'transfer', true),
];

const stopWords = new Set(['what', 'why', 'when', 'who', 'where', 'how', 'does', 'are', 'the', 'means', 'mean', 'can',
  'should', 'our', 'get', 'for', 'with', 'and', 'about', 'help', 'explain', 'tell', 'like', 'this', 'use', 'difference',
  'need', 'want', 'please', 'using', 'is', 'it', 'an', 'be', 'do', 'my', 'me', 'so', 'to', 'if', 'than', 'that', 'from',
  'too', 'in', 'on', 'still', 'out', 'some', 'have', 'has', 'of', 'or', 'am', 'into', 'as', 'your', 'you']);
const words = value => String(value ?? '').toLowerCase().match(/[a-z0-9]+/g) || [];

export function findQuestions(query) {
  const terms = [...new Set(words(query).filter(word => word.length > 1 && !stopWords.has(word)))];
  const phrase = terms.join(' ');
  if (!terms.length) return [];
  return QUESTIONS.map(entry => {
    const heading = words(entry.title);
    const aliases = words(entry.keywords);
    const score = terms.reduce((total, term) => total + (heading.includes(term) ? 5 : 0) + (aliases.includes(term) ? 4 : 0), 0);
    const exact = phrase.length > 3 && (entry.keywords.includes(phrase) || heading.join(' ').includes(phrase));
    return { entry, score: score + (exact ? 5 : 0) };
  }).filter(result => result.score > 0).sort((a, b) => b.score - a.score).slice(0, 6).map(result => result.entry);
}

export function friendCanAnswer(friend, entry) {
  return friend.id === 'mara' ? !entry.specialist : !entry.specialist || friend.domains.includes(entry.domain);
}
