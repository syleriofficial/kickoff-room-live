# GitHub Push Steps

## Option A: GitHub Website

1. Go to https://github.com/new
2. Repository name: `kickoff-room-live`
3. Visibility: Private first, Public later
4. Do not add README, gitignore, or license on GitHub because they already exist locally.
5. Create repository.

## Local Commands

Run these from this project folder:

```bash
git init
git add .
git commit -m "Initial kickoff room live kit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kickoff-room-live.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

## Safety Check Before Push

```bash
git status --short
git diff --cached --stat
```

Make sure no `.env`, token, client secret, or credential file appears.
