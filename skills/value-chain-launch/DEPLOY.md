# Deploying this skill

`~/.claude` is not version controlled, so this repo is the source of truth and the skills
directory is a deployed copy. **After every edit, re-run:**

```powershell
$src = "c:\Users\user\Desktop\ailos-agentic system\skills\value-chain-launch"
$dst = "C:\Users\user\.claude\skills\value-chain-launch"
if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
Copy-Item -Recurse -Force $src $dst
Remove-Item -Recurse -Force "$dst\tests"
```

Editing the deployed copy directly loses the change on the next deploy.
