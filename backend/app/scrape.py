"""Turn whatever link a business pastes (website, Google Maps, Instagram) into raw brand signals."""

import asyncio
import ipaddress
import json
import re
import socket
from collections import Counter
from typing import Any, Optional
from urllib.parse import unquote_plus, urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)
MAX_BYTES = 3_000_000
HEX_RE = re.compile(r"#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
SOCIAL_HOSTS = {
    "instagram": "instagram.com",
    "tiktok": "tiktok.com",
    "facebook": "facebook.com",
    "x": "x.com",
    "twitter": "twitter.com",
}


class ScrapeError(Exception):
    pass


BOT_WALL = ("you are being redirected", "just a moment...", "attention required", "access denied",
            "javascript is required", "enable javascript and cookies", "verify you are human", "captcha")


def _bot_wall(html: str) -> bool:
    head = html[:4000].lower()
    return len(html) < 20000 and any(marker in head for marker in BOT_WALL)


def normalize_url(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        raise ScrapeError("Paste a link to your website, Google Maps listing or Instagram.")
    if not re.match(r"^https?://", raw, re.I):
        raw = "https://" + raw
    parsed = urlparse(raw)
    if not parsed.hostname or "." not in parsed.hostname:
        raise ScrapeError("That doesn't look like a valid link.")
    return raw


def classify(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    path = urlparse(url).path.lower()
    if "maps.app.goo.gl" in host or (host.endswith("goo.gl") and path.startswith("/maps")):
        return "maps"
    if "google." in host and ("/maps" in path or "maps." in host):
        return "maps"
    if host.endswith("instagram.com"):
        return "instagram"
    return "website"


async def _assert_public(host: str) -> None:
    """Refuse to fetch internal addresses (basic SSRF guard)."""
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, None)
    except socket.gaierror:
        raise ScrapeError("We couldn't reach that website. Double-check the link?")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise ScrapeError("That link points to a private address.")


async def fetch(url: str) -> tuple[str, str]:
    """Returns (final_url, html). Follows redirects manually so every hop is checked."""
    headers = {"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", "Accept": "text/html,*/*"}
    async with httpx.AsyncClient(timeout=12, headers=headers, follow_redirects=False) as client:
        for _ in range(6):
            host = urlparse(url).hostname or ""
            await _assert_public(host)
            resp = await client.get(url)
            if resp.is_redirect and resp.headers.get("location"):
                url = urljoin(url, resp.headers["location"])
                continue
            if resp.status_code >= 400:
                raise ScrapeError(f"The site responded with an error ({resp.status_code}).")
            body = resp.content[:MAX_BYTES]
            return str(resp.url), body.decode(resp.encoding or "utf-8", errors="replace")
    raise ScrapeError("Too many redirects.")


def _meta(soup: BeautifulSoup, *names: str) -> Optional[str]:
    for name in names:
        tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name}) \
            or soup.find("meta", attrs={"itemprop": name})
        if tag and tag.get("content"):
            return tag["content"].strip()
    return None


def _jsonld(soup: BeautifulSoup) -> list[dict]:
    wanted = ("LocalBusiness", "Restaurant", "CafeOrCoffeeShop", "Bakery", "Store", "Organization",
              "FoodEstablishment", "HealthAndBeautyBusiness", "Product", "Menu", "ClothingStore")
    out: list[dict] = []
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            data = json.loads(tag.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        stack = data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []
        for item in stack:
            if not isinstance(item, dict):
                continue
            t = item.get("@type")
            types = t if isinstance(t, list) else [t]
            if any(isinstance(x, str) and any(w in x for w in wanted) for x in types):
                out.append({k: v for k, v in item.items() if k in (
                    "@type", "name", "description", "address", "servesCuisine", "priceRange",
                    "telephone", "openingHours", "slogan", "brand", "sameAs", "hasMenu", "image", "logo")})
    return out[:4]


def _colors(soup: BeautifulSoup, html: str) -> list[str]:
    css = " ".join(t.get_text(" ") for t in soup.find_all("style"))
    css += " " + " ".join(t.get("style", "") for t in soup.find_all(style=True))
    counts: Counter[str] = Counter()
    for m in HEX_RE.findall(css):
        h = m.lower()
        if len(h) == 4:
            h = "#" + "".join(c * 2 for c in h[1:])
        counts[h] += 1
    theme = _meta(soup, "theme-color")
    ranked = [c for c, _ in counts.most_common(24)]
    if theme and HEX_RE.fullmatch(theme.strip()):
        ranked.insert(0, theme.strip().lower())
    seen: list[str] = []
    for c in ranked:
        if c not in seen:
            seen.append(c)
    return seen[:10]


def _images(soup: BeautifulSoup, base: str, og_image: Optional[str]) -> list[dict]:
    imgs: list[dict] = []
    seen: set[str] = set()

    def add(src: Optional[str], alt: str = "", role: str = "photo"):
        if not src or src.startswith("data:"):
            return
        absolute = urljoin(base, src.strip().split(" ")[0])
        low = absolute.lower()
        if absolute in seen or low.endswith(".svg") or any(x in low for x in ("pixel", "sprite", "spacer", "tracking", "1x1")):
            return
        seen.add(absolute)
        imgs.append({"url": absolute, "alt": alt[:120], "role": role})

    if og_image:
        add(og_image, "Social preview image", "og")
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
        if not src and img.get("srcset"):
            src = img["srcset"].split(",")[-1].strip()
        alt = img.get("alt") or ""
        hint = f"{src} {alt} {' '.join(img.get('class') or [])}".lower()
        add(src, alt, "logo" if "logo" in hint else "photo")
        if len(imgs) >= 16:
            break
    return imgs


def _socials(soup: BeautifulSoup) -> dict:
    found: dict[str, str] = {}
    for a in soup.find_all("a", href=True):
        href = a["href"]
        host = (urlparse(href).hostname or "").lower()
        for key, needle in SOCIAL_HOSTS.items():
            if host.endswith(needle) and key not in found:
                found[key] = href
    return found


def _visible_text(soup: BeautifulSoup, limit: int = 6000) -> str:
    for tag in soup(["script", "style", "noscript", "svg", "iframe"]):
        tag.decompose()
    text = re.sub(r"\s+", " ", soup.get_text(" ")).strip()
    return text[:limit]


def _maps_details(url: str, soup: Optional[BeautifulSoup]) -> dict:
    details: dict[str, Any] = {}
    m = re.search(r"/maps/place/([^/@?]+)", url)
    if m:
        parts = [p.strip() for p in unquote_plus(m.group(1)).split(",")]
        details["name"] = parts[0]
        if len(parts) > 1:
            details["address"] = ", ".join(parts[1:])
    m = re.search(r"@(-?\d+\.\d+),(-?\d+\.\d+)", url)
    if m:
        details["lat"], details["lng"] = float(m.group(1)), float(m.group(2))
    q = re.search(r"[?&]q=([^&]+)", url)
    if q and "name" not in details:
        details["name"] = unquote_plus(q.group(1))
    if soup is not None:
        title = _meta(soup, "og:title", "name")
        desc = _meta(soup, "og:description", "description")
        if title and "Google Maps" not in title:
            name, _, addr = title.partition(" · ")
            details.setdefault("name", name.strip())
            if addr:
                details.setdefault("address", addr.strip())
        if desc:
            details["listing"] = desc
    return details


async def scrape(raw_url: str) -> dict:
    url = normalize_url(raw_url)
    kind = classify(url)
    result: dict[str, Any] = {"url": url, "kind": kind}
    try:
        final_url, html = await fetch(url)
    except ScrapeError as exc:
        if kind == "website":
            raise
        result["warning"] = str(exc)
        final_url, html = url, ""
    except httpx.HTTPError:
        if kind == "website":
            raise ScrapeError("We couldn't load that page. Is the site online?")
        final_url, html = url, ""
    if kind == "website":
        kind = classify(final_url)  # short links may resolve to Maps
        result["kind"] = kind
    result["final_url"] = final_url

    if html and _bot_wall(html):
        result["blocked"] = True
        result["warning"] = ("This site blocks automated visitors, so we couldn't read it. "
                             "Add a Google Maps link, a few photos or a short description for a sharper read.")
        html = ""
    soup = BeautifulSoup(html, "html.parser") if html else None
    if kind == "maps":
        result["maps"] = _maps_details(final_url, soup)
    if kind == "instagram":
        m = re.search(r"instagram\.com/([A-Za-z0-9_.]+)", final_url)
        if m:
            result["instagram_handle"] = m.group(1)
    if soup is None:
        return result

    og_image = _meta(soup, "og:image", "twitter:image", "image")
    if og_image:
        og_image = urljoin(final_url, og_image)
    result.update({
        "title": (soup.title.string.strip() if soup.title and soup.title.string else None),
        "description": _meta(soup, "description", "og:description", "twitter:description"),
        "site_name": _meta(soup, "og:site_name", "application-name"),
        "og_image": og_image,
        "jsonld": _jsonld(soup),
        "colors": _colors(soup, html),
        "socials": _socials(soup),
        "headings": [h.get_text(" ", strip=True)[:120] for h in soup.find_all(["h1", "h2", "h3"])[:14]],
    })
    icon = soup.find("link", rel=lambda v: v and any("apple-touch-icon" in r or r == "icon" for r in v))
    if icon and icon.get("href"):
        result["icon"] = urljoin(final_url, icon["href"])
    result["images"] = _images(soup, final_url, og_image) if kind == "website" else (
        [{"url": og_image, "alt": "Listing photo", "role": "og"}] if og_image else [])
    result["text"] = _visible_text(soup)
    return result
