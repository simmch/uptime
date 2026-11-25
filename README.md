# UPTIME — a cloud architect's story

A pixel-art cloud infrastructure simulator built in **three.js**. You start as a broke freelancer with $1,200 and a borrowed couch, provision infrastructure for small clients, work your way up through startups, an enterprise, and a hyperscaler — then get laid off and replaced by an AI, and join the hacker who's been attacking you all along.

Played long enough, it teaches what a Solutions Architect / Principal Engineer actually knows across AWS, Azure and GCP.

## Run it

```bash
npm install
npm run dev        # opens http://localhost:5173
npm run build      # production build in dist/
```

Requires Node 18+. Saves go to browser localStorage (export/import a save code from **Save & Settings**).

## Replace sound effects

Replace a clip in `src/sound_effects/` with an MP3 that uses the same filename. For example, `ui_click.mp3` is the button sound, `footstep.mp3` plays when walking, and `car_park.mp3` plays on arrival. `engine_drive.mp3` and `server_hum.mp3` are looping clips. Levels, repeat limits, and fade lengths are set in `src/audio/sfx.js`.

Run `npm run build` to include replacements in the production build. The **Sound effects** toggle in **Save & Settings** controls these clips. Music has its own player.

## How you play

1. **Take a contract** from the job board (story contracts are pinned in gold).
2. **Design** the architecture on an isometric diorama: pick regions, drop components on region platforms or AZ tiles, configure each one (instance sizes, Multi-AZ, autoscaling, purchase model, routing policy…).
3. **Deploy.** You pay setup labor; the client pays 30% upfront.
4. **Run** the critical 8 hours of the contract. Traffic flows as packets; spikes, AZ/region outages, DDoS, SQL injection, leaked keys, ransomware, bad deploys and config drift hit you. You pay the cloud bill **live from your wallet** — hit your credit limit and your account is suspended.
5. **Get graded** (S–F) on availability vs. SLA, p95 latency, RTO/RPO, breaches, compliance and cost vs. budget. Pay, XP, reputation, and **lessons** that link to the Codex.

Rent is due every 7 days. Skills cost skill points **and** course fees. Certifications cost exam fees and raise your pay on every job. Money is the constraint on everything.

### Controls
Drag to pan · right-drag / Shift-drag to rotate · wheel to zoom · WASD / arrows to pan · Q/E rotate · Delete removes selection · Esc cancels placing · Space/click advances dialogue.

## The 8 learning domains

| Domain | Where you learn it |
|---|---|
| **Networking & Connectivity** | VPCs, private subnets, NAT per AZ, VPC endpoints, peering, Transit Gateway, VPN/Direct Connect, Route 53 policies + health checks, CloudFront, Global Accelerator, ALB/NLB. **Network Lab**: fix broken route tables, SGs, NACLs, peering and endpoints with a reachability analyzer. **CIDR drills.** |
| **Compute & App Architecture** | EC2, Auto Scaling (target tracking, predictive, warm pools), Lambda (cold starts, concurrency quotas), API Gateway, ECS/Fargate, **EKS** (HPA, Cluster Autoscaler vs Karpenter, PDBs, probes, IRSA, mesh), App Runner, SQS/SNS/EventBridge/Kinesis/Step Functions. **kubectl terminal.** |
| **Storage, Databases & Data** | S3 classes + lifecycle + Object Lock, EFS/FSx, RDS Multi-AZ vs read replicas, RDS Proxy, Aurora (+Serverless v2, Global), DynamoDB (on-demand vs provisioned, Global Tables, DAX), ElastiCache, Redshift. |
| **Security, IAM & Governance** | IAM roles, KMS, ACM, Secrets Manager, WAF (+Bot Control), Shield Advanced, GuardDuty, CloudTrail, Config, Network Firewall, Organizations/SCPs/Identity Center. **Security Audit** and **IAM policy-evaluation** puzzles (explicit deny, SCP ceilings, boundaries, cross-account, KMS key policies). |
| **Reliability & DR** | Multi-AZ vs multi-region, RTO/RPO measured during real regional outages, pilot light / warm standby / active-active, AWS Backup + Vault Lock, quotas, chaos engineering, multi-cloud. |
| **Migration & Hybrid** | **Migration Planner**: assign the 7 Rs to real-ish portfolios, choose DataSync vs Snowball vs Direct Connect from data size and bandwidth. MGN, DMS, hybrid links. |
| **Cost & Performance** | Prices approximate real list prices. On-Demand / Savings Plans / RIs / Spot, right-sizing, NAT and data-transfer costs, caching economics, a cost-cutting contract graded on savings. |
| **Deployment & Operations** | **Terminal** with real `git`, `terraform`, `kubectl`, `gh`, `aws` and `sed` syntax: branching/merging, safe reverts, OIDC in GitHub Actions, terraform plan/apply, drift, state locks, import. Every design can be viewed as **generated Terraform**. CI/CD strategies (rolling/blue-green/canary) change how bad deploys hurt. Monitoring changes how fast you even *see* incidents. |

Plus: an 83-entry **Codex** (each with AWS/Azure/GCP equivalents and exam tips), 114 certification questions across 8 exams (Cloud Practitioner → Solutions Architect Pro → Principal Review Board), and Practice Labs for daily XP.

## Story (light spoilers)

1. **localhost** — freelance gigs: a bakery, a Discord bot, a taco truck's lunch rush, a merch drop that someone called NULL tries to knock over.
2. **Seed Round** — startups: fintech compliance, telehealth, Kubernetes launch day, live streaming under DDoS.
3. **Enterprise** — Halcyon Logistics: audits, a datacenter exit, a landing zone, a region-loss DR test. Malware signed "DR3Y".
4. **Hyperscale** — Axiom: platform onboarding, cost cutting, global payments, and NULL's Black Friday siege. Then Axiom announces AUTOPILOT.
5. **Deprecated** — laid off by email. NULL reveals himself.
6. **The Signal** — the villain arc: run a broadcast that must stay up while DNS is seized, AWS terminates your account, and courts shut down whole jurisdictions. Multi-cloud or die.
7. **Root** — the last broadcast, and a choice.

## Art

The game is set in the 1980s: a synthwave look built from low-poly models by [Polyfork](https://polyfork.dev) (CC BY 4.0, see [CREDITS.md](CREDITS.md)), with neon bloom, grain, lens fringing and a vignette from [postprocessing](https://github.com/vanruesc/postprocessing) (found via [Fasani/three-js-resources](https://github.com/Fasani/three-js-resources)) and a CSS scanline overlay. Home life is third person (WASD + drag to look, or tap to walk on touch screens).

- `scripts/polyfork-models.json` maps each game key (`server`, `lb`, `player`, `home_bed`, …) to a Polyfork model title.
- `python3 scripts/fetch-polyfork.py catalog.json` downloads and compresses them into `public/models` (needs `@gltf-transform/cli`; `catalog.json` is the `{id, title}` card list from https://polyfork.dev/assets).
- `npx vite` then `python3 scripts/model-icons.py` re-renders the UI icon sheet (`public/sprites/icons.webp`, needs Playwright).

The old pixel atlas (`public/sprites/atlas.png`, Pixel Art Atlas 1.4M by Angais, CC0) is only a fallback for keys with no model.

## Project layout

```
src/
  data/       components (52), skills (73), story & chapters, codex, quiz, labs, terminal challenges, job generator
  sim/        traffic/failure simulator, incidents, Well-Architected review, Terraform export
  render/     three.js world (pixelated isometric diorama, packets, incidents) + sprite atlas
  ui/         HUD, office, build/run screens, skills/codex/certs/shop panels, labs, terminal, title/ending
  core/       state, economy, progression, save/load
  game.js     story progression, grading, payouts
test/         node test/integrity.mjs · node test/balance.mjs · node test/terminal_test.mjs · node test/sim_test.mjs
```

### Extending
- **New component**: add to `src/data/components.js` (kind, scope, price, config), handle its `kind` in `src/sim/sim.js` if it changes traffic/cost, add a Codex entry.
- **New contract**: add to `STORY_JOBS` in `src/data/story.js` and reference it from a chapter step, or add a template to `src/data/jobs.js` for the random board.
- **New incident**: describe it in `src/sim/incidents.js`, implement start/end in `src/sim/sim.js`.
- Run `node test/integrity.mjs` to check every skill/codex/sprite reference resolves, and `node test/balance.mjs` to check story contracts are still winnable.

Prices, capacities and latencies are simplified for teaching; they're directionally right, not quotes.
