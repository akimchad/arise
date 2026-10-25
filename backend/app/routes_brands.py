"""Brands: paste a link (and/or photos), get a brand profile and timely campaign ideas."""

import asyncio
import logging
import random
import time
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from . import colors, config, db, fallback, llm, moments
from .auth import current_user, optional_user
from .models import BrandProfile
from .scrape import ScrapeError, scrape

log = logging.getLogger("arise.brands")
router = APIRouter(prefix="/brands", tags=["brands"])
_tasks: set[asyncio.Task] = set()
_trend_cache: dict[str, tuple[float, str]] = {}


class AnalyzeIn(BaseModel):
    url: str = Field(default="", max_length=2000)
    notes: str = Field(default="", max_length=1500)
    upload_ids: list[str] = Field(default_factory=list, max_length=6)


class IdeasIn(BaseModel):
    brief: str = Field(default="", max_length=1200)


class ClaimIn(BaseModel):
    anon_id: str = Field(min_length=8, max_length=64)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


async def rate_limit(kind: str, key: str, limit: int, window: timedelta) -> None:
    since = db.now() - window
    count = await db.events.count_documents({"kind": kind, "key": key, "created_at": {"$gte": since}})
    if count >= limit:
        raise HTTPException(status_code=429, detail="You're going fast! Sign in or try again in a little while.")
    await db.events.insert_one({"kind": kind, "key": key, "created_at": db.now()})


def can_access(brand: dict, user: Optional[dict], anon_id: Optional[str]) -> bool:
    if brand.get("user_id"):
        return bool(user) and brand["user_id"] == user["_id"]
    return bool(anon_id) and brand.get("anon_id") == anon_id


async def load_brand(brand_id: str, user: Optional[dict], anon_id: Optional[str]) -> dict:
    brand = await db.brands.find_one({"_id": brand_id})
    if not brand or not can_access(brand, user, anon_id):
        raise HTTPException(status_code=404, detail="Brand not found.")
    return brand


def serialize(brand: dict) -> dict:
    src = brand.get("source") or {}
    return {
        "id": brand["_id"],
        "status": brand.get("status"),
        "stage": brand.get("stage"),
        "error": brand.get("error"),
        "engine": brand.get("engine"),
        "input": brand.get("input"),
        "source": {k: src.get(k) for k in ("kind", "url", "final_url", "title", "og_image", "icon", "images",
                                           "photos", "colors", "socials", "maps", "warning")},
        "uploads": [{"id": u, "url": f"/api/uploads/{u}"} for u in (brand.get("input") or {}).get("upload_ids", [])],
        "profile": brand.get("profile"),
        "ideas": brand.get("ideas") or [],
        "trend_notes": brand.get("trend_notes") or [],
        "ideas_brief": brand.get("ideas_brief") or "",
        "calendar": moments.upcoming(horizon_days=45)[:6],
        "created_at": brand.get("created_at"),
        "updated_at": brand.get("updated_at"),
    }


async def _stage(brand_id: str, stage: str, **extra) -> None:
    await db.brands.update_one({"_id": brand_id}, {"$set": {"stage": stage, "updated_at": db.now(), **extra}})


def _spawn(coro) -> None:
    task = asyncio.create_task(coro)
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


async def _trends(profile: dict, calendar: str) -> str:
    key = f"{profile.get('category')}:{profile.get('business_type', '').lower()}:{(profile.get('location') or '').lower()}"
    hit = _trend_cache.get(key)
    if hit and time.time() - hit[0] < 6 * 3600:
        return hit[1]
    notes = await llm.research_trends(profile, calendar)
    if notes:
        _trend_cache[key] = (time.time(), notes)
    return notes


async def run_ideas(brand_id: str, profile: dict, brief: str, seed: int = 0) -> None:
    calendar = moments.calendar_brief()
    engine = "playbook"
    idea_set = None
    if llm.available():
        try:
            await _stage(brand_id, "researching")
            trends = await _trends(profile, calendar)
            await _stage(brand_id, "ideating")
            idea_set = await llm.generate_ideas(profile, calendar, trends, brief)
            engine = "claude"
        except Exception:
            log.exception("Claude ideation failed; using heuristics")
    if idea_set is None or not idea_set.ideas:
        await _stage(brand_id, "researching")
        await asyncio.sleep(0.6)  # let the UI show the calendar step
        await _stage(brand_id, "ideating")
        idea_set = fallback.ideas_for(profile, brief, seed=seed)
        engine = "playbook"
    ideas = [{"id": db.new_id()[:12], **i.model_dump()} for i in idea_set.ideas]
    await db.brands.update_one({"_id": brand_id}, {"$set": {
        "ideas": ideas, "trend_notes": idea_set.trend_notes, "ideas_brief": brief, "status": "ready",
        "stage": "ready", "updated_at": db.now(), "ideas_engine": engine}})


async def run_analysis(brand_id: str) -> None:
    brand = await db.brands.find_one({"_id": brand_id})
    if not brand:
        return
    inp = brand["input"]
    try:
        scraped: dict = {}
        if inp.get("url"):
            try:
                scraped = await scrape(inp["url"])
            except ScrapeError as exc:
                if not inp.get("upload_ids") and not inp.get("notes"):
                    raise
                scraped = {"url": inp["url"], "warning": str(exc)}
        uploads = await db.uploads.find({"_id": {"$in": inp.get("upload_ids", [])}}).to_list(10)
        upload_bytes = [bytes(u["data"]) for u in uploads]
        candidates = [i["url"] for i in scraped.get("images") or [] if i.get("role") != "logo"]
        photos, palette_images = await colors.curate(candidates, upload_bytes)
        scraped["photos"] = photos
        await _stage(brand_id, "understanding", source={k: v for k, v in scraped.items() if k != "text"})

        profile: Optional[BrandProfile] = None
        engine = "playbook"
        if llm.available():
            try:
                research = ""
                if inp.get("url") and len(scraped.get("text") or "") < 600:
                    await _stage(brand_id, "lookup")
                    research = await llm.research_business(scraped, inp.get("notes", ""))
                    await _stage(brand_id, "understanding")
                profile = await llm.analyze_brand(scraped, inp.get("notes", ""), research, uploads)
                engine = "claude"
            except Exception:
                log.exception("Claude brand analysis failed; using heuristics")
        if profile is None:
            palette = colors.merge(scraped.get("colors") or [], [colors.dominant(b) for b in palette_images])
            profile = fallback.profile_from_signals(scraped, inp.get("notes", ""), palette)
        profile_dict = profile.model_dump()
        await db.brands.update_one({"_id": brand_id}, {"$set": {
            "profile": profile_dict, "engine": engine, "updated_at": db.now()}})
        await run_ideas(brand_id, profile_dict, "")
    except ScrapeError as exc:
        await db.brands.update_one({"_id": brand_id}, {"$set": {"status": "failed", "stage": "failed", "error": str(exc)}})
    except Exception:
        log.exception("analysis crashed")
        await db.brands.update_one({"_id": brand_id}, {"$set": {
            "status": "failed", "stage": "failed", "error": "Something went wrong while reading your brand. Try again?"}})


@router.post("/analyze")
async def analyze(body: AnalyzeIn, request: Request, user: Optional[dict] = Depends(optional_user),
                  x_anon_id: Optional[str] = Header(default=None)):
    if not body.url.strip() and not body.upload_ids and not body.notes.strip():
        raise HTTPException(status_code=400, detail="Paste a link, upload a photo, or tell us about your business.")
    if not user:
        if not x_anon_id:
            raise HTTPException(status_code=400, detail="Missing visitor id.")
        await rate_limit("analysis", client_ip(request), config.ANON_ANALYSES_PER_HOUR, timedelta(hours=1))
    else:
        await rate_limit("analysis", user["_id"], 30, timedelta(hours=1))
    brand = {
        "_id": db.new_id(),
        "user_id": user["_id"] if user else None,
        "anon_id": None if user else x_anon_id,
        "input": {"url": body.url.strip(), "notes": body.notes.strip(), "upload_ids": body.upload_ids},
        "status": "working", "stage": "reading", "created_at": db.now(), "updated_at": db.now(),
    }
    await db.brands.insert_one(brand)
    _spawn(run_analysis(brand["_id"]))
    return serialize(brand)


@router.get("")
async def list_brands(user: dict = Depends(current_user)):
    docs = await db.brands.find({"user_id": user["_id"], "status": {"$ne": "failed"}}).sort("created_at", -1).to_list(50)
    return {"brands": [serialize(d) for d in docs]}


STALE_AFTER = timedelta(seconds=75)


async def _resume_if_stale(brand: dict) -> dict:
    """Background tasks die with the process (deploys, restarts); pick up abandoned work when polled."""
    if brand.get("status") != "working" or db.now() - brand["updated_at"] < STALE_AFTER:
        return brand
    claimed = await db.brands.update_one(
        {"_id": brand["_id"], "status": "working", "updated_at": brand["updated_at"]},
        {"$set": {"updated_at": db.now()}})
    if claimed.modified_count == 1:
        log.warning("resuming stale brand job %s (stage=%s)", brand["_id"], brand.get("stage"))
        if brand.get("profile"):
            _spawn(run_ideas(brand["_id"], brand["profile"], brand.get("ideas_brief") or "", seed=random.randint(1, 10**6)))
        else:
            _spawn(run_analysis(brand["_id"]))
    return await db.brands.find_one({"_id": brand["_id"]})


@router.get("/{brand_id}")
async def get_brand(brand_id: str, user: Optional[dict] = Depends(optional_user),
                    x_anon_id: Optional[str] = Header(default=None)):
    return serialize(await _resume_if_stale(await load_brand(brand_id, user, x_anon_id)))


@router.post("/{brand_id}/ideas")
async def regenerate_ideas(brand_id: str, body: IdeasIn, request: Request, user: Optional[dict] = Depends(optional_user),
                           x_anon_id: Optional[str] = Header(default=None)):
    brand = await load_brand(brand_id, user, x_anon_id)
    if brand.get("status") == "working":
        raise HTTPException(status_code=409, detail="Still working on the last request.")
    if not brand.get("profile"):
        raise HTTPException(status_code=400, detail="This brand hasn't been analyzed yet.")
    await rate_limit("ideas", user["_id"] if user else client_ip(request), 20, timedelta(hours=1))
    await db.brands.update_one({"_id": brand_id}, {"$set": {"status": "working", "stage": "researching", "error": None,
                                                            "ideas_brief": body.brief.strip(), "updated_at": db.now()}})
    _spawn(run_ideas(brand_id, brand["profile"], body.brief.strip(), seed=random.randint(1, 10**6)))
    return serialize(await db.brands.find_one({"_id": brand_id}))


class ProfilePatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    business_type: Optional[str] = Field(default=None, min_length=1, max_length=60)
    signature_items: Optional[list[str]] = Field(default=None, max_length=8)
    tagline: Optional[str] = Field(default=None, max_length=160)
    location: Optional[str] = Field(default=None, max_length=120)
    audience: Optional[str] = Field(default=None, max_length=400)
    voice: Optional[list[str]] = None
    palette: Optional[list[dict]] = None


@router.patch("/{brand_id}")
async def patch_brand(brand_id: str, body: ProfilePatch, user: Optional[dict] = Depends(optional_user),
                      x_anon_id: Optional[str] = Header(default=None)):
    brand = await load_brand(brand_id, user, x_anon_id)
    updates = {f"profile.{k}": v for k, v in body.model_dump(exclude_none=True).items()}
    if body.business_type:
        category, _ = fallback._business_type({"name": body.business_type.lower(), "meta": "", "text": ""})
        if category != "other":
            updates["profile.category"] = category
    if updates and brand.get("profile"):
        await db.brands.update_one({"_id": brand_id}, {"$set": {**updates, "updated_at": db.now()}})
    return serialize(await db.brands.find_one({"_id": brand_id}))


@router.post("/claim")
async def claim(body: ClaimIn, user: dict = Depends(current_user)):
    res = await db.brands.update_many({"anon_id": body.anon_id, "user_id": None},
                                      {"$set": {"user_id": user["_id"], "anon_id": None}})
    return {"claimed": res.modified_count}
