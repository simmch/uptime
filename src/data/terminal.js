// A small simulated shell: git, terraform, kubectl, gh, aws, sed, cat, ls.
// Real syntax, simplified state. Challenges check state after each command.

const sha = () => Math.random().toString(16).slice(2, 9);

export function newWorld() {
  return {
    files: {},
    git: { init: false, branches: {}, head: 'main', staged: new Set(), committedFiles: {}, remote: {}, log: [] },
    tf: { init: false, planned: false, applied: false, state: {}, desired: {}, drift: {}, imported: [], lockedBy: null },
    k8s: { deployments: {}, hpas: {}, nodes: 3, nodeCpu: 4, events: [] },
    gh: { runs: [], secrets: [] },
    history: [],
    flags: {},
  };
}

// ───────────── helpers ─────────────
function gitCommit(w, msg, files) {
  const b = w.git.head;
  const c = { sha: sha(), msg, files: { ...files } };
  (w.git.branches[b] ||= []).push(c);
  w.git.committedFiles[b] = { ...(w.git.committedFiles[b] || {}), ...files };
  return c;
}
function tokens(line) {
  const out = []; let cur = '', q = null;
  for (const ch of line) {
    if (q) { if (ch === q) q = null; else cur += ch; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (ch === ' ') { if (cur) out.push(cur), cur = ''; }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
const opt = (args, name) => { const i = args.findIndex(a => a === name || a.startsWith(name + '=')); if (i < 0) return null; const a = args[i]; return a.includes('=') ? a.split('=').slice(1).join('=') : args[i + 1]; };

// ───────────── command dispatch ─────────────
export function run(w, line) {
  const t = tokens(line.trim());
  if (!t.length) return '';
  w.history.push(line.trim());
  // redirection: echo "x" >> file
  const redir = line.match(/^echo\s+(["'])(.*)\1\s*(>>?)\s*(\S+)$/);
  if (redir) { const [, , text, op, file] = redir; w.files[file] = op === '>>' ? (w.files[file] || '') + text + '\n' : text + '\n'; return ''; }
  const [cmd, ...a] = t;
  switch (cmd) {
    case 'help': return HELP;
    case 'ls': return Object.keys(w.files).sort().join('  ') || '(empty)';
    case 'pwd': return '/home/you/project';
    case 'cat': return a[0] in w.files ? w.files[a[0]].replace(/\n$/, '') : `cat: ${a[0]}: No such file or directory`;
    case 'echo': return a.join(' ');
    case 'clear': return '\x1bclear';
    case 'sed': return sed(w, a);
    case 'git': return git(w, a);
    case 'terraform': case 'tf': return terraform(w, a);
    case 'kubectl': case 'k': return kubectl(w, a);
    case 'gh': return gh(w, a);
    case 'aws': return aws(w, a);
    case 'whoami': return 'you (laid-off? not yet.)';
    default: return `${cmd}: command not found. Type "help".`;
  }
}

const HELP = `Available: ls, cat, echo "x" > file, sed -i 's/old/new/' file, pwd, clear, hint
git     init | status | add <f|.> | commit -m "msg" | log [--oneline] | branch [name] | checkout [-b] <br>
        switch [-c] <br> | merge <br> | revert <sha> | push [origin <br>] | pull | diff | reset --hard <ref>
terraform  init | plan | apply [-auto-approve] | state list | import <addr> <id> | fmt | validate | output
kubectl get pods|deploy|nodes|hpa|svc | describe pod <p> | logs <p> | scale deployment <d> --replicas=N
        rollout status|history|undo deployment/<d> | set image deployment/<d> <c>=<img>
        set resources deployment/<d> --requests=cpu=<v> | autoscale deployment <d> --min=N --max=N --cpu-percent=N
gh      run list | run view <id> | run rerun <id> | secret set <NAME> | pr create | pr merge
aws     sts get-caller-identity | s3 ls | ec2 describe-instances`;

function sed(w, a) {
  // sed -i 's/old/new/[g]' file
  const i = a.indexOf('-i');
  const expr = a[i >= 0 ? i + 1 : 0], file = a[a.length - 1];
  if (!expr || !file || !(file in w.files)) return `sed: can't read ${file}`;
  const m = expr.match(/^s(.)(.*?)\1(.*?)\1(g?)$/);
  if (!m) return 'sed: invalid expression (use s/old/new/)';
  const [, , from, toRaw, g] = m;
  const to = toRaw.replace(/\\n/g, '\n');
  const before = w.files[file];
  w.files[file] = g ? before.split(from).join(to) : before.replace(from, to);
  return before === w.files[file] ? `(no match for "${from}")` : '';
}

function git(w, a) {
  const G = w.git;
  const sub = a[0];
  if (sub !== 'init' && !G.init) return 'fatal: not a git repository';
  const cur = () => G.branches[G.head] || [];
  const dirty = () => Object.keys(w.files).filter(f => (G.committedFiles[G.head] || {})[f] !== w.files[f]);
  switch (sub) {
    case 'init': G.init = true; G.branches.main ||= []; return 'Initialized empty Git repository';
    case 'status': {
      const st = [...G.staged];
      const mod = dirty().filter(f => !G.staged.has(f));
      return `On branch ${G.head}\n` + (st.length ? `Changes to be committed:\n${st.map(f => '  modified: ' + f).join('\n')}\n` : '') + (mod.length ? `Changes not staged for commit:\n${mod.map(f => '  modified: ' + f).join('\n')}` : (!st.length ? 'nothing to commit, working tree clean' : ''));
    }
    case 'add': { const fs = a[1] === '.' || a[1] === '-A' ? dirty() : a.slice(1); for (const f of fs) if (f in w.files) G.staged.add(f); return ''; }
    case 'commit': {
      const m = opt(a, '-m') ?? opt(a, '-am');
      if (!m) return 'error: use git commit -m "message"';
      if (a.includes('-am') || a.includes('-a')) for (const f of dirty()) G.staged.add(f);
      if (!G.staged.size) return 'nothing to commit';
      const files = {}; for (const f of G.staged) files[f] = w.files[f];
      const c = gitCommit(w, m, files); G.staged.clear();
      return `[${G.head} ${c.sha}] ${m}\n ${Object.keys(files).length} file(s) changed`;
    }
    case 'log': return cur().slice().reverse().map(c => a.includes('--oneline') ? `${c.sha} ${c.msg}` : `commit ${c.sha}\n    ${c.msg}`).join('\n') || 'no commits';
    case 'branch': {
      if (!a[1]) return Object.keys(G.branches).map(b => (b === G.head ? '* ' : '  ') + b).join('\n');
      if (a[1] === '-d' || a[1] === '-D') { delete G.branches[a[2]]; return `Deleted branch ${a[2]}`; }
      G.branches[a[1]] = cur().slice(); G.committedFiles[a[1]] = { ...(G.committedFiles[G.head] || {}) }; return '';
    }
    case 'checkout': case 'switch': {
      const create = a[1] === '-b' || a[1] === '-c';
      const b = create ? a[2] : a[1];
      if (!b) return 'error: branch name required';
      if (create) { if (G.branches[b]) return `fatal: a branch named '${b}' already exists`; G.branches[b] = cur().slice(); G.committedFiles[b] = { ...(G.committedFiles[G.head] || {}) }; }
      else if (!G.branches[b]) return `error: pathspec '${b}' did not match any branch`;
      G.head = b;
      Object.assign(w.files, G.committedFiles[b] || {});
      return `Switched to ${create ? 'a new ' : ''}branch '${b}'`;
    }
    case 'merge': {
      const b = a[1];
      if (!G.branches[b]) return `merge: ${b} - not something we can merge`;
      const mine = new Set(cur().map(c => c.sha));
      const incoming = G.branches[b].filter(c => !mine.has(c.sha));
      if (!incoming.length) return 'Already up to date.';
      // conflict if both sides changed the same file since branching
      const conflictFile = w.flags.conflictOn && b === w.flags.conflictBranch ? w.flags.conflictOn : null;
      if (conflictFile && !w.flags.conflictResolved) {
        w.files[conflictFile] = `<<<<<<< HEAD\n${w.flags.oursText}\n=======\n${w.flags.theirsText}\n>>>>>>> ${b}\n`;
        w.flags.inMerge = b;
        return `Auto-merging ${conflictFile}\nCONFLICT (content): Merge conflict in ${conflictFile}\nAutomatic merge failed; fix conflicts, git add, then git commit.`;
      }
      G.branches[G.head] = cur().concat(incoming);
      Object.assign(G.committedFiles[G.head] ||= {}, G.committedFiles[b]);
      Object.assign(w.files, G.committedFiles[b]);
      w.flags.merged = (w.flags.merged || []).concat(b);
      return `Updating… Fast-forward\n ${incoming.length} commit(s) merged from ${b}`;
    }
    case 'revert': {
      const target = a[1] === 'HEAD' ? cur()[cur().length - 1] : cur().find(c => c.sha.startsWith(a[1] || '~'));
      if (!target) return `fatal: bad revision '${a[1]}'`;
      const prevFiles = {};
      for (const f of Object.keys(target.files)) {
        const older = cur().slice(0, cur().indexOf(target)).reverse().find(c => f in c.files);
        prevFiles[f] = older ? older.files[f] : '';
      }
      Object.assign(w.files, prevFiles);
      const c = gitCommit(w, `Revert "${target.msg}"`, prevFiles);
      w.flags.reverted = (w.flags.reverted || []).concat(target.sha);
      return `[${G.head} ${c.sha}] Revert "${target.msg}"`;
    }
    case 'reset': {
      if (a[1] !== '--hard') return 'usage: git reset --hard <ref>';
      const ref = a[2] || 'HEAD';
      const m = ref.match(/HEAD~(\d+)/);
      const n = m ? +m[1] : 0;
      if (n) G.branches[G.head] = cur().slice(0, -n);
      w.flags.resetShared = G.head === 'main' && n > 0;
      return `HEAD is now at ${(cur()[cur().length - 1] || {}).sha || '(root)'}`;
    }
    case 'push': {
      const b = a[2] || G.head;
      if (a.includes('--force') || a.includes('-f')) w.flags.forcePushed = true;
      G.remote[b] = (G.branches[b] || []).slice();
      w.flags.pushed = (w.flags.pushed || []).concat(b);
      if (w.flags.onPush) w.flags.onPush(w, b);
      return `To github.com:you/project.git\n   ${b} -> ${b}`;
    }
    case 'pull': return 'Already up to date.';
    case 'diff': return dirty().map(f => `diff --git a/${f} b/${f}\n- ${(G.committedFiles[G.head] || {})[f] || ''}\n+ ${w.files[f]}`).join('\n') || '';
    case 'stash': return 'Saved working directory';
    default: return `git: '${sub}' is not a git command.`;
  }
}

function terraform(w, a) {
  const T = w.tf;
  const sub = a[0];
  if (sub !== 'init' && sub !== 'fmt' && sub !== 'version' && !T.init) return 'Error: Backend initialization required, please run "terraform init"';
  const diff = () => {
    const lines = []; let add = 0, change = 0, destroy = 0;
    for (const [k, v] of Object.entries(T.desired)) {
      if (!(k in T.state)) { lines.push(`  + ${k}\n      ${Object.entries(v).map(([x, y]) => `+ ${x} = ${JSON.stringify(y)}`).join('\n      ')}`); add++; }
      else if (JSON.stringify(T.state[k]) !== JSON.stringify(v)) { lines.push(`  ~ ${k}\n      ${Object.keys(v).filter(x => JSON.stringify(v[x]) !== JSON.stringify(T.state[k][x])).map(x => `~ ${x} = ${JSON.stringify(T.state[k][x])} -> ${JSON.stringify(v[x])}`).join('\n      ')}`); change++; }
    }
    for (const k of Object.keys(T.state)) if (!(k in T.desired)) { lines.push(`  - ${k}`); destroy++; }
    return { lines, add, change, destroy };
  };
  switch (sub) {
    case 'init': T.init = true; return 'Initializing the backend...\nInitializing provider plugins...\n- Installing hashicorp/aws v5.x...\nTerraform has been successfully initialized!';
    case 'fmt': return 'main.tf';
    case 'validate': return 'Success! The configuration is valid.';
    case 'version': return 'Terraform v1.9.x';
    case 'plan': {
      T.planned = true; T.plannedAfterDrift = !!w.flags.driftHappened;
      const d = diff();
      if (!d.lines.length) return 'No changes. Your infrastructure matches the configuration.';
      const driftNote = Object.keys(T.drift).length ? 'Note: Objects have changed outside of Terraform\n\n' : '';
      return `${driftNote}Terraform will perform the following actions:\n\n${d.lines.join('\n')}\n\nPlan: ${d.add} to add, ${d.change} to change, ${d.destroy} to destroy.`;
    }
    case 'apply': {
      if (T.lockedBy) return `Error acquiring the state lock\nLock Info:\n  Who: ${T.lockedBy}\nTerraform acquires a state lock to protect the state from being written by multiple users at the same time.`;
      const d = diff();
      if (!a.includes('-auto-approve') && !w.flags.applyConfirmed) { w.flags.pendingApply = true; return `${d.lines.join('\n')}\n\nPlan: ${d.add} to add, ${d.change} to change, ${d.destroy} to destroy.\nDo you want to perform these actions? Only 'yes' will be accepted. (type: terraform apply -auto-approve, or yes)`; }
      T.state = JSON.parse(JSON.stringify(T.desired)); T.applied = true; T.drift = {};
      w.flags.driftFixed = !!w.flags.driftHappened;
      return `Apply complete! Resources: ${d.add} added, ${d.change} changed, ${d.destroy} destroyed.`;
    }
    case 'state': if (a[1] === 'list') return Object.keys(T.state).join('\n') || '(empty state)'; if (a[1] === 'show') return JSON.stringify(T.state[a[2]] || {}, null, 2); return 'usage: terraform state list|show';
    case 'import': {
      const [addr, id] = [a[1], a[2]];
      if (!addr || !id) return 'usage: terraform import <address> <id>';
      if (!(addr in T.desired)) return `Error: resource address "${addr}" does not exist in the configuration.`;
      if (w.flags.importId && id !== w.flags.importId) return `Error: Cannot import non-existent remote object ${id}`;
      T.state[addr] = JSON.parse(JSON.stringify(T.desired[addr])); T.imported.push(addr);
      return `${addr}: Importing from ID "${id}"...\nImport successful!`;
    }
    case 'output': return Object.entries(T.outputs || {}).map(([k, v]) => `${k} = "${v}"`).join('\n') || 'No outputs.';
    case 'force-unlock': T.lockedBy = null; w.flags.unlocked = true; return 'Terraform state has been successfully unlocked!';
    case 'destroy': return 'Refusing to destroy production in a training sim. 🙂';
    default: return `Terraform has no command named "${sub}".`;
  }
}

function kubectl(w, a) {
  const K = w.k8s;
  const [verb, kind, name] = a;
  const deployName = s => (s || '').replace(/^(deployment|deploy|deployments)\//, '');
  const podsOf = d => {
    const dep = K.deployments[d]; const out = [];
    const cpuPerPod = dep.cpuReq || 0.5;
    const capacityPods = Math.floor((K.nodes * K.nodeCpu * 0.9) / cpuPerPod);
    for (let i = 0; i < dep.replicas; i++) {
      let status = dep.crash ? 'CrashLoopBackOff' : 'Running';
      if (i >= capacityPods) status = 'Pending';
      out.push({ name: `${d}-${dep.hash}-${(i * 7919 % 99999).toString(36).padStart(5, 'x')}`, status, restarts: dep.crash ? 4 + i : 0, dep: d });
    }
    return out;
  };
  const allPods = () => Object.keys(K.deployments).flatMap(podsOf);
  switch (verb) {
    case 'get': {
      if (['pods', 'pod', 'po'].includes(kind)) return 'NAME                         READY   STATUS             RESTARTS\n' + allPods().map(p => `${p.name.padEnd(28)} ${p.status === 'Running' ? '1/1' : '0/1'}     ${p.status.padEnd(18)} ${p.restarts}`).join('\n');
      if (['deploy', 'deployment', 'deployments'].includes(kind)) return 'NAME      READY    UP-TO-DATE   AVAILABLE\n' + Object.entries(K.deployments).map(([n, d]) => { const ok = podsOf(n).filter(p => p.status === 'Running').length; return `${n.padEnd(9)} ${ok}/${d.replicas}`.padEnd(18) + ` ${d.replicas}            ${ok}`; }).join('\n');
      if (['nodes', 'node', 'no'].includes(kind)) return 'NAME                          STATUS   ROLES    VERSION\n' + Array.from({ length: K.nodes }, (_, i) => `ip-10-0-${i + 1}-17.ec2.internal  Ready    <none>   v1.31`).join('\n');
      if (kind === 'hpa') return 'NAME   REFERENCE        TARGETS   MINPODS   MAXPODS\n' + Object.entries(K.hpas).map(([n, h]) => `${n.padEnd(6)} Deployment/${n}   30%/${h.cpu}%    ${h.min}        ${h.max}`).join('\n') || 'No resources found.';
      if (['svc', 'service', 'services'].includes(kind)) return 'NAME   TYPE           CLUSTER-IP     EXTERNAL-IP\nweb    LoadBalancer   172.20.14.9    a1b2c3.elb.amazonaws.com';
      return `error: the server doesn't have a resource type "${kind}"`;
    }
    case 'describe': {
      const p = allPods().find(x => x.name === name || x.name.startsWith(name || '~'));
      if (!p) return `Error from server (NotFound): pods "${name}" not found`;
      w.flags.described = true;
      const dep = K.deployments[p.dep];
      let ev = '  Normal  Scheduled  Successfully assigned to node';
      if (p.status === 'Pending') ev = `  Warning  FailedScheduling  0/${K.nodes} nodes are available: ${K.nodes} Insufficient cpu.`;
      if (p.status === 'CrashLoopBackOff') ev = '  Warning  BackOff  Back-off restarting failed container';
      return `Name: ${p.name}\nStatus: ${p.status}\nContainers:\n  app:\n    Image: ${dep.image}\n    Requests: cpu: ${dep.cpuReq * 1000}m\nEvents:\n${ev}`;
    }
    case 'logs': {
      const p = allPods().find(x => x.name === kind || x.name.startsWith(kind || '~'));
      if (!p) return `error: pod "${kind}" not found`;
      w.flags.readLogs = true;
      return K.deployments[p.dep].crash ? 'Starting server v2.0.0...\nTypeError: Cannot read properties of undefined (reading \'DATABASE_URL\')\n    at loadConfig (/app/config.js:12)' : 'listening on :8080';
    }
    case 'scale': {
      const d = deployName(kind === 'deployment' || kind === 'deploy' ? name : kind);
      const r = opt(a, '--replicas');
      if (!K.deployments[d]) return `Error from server (NotFound): deployments.apps "${d}" not found`;
      if (!r) return 'error: --replicas is required';
      K.deployments[d].replicas = +r; return `deployment.apps/${d} scaled`;
    }
    case 'autoscale': {
      const d = deployName(kind === 'deployment' || kind === 'deploy' ? name : kind);
      if (!K.deployments[d]) return `Error from server (NotFound): deployments.apps "${d}" not found`;
      K.hpas[d] = { min: +(opt(a, '--min') || 1), max: +(opt(a, '--max') || 10), cpu: +(opt(a, '--cpu-percent') || 80) };
      return `horizontalpodautoscaler.autoscaling/${d} autoscaled`;
    }
    case 'rollout': {
      const d = deployName(name);
      const dep = K.deployments[d];
      if (!dep) return `Error from server (NotFound): deployments.apps "${d}" not found`;
      if (kind === 'status') return dep.crash ? `Waiting for deployment "${d}" rollout to finish: 0 of ${dep.replicas} updated replicas are available...` : `deployment "${d}" successfully rolled out`;
      if (kind === 'history') return 'REVISION  CHANGE-CAUSE\n' + dep.revisions.map((r, i) => `${i + 1}         ${r}`).join('\n');
      if (kind === 'undo') {
        if (dep.revisions.length < 2) return 'error: no rollout history found';
        dep.revisions.pop(); dep.image = dep.revisions[dep.revisions.length - 1].split(' ').pop(); dep.crash = false; dep.hash = sha().slice(0, 5);
        w.flags.rolledBack = true; return `deployment.apps/${d} rolled back`;
      }
      return 'usage: kubectl rollout status|history|undo deployment/<name>';
    }
    case 'set': {
      if (kind === 'image') {
        const d = deployName(name); const dep = K.deployments[d]; const spec = a[3] || '';
        if (!dep) return `deployments.apps "${d}" not found`;
        const img = spec.split('=')[1]; if (!img) return 'usage: kubectl set image deployment/<d> <container>=<image>';
        dep.image = img; dep.revisions.push(`set image ${img}`); dep.crash = /v2\.0\.0/.test(img); dep.hash = sha().slice(0, 5);
        return `deployment.apps/${d} image updated`;
      }
      if (kind === 'resources') {
        const d = deployName(name); const dep = K.deployments[d];
        if (!dep) return `deployments.apps "${d}" not found`;
        const req = opt(a, '--requests'); const m = (req || '').match(/cpu=(\d+)(m?)/);
        if (!m) return 'usage: kubectl set resources deployment/<d> --requests=cpu=500m';
        dep.cpuReq = m[2] ? +m[1] / 1000 : +m[1]; dep.hash = sha().slice(0, 5);
        return `deployment.apps/${d} resource requirements updated`;
      }
      return 'error: unknown set subcommand';
    }
    case 'delete': if (kind === 'pod') return `pod "${name}" deleted (the Deployment will recreate it)`; return 'error: be careful what you delete';
    case 'top': return 'NAME                CPU(cores)   MEMORY\n' + allPods().slice(0, 5).map(p => `${p.name.slice(0, 18).padEnd(19)} ${p.status === 'Running' ? '212m' : '0m'}         180Mi`).join('\n');
    case 'apply': return a.includes('-f') ? 'configured' : 'error: must specify -f';
    case 'config': return 'CURRENT   NAME\n*         prod-eks';
    default: return `error: unknown command "${verb}" for "kubectl"`;
  }
}

function gh(w, a) {
  const [g, sub, id] = a;
  if (g === 'run' && sub === 'list') return 'STATUS  TITLE              WORKFLOW  ID\n' + w.gh.runs.map(r => `${r.ok ? '✓' : 'X'}       ${r.title.padEnd(18)} deploy    ${r.id}`).join('\n');
  if (g === 'run' && sub === 'view') { const r = w.gh.runs.find(x => String(x.id) === id) || w.gh.runs[w.gh.runs.length - 1]; return r ? r.log : 'no runs'; }
  if (g === 'run' && sub === 'rerun') {
    const ok = w.flags.ciCheck ? w.flags.ciCheck(w) : true;
    const r = { id: 1000 + w.gh.runs.length, title: 'deploy (rerun)', ok, log: ok ? '✓ Configure AWS credentials (OIDC)\n✓ terraform apply\n✓ Deploy' : w.gh.runs[w.gh.runs.length - 1]?.log };
    w.gh.runs.push(r); if (ok) w.flags.ciGreen = true;
    return ok ? `✓ Run ${r.id} succeeded` : `X Run ${r.id} failed — gh run view ${r.id}`;
  }
  if (g === 'secret' && sub === 'set') { w.gh.secrets.push(id); return `✓ Set secret ${id}`; }
  if (g === 'pr' && sub === 'create') { w.flags.prOpened = true; return 'https://github.com/you/project/pull/42'; }
  if (g === 'pr' && sub === 'merge') { if (!w.flags.prOpened) return 'no open pull request'; w.flags.prMerged = true; return '✓ Merged pull request #42'; }
  return 'usage: gh run list|view|rerun, gh secret set, gh pr create|merge';
}

function aws(w, a) {
  const s = a.join(' ');
  if (s.startsWith('sts get-caller-identity')) { w.flags.whoami = true; return JSON.stringify({ UserId: 'AROAEXAMPLE:you', Account: '111122223333', Arn: 'arn:aws:sts::111122223333:assumed-role/PlatformEngineer/you' }, null, 2); }
  if (s.startsWith('s3 ls')) return '2026-01-04 logs-bucket-prod\n2026-02-11 ledger-data\n2026-03-30 tfstate-prod';
  if (s.startsWith('ec2 describe-instances')) return '{ "Reservations": [ { "Instances": [ { "InstanceId": "i-0abc", "State": { "Name": "running" } } ] } ] }';
  return 'aws: this sim supports sts get-caller-identity, s3 ls, ec2 describe-instances';
}

// ═══════════════════════ CHALLENGES ═══════════════════════
export const CHALLENGES = {
  git_basics: {
    title: 'Ship a README fix the right way', domain: 'ops',
    intro: 'The README says "Run npm star". Fix it on a feature branch, merge into main, and push main.',
    setup(w) { w.git.init = true; w.files['README.md'] = 'Run npm star\n'; gitCommit(w, 'initial commit', { 'README.md': w.files['README.md'] }); },
    objectives: [
      { text: 'Create and switch to a branch named feature/*', check: w => w.git.head.startsWith('feature/') || Object.keys(w.git.branches).some(b => b.startsWith('feature/')) },
      { text: 'Fix README.md ("npm star" → "npm start")', check: w => /npm start/.test(w.files['README.md']) },
      { text: 'Commit the fix on the feature branch', check: w => Object.entries(w.git.branches).some(([b, cs]) => b.startsWith('feature/') && cs.some(c => /npm start/.test(c.files['README.md'] || ''))) },
      { text: 'Merge it into main', check: w => (w.git.branches.main || []).some(c => /npm start/.test(c.files['README.md'] || '')) },
      { text: 'Push main', check: w => (w.git.remote.main || []).some(c => /npm start/.test(c.files['README.md'] || '')) },
    ],
    hints: ['git checkout -b feature/readme', "sed -i 's/npm star/npm start/' README.md", 'git add README.md && git commit -m "fix readme"', 'git checkout main → git merge feature/readme → git push origin main'],
  },
  git_hotfix: {
    title: 'Production is down after the last merge', domain: 'ops',
    intro: 'Someone pushed "feat: new pricing" to main and checkout is throwing 500s. Undo it SAFELY on the shared main branch and push. Do not rewrite history.',
    setup(w) {
      w.git.init = true;
      w.files['pricing.js'] = 'export const tax = 0.08;\n'; gitCommit(w, 'initial pricing', { 'pricing.js': w.files['pricing.js'] });
      w.files['pricing.js'] = 'export const tax = undefined.rate;\n'; const bad = gitCommit(w, 'feat: new pricing', { 'pricing.js': w.files['pricing.js'] });
      w.flags.badSha = bad.sha; w.git.remote.main = w.git.branches.main.slice();
    },
    objectives: [
      { text: 'Find the bad commit (git log)', check: w => w.history.some(h => h.startsWith('git log')) },
      { text: 'Revert it with a new commit (git revert)', check: w => (w.flags.reverted || []).includes(w.flags.badSha) },
      { text: 'Push main', check: w => (w.git.remote.main || []).some(c => c.msg.startsWith('Revert')) },
      { text: 'Don\'t force-push shared history', check: w => !w.flags.forcePushed, passive: true },
    ],
    hints: ['git log --oneline', 'git revert <sha of "feat: new pricing">', 'git push origin main'],
  },
  ci_secret: {
    title: 'Pipeline red: no more stored keys', domain: 'ops',
    intro: 'The deploy workflow fails: the AWS_KEY secret was revoked after a leak. Security says: no long-lived keys. Switch the workflow to OIDC (role-to-assume), commit, push, rerun.',
    setup(w) {
      w.git.init = true;
      w.files['deploy.yml'] = 'permissions:\n  contents: read\nsteps:\n  - uses: aws-actions/configure-aws-credentials@v4\n    with:\n      aws-access-key-id: ${{ secrets.AWS_KEY }}\n      aws-region: us-east-1\n';
      gitCommit(w, 'ci: deploy workflow', { 'deploy.yml': w.files['deploy.yml'] });
      w.gh.runs.push({ id: 991, title: 'deploy', ok: false, log: 'X Configure AWS credentials\n  Error: The security token included in the request is invalid.' });
      w.flags.ciCheck = w2 => /role-to-assume/.test((w2.git.committedFiles.main || {})['deploy.yml'] || '') && /id-token: write/.test((w2.git.committedFiles.main || {})['deploy.yml'] || '') && (w2.flags.pushed || []).includes('main') && !/aws-access-key-id/.test((w2.git.committedFiles.main || {})['deploy.yml'] || '');
    },
    objectives: [
      { text: 'Inspect the failure (gh run view)', check: w => w.history.some(h => h.startsWith('gh run view')) },
      { text: 'Replace the key with role-to-assume: arn:aws:iam::111122223333:role/gha-deploy', check: w => /role-to-assume/.test(w.files['deploy.yml']) && !/aws-access-key-id/.test(w.files['deploy.yml']) },
      { text: 'Grant the OIDC token permission (id-token: write)', check: w => /id-token: write/.test(w.files['deploy.yml']) },
      { text: 'Commit and push to main', check: w => (w.flags.pushed || []).includes('main') && /role-to-assume/.test((w.git.committedFiles.main || {})['deploy.yml'] || '') },
      { text: 'Rerun the pipeline green', check: w => !!w.flags.ciGreen },
    ],
    hints: ['gh run view 991', "sed -i 's|aws-access-key-id: ${{ secrets.AWS_KEY }}|role-to-assume: arn:aws:iam::111122223333:role/gha-deploy|' deploy.yml   (| as delimiter because the ARN contains /)", "sed -i 's|contents: read|contents: read\\n  id-token: write|' deploy.yml", 'git commit -am "ci: oidc" → git push origin main → gh run rerun 991'],
  },
  tf_basics: {
    title: 'Your first terraform apply', domain: 'ops',
    intro: 'main.tf declares an encrypted S3 bucket and a VPC. Initialize, review the plan, and apply.',
    setup(w) { w.files['main.tf'] = 'resource "aws_s3_bucket" "assets" { bucket = "acme-assets" }\nresource "aws_vpc" "main" { cidr_block = "10.0.0.0/16" }\n'; w.tf.desired = { 'aws_s3_bucket.assets': { bucket: 'acme-assets', encrypted: true }, 'aws_vpc.main': { cidr_block: '10.0.0.0/16' } }; },
    objectives: [
      { text: 'terraform init', check: w => w.tf.init },
      { text: 'terraform plan (always read it)', check: w => w.tf.planned },
      { text: 'terraform apply', check: w => w.tf.applied && 'aws_vpc.main' in w.tf.state },
      { text: 'Confirm with terraform state list', check: w => w.history.some(h => /terraform state list/.test(h)) },
    ],
    hints: ['terraform init', 'terraform plan', 'terraform apply -auto-approve', 'terraform state list'],
  },
  tf_drift: {
    title: 'Drift, locks and an orphan bucket', domain: 'ops',
    intro: 'Someone opened port 22 to the world in the console. A crashed CI job left the state locked. And logs-bucket-prod exists but Terraform doesn\'t manage it. Fix all three.',
    setup(w) {
      w.tf.init = true;
      w.tf.desired = { 'aws_security_group.web': { ingress: ['443 from 0.0.0.0/0'] }, 'aws_s3_bucket.logs': { bucket: 'logs-bucket-prod' } };
      w.tf.state = { 'aws_security_group.web': { ingress: ['443 from 0.0.0.0/0', '22 from 0.0.0.0/0'] } };
      w.tf.drift = { 'aws_security_group.web': true }; w.flags.driftHappened = true; w.flags.importId = 'logs-bucket-prod';
      w.tf.lockedBy = 'ci-runner-7 (crashed 2h ago) · ID 4f1c-9a';
      w.files['main.tf'] = 'resource "aws_security_group" "web" { ingress 443 }\nresource "aws_s3_bucket" "logs" { bucket = "logs-bucket-prod" }\n';
    },
    objectives: [
      { text: 'See the drift with terraform plan', check: w => w.tf.planned },
      { text: 'Release the stale lock (terraform force-unlock <ID>)', check: w => !!w.flags.unlocked },
      { text: 'Import the existing bucket (terraform import aws_s3_bucket.logs logs-bucket-prod)', check: w => w.tf.imported.includes('aws_s3_bucket.logs') },
      { text: 'Apply to revert the console change', check: w => w.flags.driftFixed && !JSON.stringify(w.tf.state).includes('22 from') },
    ],
    hints: ['terraform plan', 'terraform force-unlock 4f1c-9a', 'terraform import aws_s3_bucket.logs logs-bucket-prod', 'terraform apply -auto-approve'],
  },
  k8s_scale: {
    title: 'Black Friday prep', domain: 'compute',
    intro: 'Marketing just told you about the sale. Scale deployment "web" to 10 replicas now, and add an HPA (min 10, max 50, 60% CPU) so it handles the rest itself.',
    setup(w) { w.k8s.deployments.web = { replicas: 3, image: 'shop/web:v1.4.2', revisions: ['initial shop/web:v1.4.2'], hash: 'a8f2c', cpuReq: 0.25 }; w.k8s.nodes = 4; },
    objectives: [
      { text: 'Check current state (kubectl get deploy)', check: w => w.history.some(h => /kubectl get (deploy|deployment)/.test(h)) },
      { text: 'Scale web to 10 replicas', check: w => w.k8s.deployments.web.replicas >= 10 },
      { text: 'Create an HPA: min 10, max 50, cpu 60%', check: w => { const h = w.k8s.hpas.web; return h && h.min >= 10 && h.max >= 50 && h.cpu <= 70; } },
    ],
    hints: ['kubectl get deploy', 'kubectl scale deployment web --replicas=10', 'kubectl autoscale deployment web --min=10 --max=50 --cpu-percent=60'],
  },
  k8s_rollback: {
    title: 'CrashLoopBackOff at 3 a.m.', domain: 'compute',
    intro: 'Pager: web is down after a deploy. Find out why, roll back, confirm.',
    setup(w) { w.k8s.deployments.web = { replicas: 3, image: 'shop/web:v2.0.0', revisions: ['initial shop/web:v1.9.3', 'set image shop/web:v2.0.0'], hash: 'c0ffe', crash: true, cpuReq: 0.25 }; },
    objectives: [
      { text: 'Look at the pods', check: w => w.history.some(h => /kubectl get (pods|po)/.test(h)) },
      { text: 'Read the crashing container\'s logs', check: w => !!w.flags.readLogs },
      { text: 'Roll back the deployment', check: w => !!w.flags.rolledBack },
      { text: 'Verify the rollout', check: w => w.flags.rolledBack && w.history.some(h => /rollout status/.test(h)) },
    ],
    hints: ['kubectl get pods', 'kubectl logs <pod-name>', 'kubectl rollout undo deployment/web', 'kubectl rollout status deployment/web'],
  },
  k8s_debug: {
    title: 'Pending forever', domain: 'compute',
    intro: 'New "api" pods never start. Diagnose and fix without buying more nodes.',
    setup(w) { w.k8s.deployments.api = { replicas: 6, image: 'acme/api:3.1', revisions: ['initial acme/api:3.1'], hash: 'beef1', cpuReq: 4 }; w.k8s.nodes = 3; w.k8s.nodeCpu = 4; },
    objectives: [
      { text: 'Describe a Pending pod', check: w => !!w.flags.described },
      { text: 'Right-size the CPU request (≤ 1 CPU)', check: w => w.k8s.deployments.api.cpuReq <= 1 },
      { text: 'All 6 pods Running', check: w => { const d = w.k8s.deployments.api; return Math.floor((w.k8s.nodes * w.k8s.nodeCpu * 0.9) / d.cpuReq) >= d.replicas; } },
    ],
    hints: ['kubectl get pods → kubectl describe pod <pending-pod>', 'Requests of 4 CPU on 4-CPU nodes never fit.', 'kubectl set resources deployment/api --requests=cpu=500m'],
  },
};
CHALLENGES.git_hotfix.objectives[3].passive = true;
