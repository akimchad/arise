"""Higgsfield API client (https://docs.higgsfield.ai) plus a demo provider that needs no credentials."""

import asyncio
import random
import time
from typing import Optional
from uuid import uuid4

import httpx

from . import config

TERMINAL = {"completed", "failed", "nsfw", "canceled"}


class HiggsfieldError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


def _friendly(status: int, detail: str) -> HiggsfieldError:
    if status == 401:
        return HiggsfieldError("Generation service credentials are invalid.", 503)
    if status == 403:
        return HiggsfieldError("The generation balance is empty — try again later.", 503)
    if status == 429:
        return HiggsfieldError("The studio is busy right now. Try again in a minute.", 429)
    if status in (423, 503):
        return HiggsfieldError("That model is temporarily unavailable. Try again shortly.", 503)
    if status in (400, 422):
        return HiggsfieldError(f"The generation request was rejected: {detail[:200]}", 400)
    return HiggsfieldError(f"Generation service error ({status}).", 502)


class HiggsfieldAPI:
    mode = "live"

    def __init__(self, credentials: str, base_url: str):
        self._headers = {"Authorization": f"Key {credentials}", "Content-Type": "application/json"}
        self._base = base_url.rstrip("/")

    async def _request(self, method: str, path: str, **kw) -> dict:
        url = path if path.startswith("http") else f"{self._base}/{path.lstrip('/')}"
        async with httpx.AsyncClient(timeout=30) as client:
            for attempt in range(3):
                try:
                    resp = await client.request(method, url, headers={**self._headers, **kw.pop("headers", {})}, **kw)
                except httpx.HTTPError:
                    if attempt == 2:
                        raise HiggsfieldError("Couldn't reach the generation service.", 502)
                    await asyncio.sleep(1.5 * (attempt + 1))
                    continue
                if resp.status_code >= 500 and attempt < 2:
                    await asyncio.sleep(1.5 * (attempt + 1))
                    continue
                if resp.status_code >= 400:
                    try:
                        detail = str(resp.json().get("detail", ""))
                    except ValueError:
                        detail = resp.text
                    raise _friendly(resp.status_code, detail)
                return resp.json() if resp.content else {}
        raise HiggsfieldError("Generation service error.", 502)

    async def submit(self, endpoint: str, payload: dict, idempotency_key: str, fmt: str = "post",
                     hint: str = "") -> str:
        data = await self._request("POST", endpoint, json=payload, headers={"Idempotency-Key": idempotency_key})
        return data["request_id"]

    async def status(self, request_id: str) -> dict:
        return await self._request("GET", f"requests/{request_id}/status")

    async def upload(self, data: bytes, content_type: str) -> str:
        """Upload input media; returns a public URL usable as image_url."""
        info = await self._request("POST", "files/generate-upload-url", json={"content_type": content_type})
        async with httpx.AsyncClient(timeout=60) as client:
            put = await client.put(info["upload_url"], content=data, headers=info.get("upload_headers") or {
                "Content-Type": content_type})
        if put.status_code >= 400:
            raise HiggsfieldError("Couldn't upload the reference photo.", 502)
        return info["public_url"]


# Demo provider: replays showcase media so the whole flow works without API credentials.
DEMO_MEDIA = {
    "post": ["philz-post.jpg", "tartine-post.jpg", "neighbor-post.jpg", "citylights-post.jpg"],
    "story": ["philz-story.jpg", "bluebottle-story.jpg", "birite-story.jpg"],
    "banner": ["philz-interior.jpg", "boulders-banner.jpg"],
    "flyer": ["philz-menu.jpg"],
    "wallpaper": ["bluebottle-story.jpg"],
    "square": ["philz-halloween.jpg", "boudin-halloween.jpg"],
    "video": ["philz-video.mp4", "boudin-video.mp4"],
}


class DemoProvider:
    mode = "demo"

    def __init__(self):
        self._jobs: dict[str, dict] = {}

    async def submit(self, endpoint: str, payload: dict, idempotency_key: str, fmt: str = "post",
                     hint: str = "") -> str:
        rid = uuid4().hex
        choices = DEMO_MEDIA.get(fmt) or DEMO_MEDIA["post"]
        key = "".join(ch for ch in hint.lower() if ch.isalnum())
        matching = [f for f in choices if f.split("-")[0] in key]
        choices = matching or choices
        self._jobs[rid] = {
            "ready_at": time.time() + (random.uniform(14, 20) if fmt == "video" else random.uniform(5, 9)),
            "file": random.choice(choices), "video": fmt == "video",
        }
        return rid

    async def status(self, request_id: str) -> dict:
        job = self._jobs.get(request_id)
        if not job:
            return {"status": "failed", "error": "Demo job expired (server restarted)."}
        if time.time() < job["ready_at"]:
            return {"status": "in_progress"}
        url = f"/showcase/{job['file']}"
        return {"status": "completed", "video": {"url": url}} if job["video"] else {
            "status": "completed", "images": [{"url": url}]}

    async def upload(self, data: bytes, content_type: str) -> str:
        return ""


provider: HiggsfieldAPI | DemoProvider = (
    HiggsfieldAPI(config.HF_CREDENTIALS, config.HF_BASE_URL)
    if config.GENERATION_MODE == "live" and config.HF_CREDENTIALS else DemoProvider()
)


def result_url(status: dict) -> Optional[str]:
    if status.get("images"):
        return status["images"][0].get("url")
    if status.get("video"):
        return status["video"].get("url")
    return None
