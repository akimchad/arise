"""Runtime configuration, read once from the environment (and backend/.env)."""

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


MONGO_URL = os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017")
DB_NAME = os.environ.get("DB_NAME", "arise")

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-only-change-me")
JWT_TTL_DAYS = _int("JWT_TTL_DAYS", 30)

# Claude (brand analysis, trend research, campaign ideas)
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-5-5")

# Higgsfield API (https://console.higgsfield.ai) — "key_id:key_secret"
HF_CREDENTIALS = os.environ.get("HF_CREDENTIALS", "")
if not HF_CREDENTIALS and os.environ.get("HF_API_KEY_ID"):
    HF_CREDENTIALS = f"{os.environ['HF_API_KEY_ID']}:{os.environ.get('HF_API_KEY_SECRET', '')}"
HF_BASE_URL = os.environ.get("HF_BASE_URL", "https://api.higgsfield.ai")
# Images: GPT Image 2.5 Sunburst (Marketing Studio). Videos: Wan 3.0 image-to-video.
HF_IMAGE_ENDPOINT = os.environ.get("HF_IMAGE_ENDPOINT", "marketing-studio/image/sunburst")
HF_IMAGE_QUALITY = os.environ.get("HF_IMAGE_QUALITY", "high")
HF_VIDEO_ENDPOINT = os.environ.get("HF_VIDEO_ENDPOINT", "alibaba/wan-3.0/image-to-video")
HF_VIDEO_RESOLUTION = os.environ.get("HF_VIDEO_RESOLUTION", "720p")
HF_ADS_ENDPOINT = os.environ.get("HF_ADS_ENDPOINT", "higgsfield/ads-studio/v1.0")
# "image": render Arise's prompt with HF_IMAGE_ENDPOINT (default); "ads": Ads Studio writes + renders the concept
HF_IMAGE_ENGINE = os.environ.get("HF_IMAGE_ENGINE", "image")

# "live" calls Higgsfield; "demo" replays showcase media (no credentials needed).
GENERATION_MODE = os.environ.get("GENERATION_MODE", "live" if HF_CREDENTIALS else "demo")

# Fair-use limits for the hackathon demo
DAILY_IMAGE_LIMIT = _int("DAILY_IMAGE_LIMIT", 8)
DAILY_VIDEO_LIMIT = _int("DAILY_VIDEO_LIMIT", 2)
GLOBAL_DAILY_IMAGE_LIMIT = _int("GLOBAL_DAILY_IMAGE_LIMIT", 400)
GLOBAL_DAILY_VIDEO_LIMIT = _int("GLOBAL_DAILY_VIDEO_LIMIT", 60)
ANON_ANALYSES_PER_HOUR = _int("ANON_ANALYSES_PER_HOUR", 6)

# Public origin used for share links (falls back to the request's origin)
PUBLIC_URL = os.environ.get("PUBLIC_URL", "").rstrip("/")

FRONTEND_BUILD = Path(os.environ.get("FRONTEND_BUILD", ROOT.parent / "frontend" / "build"))
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", ROOT / "uploads"))
