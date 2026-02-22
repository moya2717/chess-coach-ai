# Dashboard Troubleshooting Guide

Use this checklist when the ChessCoach dashboard does not load, shows empty data, or reports engine/API issues.

## 1) Start both required processes

The dashboard depends on both the frontend and backend.

```bash
# Terminal 1
npm run api

# Terminal 2
npm run dev
```

Expected:
- API server running on `http://localhost:3001`
- Vite app running on `http://localhost:3000`

If either process is down, the dashboard will show fetch errors or partial data.

## 2) Verify health and API routes

Confirm the API process responds before testing in browser.

```bash
curl -sS http://localhost:3001/health
curl -sS "http://localhost:3001/api/chesscom/recent?username=erik&limit=1"
```

If `/health` fails, fix backend startup first (Node version, install, port conflict).

## 3) Check environment variables

For local development, keep frontend requests on the same origin through Vite proxy (default setup). For custom deployments, set:

```bash
VITE_API_BASE_URL=https://your-api-domain.example
```

If this is wrong, dashboard calls fail even when UI loads.

## 4) Validate usernames and filters

Dashboard cards remain empty when no games are returned. Confirm:
- Chess.com/Lichess usernames are correct
- Time window isn't too narrow
- Player has recent games with accessible PGNs

## 5) Understand analysis behavior

The app loads games first, then analysis is done on demand or with **Re-run Engine Analysis**.

If engine analysis fails, the app intentionally falls back to material-based analysis so the dashboard still works with limited depth.

## 6) Diagnose using browser DevTools

Open Network tab and check failed requests:
- `4xx`: bad usernames or route params
- `5xx`: backend/provider error
- `CORS`/`ERR_CONNECTION_REFUSED`: base URL/proxy/server startup issue

Console warnings from `startAnalysis` also indicate whether Chess.com or Lichess fetch failed independently.

## 7) Known production checks

Before sharing the app, validate:

1. Backend is reachable from frontend host.
2. `/api/*` routes are not blocked by platform rewrites.
3. Timeout budget is sufficient for provider + analysis calls.
4. Rate limiting is handled gracefully (retry or user messaging).

## 8) Quick reset procedure

When state seems stuck:

1. Stop both servers.
2. Run `npm install` again.
3. Restart `npm run api` and `npm run dev`.
4. Hard-refresh browser (`Ctrl+Shift+R` / `Cmd+Shift+R`).

This resolves most local caching and stale build issues.


## 9) Validation checklist (required)

Run these concrete validations before production rollout:

1. **Backend reachable from frontend host**
   - Local: verify Vite proxy sends `/api/*` to `http://localhost:3001`.
   - Production: verify frontend host can reach `/api/health` and gets `{ ok: true }`.

2. **`/api/*` routes not blocked by platform rewrites**
   - Ensure hosting config preserves `/api/(.*)` before SPA fallback rewrite.
   - Confirm a non-existent API route returns JSON 404 from backend (not HTML index page).

3. **Timeout budget sufficient for provider + analysis calls**
   - Keep client request timeout >= 45s for game fetch and >= 120s for deep analysis runs.
   - Validate with a real user that has large archives and slow provider responses.

4. **Rate limiting handled gracefully**
   - Confirm 429/503 responses show retry guidance in UI (e.g., wait 30–60 seconds).
   - Confirm backend retries transient upstream failures and marks retryable errors correctly.
