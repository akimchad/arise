# Arise — Your business. Everywhere.

Paste a website, Google Maps link or Instagram profile (or upload a few photos). Arise learns the brand, checks the calendar and what's trending this week, pitches campaign ideas only that business could post, and renders the posts, stories, reels, ad banners, flyers and wallpapers — ready to download or share.

Built for the Claude Code × Emergent hackathon.

- **Arise's brand reader** pulls the name, business type, signature items, neighborhood and a palette (from the site's CSS and its own photos) out of a website, Maps listing, Instagram profile or uploaded photos.
- **Arise's campaign playbook** matches the business to this week's moments (holidays, food days, seasons) and formats that perform for local businesses.
- **Higgsfield** does the creative work: **GPT Image 2.5 Sunburst** renders every format from Arise's brief (with the business's real photos as references) and **Wan 3.0** animates the story into a 5-second reel. Ads Studio is available as an alternative engine (`HF_IMAGE_ENGINE=ads`).
- Optional: set `ANTHROPIC_API_KEY` and Claude takes over brand analysis and ideation with live trend research.
- **Emergent-style stack**: React frontend + FastAPI backend + MongoDB, everything under `/api`.

## How it works

```
link / photos ──► scrape (site, Maps, Instagram; SSRF-guarded, respects bot walls)
              ──► brand profile: type, signature items, location, palette from photos  (editable)
              ──► playbook: calendar moments + active seasons + evergreen formats ──► 5 campaign ideas
pick an idea ──► "Make it yours" (formats, tone, headline — or let Higgsfield write it, accent, real photos)
              ──► Higgsfield GPT Image 2.5 Sunburst: one finished creative per format (brief + references)
              ──► story ──► Wan 3.0 image-to-video reel
              ──► results in device frames ──► download · share link (OG card) · X · Instagram · calendar
```

Every account gets a daily fair-use quota (default 8 images + 2 videos per UTC day) plus a global daily cap, enforced server-side.

## Run locally

Requirements: Python 3.11+, Node 18+, MongoDB.

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env            # add HF_CREDENTIALS (ANTHROPIC_API_KEY optional)
.venv/bin/uvicorn server:app --port 8001 --reload
```

```bash
cd frontend
npm install
npm run dev                     # http://localhost:3000, proxies /api to :8001
```

Without `HF_CREDENTIALS` the app still runs end to end in **demo mode**, replaying the showcase media. The Higgsfield API bills a prepaid USD balance (separate from higgsfield.ai web credits) — top it up in the console or every generation returns `not_enough_credits`.

### Environment

| Variable | Purpose |
| --- | --- |
| `MONGO_URL`, `DB_NAME` | MongoDB connection |
| `JWT_SECRET` | Signs login tokens — set a long random value |
| `HF_CREDENTIALS` | Higgsfield API key as `key_id:key_secret` ([console.higgsfield.ai](https://console.higgsfield.ai)) |
| `HF_IMAGE_ENDPOINT` | Image model (default `marketing-studio/image/sunburst` — GPT Image 2.5 Sunburst) |
| `HF_VIDEO_ENDPOINT` | Video model (default `alibaba/wan-3.0/image-to-video` — Wan 3.0) |
| `HF_IMAGE_ENGINE` | `image` (default: render Arise's prompt with `HF_IMAGE_ENDPOINT`) or `ads` (Ads Studio writes + renders the concept) |
| `ANTHROPIC_API_KEY` | Optional: Claude brand analysis, live trend research and ideas |
| `GENERATION_MODE` | `live` (default when credentials exist) or `demo` |
| `DAILY_IMAGE_LIMIT`, `DAILY_VIDEO_LIMIT` | Per-account daily quota |
| `PUBLIC_URL` | Public origin for share links |

## Deploy

Single service: build the frontend and FastAPI serves it alongside the API.

```bash
cd frontend && npm run build    # outputs frontend/build, served by backend/server.py
```

Or use the Dockerfile (`docker build -t arise . && docker run -p 8001:8001 --env-file backend/.env arise`).

### On Emergent

The repo uses Emergent's standard layout: `backend/` (FastAPI, `uvicorn server:app` on `:8001`, every route under `/api`) and `frontend/` (`yarn start` on `:3000`, `yarn build` → `frontend/build`), with `MONGO_URL`, `DB_NAME` and `REACT_APP_BACKEND_URL` read from the environment.

1. In Emergent, connect GitHub from your profile and pull this repository into a new workspace.
2. Add the secrets to the backend environment (`backend/.env` in the workspace, or the deployment's environment settings) — never commit them:
   - `HF_CREDENTIALS=key_id:key_secret` (Higgsfield API)
   - `JWT_SECRET=` a long random string
   - optional: `PUBLIC_URL=https://<your-app>` so share links use the public domain
3. Restart the backend, check the preview, then click **Deploy**.

Share links are served at `/api/s/<id>` (Open Graph cards for X, iMessage, Slack), so they work behind Emergent's `/api` routing.

## Project layout

```
backend/
  server.py              FastAPI app, share pages (Open Graph), SPA serving
  app/scrape.py          website / Maps / Instagram signal extraction
  app/fallback.py        brand reader + campaign playbook (default "brain")
  app/colors.py          palette extraction from photos + CSS
  app/llm.py             optional Claude path: research, brand profile, ideas
  app/moments.py         marketing calendar (holidays, food days, seasons)
  app/prompts.py         per-format prompt composition
  app/higgsfield.py      Higgsfield API client + demo provider
  app/routes_*.py        brands, generations, uploads, usage, media, sharing
frontend/
  src/pages/             Landing, Studio, BrandPage, GenerationPage, Library, Share, Auth
  src/components/        device frames, create panel, link input, nav
  src/lib/               zod schemas + typed API client, auth
  public/showcase/       landing-page creatives (regenerate: backend/.venv/bin/python -m scripts.showcase)
```

Showcase creatives featuring Bay Area businesses are unofficial concept examples generated with Arise and are not affiliated with or endorsed by those businesses.
