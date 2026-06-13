# GitHub Pages Setup

Use GitHub Pages to open the command kit from a browser without digging through files.

## Enable Pages With GitHub Actions

Recommended:

1. Open the GitHub repository.
2. Go to `Settings`.
3. Go to `Pages`.
4. Source: `GitHub Actions`.
5. Save.

The workflow `.github/workflows/pages.yml` deploys the site after each push to `main`.

## Alternative: Enable Pages From Branch

1. Open the GitHub repository.
2. Go to `Settings`.
3. Go to `Pages`.
4. Source: `Deploy from a branch`.
5. Branch: `main`.
6. Folder: `/root`.
7. Save.

## URL

After GitHub builds the site, the launcher should be available at:

`https://syleriofficial.github.io/kickoff-room-live/`

## Start Page

The site opens `index.html`, which links to:

- Command Center
- Producer Panel
- OBS Overlay
- Thumbnail Template
- Channel Setup
- Automation Plan

## Note

For OBS, local files are often more reliable than GitHub Pages if browser audio/TTS permissions are inconsistent. Use GitHub Pages for planning and copying stream text; use local files in OBS if needed.
