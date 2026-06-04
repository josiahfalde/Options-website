# Deploying Flywheel

## Today — one command (works now, no setup)

```bash
npm run deploy
```

This builds the app and pushes `dist/` to the `gh-pages` branch, which GitHub
Pages serves at:

> https://josiahfalde.github.io/Options-website/

## Optional upgrade — auto-deploy on every push

Right now the live site updates only when you run `npm run deploy`. To make every
`git push` to `main` rebuild and publish automatically, enable the GitHub Actions
workflow:

1. Grant your CLI the `workflow` permission (one time):
   ```bash
   gh auth refresh -h github.com -s workflow
   ```
   (Follow the browser/device prompt — this only needs to happen once.)

2. Move the staged workflow into place and push it:
   ```bash
   mkdir -p .github/workflows
   git mv docs/deploy.workflow.yml .github/workflows/deploy.yml
   git commit -m "Enable Pages auto-deploy via Actions"
   git push
   ```

3. In the repo: **Settings → Pages → Source → GitHub Actions**.

After that, pushing to `main` deploys automatically and you can stop using
`npm run deploy`.
