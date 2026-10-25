"""Brand palette from photos and site CSS: dominant colors, de-duplicated and given friendly names."""

import asyncio
import colorsys
import io
from typing import Iterable

import httpx
from PIL import Image

from .scrape import UA, _assert_public, ScrapeError

NAMED = [
    ("Espresso", (59, 38, 30)), ("Chocolate", (92, 58, 40)), ("Caramel", (196, 132, 64)), ("Honey", (226, 170, 72)),
    ("Cream", (240, 228, 206)), ("Oat", (222, 207, 182)), ("Terracotta", (196, 94, 62)), ("Ember", (222, 84, 38)),
    ("Tomato", (214, 58, 46)), ("Berry", (150, 40, 72)), ("Blush", (232, 176, 168)), ("Rose", (210, 110, 130)),
    ("Plum", (96, 48, 92)), ("Lavender", (178, 160, 210)), ("Sky", (140, 190, 225)), ("Ocean", (38, 104, 160)),
    ("Navy", (28, 42, 80)), ("Teal", (32, 120, 120)), ("Mint", (160, 214, 180)), ("Matcha", (140, 176, 96)),
    ("Sage", (170, 186, 150)), ("Forest", (36, 74, 52)), ("Olive", (110, 112, 52)), ("Mustard", (204, 168, 40)),
    ("Sand", (214, 192, 150)), ("Stone", (150, 144, 134)), ("Charcoal", (48, 48, 50)), ("Ink", (20, 20, 22)),
    ("Paper", (246, 242, 234)),
]


def _hex(rgb: tuple[int, int, int]) -> str:
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def _rgb(hex_: str) -> tuple[int, int, int]:
    h = hex_.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _dist(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def name_for(hex_: str) -> str:
    rgb = _rgb(hex_)
    return min(NAMED, key=lambda n: _dist(n[1], rgb))[0]


def _interesting(rgb: tuple[int, int, int]) -> bool:
    _, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
    return 0.08 < l < 0.93 and (s > 0.12 or 0.15 < l < 0.4)


def dominant(data: bytes, k: int = 6) -> list[tuple[str, float]]:
    """Returns [(hex, share)] for the most common colors in an image."""
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        return []
    img.thumbnail((96, 96))
    q = img.quantize(colors=k, method=Image.Quantize.MEDIANCUT)
    palette = q.getpalette() or []
    counts = sorted(q.getcolors() or [], reverse=True)
    total = sum(c for c, _ in counts) or 1
    out = []
    for count, idx in counts:
        rgb = tuple(palette[idx * 3: idx * 3 + 3])
        if len(rgb) == 3:
            out.append((_hex(rgb), count / total))
    return out


async def fetch_image(url: str, limit: int = 6_000_000) -> bytes | None:
    try:
        host = httpx.URL(url).host
        await _assert_public(host)
        async with httpx.AsyncClient(timeout=8, follow_redirects=True, headers={"User-Agent": UA}) as client:
            r = await client.get(url)
        if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image/") or len(r.content) > limit:
            return None
        return r.content
    except (httpx.HTTPError, ScrapeError, ValueError):
        return None


def merge(css_colors: Iterable[str], image_colors: list[list[tuple[str, float]]], max_colors: int = 4) -> list[dict]:
    """CSS brand colors first (they're intentional), then the strongest photo colors; skip near-duplicates."""
    picked: list[str] = []

    def add(h: str) -> None:
        h = h.lower()
        if len(h) != 7 or not _interesting(_rgb(h)):
            return
        if all(_dist(_rgb(h), _rgb(p)) > 60 for p in picked):
            picked.append(h)

    for h in css_colors:
        add(h)
        if len(picked) >= 2:
            break
    ranked = sorted((c for colors in image_colors for c in colors), key=lambda c: -c[1])
    for h, _ in ranked:
        if len(picked) >= max_colors:
            break
        add(h)
    seen_names: set[str] = set()
    out = []
    for h in picked:
        n = name_for(h)
        if n in seen_names:
            n = f"{n} II"
        seen_names.add(n)
        out.append({"name": n, "hex": h})
    return out


def is_good_photo(data: bytes) -> bool:
    """Real photos only: big enough, not a transparent cut-out, not mostly blank, not flat."""
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except Exception:
        return False
    if img.width < 320 or img.height < 220:
        return False
    if img.mode in ("RGBA", "LA", "P"):
        alpha = img.convert("RGBA").getchannel("A").resize((64, 64))
        if sum(1 for a in alpha.getdata() if a < 200) / 4096 > 0.2:
            return False
    gray = img.convert("L").resize((64, 64))
    px = list(gray.getdata())
    mean = sum(px) / len(px)
    std = (sum((p - mean) ** 2 for p in px) / len(px)) ** 0.5
    bright = sum(1 for p in px if p > 232) / len(px)
    return std > 22 and bright < 0.5


async def curate(image_urls: list[str], uploads: list[bytes]) -> tuple[list[str], list[bytes]]:
    """Fetch candidate site images in parallel; return (good photo URLs in page order, bytes for palette)."""
    candidates = image_urls[:12]
    fetched = await asyncio.gather(*[fetch_image(u) for u in candidates])
    good = [(u, b) for u, b in zip(candidates, fetched) if b and is_good_photo(b)]
    return [u for u, _ in good], [*uploads, *[b for _, b in good[:4]]]


async def palette_from(css_colors: list[str], image_urls: list[str], uploads: list[bytes]) -> list[dict]:
    fetched = await asyncio.gather(*[fetch_image(u) for u in image_urls[:3]])
    blobs = [b for b in [*uploads, *fetched] if b]
    return merge(css_colors, [dominant(b) for b in blobs])
