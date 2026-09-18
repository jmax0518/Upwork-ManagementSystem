# Upwork Job Summarizer (Chrome Extension)

Chrome extension for Upwork freelancers: click **Summary** on any job detail view to extract structured job data, build a short summary, and `POST` it to your management server (for search → bid → interview → outcome tracking).

## Install (development)

1. Build the content script (required after changing `src/`):

   ```bash
   cd extension
   npm install
   npm run build
   ```

2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select this `extension` folder
5. After code changes, run `npm run build` and click **Reload** on the extension

### ixBrowser (or another machine/profile)

`127.0.0.1` inside ixBrowser points at **that profile’s environment**, not your PC. Use the URL that actually reaches your Next.js host, for example:

`http://192.168.132.62:3847` (your PC’s LAN IP from `npm run dev`)

1. On your PC: `cd web && npm run dev` (listens on all interfaces).
2. In ixBrowser, open the extension popup → set **Server base URL** to that LAN/public URL.
3. Click **Save settings** → Chrome/ixBrowser asks to **Allow** access to that host → approve.
4. Click **Test connection**, then **Summary** on Upwork.

Allow Windows Firewall for port **3847** if the test fails from ixBrowser but works on the PC browser.

**HTTP 503 on Test connection:** Usually the request never reaches Next.js. If the ixBrowser profile uses a **proxy/VPN**, traffic to `192.168.x.x` often hits the proxy and returns 503 (private IPs are not reachable from a remote proxy). Fix: turn off proxy for that profile, add LAN bypass, or expose the dashboard with a tunnel, e.g. `ngrok http 3847`, and set Server URL to the `https://….ngrok-free.app` URL (then Save + Allow).
4. Open the extension popup and set your server URL (default: `http://localhost:3847`, path `/api/jobs`)

## Use on Upwork

Supported pages:

- Job search (`/nx/search/jobs`)
- Find work / best matches (`/nx/find-work/...`)
- Direct job URL (`/jobs/~...`)
- Apply URL (`/freelance-jobs/apply/...`)

Open a job so the detail panel (or full job page) is visible, then click the floating **Summary** button.

The extension asks for host permission the first time it calls a non-localhost server URL.

## Next.js platform (API + simple UI)

The main server lives in `../web`:

```bash
cd ../web
npm install
npm run dev
```

Open [http://localhost:3847](http://localhost:3847) for the job inbox.

Optional auth:

```bash
set API_KEY=your-secret
npm run dev
```

Set the same value in the extension popup **API key** field.

## POST payload contract

`POST /api/jobs` with `Content-Type: application/json`.

| Field | Description |
| --- | --- |
| `source` | `"upwork-job-summarizer-extension"` |
| `extensionVersion` | Extension version string |
| `capturedAt` | ISO timestamp |
| `upworkJobId` | e.g. `"~021883994784056195740"` |
| `url` | Canonical job URL |
| `pipelineStatus` | Initial `"new"` — your dashboard updates this |
| `summary` | Human-readable short summary (client-side) |
| `job` | Title, description, budget, skills, activity, screening questions, etc. |
| `client` | Structured client stats parsed from the job page |

Suggested pipeline statuses for your dashboard:

`new` → `reviewing` → `bid_planned` → `bid_sent` → `interview` → `won` | `lost` | `passed`

Update status via the example server:

`PATCH /api/jobs/:upworkJobId/status` with body `{ "pipelineStatus": "bid_sent", "notes": "..." }`.

## Project layout

```
extension/
  manifest.json
  popup/           # Server URL & API key settings
  src/content/     # Summary button + scrape trigger
  src/background/  # POST to your server
  src/lib/         # DOM extraction, summary, payload builder
server/            # Optional starter API for your dashboard
```

## Notes

- Extraction reads visible DOM only (no Upwork API). Upwork UI changes may require selector updates in `src/lib/extractJob.js`.
- For AI summaries, run an LLM on your server using `job.description` and replace or extend the `summary` field before saving to your database.
