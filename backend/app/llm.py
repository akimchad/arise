"""Claude-powered brand understanding, trend research and campaign ideation."""

import base64
import json
import logging
from typing import Any, Optional, TypeVar

import anthropic
import httpx
from pydantic import BaseModel

from . import config
from .models import BrandProfile, IdeaSet

log = logging.getLogger("arise.llm")
T = TypeVar("T", bound=BaseModel)

client: Optional[anthropic.AsyncAnthropic] = (
    anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY, timeout=180, max_retries=2)
    if config.ANTHROPIC_API_KEY else None
)
WEB_SEARCH = {"type": "web_search_20260209", "name": "web_search"}
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


class LLMError(Exception):
    pass


def available() -> bool:
    return client is not None


async def _parse(cls: type[T], system: str, content: list[dict], effort: str) -> T:
    assert client is not None
    kwargs: dict[str, Any] = dict(
        model=config.CLAUDE_MODEL,
        max_tokens=16000,
        system=system,
        messages=[{"role": "user", "content": content}],
        output_format=cls,
        output_config={"effort": effort},
    )
    try:
        resp = await client.beta.messages.parse(
            betas=["server-side-fallback-2026-07-01"], fallbacks="default", **kwargs
        )
    except anthropic.BadRequestError as exc:
        log.warning("fallback-enabled request rejected (%s); retrying without fallbacks", exc.message)
        resp = await client.messages.parse(**kwargs)
    if resp.stop_reason == "refusal":
        raise LLMError("Claude declined this request.")
    if resp.parsed_output is None:
        raise LLMError(f"No structured output (stop_reason={resp.stop_reason}).")
    return resp.parsed_output


async def _search(prompt: str, max_uses: int = 4) -> str:
    """Free-form research with Claude's web search tool; returns plain-text notes."""
    assert client is not None
    messages: list[dict] = [{"role": "user", "content": prompt}]
    tools = [{**WEB_SEARCH, "max_uses": max_uses}]
    resp = None
    for _ in range(4):
        resp = await client.messages.create(
            model=config.CLAUDE_MODEL, max_tokens=8000, tools=tools, messages=messages,
            output_config={"effort": "low"},
        )
        if resp.stop_reason != "pause_turn":
            break
        messages.append({"role": "assistant", "content": resp.content})
    if resp is None or resp.stop_reason == "refusal":
        return ""
    return "\n".join(b.text for b in resp.content if b.type == "text").strip()


async def _image_block(url: str) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as http:
            r = await http.get(url, headers={"User-Agent": "Mozilla/5.0 Arise"})
        ctype = r.headers.get("content-type", "").split(";")[0].strip()
        if r.status_code != 200 or ctype not in IMAGE_TYPES or len(r.content) > 4_500_000:
            return None
        return {"type": "image", "source": {"type": "base64", "media_type": ctype,
                                            "data": base64.standard_b64encode(r.content).decode()}}
    except httpx.HTTPError:
        return None


BRAND_SYSTEM = """You are the brand strategist inside Arise, a tool that creates social media \
content for local and small businesses (cafes, bakeries, restaurants, shops, salons, studios).

From the signals you are given (website copy, metadata, a maps listing, research notes, photos the \
owner uploaded), write a concise brand profile that a creative director could brief from.

Rules:
- Ground every claim in the signals. Where you must infer (audience, voice, palette), infer what is \
most plausible for this specific business — never generic filler.
- Do not invent street addresses, prices, awards or facts.
- Palette: prefer colors evident in the site/photos; otherwise propose colors that suit the brand. \
Use #RRGGBB hex.
- Keep every string short and specific. No marketing clichés like 'elevate' or 'unlock'."""

IDEAS_SYSTEM = """You are the creative director inside Arise. You turn a local business's brand \
profile into ready-to-produce social campaign concepts that feel timely and specific.

Each concept is produced as an AI-generated ad image (and optionally animated into a short video), \
so the visual fields must describe something a photographer could shoot today:
- scene: the hero subject (their real products/space), props, setting, composition. No text in it.
- headline: max 6 words, the line printed on the creative. Witty or warm, never generic.
- typography: a concrete type treatment that suits the brand voice.
- mood: lighting and color direction that uses the brand palette.

Guidance:
- Prefer the nearest relevant calendar moments (e.g. a holiday next week) and active seasons.
- Use trend notes when they genuinely fit this business. Never reference other brands, celebrities \
or trademarked characters.
- Make every idea unmistakably about THIS business and its signature items.
- Captions: brand voice, 1-3 short sentences, at most one emoji. Hashtags without '#'."""


def _profile_json(profile: BrandProfile | dict) -> str:
    data = profile.model_dump() if isinstance(profile, BaseModel) else profile
    return json.dumps(data, indent=1, ensure_ascii=False)


def _signals_text(scraped: dict, notes: str, research: str) -> str:
    keep = {k: scraped.get(k) for k in (
        "url", "kind", "title", "description", "site_name", "maps", "instagram_handle", "jsonld",
        "colors", "headings", "socials") if scraped.get(k)}
    parts = [f"<signals>\n{json.dumps(keep, indent=1, ensure_ascii=False)[:6000]}\n</signals>"]
    if scraped.get("text"):
        parts.append(f"<website_text>\n{scraped['text'][:6000]}\n</website_text>")
    if research:
        parts.append(f"<research_notes>\n{research[:5000]}\n</research_notes>")
    if notes:
        parts.append(f"<owner_notes>\n{notes[:1500]}\n</owner_notes>")
    return "\n\n".join(parts)


async def research_business(scraped: dict, notes: str) -> str:
    who = (scraped.get("maps") or {}).get("name") or scraped.get("site_name") or scraped.get("title") \
        or scraped.get("instagram_handle") or scraped.get("url")
    where = (scraped.get("maps") or {}).get("address", "")
    prompt = (
        f"Look up this local business and summarize what you can verify: {who} {where}.\n"
        f"Link provided: {scraped.get('url')}\n{('Owner notes: ' + notes) if notes else ''}\n"
        "Report: what it is, signature products/services, price level, vibe and interior/visual style, "
        "the neighborhood, who the customers seem to be (from reviews), and any distinctive details. "
        "Be concise (under 250 words). If you cannot find it, say so."
    )
    try:
        return await _search(prompt, max_uses=3)
    except anthropic.APIError as exc:
        log.warning("business research failed: %s", exc)
        return ""


async def analyze_brand(scraped: dict, notes: str, research: str, uploads: list[dict]) -> BrandProfile:
    content: list[dict] = []
    for up in uploads[:4]:
        content.append({"type": "image", "source": {
            "type": "base64", "media_type": up["content_type"], "data": base64.standard_b64encode(up["data"]).decode()}})
    for img in (scraped.get("images") or [])[:2]:
        block = await _image_block(img["url"])
        if block:
            content.append(block)
    has_photos = len(content) > 0
    content.append({"type": "text", "text": _signals_text(scraped, notes, research) + (
        "\n\nThe images above are photos of the business (uploaded by the owner or found on their site)."
        if has_photos else "") + "\n\nWrite the brand profile."})
    return await _parse(BrandProfile, BRAND_SYSTEM, content, effort="low")


async def research_trends(profile: BrandProfile | dict, calendar: str) -> str:
    p = profile if isinstance(profile, dict) else profile.model_dump()
    prompt = (
        f"{calendar.splitlines()[0]}\n"
        f"I run social media for a {p.get('business_type')} ({p.get('category')}) in {p.get('location') or 'the US'}. "
        "Search for what is trending RIGHT NOW (this month) for businesses like this on Instagram, TikTok and "
        "in food/retail culture: seasonal flavors or products, content formats, aesthetics, viral moments. "
        "Return 5 bullet points, each one specific, current and actionable, with the source in parentheses."
    )
    try:
        return await _search(prompt, max_uses=4)
    except anthropic.APIError as exc:
        log.warning("trend research failed: %s", exc)
        return ""


async def generate_ideas(profile: BrandProfile | dict, calendar: str, trends: str, brief: str = "",
                         count: int = 5) -> IdeaSet:
    text = (
        f"<brand_profile>\n{_profile_json(profile)}\n</brand_profile>\n\n"
        f"<calendar>\n{calendar}\n</calendar>\n\n"
        f"<trend_notes>\n{trends or 'No live trend research available; rely on the calendar and season.'}\n</trend_notes>\n\n"
    )
    if brief:
        text += (f"<owner_request>\n{brief[:1200]}\n</owner_request>\n\n"
                 f"Write {count} distinct campaign concepts that answer the owner's request.")
    else:
        text += (
            f"Write {count} distinct campaign concepts, ordered by how timely they are. Mix: the nearest fitting "
            "holiday, a seasonal/trend concept, a signature-product spotlight, and a community or evergreen concept."
        )
    return await _parse(IdeaSet, IDEAS_SYSTEM, [{"type": "text", "text": text}], effort="medium")
