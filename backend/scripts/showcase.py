"""Render the landing-page showcase with the same Higgsfield models the app uses.

Usage (from backend/):  .venv/bin/python -m scripts.showcase [name ...]
Images: GPT Image 2.5 Sunburst. Videos: Wan 3.0 image-to-video from a rendered still.
Outputs land in frontend/public/showcase/ (JPEG stills, MP4 videos)."""

import asyncio
import io
import sys
from pathlib import Path

import httpx
from PIL import Image

from app import config
from app.higgsfield import TERMINAL, HiggsfieldAPI, result_url

OUT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "showcase"
PHILZ_LOGO = ("the Philz Coffee logo: playful rounded white bubble lettering 'Philz Coffee' outlined in dark chocolate "
              "brown, with a small orange coffee mug and a curl of steam above it")

IMAGES: dict[str, tuple[str, str]] = {
    "philz-hero": ("3:4", f"Premium studio product photograph of a Philz Coffee Mint Mojito iced coffee: a clear plastic cold cup of creamy iced coffee with swirls of sweet cream, packed with ice and topped with a generous sprig of fresh mint leaves, condensation droplets. The cup is printed with {PHILZ_LOGO}. The cup sits on a small travertine stone plinth. Seamless warm cream background (#F4EFE6), soft natural window light from the left, gentle long shadow, a few loose fresh mint leaves at the base. Clean, minimal, high-end editorial product photography, no other text."),
    "philz-story": ("9:16", f"Vertical Instagram story for Philz Coffee in San Francisco. Close-up: a barista's hand pours sweet cream into a clear cup of iced coffee packed with fresh muddled mint leaves, creamy swirls blooming through the dark coffee, ice cubes, on a warm wooden coffee bar with paper pour-over cones and a hanging green plant softly blurred behind, golden morning sunlight. Playful white hand-lettered text on the left side reading exactly \"Minty. Creamy. Very SF.\" Small {PHILZ_LOGO} in the top-left corner. Natural, joyful, premium lifestyle photography."),
    "philz-post": ("3:4", f"Instagram feed ad for Philz Coffee. Photo: a Mint Mojito iced coffee (creamy iced coffee topped with a big sprig of fresh mint) in a clear cup printed with the Philz Coffee logo, on a sunlit wooden counter beside a paper pour-over cone slowly dripping coffee, a cozy colorful San Francisco coffee shop softly blurred behind. Huge bold chunky rounded white headline across the top reading exactly \"ONE CUP AT A TIME.\" Small white caps text bottom-left reading exactly \"FRESH MINT. MADE TO ORDER.\" Small {PHILZ_LOGO} top-right. Warm, joyful, professional social media design."),
    "philz-halloween": ("1:1", f"Halloween seasonal Instagram post for Philz Coffee. A white paper hot cup printed with {PHILZ_LOGO} and a clear iced Mint Mojito with fresh mint (its cup also printed with the Philz Coffee logo) side by side on a dark walnut table, surrounded by small heirloom pumpkins, a softly glowing carved jack-o'-lantern, dried autumn leaves and cinnamon sticks, warm candlelight, rich chocolate brown and burnt orange tones. Big playful rounded cream-colored headline at the top reading exactly \"Treats. No tricks.\" Small text at the bottom reading exactly \"HAPPY HALLOWEEN FROM PHILZ · OCT 31\". Premium editorial photography, cozy and festive. Every word spelled exactly as written."),
    "philz-interior": ("16:9", f"Wide interior photograph of a warm, inviting Philz Coffee shop in San Francisco on a sunny morning: a long wooden pour-over bar lined with paper-filter cones and kettles, cups prepared one at a time, cozy mismatched vintage couches and armchairs, warm wood, potted plants, big bright windows. A wall sign shows {PHILZ_LOGO}. No people. Photorealistic interior lifestyle photography."),
    "philz-menu": ("3:4", "Charming hand-drawn chalkboard menu board for Philz Coffee, hanging on a warm wooden wall inside the coffee shop, a potted plant at the edge of frame. Neat, legible white and pastel chalk lettering. Title at the top: \"Philz Favorites\". Then a list, one per line: \"Mint Mojito Iced\", \"Tesora\", \"Philtered Soul\", \"Jacob's Wonderbar\", \"Ecstatic Iced\". Small chalk doodles of mint leaves and a steaming mug. Soft daylight, photorealistic, cozy cafe interior. Every word spelled exactly as written."),
    "tartine-post": ("3:4", "Instagram post for Tartine Bakery in San Francisco's Mission District. Close-up of Tartine-style morning buns — spiraled, caramelized, sugar-crusted laminated pastries with orange zest and cinnamon — next to a dark, blistered, crackly-crusted country sourdough loaf on a rustic wooden counter, warm early-morning light through the bakery window, a little flour dust. Elegant black serif headline on a cream band at the bottom reading exactly \"Worth the line.\" Small black caps text at the top reading exactly \"TARTINE · SAN FRANCISCO\". Warm, appetizing, editorial food photography."),
    "boudin-halloween": ("1:1", "Halloween Instagram post for Boudin Bakery, San Francisco's sourdough bakery since 1849. A golden sourdough loaf shaped and scored like a pumpkin with a little bread stem, next to a classic round sourdough bread bowl filled with steaming creamy clam chowder, on a rustic wooden table by a window with the Golden Gate Bridge and the bay softly blurred outside at dusk, a few small pumpkins, steam rising. Bold vintage-style cream serif headline at the top reading exactly \"Bread bowl season.\" Small text at the bottom reading exactly \"BOUDIN · SAN FRANCISCO SOURDOUGH SINCE 1849\". Warm, cozy, appetizing editorial food photography."),
    "bluebottle-story": ("9:16", "Vertical Instagram story for Blue Bottle Coffee. Ultra-minimal composition: a clear glass of New Orleans-style iced coffee with milk swirling into it, on a pale white marble counter, soft diffused daylight, lots of clean white space, a small white Blue Bottle Coffee paper cup nearby printed with its simple light-blue outline bottle logo. Small, quiet, light-blue sans-serif text near the bottom reading exactly \"Cold, slow, New Orleans.\" Calm, airy, refined minimalist product photography."),
    "birite-story": ("9:16", "Vertical Instagram story for Bi-Rite Creamery in San Francisco. A hand holds up a sugar cone with a generous scoop of salted caramel ice cream, a slow drip running down, in front of the sunny green lawn of Dolores Park with palm trees and the San Francisco skyline softly blurred in the distance, golden afternoon light. Playful bold cream-colored headline reading exactly \"One scoop at a time.\" Small text at the bottom reading exactly \"BI-RITE CREAMERY · 18TH ST, SF\". Joyful, sunny, premium lifestyle photography."),
    "neighbor-post": ("3:4", "Instagram post for Neighbor Bakehouse, a beloved bakery in San Francisco's Dogpatch neighborhood. A wooden tray of golden, shatteringly flaky laminated croissants, spiral morning buns and glossy savory croissants inside a bright glass pastry case, a light, airy industrial bakery with concrete and pale wood, morning light. Bold black condensed sans-serif headline on a white band at the bottom reading exactly \"Flaky by nature.\" Small black caps text at the top reading exactly \"NEIGHBOR BAKEHOUSE · DOGPATCH SF\". Appetizing, editorial food photography."),
    "boulders-banner": ("16:9", "Wide display ad for Dogpatch Boulders, an indoor bouldering gym in San Francisco's Dogpatch neighborhood. A climber seen from behind reaching for a hold on a steep bouldering wall covered in bright multicolor holds, chalk dust floating in the air, a huge industrial warehouse gym with high ceilings and skylights, dramatic light. Huge bold white headline on the left reading exactly \"Send it after work.\" and a small orange rounded button reading exactly \"BOOK A DAY PASS\". Small white text top-left reading exactly \"DOGPATCH BOULDERS\". Energetic, premium fitness brand ad design."),
    "citylights-post": ("3:4", "Instagram post for City Lights Booksellers, the legendary independent bookstore in San Francisco's North Beach. Warm photo of the bookstore storefront at dusk on Columbus Avenue: tall windows glowing warmly, packed with stacked books, the store's sign above the entrance, a cozy autumn evening with a few leaves on the sidewalk. Elegant cream serif headline at the top reading exactly \"Get lost in a good book.\" Small caps text at the bottom reading exactly \"CITY LIGHTS · NORTH BEACH SINCE 1953\". Literary, nostalgic, editorial photography."),
}

# name -> (source still, aspect, motion prompt)
VIDEOS: dict[str, tuple[str, str, str]] = {
    "philz-video": ("philz-story", "9:16", "Slow, satisfying motion: sweet cream keeps pouring into the iced coffee, creamy swirls bloom and spiral through the dark coffee around the fresh mint leaves, ice cubes shift gently, warm sunlight flickers softly, subtle slow camera push-in. Keep the hand-lettered text and logo perfectly still and legible."),
    "boudin-video": ("boudin-halloween", "1:1", "Cozy subtle motion: thick steam rises and curls slowly from the hot clam chowder in the sourdough bread bowl, warm light shimmers on the golden crust, the bay softly glints outside the window, slow gentle camera push-in. Keep all on-screen text perfectly still and legible."),
}


async def wait(api: HiggsfieldAPI, rid: str, label: str, timeout: int = 900) -> dict:
    delay, waited = 3.0, 0.0
    while waited < timeout:
        st = await api.status(rid)
        if st.get("status") in TERMINAL:
            return st
        await asyncio.sleep(delay)
        waited += delay
        delay = min(delay * 1.4, 10)
    raise TimeoutError(label)


async def render_image(api: HiggsfieldAPI, name: str, sem: asyncio.Semaphore) -> str | None:
    aspect, prompt = IMAGES[name]
    async with sem:
        rid = await api.submit(config.HF_IMAGE_ENDPOINT, {
            "prompt": prompt, "aspect_ratio": aspect, "resolution": "2k", "quality": "high", "enhance_prompt": False,
        }, f"arise-showcase-{name}-v2")
        st = await wait(api, rid, name)
    url = result_url(st)
    if st.get("status") != "completed" or not url:
        print(f"✗ {name}: {st.get('status')} {st.get('error')}")
        return None
    async with httpx.AsyncClient(timeout=120) as http:
        data = (await http.get(url)).content
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img.thumbnail((1600, 1600))
    img.save(OUT / f"{name}.jpg", "JPEG", quality=84, optimize=True, progressive=True)
    print(f"✓ {name} ({img.width}x{img.height})")
    return url


async def render_video(api: HiggsfieldAPI, name: str, still_url: str) -> None:
    _, aspect, prompt = VIDEOS[name]
    rid = await api.submit(config.HF_VIDEO_ENDPOINT, {
        "prompt": prompt, "image_url": still_url, "duration": 5, "resolution": "720p",
        "aspect_ratio": aspect, "generate_audio": False,
    }, f"arise-showcase-{name}-v2")
    st = await wait(api, rid, name, timeout=1500)
    url = result_url(st)
    if st.get("status") != "completed" or not url:
        print(f"✗ {name}: {st.get('status')} {st.get('error')}")
        return
    async with httpx.AsyncClient(timeout=300) as http:
        (OUT / f"{name}.mp4").write_bytes((await http.get(url)).content)
    print(f"✓ {name}")


async def main(only: list[str]) -> None:
    api = HiggsfieldAPI(config.HF_CREDENTIALS, config.HF_BASE_URL)
    sem = asyncio.Semaphore(6)
    images = [n for n in IMAGES if not only or n in only or any(VIDEOS.get(v, ("",))[0] == n for v in only)]
    urls = dict(zip(images, await asyncio.gather(*[render_image(api, n, sem) for n in images])))
    videos = [v for v in VIDEOS if not only or v in only or VIDEOS[v][0] in only]
    await asyncio.gather(*[render_video(api, v, urls[VIDEOS[v][0]]) for v in videos if urls.get(VIDEOS[v][0])])


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
