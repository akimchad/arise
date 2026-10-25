"""Shapes shared by the LLM layer, the heuristics fallback and the API."""

from typing import Literal

from pydantic import BaseModel, Field

Category = Literal[
    "cafe", "bakery", "restaurant", "bar", "retail", "beauty", "fitness", "florist", "services", "other"
]
Format = Literal["post", "story", "banner", "flyer", "wallpaper", "video"]
MomentType = Literal["holiday", "trend", "seasonal", "product", "community", "evergreen"]


class Swatch(BaseModel):
    name: str = Field(description="Evocative color name, e.g. 'Matcha'")
    hex: str = Field(description="#RRGGBB")


class BrandProfile(BaseModel):
    name: str
    category: Category
    business_type: str = Field(description="Short label, e.g. 'Matcha bar' or 'Neighborhood barbershop'")
    tagline: str = Field(description="A short line in the brand's own voice")
    description: str = Field(description="1-2 sentences on what the business is and what it sells")
    location: str = Field(description="City and region if known, else empty string")
    neighborhood: str = Field(description="One sentence on the local community/vibe around the business")
    audience: str = Field(description="1-2 sentences on who their customers are and what they value")
    audience_tags: list[str] = Field(description="3-5 short audience descriptors")
    voice: list[str] = Field(description="3-4 adjectives for the brand voice")
    palette: list[Swatch] = Field(description="3-5 brand colors, most important first")
    visual_style: str = Field(description="Photography/art direction that fits the brand, one or two sentences")
    signature_items: list[str] = Field(description="3-6 signature products or services")
    differentiators: list[str] = Field(description="2-4 things that make them different")
    content_pillars: list[str] = Field(description="3-4 recurring content themes")


class CampaignIdea(BaseModel):
    title: str = Field(description="Campaign name, e.g. 'Pumpkin Spice Matcha Week'")
    moment: str = Field(description="What it ties to, e.g. 'Halloween · Oct 31' or 'Trending: cozy cafe ASMR'")
    moment_type: MomentType
    moment_date: str = Field(description="ISO date of the moment, or empty string if not date-bound")
    hook: str = Field(description="One-line pitch of the idea")
    why_now: str = Field(description="1-2 sentences on why this will work this week for this business")
    headline: str = Field(description="On-image headline, max 6 words, punchy")
    subline: str = Field(description="Optional small on-image text, max 8 words, or empty string")
    scene: str = Field(description="Detailed photographic scene for the creative: subject, props, setting. No text.")
    typography: str = Field(description="Type treatment for the headline, e.g. 'huge bold condensed white sans-serif'")
    mood: str = Field(description="Lighting, color and mood direction")
    video_motion: str = Field(description="How the hero image should move in a 5s clip, e.g. 'steam rises, slow push-in'")
    caption: str = Field(description="Ready-to-post social caption in the brand voice, 1-3 short sentences")
    hashtags: list[str] = Field(description="4-8 hashtags without the # symbol")
    cta: str = Field(description="Short call to action, e.g. 'Order ahead'")
    formats: list[Format] = Field(description="Best formats for this idea, most important first")


class IdeaSet(BaseModel):
    trend_notes: list[str] = Field(description="2-4 short notes on the trend or calendar signals you used")
    ideas: list[CampaignIdea]
