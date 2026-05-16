# LucidFlex Tracker

## Local development

```bash
# Terminal 1 — backend
npm install
node server.js

# Terminal 2 — frontend
cd client
npm install
npm run dev
# opens at http://localhost:5173
```

## Deploy to Railway

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/YOUR/REPO
git push -u origin main
```

### 2. Create Railway project
- Go to railway.app → New Project → Deploy from GitHub repo
- Select your repo

### 3. Set environment variables
In Railway → your service → Variables, add:

| Key        | Value       |
|------------|-------------|
| USER1_NAME | Alex        |
| USER1_PASS | your-pin    |
| USER2_NAME | Jordan      |
| USER2_PASS | your-pin    |

### 4. Add a Volume (so data survives redeploys)
- Railway → your service → Volumes → Add Volume
- Mount path: `/data`
- Then add this variable: `DATA_PATH=/data/db.json`

That's it. Railway auto-detects `railway.toml` and builds + deploys.

## Default passcodes (change in Railway env vars!)
- User 1: `1111`
- User 2: `2222`
