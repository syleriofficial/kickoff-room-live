# GitHub Actions

This repo includes a workflow:

`.github/workflows/stream-pack.yml`

It runs on:

- push to `main`
- pull requests to `main`
- manual `workflow_dispatch`

## What It Checks

- Node syntax for the stream pack generator
- Node syntax for overlay/config scripts
- Regenerates the stream pack
- Verifies generated files are committed

## If It Fails

Run locally:

```bash
node tools/generate-stream-pack.mjs
git status --short
```

If generated files changed:

```bash
git add outputs/generated-stream-pack
git commit -m "Regenerate stream pack"
git push
```
