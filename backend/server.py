"""Arise API — run with: uvicorn server:app --host 0.0.0.0 --port 8001"""

import html
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app import config, db, llm, moments
from app.auth import router as auth_router
from app.higgsfield import provider
from app.routes_brands import router as brands_router
from app.routes_generations import router as generations_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await db.ensure_indexes()
    logging.getLogger("arise").info(
        "Arise ready — generation=%s, claude=%s", provider.mode, "on" if llm.available() else "off")
    yield


app = FastAPI(title="Arise", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

api = APIRouter(prefix="/api")
api.include_router(auth_router)
api.include_router(brands_router)
api.include_router(generations_router)


@api.get("/health")
async def health():
    return {"ok": True}


@api.get("/config")
async def public_config():
    return {
        "generation_mode": provider.mode,
        "claude": llm.available(),
        "limits": {"images": config.DAILY_IMAGE_LIMIT, "videos": config.DAILY_VIDEO_LIMIT},
    }


@api.get("/moments")
async def upcoming_moments():
    return {"moments": moments.upcoming(horizon_days=60), "seasons": moments.active_seasons()}


app.include_router(api)


@app.get("/s/{item_id}", response_class=HTMLResponse)
@app.get("/api/s/{item_id}", response_class=HTMLResponse)  # Emergent's ingress only routes /api/* to the backend
async def share_page(item_id: str, request: Request):
    """Server-rendered Open Graph card so shared links unfurl with the creative on X, iMessage, Slack."""
    gen = await db.generations.find_one({"items.id": item_id})
    item = next((i for i in (gen or {}).get("items", []) if i["id"] == item_id), None)
    origin = config.PUBLIC_URL or str(request.base_url).rstrip("/")
    target = f"{origin}/share/{item_id}"
    if not item or not item.get("url"):
        return HTMLResponse(f'<meta http-equiv="refresh" content="0;url={origin}/">', status_code=404)
    title = html.escape(f"{gen.get('brand_name') or 'Arise'} — {gen['idea'].get('title', '')}")
    desc = html.escape((gen.get("caption") or "")[:200])
    media = item["url"] if item["url"].startswith("http") else origin + item["url"]
    media = html.escape(media)
    og_media = (f'<meta property="og:video" content="{media}"><meta property="og:type" content="video.other">'
                if item["kind"] == "video" else
                f'<meta property="og:image" content="{media}"><meta name="twitter:image" content="{media}">')
    return HTMLResponse(f"""<!doctype html><html><head><meta charset="utf-8">
<title>{title}</title><meta property="og:title" content="{title}"><meta property="og:description" content="{desc}">
{og_media}<meta name="twitter:card" content="summary_large_image"><meta property="og:site_name" content="Arise">
<meta http-equiv="refresh" content="0;url={html.escape(target)}"></head>
<body><a href="{html.escape(target)}">View on Arise</a></body></html>""")


# Serve the built frontend (single-service deploys). In dev, Vite serves it on :3000.
if config.FRONTEND_BUILD.exists():
    assets = config.FRONTEND_BUILD / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        if path.startswith("api/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)
        candidate = (config.FRONTEND_BUILD / path).resolve()
        if path and candidate.is_file() and config.FRONTEND_BUILD.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(config.FRONTEND_BUILD / "index.html")
