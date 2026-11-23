---
name: commit-push
description: Commit the current project changes and push them to GitHub. Use only when the user explicitly invokes /commit-push.
disable-model-invocation: true
---

# Commit and push to GitHub

Invoking this command is explicit permission to commit and push. Do both. Do not ask for confirmation first.

Remote: `origin` → `https://github.com/simmch/uptime.git`. Push the current branch. Do not change the remote or git config.

## Safety

- Do not update git config.
- Do not skip hooks (`--no-verify`, `--no-gpg-sign`).
- Do not force-push, hard-reset, or otherwise rewrite history.
- Do not commit secrets (`.env`, credentials, keys). If the user has staged one, leave it unstaged and say so.
- Do not commit `node_modules`, `dist`, or other files ignored by `.gitignore`.
- If there is nothing to commit, do not create an empty commit. Push only when the branch is ahead of the remote.
- If the commit fails or a hook rejects it, fix the problem and make a new commit. Do not amend.

## Steps

1. In parallel, run `git status`, `git diff` (staged and unstaged), and `git log -8 --oneline`.
2. Stage the relevant changes, including new source files. Leave secrets and ignored build artifacts unstaged.
3. Write a 1–2 sentence message that matches recent commit style and states why the change exists. Pass it with a heredoc:

```bash
git commit -m "$(cat <<'EOF'
Commit message here.

EOF
)"
```

4. Run `git status` to confirm the commit succeeded.
5. Push: `git push -u origin HEAD`.
6. Reply with the commit hash, the GitHub commit URL (`https://github.com/simmch/uptime/commit/<hash>`), and whether the push succeeded.
