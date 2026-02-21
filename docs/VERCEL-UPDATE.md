# Vercel deploy + update runbook

## 1) One-time setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run backend and frontend in separate terminals:
   - Terminal A:
     ```bash
     npm run api
     ```
   - Terminal B:
     ```bash
     npm run dev
     ```
3. Verify:
   - Frontend: http://localhost:3000
   - API health check (example): http://localhost:3000/api/games?username=test&platform=chess.com&count=1

## 2) Push to GitHub

```bash
git add .
git commit -m "feat: production-ready Vercel API routing"
git push origin <your-branch>
```

If this is first push for a new repo:

```bash
git remote add origin https://github.com/<your-user>/<your-repo>.git
git branch -M main
git push -u origin main
```

## 3) Connect repo to Vercel (first deploy)

1. In Vercel, click **Add New Project**.
2. Import your GitHub repository.
3. Keep default framework detection (Vite).
4. Deploy.

The project includes:
- `vercel.json` for build output and Node runtime.
- `api/[...route].js` so all `/api/*` requests are served by the backend.

## 4) Update the currently running Vercel app

For every change:

```bash
git add .
git commit -m "<what changed>"
git push origin main
```

Vercel auto-builds and auto-promotes the new deployment for `main`.

### Recommended production flow

- Use Pull Requests for all changes.
- Let Vercel create a **Preview Deployment** per PR.
- Verify preview URL.
- Merge to `main` only after checks pass.
- Roll back quickly from Vercel dashboard if needed (**Deployments → Promote previous**).

## 5) Environment variables

Set these in Vercel Project Settings → Environment Variables (if used):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL` (optional; leave unset to use same-origin `/api`)

After updating environment variables, trigger a redeploy from Vercel dashboard.
