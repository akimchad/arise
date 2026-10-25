"""Compose model prompts for each output format from a brand profile + campaign idea."""

from typing import Optional

from . import config

# engine "ads" = Higgsfield Ads Studio (writes + renders the concept); "image" = Marketing Studio Image (renders our prompt)
FORMATS: dict[str, dict] = {
    "post": {
        "label": "Instagram post", "kind": "image", "aspect": "3:4", "ads_aspect": "4:5", "engine": "ads",
        "frame": "Instagram feed post ad, portrait composition",
        "ad": "Instagram feed ad (4:5 portrait)",
        "text": "headline large and confident near the top",
    },
    "story": {
        "label": "Story", "kind": "image", "aspect": "9:16", "engine": "ads",
        "frame": "Vertical full-bleed Instagram story",
        "ad": "full-screen vertical story ad (9:16) for Instagram and TikTok; keep text out of the top 12% and bottom 15%",
        "text": "headline in the middle third, keeping the top 12% and bottom 15% free of text",
    },
    "banner": {
        "label": "Ad banner", "kind": "image", "aspect": "16:9", "engine": "ads",
        "frame": "Wide 16:9 display ad banner for Meta/X ads",
        "ad": "wide 16:9 display ad for Meta and X, headline on the left and the hero subject on the right",
        "text": "headline on the left third with the hero subject on the right",
    },
    "flyer": {
        "label": "In-store flyer", "kind": "image", "aspect": "2:3", "engine": "ads",
        "frame": "Printed in-store poster / menu-board style flyer",
        "ad": "printed in-store poster / flyer (2:3) with generous margins, designed to hang by the counter or in the window",
        "text": "headline at the top, small supporting text below, generous margins",
    },
    "wallpaper": {
        "label": "Phone wallpaper", "kind": "image", "aspect": "9:16", "engine": "image",
        "frame": "Minimal aesthetic phone wallpaper for fans of the brand",
        "text": "no headline at all; only a tiny brand wordmark at the very bottom; calm empty space in the upper third for the clock",
    },
    "video": {
        "label": "Reel", "kind": "video", "aspect": "9:16", "source": "story",
    },
}

TONES: dict[str, dict] = {
    "auto": {},
    "bold": {"typography": "huge heavy condensed uppercase sans-serif", "mood": "high contrast, punchy, confident"},
    "elegant": {"typography": "refined high-contrast thin serif", "mood": "soft, airy, editorial, understated"},
    "playful": {"typography": "chunky rounded friendly display type", "mood": "bright, cheerful, lively color"},
    "minimal": {"typography": "small clean modern sans-serif with lots of negative space", "mood": "calm, clean, minimal"},
    "cozy": {"typography": "warm hand-lettered script", "mood": "warm, intimate, golden light"},
}


def _palette(profile: dict, accent: Optional[str]) -> str:
    swatches = [f"{s.get('name')} {s.get('hex')}" for s in profile.get("palette", [])[:4]]
    if accent:
        swatches.insert(0, f"accent {accent}")
    return ", ".join(swatches)


def image_prompt(fmt: str, profile: dict, idea: dict, overrides: dict, has_refs: bool) -> str:
    spec = FORMATS[fmt]
    tone = TONES.get(overrides.get("tone") or "auto", {})
    headline = (overrides.get("headline") or idea.get("headline") or "").strip()
    subline = (overrides.get("subline") if overrides.get("subline") is not None else idea.get("subline") or "").strip()
    typography = tone.get("typography") or idea.get("typography") or "bold modern sans-serif"
    mood = tone.get("mood") or idea.get("mood") or ""
    name = profile.get("name", "")
    where = f" in {profile['location']}" if profile.get("location") else ""
    kind = (profile.get("business_type") or "local business").lower()
    article = "an" if kind[:1] in "aeiou" else "a"

    parts = [
        f"{spec['frame']} for {name}, {article} {kind}{where}.",
        f"Photo: {idea.get('scene', '')}.",
    ]
    if has_refs:
        parts.append("Use the provided reference photo(s) of the real business/product as the hero subject, "
                     "preserving how it actually looks.")
    if mood:
        parts.append(f"Mood and lighting: {mood}.")
    if fmt == "wallpaper":
        parts.append(f"Text: {spec['text']} reading exactly \"{name}\".")
    else:
        text = (f"On-image text: headline reading exactly \"{headline}\" set in {typography}, {spec['text']}."
                if headline else
                f"On-image text: a short, punchy headline (max 5 words) that fits the campaign \"{idea.get('title', '')}\", "
                f"set in {typography}, {spec['text']}.")
        if subline:
            text += f" Small supporting text reading exactly \"{subline}\"."
        text += f" A small \"{name}\" wordmark in a corner."
        parts.append(text)
    parts.append(f"Brand colors: {_palette(profile, overrides.get('accent'))}.")
    if profile.get("visual_style"):
        parts.append(f"Art direction: {profile['visual_style']}")
    parts.append("Premium, professional social media design; crisp legible typography with every word spelled "
                 "exactly as written; no other text, no watermarks, no UI elements.")
    return " ".join(p for p in parts if p.strip())


def engine_for(fmt: str) -> str:
    return "image" if config.HF_IMAGE_ENGINE == "image" else FORMATS[fmt].get("engine", "image")


def aspect_for(fmt: str) -> str:
    spec = FORMATS[fmt]
    return spec.get("ads_aspect", spec["aspect"]) if engine_for(fmt) == "ads" else spec["aspect"]


def ads_brief(fmt: str, profile: dict, idea: dict, overrides: dict, has_refs: bool) -> str:
    """Creative brief for Higgsfield Ads Studio, which prepares the concept and renders it."""
    spec = FORMATS[fmt]
    tone_key = overrides.get("tone") or "auto"
    tone = TONES.get(tone_key, {})
    headline = (overrides.get("headline") if overrides.get("headline") is not None else idea.get("headline") or "").strip()
    subline = (overrides.get("subline") if overrides.get("subline") is not None else idea.get("subline") or "").strip()
    name = profile.get("name", "")
    kind = (profile.get("business_type") or "local business").lower()
    article = "an" if kind[:1] in "aeiou" else "a"
    where = f" in {profile['location']}" if profile.get("location") else ""
    items = ", ".join(profile.get("signature_items", [])[:4])

    lines = [
        f"Create one {spec['ad']} for {name}, {article} {kind}{where}.",
        f"Campaign: \"{idea.get('title', '')}\" — {idea.get('hook', '')} Moment: {idea.get('moment', '')}.",
        f"Why it works now: {idea.get('why_now', '')}",
        (f"Headline: use exactly \"{headline}\" as the main on-image headline." if headline
         else "Headline: write one short, punchy headline (max 6 words) in the brand's voice."),
    ]
    if subline:
        lines.append(f"Supporting line (small): \"{subline}\".")
    lines += [
        f"Visual direction: {idea.get('scene', '')}.",
        f"Mood and lighting: {tone.get('mood') or idea.get('mood', '')}.",
        f"Typography: {tone.get('typography') or idea.get('typography', 'bold modern sans-serif')}.",
        f"Brand: {profile.get('description', '')} Signature items: {items}. Voice: {', '.join(profile.get('voice', []))}.",
        f"Brand colors: {_palette(profile, overrides.get('accent'))}.",
    ]
    if profile.get("visual_style"):
        lines.append(f"Art direction: {profile['visual_style']}")
    if has_refs:
        lines.append("Use the reference photos of the real business and products as the hero; keep them recognizable.")
    lines.append(f"Show \"{name}\" as a small, tasteful wordmark. Call to action: {idea.get('cta') or 'Visit us'}.")
    lines.append("No other brands, logos or watermarks. Keep every word correctly spelled, crisp and legible. "
                 "Premium, scroll-stopping, unmistakably local.")
    return "\n".join(lines)[:7800]


def video_prompt(idea: dict) -> str:
    motion = idea.get("video_motion") or "gentle natural motion, slow cinematic push-in"
    return (f"{motion}. Subtle, premium, cinematic; slow camera push-in. "
            "Keep all on-screen text and logos perfectly still and legible.")
