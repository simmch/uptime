import { newWorld, run, CHALLENGES } from '../src/data/terminal.js';
for (const [id, ch] of Object.entries(CHALLENGES)) {
  const w = newWorld(); ch.setup(w);
  const sol = {
    git_basics: ['git checkout -b feature/readme', "sed -i 's/npm star/npm start/' README.md", 'git add README.md', 'git commit -m "fix readme"', 'git checkout main', 'git merge feature/readme', 'git push origin main'],
    git_hotfix: ['git log --oneline', `git revert ${w.flags.badSha}`, 'git push origin main'],
    ci_secret: ['gh run view 991', "sed -i 's|aws-access-key-id: ${{ secrets.AWS_KEY }}|role-to-assume: arn:aws:iam::111122223333:role/gha-deploy|' deploy.yml", "sed -i 's|contents: read|contents: read\\n  id-token: write|' deploy.yml", 'git commit -am "ci: oidc"', 'git push origin main', 'gh run rerun 991'],
    tf_basics: ['terraform init', 'terraform plan', 'terraform apply -auto-approve', 'terraform state list'],
    tf_drift: ['terraform plan', 'terraform force-unlock 4f1c-9a', 'terraform import aws_s3_bucket.logs logs-bucket-prod', 'terraform apply -auto-approve'],
    k8s_scale: ['kubectl get deploy', 'kubectl scale deployment web --replicas=10', 'kubectl autoscale deployment web --min=10 --max=50 --cpu-percent=60'],
    k8s_rollback: ['kubectl get pods', 'kubectl logs web-c0ffe-xxxx0', 'kubectl rollout undo deployment/web', 'kubectl rollout status deployment/web'],
    k8s_debug: ['kubectl get pods', 'kubectl describe pod api', 'kubectl set resources deployment/api --requests=cpu=500m'],
  }[id];
  let last='';
  for (const c of sol) last = run(w, c);
  const res = ch.objectives.map(o => o.check(w));
  console.log(id, res.every(Boolean) ? 'PASS' : 'FAIL', res.join(','), res.every(Boolean)?'':last);
}
