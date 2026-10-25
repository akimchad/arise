"""Generations: turn a campaign idea into images/videos via Higgsfield; usage limits; media + sharing."""

import asyncio
import logging
import re
from datetime import datetime, time as dtime, timedelta, timezone
from typing import Literal, Optional

import httpx
from bson import Binary
from fastapi import APIRouter, Depends, File, Header, HTTPException, Request, UploadFile
from fastapi.responses import RedirectResponse, Response, StreamingResponse
from pydantic import BaseModel, Field

from . import config, db
from .auth import current_user, optional_user
from .higgsfield import TERMINAL, HiggsfieldError, provider, result_url
from .prompts import FORMATS, ads_brief, aspect_for, engine_for, image_prompt, video_prompt
from .routes_brands import can_access, client_ip, rate_limit

log = logging.getLogger("arise.generations")
router = APIRouter(tags=["generations"])

ACTIVE = {"queued", "running"}
DONE_STATES = {"done", "failed", "blocked"}
UPLOAD_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD = 8 * 1024 * 1024


class Overrides(BaseModel):
    headline: Optional[str] = Field(default=None, max_length=80)
    subline: Optional[str] = Field(default=None, max_length=100)
    tone: Optional[Literal["auto", "bold", "elegant", "playful", "minimal", "cozy"]] = None
    accent: Optional[str] = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    caption: Optional[str] = Field(default=None, max_length=600)


class GenerateIn(BaseModel):
    brand_id: str
    idea_id: str
    formats: list[Literal["post", "story", "banner", "flyer", "wallpaper", "video"]] = Field(min_length=1, max_length=6)
    overrides: Overrides = Field(default_factory=Overrides)
    reference_urls: list[str] = Field(default_factory=list, max_length=4)
    upload_ids: list[str] = Field(default_factory=list, max_length=4)


def day_start() -> datetime:
    return datetime.combine(db.now().date(), dtime.min, tzinfo=timezone.utc)


async def usage_for(user_id: Optional[str]) -> dict:
    match: dict = {"created_at": {"$gte": day_start()}}
    if user_id:
        match["user_id"] = user_id
    pipeline = [
        {"$match": match}, {"$unwind": "$items"},
        {"$match": {"items.status": {"$nin": ["failed", "blocked"]}}},
        {"$group": {"_id": "$items.kind", "n": {"$sum": 1}}},
    ]
    counts = {row["_id"]: row["n"] async for row in db.generations.aggregate(pipeline)}
    return {"image": counts.get("image", 0), "video": counts.get("video", 0)}


def usage_payload(used: dict) -> dict:
    resets = day_start() + timedelta(days=1)
    return {
        "images": {"used": used["image"], "limit": config.DAILY_IMAGE_LIMIT},
        "videos": {"used": used["video"], "limit": config.DAILY_VIDEO_LIMIT},
        "resets_at": resets.isoformat(),
        "mode": provider.mode,
    }


def serialize(gen: dict) -> dict:
    items = []
    for it in gen["items"]:
        items.append({k: it.get(k) for k in (
            "id", "format", "label", "kind", "aspect", "status", "url", "error", "source_item")} | {
            "download": f"/api/media/{gen['_id']}/{it['id']}?download=1" if it.get("url") else None,
            "share": f"/api/s/{it['id']}" if it.get("url") else None,
        })
    done = all(i["status"] in DONE_STATES for i in items)
    return {
        "id": gen["_id"], "brand_id": gen["brand_id"], "brand_name": gen.get("brand_name"),
        "idea": gen["idea"], "overrides": gen.get("overrides") or {}, "caption": gen.get("caption"),
        "hashtags": gen.get("hashtags") or [], "items": items, "complete": done,
        "mode": gen.get("mode"), "created_at": gen["created_at"],
    }


async def _set_item(gen_id: str, item_id: str, **fields) -> None:
    await db.generations.update_one(
        {"_id": gen_id, "items.id": item_id},
        {"$set": {f"items.$.{k}": v for k, v in fields.items()}},
    )


async def _submit_image(gen_id: str, item: dict, refs: list[str], hint: str, profile: dict) -> None:
    if item.get("engine") == "ads":
        endpoint = config.HF_ADS_ENDPOINT
        payload = {
            "prompt": item["prompt"], "aspect_ratio": item["aspect"], "batch_size": 1, "language": "en",
            "niche": (profile.get("business_type") or "Local business")[:1000],
            "target_audience": (profile.get("audience") or "")[:2000],
        }
        if refs:
            payload["image_urls"] = refs[:10]
    else:
        endpoint = config.HF_IMAGE_ENDPOINT
        payload = {"prompt": item["prompt"], "aspect_ratio": item["aspect"], "resolution": "2k", "quality": config.HF_IMAGE_QUALITY,
                   "enhance_prompt": False}
        if refs:
            payload["image_urls"] = refs
    try:
        rid = await provider.submit(endpoint, payload, f"{gen_id}-{item['id']}", item["format"], hint)
        await _set_item(gen_id, item["id"], request_id=rid, status="queued", checked_at=db.now())
    except HiggsfieldError as exc:
        await _set_item(gen_id, item["id"], status="failed", error=str(exc))


async def _submit_video(gen_id: str, item: dict, image_url: str, hint: str = "") -> None:
    payload = {"prompt": item["prompt"], "image_url": image_url, "duration": 5,
               "resolution": config.HF_VIDEO_RESOLUTION, "aspect_ratio": item["aspect"], "generate_audio": False}
    try:
        rid = await provider.submit(config.HF_VIDEO_ENDPOINT, payload, f"{gen_id}-{item['id']}", "video", hint)
        await _set_item(gen_id, item["id"], request_id=rid, status="queued", checked_at=db.now())
    except HiggsfieldError as exc:
        await _set_item(gen_id, item["id"], status="failed", error=str(exc))


async def refresh(gen: dict) -> dict:
    """Pull-based progress: poll Higgsfield for active items, chain videos off finished stories."""
    if all(i["status"] in DONE_STATES for i in gen["items"]):
        return gen
    now = db.now()
    by_id = {i["id"]: i for i in gen["items"]}

    async def poll(item: dict):
        checked = item.get("checked_at")
        if checked and (now - checked).total_seconds() < 2.5:
            return
        try:
            st = await provider.status(item["request_id"])
        except HiggsfieldError as exc:
            log.warning("status check failed: %s", exc)
            await _set_item(gen["_id"], item["id"], checked_at=now)
            return
        status = st.get("status")
        if status == "completed" and result_url(st):
            await _set_item(gen["_id"], item["id"], status="done", url=result_url(st), finished_at=now, checked_at=now)
        elif status == "nsfw":
            await _set_item(gen["_id"], item["id"], status="blocked", checked_at=now,
                            error="This one was blocked by content moderation. Try a different idea or headline.")
        elif status in TERMINAL:
            await _set_item(gen["_id"], item["id"], status="failed", checked_at=now,
                            error=st.get("error") or "Generation failed — credits weren't used. Try again.")
        else:
            await _set_item(gen["_id"], item["id"], status="running" if status == "in_progress" else "queued",
                            checked_at=now)

    async def chain(item: dict):
        source = by_id.get(item.get("source_item"))
        if not source or source["status"] in ("failed", "blocked"):
            await _set_item(gen["_id"], item["id"], status="failed", error="The video needs its story image, which failed.")
            return
        if source["status"] != "done":
            return
        claimed = await db.generations.update_one(
            {"_id": gen["_id"], "items": {"$elemMatch": {"id": item["id"], "status": "waiting"}}},
            {"$set": {"items.$.status": "queued"}})
        if claimed.modified_count == 1:
            await _submit_video(gen["_id"], item, source["url"], gen.get("brand_name") or "")

    jobs = []
    for item in gen["items"]:
        if item["status"] in ACTIVE and item.get("request_id"):
            jobs.append(poll(item))
        elif item["status"] == "waiting":
            jobs.append(chain(item))
    if jobs:
        await asyncio.gather(*jobs)
    return await db.generations.find_one({"_id": gen["_id"]})


async def _reference_urls(body: GenerateIn, brand: dict) -> list[str]:
    allowed = {img["url"] for img in ((brand.get("source") or {}).get("images") or [])}
    refs = [u for u in body.reference_urls if u in allowed]
    for up_id in body.upload_ids:
        up = await db.uploads.find_one({"_id": up_id})
        if not up:
            continue
        if not up.get("hf_url") and provider.mode == "live":
            try:
                up["hf_url"] = await provider.upload(bytes(up["data"]), up["content_type"])
                await db.uploads.update_one({"_id": up_id}, {"$set": {"hf_url": up["hf_url"]}})
            except HiggsfieldError as exc:
                log.warning("reference upload failed: %s", exc)
        if up.get("hf_url"):
            refs.append(up["hf_url"])
    return refs[:4]


@router.post("/generations")
async def create_generation(body: GenerateIn, user: dict = Depends(current_user),
                            x_anon_id: Optional[str] = Header(default=None)):
    brand = await db.brands.find_one({"_id": body.brand_id})
    if not brand or not can_access(brand, user, x_anon_id):
        raise HTTPException(status_code=404, detail="Brand not found.")
    if not brand.get("user_id"):
        await db.brands.update_one({"_id": brand["_id"]}, {"$set": {"user_id": user["_id"], "anon_id": None}})
    idea = next((i for i in brand.get("ideas") or [] if i["id"] == body.idea_id), None)
    if not idea:
        raise HTTPException(status_code=404, detail="That idea is no longer available — refresh ideas.")

    formats = list(dict.fromkeys(body.formats))
    if "video" in formats and "story" not in formats:
        formats.insert(formats.index("video"), "story")
    want_images = sum(1 for f in formats if FORMATS[f]["kind"] == "image")
    want_videos = sum(1 for f in formats if FORMATS[f]["kind"] == "video")

    used = await usage_for(user["_id"])
    left_img = config.DAILY_IMAGE_LIMIT - used["image"]
    left_vid = config.DAILY_VIDEO_LIMIT - used["video"]
    if want_images > left_img or want_videos > left_vid:
        raise HTTPException(status_code=429, detail=(
            f"Daily limit reached — you have {max(left_img, 0)} image(s) and {max(left_vid, 0)} video(s) left today. "
            "Pick fewer formats or come back tomorrow."))
    total = await usage_for(None)
    if total["image"] + want_images > config.GLOBAL_DAILY_IMAGE_LIMIT or total["video"] + want_videos > config.GLOBAL_DAILY_VIDEO_LIMIT:
        raise HTTPException(status_code=503, detail="Arise is at capacity for today. Please come back tomorrow!")

    refs = await _reference_urls(body, brand)
    overrides = body.overrides.model_dump(exclude_none=True)
    profile = brand["profile"]
    items: list[dict] = []
    for fmt in formats:
        spec = FORMATS[fmt]
        item = {"id": db.new_id()[:16], "format": fmt, "label": spec["label"], "kind": spec["kind"],
                "aspect": spec["aspect"] if spec["kind"] == "video" else aspect_for(fmt),
                "status": "pending", "created_at": db.now()}
        if spec["kind"] == "image":
            item["engine"] = engine_for(fmt)
            item["prompt"] = (ads_brief if item["engine"] == "ads" else image_prompt)(fmt, profile, idea, overrides, bool(refs))
        else:
            item["prompt"] = video_prompt(idea)
            item["status"] = "waiting"
            item["source_item"] = next(i["id"] for i in items if i["format"] == spec["source"])
        items.append(item)

    gen = {
        "_id": db.new_id(), "user_id": user["_id"], "brand_id": brand["_id"], "brand_name": profile.get("name"),
        "idea": {k: idea.get(k) for k in ("id", "title", "moment", "hook", "headline", "subline", "cta")},
        "overrides": overrides, "caption": overrides.get("caption") or idea.get("caption"),
        "hashtags": idea.get("hashtags") or [], "items": items, "references": refs,
        "mode": provider.mode, "created_at": db.now(),
    }
    await db.generations.insert_one(gen)
    await asyncio.gather(*[_submit_image(gen["_id"], it, refs, profile.get("name", ""), profile) for it in items if it["kind"] == "image"])
    gen = await db.generations.find_one({"_id": gen["_id"]})
    return {"generation": serialize(gen), "usage": usage_payload(await usage_for(user["_id"]))}


@router.get("/generations")
async def list_generations(brand_id: Optional[str] = None, user: dict = Depends(current_user)):
    q: dict = {"user_id": user["_id"]}
    if brand_id:
        q["brand_id"] = brand_id
    docs = await db.generations.find(q).sort("created_at", -1).to_list(60)
    pending = [d for d in docs[:4] if not all(i["status"] in DONE_STATES for i in d["items"])]
    if pending:
        fresh = {g["_id"]: g for g in await asyncio.gather(*[refresh(d) for d in pending])}
        docs = [fresh.get(d["_id"], d) for d in docs]
    return {"generations": [serialize(d) for d in docs]}


@router.get("/generations/{gen_id}")
async def get_generation(gen_id: str, user: dict = Depends(current_user)):
    gen = await db.generations.find_one({"_id": gen_id, "user_id": user["_id"]})
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found.")
    return {"generation": serialize(await refresh(gen)), "usage": usage_payload(await usage_for(user["_id"]))}


@router.get("/usage")
async def usage(user: dict = Depends(current_user)):
    return usage_payload(await usage_for(user["_id"]))


def _filename(gen: dict, item: dict, ext: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", f"{gen.get('brand_name') or 'arise'} {item['label']}".lower()).strip("-")
    return f"{base}.{ext}"


@router.get("/media/{gen_id}/{item_id}")
async def media(gen_id: str, item_id: str, download: int = 0):
    gen = await db.generations.find_one({"_id": gen_id, "items.id": item_id})
    item = next((i for i in (gen or {}).get("items", []) if i["id"] == item_id), None)
    if not item or not item.get("url"):
        raise HTTPException(status_code=404, detail="Media not found.")
    url = item["url"]
    if url.startswith("/"):
        return RedirectResponse(url)
    client = httpx.AsyncClient(timeout=60, follow_redirects=True)
    upstream = await client.send(client.build_request("GET", url), stream=True)
    ctype = upstream.headers.get("content-type", "application/octet-stream")
    ext = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4"}.get(
        ctype.split(";")[0], url.rsplit(".", 1)[-1][:4])
    headers = {"Cache-Control": "public, max-age=86400"}
    if download:
        headers["Content-Disposition"] = f'attachment; filename="{_filename(gen, item, ext)}"'

    async def body():
        try:
            async for chunk in upstream.aiter_bytes():
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(body(), media_type=ctype, headers=headers)


@router.get("/share/{item_id}")
async def share_data(item_id: str):
    gen = await db.generations.find_one({"items.id": item_id})
    item = next((i for i in (gen or {}).get("items", []) if i["id"] == item_id), None)
    if not item or not item.get("url"):
        raise HTTPException(status_code=404, detail="Not found.")
    brand = await db.brands.find_one({"_id": gen["brand_id"]}) or {}
    return {
        "brand": {"name": gen.get("brand_name"), "palette": (brand.get("profile") or {}).get("palette", [])},
        "idea": gen["idea"], "caption": gen.get("caption"), "hashtags": gen.get("hashtags") or [],
        "item": {"id": item["id"], "format": item["format"], "label": item["label"], "kind": item["kind"],
                 "aspect": item["aspect"], "url": f"/api/media/{gen['_id']}/{item['id']}"},
        "siblings": [{"id": i["id"], "label": i["label"], "kind": i["kind"], "aspect": i["aspect"],
                      "url": f"/api/media/{gen['_id']}/{i['id']}"} for i in gen["items"] if i.get("url")],
    }


@router.post("/uploads")
async def upload(request: Request, file: UploadFile = File(...), user: Optional[dict] = Depends(optional_user),
                 x_anon_id: Optional[str] = Header(default=None)):
    if file.content_type not in UPLOAD_TYPES:
        raise HTTPException(status_code=400, detail="Upload a JPG, PNG or WebP image.")
    data = await file.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="That image is over 8 MB.")
    await rate_limit("upload", user["_id"] if user else client_ip(request), 40, timedelta(hours=1))
    doc = {"_id": db.new_id(), "data": Binary(data), "content_type": file.content_type, "size": len(data),
           "user_id": user["_id"] if user else None, "anon_id": x_anon_id, "created_at": db.now()}
    await db.uploads.insert_one(doc)
    return {"id": doc["_id"], "url": f"/api/uploads/{doc['_id']}"}


@router.get("/uploads/{upload_id}")
async def get_upload(upload_id: str):
    doc = await db.uploads.find_one({"_id": upload_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found.")
    return Response(bytes(doc["data"]), media_type=doc["content_type"],
                    headers={"Cache-Control": "public, max-age=604800"})
