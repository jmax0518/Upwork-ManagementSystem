# Upwork Management (Next.js)

Simple Next.js platform for the Chrome extension API and a minimal job inbox UI.

## Run locally

```bash
npm install
npm run dev
```

- App & dashboard preview: [http://localhost:3847](http://localhost:3847)
- Health check: `GET /api/health`
- Extension endpoint: `POST /api/jobs` (same URL as before)

Optional API auth (extension popup → API key):

```bash
set API_KEY=your-secret
npm run dev
```

### ixBrowser: ngrok tunnel

Your snippet should forward **port 3847** (Next.js), not 8085. This repo includes a tunnel script:

**Terminal 1:** `npm run dev`  
**Terminal 2:**

```powershell
set NGROK_AUTHTOKEN=your_token_from_ngrok_dashboard
npm run tunnel
# same as: node index.js  (with NGROK_AUTHTOKEN set)
```

Extension popup:

- **Server base URL:** `https://yanking-bullish-negligent.ngrok-free.dev`
- **API path:** `/api/jobs`
- **Save settings** → **Allow** → **Test connection**

## API (extension-compatible)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/jobs` | List jobs (Bearer token if `API_KEY` set) |
| `POST` | `/api/jobs` | Upsert job from extension |
| `PATCH` | `/api/jobs/:upworkJobId/status` | Update pipeline status |

Jobs are stored in `data/jobs.json` until you move to a database.

## Project layout

```
app/                 # Pages + Route Handlers
src/lib/             # Job store, auth helpers
src/types/           # Shared TypeScript types
src/components/      # UI building blocks
```

The full dashboard workflow (bidding, interviews, outcomes) will build on these types and routes.
