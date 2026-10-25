"""Arise's built-in brand reader and campaign playbook (no LLM needed).

Reads a business from scraped signals, then pitches timely concepts from the marketing calendar plus a
seasonal playbook of formats that consistently perform for local businesses. Higgsfield Ads Studio turns
each concept into finished creatives."""

import hashlib
import random
import re
from collections import Counter
from datetime import date
from typing import Optional

from . import moments
from .models import BrandProfile, CampaignIdea, IdeaSet, Swatch

# keyword -> (category, label); scored against name, title, description and page text
TYPES: list[tuple[tuple[str, ...], str, str]] = [
    (("matcha",), "cafe", "Matcha bar"),
    (("creamery", "ice cream", "gelato", "frozen yogurt"), "cafe", "Ice cream shop"),
    (("boba", "bubble tea", "tea house", "teahouse"), "cafe", "Tea shop"),
    (("coffee", "espresso", "roaster", "cafe", "café"), "cafe", "Coffee shop"),
    (("donut", "doughnut"), "bakery", "Donut shop"),
    (("sourdough",), "bakery", "Sourdough bakery"),
    (("bakery", "bakehouse", "patisserie", "pâtisserie", "boulangerie", "croissant"), "bakery", "Bakery"),
    (("chocolate", "chocolatier", "confection"), "retail", "Chocolate shop"),
    (("ramen",), "restaurant", "Ramen shop"),
    (("pizzeria", "pizza"), "restaurant", "Pizzeria"),
    (("taqueria", "burrito", "tacos", "taco"), "restaurant", "Taqueria"),
    (("sushi", "omakase"), "restaurant", "Sushi bar"),
    (("burger",), "restaurant", "Burger joint"),
    (("dim sum", "dumpling"), "restaurant", "Dumpling house"),
    (("brunch",), "restaurant", "Brunch spot"),
    (("restaurant", "kitchen", "bistro", "trattoria", "dining", "eatery"), "restaurant", "Restaurant"),
    (("brewery", "taproom", "brewing"), "bar", "Brewery"),
    (("wine bar", "natural wine", "wine shop"), "bar", "Wine bar"),
    (("cocktail", "speakeasy"), "bar", "Cocktail bar"),
    (("bookstore", "booksellers", "bookshop", "books"), "retail", "Bookstore"),
    (("bouldering", "boulders", "climbing"), "fitness", "Climbing gym"),
    (("yoga",), "fitness", "Yoga studio"),
    (("pilates",), "fitness", "Pilates studio"),
    (("cycling studio", "spin class", "indoor cycling"), "fitness", "Cycling studio"),
    (("gym", "fitness", "crossfit", "boxing"), "fitness", "Gym"),
    (("barbershop", "barber"), "beauty", "Barbershop"),
    (("nail salon", "manicure", "nails"), "beauty", "Nail studio"),
    (("salon", "hair"), "beauty", "Hair salon"),
    (("spa", "facial", "massage", "skincare"), "beauty", "Spa"),
    (("florist", "flowers", "bouquet", "floral"), "florist", "Florist"),
    (("plant shop", "nursery", "plants"), "retail", "Plant shop"),
    (("boutique", "clothing", "apparel", "fashion"), "retail", "Boutique"),
    (("gift shop", "gifts", "homeware", "ceramics"), "retail", "Gift shop"),
]

LEXICON: dict[str, list[str]] = {
    "cafe": ["mint mojito", "cold brew", "nitro cold brew", "new orleans iced coffee", "pour-over", "pour over", "latte",
             "cappuccino", "cortado", "flat white", "espresso", "iced matcha", "matcha latte", "hojicha", "chai latte",
             "mocha", "drip coffee", "salted caramel", "ice cream", "gelato", "waffle cone", "sundae", "affogato",
             "boba", "milk tea", "pastries", "croissant", "scone", "bagel", "avocado toast"],
    "bakery": ["morning bun", "croissant", "sourdough", "country loaf", "baguette", "pain au chocolat", "kouign amann",
               "cinnamon roll", "bread bowl", "clam chowder", "focaccia", "brioche", "fruit tart", "cake", "cookies",
               "donut", "bagel", "pie", "eclair", "macaron", "danish", "scone", "char siu croissant"],
    "restaurant": ["ramen", "tonkotsu", "pizza", "burrito", "tacos", "sushi", "burger", "pasta", "dumplings", "pho",
                   "fried chicken", "noodles", "brunch", "oysters", "clam chowder", "dim sum", "curry", "tasting menu"],
    "bar": ["cocktails", "natural wine", "craft beer", "ipa", "happy hour", "mezcal", "negroni", "spritz", "martini"],
    "retail": ["new releases", "staff picks", "books", "poetry", "vinyl", "plants", "candles", "gift sets", "jewelry",
               "knitwear", "ceramics", "stationery", "chocolate bars", "truffles"],
    "fitness": ["bouldering", "day pass", "yoga", "pilates", "spin", "hiit", "intro class", "memberships",
                "personal training", "climbing"],
    "beauty": ["haircut", "fade", "color", "balayage", "manicure", "facial", "brows", "lashes", "massage", "blowout"],
    "florist": ["bouquets", "arrangements", "wedding florals", "dried flowers", "roses", "peonies", "plants"],
}

STOP = {"home", "menu", "shop", "about", "about us", "contact", "locations", "location", "order", "order now", "cart",
        "login", "log in", "sign in", "sign up", "rewards", "gift cards", "subscribe", "careers", "faq", "privacy",
        "terms", "welcome", "news", "blog", "events", "catering", "delivery", "search", "account", "more", "visit",
        "hours", "learn more", "our story", "story", "press", "jobs", "team", "follow us", "newsletter"}

CATEGORY_DEFAULTS = {
    "cafe": dict(voice=["Warm", "Easygoing", "Crafted"], audience="Regulars on their morning routine, remote workers and weekend wanderers who care about a good cup and a friendly face.",
                 tags=["Morning regulars", "Remote workers", "Weekend wanderers"], style="Sunlit counter shots, steam and texture, honest close-ups of the cup, warm wood and plants.",
                 pillars=["Signature drinks", "Behind the bar", "Seasonal specials", "Regulars & community"]),
    "bakery": dict(voice=["Warm", "Artisanal", "Generous"], audience="Neighbors who line up early, families picking up weekend treats and food lovers who travel for a great pastry.",
                   tags=["Early risers", "Families", "Food lovers"], style="Golden morning light, flaky texture, flour dust, rustic wood and linen.",
                   pillars=["Fresh from the oven", "Baker's craft", "Seasonal bakes", "Pre-orders & gifting"]),
    "restaurant": dict(voice=["Bold", "Welcoming", "Flavor-first"], audience="Locals looking for a go-to spot, date nights and friends who share plates and photos.",
                       tags=["Locals", "Date nights", "Friend groups"], style="Moody, appetizing close-ups with steam and gloss, warm practical lighting.",
                       pillars=["Signature dishes", "In the kitchen", "Specials", "Atmosphere"]),
    "bar": dict(voice=["Playful", "Confident", "After-hours"], audience="After-work crowds, weekend groups and enthusiasts who appreciate a well-made drink.",
                tags=["After-work", "Weekend groups", "Enthusiasts"], style="Low warm light, glassware highlights, rich shadows.",
                pillars=["Signature pours", "Behind the bar", "Events", "Happy hour"]),
    "retail": dict(voice=["Curated", "Friendly", "Thoughtful"], audience="Locals and visitors who love discovering something special and supporting independent shops.",
                   tags=["Browsers", "Gift-givers", "Shop-local fans"], style="Styled flat lays and inviting storefront shots in natural light.",
                   pillars=["New arrivals", "Staff picks", "Gift ideas", "The shop"]),
    "fitness": dict(voice=["Energetic", "Encouraging", "Community"], audience="Busy locals building a routine, beginners looking for a welcoming start and regulars chasing goals.",
                    tags=["After-work", "Beginners", "Regulars"], style="Dynamic action, chalk and sweat, dramatic light, real effort.",
                    pillars=["Classes", "Member wins", "Coaching tips", "Community"]),
    "beauty": dict(voice=["Polished", "Warm", "Confident"], audience="Locals who want to look and feel their best with a team they trust.",
                   tags=["Regular clients", "Event-goers", "Self-care fans"], style="Clean, flattering light, crisp detail shots, calm interiors.",
                   pillars=["Transformations", "The team", "Care tips", "Booking"]),
    "florist": dict(voice=["Romantic", "Artful", "Seasonal"], audience="Gift-givers, event planners and anyone who wants their home to feel alive.",
                    tags=["Gift-givers", "Couples", "Event planners"], style="Airy light, lush textures, seasonal color stories.",
                    pillars=["Seasonal stems", "Arrangements", "Events", "In the studio"]),
}
for _k in ("services", "other"):
    CATEGORY_DEFAULTS[_k] = dict(voice=["Friendly", "Reliable", "Local"], audience="Neighbors who value a trusted local business and a personal touch.",
                                 tags=["Locals", "Regulars", "New neighbors"], style="Natural light, real people and places, warm and honest.",
                                 pillars=["What we do", "Behind the scenes", "Customer love", "Offers"])

DEFAULT_PALETTE = {
    "cafe": [("Espresso", "#3b261e"), ("Cream", "#efe3cc"), ("Caramel", "#c4843f")],
    "bakery": [("Crust", "#b8742f"), ("Flour", "#f4ede1"), ("Ink", "#2b2420")],
    "restaurant": [("Ember", "#c2410c"), ("Linen", "#f5efe6"), ("Char", "#1f1b18")],
    "bar": [("Velvet", "#5b1a2e"), ("Brass", "#c9a45c"), ("Night", "#141217")],
    "retail": [("Clay", "#b5643c"), ("Oat", "#efe7da"), ("Ink", "#1e1e1e")],
    "fitness": [("Volt", "#ff5b1f"), ("Night", "#121212"), ("Chalk", "#f2f0eb")],
    "beauty": [("Blush", "#e8b4a6"), ("Cream", "#f7f0e8"), ("Espresso", "#2e211c")],
    "florist": [("Petal", "#e7a1a6"), ("Stem", "#4e6b45"), ("Paper", "#f6f0e6")],
    "services": [("Signal", "#ff5b1f"), ("Paper", "#f5f1ea"), ("Ink", "#121212")],
    "other": [("Signal", "#ff5b1f"), ("Paper", "#f5f1ea"), ("Ink", "#121212")],
}

US_CITIES = ["San Francisco", "Oakland", "Berkeley", "San Jose", "Palo Alto", "Los Angeles", "San Diego", "Seattle",
             "Portland", "New York", "Brooklyn", "Chicago", "Austin", "Denver", "Boston", "Miami", "Atlanta",
             "Philadelphia", "Washington", "Nashville", "New Orleans", "Minneapolis", "Phoenix", "Dallas", "Houston",
             "Sacramento", "Santa Monica", "Pasadena", "Honolulu", "Salt Lake City", "Las Vegas", "Detroit", "Toronto",
             "Vancouver", "London", "Paris", "Sydney", "Melbourne", "Tokyo", "Mexico City"]
SF_HOODS = ["Dogpatch", "Mission District", "the Mission", "North Beach", "Hayes Valley", "SoMa", "Castro",
            "Noe Valley", "Marina", "Haight", "Fisherman's Wharf", "Chinatown", "Potrero Hill", "Bernal Heights",
            "Inner Sunset", "Outer Sunset", "Richmond District", "Japantown", "Nob Hill", "Pacific Heights"]

GENERIC_TITLES = {"home", "homepage", "welcome", "official site", "official website", "shop", "online store", "menu"}


def _blob(scraped: dict, notes: str) -> dict[str, str]:
    return {
        "name": " ".join(filter(None, [(scraped.get("maps") or {}).get("name"), scraped.get("site_name"), scraped.get("title")])).lower(),
        "meta": " ".join(filter(None, [scraped.get("description"), " ".join(scraped.get("headings") or []),
                                       str((scraped.get("maps") or {}).get("listing", "")), notes])).lower(),
        "text": (scraped.get("text") or "").lower(),
    }


def _domain(scraped: dict) -> str:
    host = re.sub(r"^www\.", "", re.sub(r"^https?://", "", scraped.get("final_url") or scraped.get("url", ""))).split("/")[0]
    return host.split(".")[0].replace("-", "")


def _clean_name(scraped: dict) -> str:
    domain = _domain(scraped)
    for candidate in ((scraped.get("maps") or {}).get("name"), scraped.get("site_name")):
        if candidate and candidate.strip() and candidate.strip().lower() not in GENERIC_TITLES:
            return candidate.strip()[:60]
    segments = [s.strip() for s in re.split(r"\s[|–—\-·:]\s", scraped.get("title") or "") if s.strip()]
    segments = [s for s in segments if s.lower() not in GENERIC_TITLES]
    for seg in segments:
        squashed = re.sub(r"[^a-z0-9]", "", seg.lower())
        if squashed and (squashed in domain or domain in squashed):
            return seg[:60]
    if segments and len(segments[0]) <= 40:
        return segments[0]
    if scraped.get("instagram_handle"):
        return scraped["instagram_handle"]
    return domain.replace("_", " ").title() or "Your business"


def _business_type(b: dict[str, str]) -> tuple[str, str]:
    best, score = ("other", "Local business"), 0
    for words, cat, label in TYPES:
        s = sum(b["name"].count(w) * 6 + b["meta"].count(w) * 3 + min(b["text"].count(w), 6) for w in words)
        if s > score:
            best, score = (cat, label), s
    return best


HEADING_NOISE = ("welcome", "our ", "your ", "we ", "who ", "shop", "order", "online", "store", "explore", "happenings",
                 "trending", "favorites", "favourites", "new and", "stop by", "learn", "discover", "join", "visit",
                 "about", "find", "get ", "hungry", "sign", "subscribe", "follow", "community", "stewardship", "love",
                 "at home", "gift", "event", "news", "location", "hours", "contact", "menu", "more", "career", "press",
                 "catering", "delivery", "reward", "why ", "how ", "what ", "book now", "reserve", "cart", "faq")


def _signature_items(scraped: dict, b: dict[str, str], category: str, name: str) -> list[str]:
    found: Counter[str] = Counter()
    display: dict[str, str] = {}
    corpus = b["meta"] + " " + b["text"]
    for term in LEXICON.get(category, []):
        n = corpus.count(term)
        if n:
            found[term] += 10 + n * 2 + (6 if term in b["meta"] else 0)
            display[term] = term.title()
    candidates: list[str] = []
    for item in scraped.get("jsonld") or []:
        if item.get("@type") in ("Product", "MenuItem") and isinstance(item.get("name"), str):
            candidates.append(item["name"])
    candidates += [h for h in (scraped.get("headings") or []) if 3 <= len(h) <= 32]
    name_tokens = {t for t in re.findall(r"[a-z]{4,}", name.lower())}
    for c in candidates:
        cl = c.strip().lower()
        if (cl in STOP or any(n in cl for n in HEADING_NOISE) or "?" in cl or "!" in cl or len(cl.split()) > 4
                or not re.search(r"[a-z]", cl) or any(t in cl for t in name_tokens)):
            continue
        found[cl] += 3 + min(corpus.count(cl), 5)
        display.setdefault(cl, c.strip() if not c.strip().isupper() else c.strip().title())
    items: list[str] = []
    for term, _ in found.most_common(14):
        if any(term in i.lower() or i.lower() in term for i in items):
            continue
        items.append(display.get(term, term))
        if len(items) == 5:
            break
    return items


BAY_AREA = ["San Francisco", "Oakland", "Berkeley", "San Jose", "Palo Alto"]


def _location(scraped: dict, text: str) -> tuple[str, str]:
    maps = scraped.get("maps") or {}
    for item in scraped.get("jsonld") or []:
        addr = item.get("address")
        if isinstance(addr, dict) and addr.get("addressLocality"):
            return (", ".join(filter(None, [addr["addressLocality"], addr.get("addressRegion", "")])), "")
    if maps.get("address"):
        city = next((c for c in US_CITIES if c.lower() in maps["address"].lower()), "")
        parts = [p.strip() for p in maps["address"].split(",")]
        return (city or (parts[-2] if len(parts) >= 2 else parts[0]), "")
    hood = next((h for h in SF_HOODS if h.lower() in text), "")
    if hood:
        return ("San Francisco", hood)
    bay = Counter({c: text.count(c.lower()) for c in BAY_AREA})
    city, n = bay.most_common(1)[0]
    if n:
        return (city, "")
    counts = Counter({c: text.count(c.lower()) for c in US_CITIES})
    city, n = counts.most_common(1)[0]
    return (city if n >= 2 else "", "")


def profile_from_signals(scraped: dict, notes: str = "", palette: Optional[list[dict]] = None) -> BrandProfile:
    b = _blob(scraped, notes)
    category, label = _business_type(b)
    name = _clean_name(scraped)
    items = _signature_items(scraped, b, category, name) or {
        "cafe": ["Espresso drinks", "Seasonal lattes", "House pastries"],
        "bakery": ["Morning pastries", "Fresh bread", "Seasonal bakes"],
        "restaurant": ["House specialty", "Seasonal special", "Dessert"],
        "bar": ["Signature cocktails", "Happy hour", "Bar snacks"],
        "retail": ["New arrivals", "Bestsellers", "Gift sets"],
        "fitness": ["Intro class", "Memberships", "Signature class"],
        "beauty": ["Signature service", "Treatments", "Gift cards"],
        "florist": ["Seasonal bouquets", "Arrangements", "Event florals"],
    }.get(category, ["Signature product", "Bestseller", "New arrival"])
    city, hood = _location(scraped, b["meta"] + " " + b["text"])
    location = ", ".join(filter(None, [hood if hood.lower() != "the mission" else "Mission District", city]))
    d = CATEGORY_DEFAULTS[category]
    desc = (scraped.get("description") or "").strip()
    if not desc:
        desc = f"{name} is {'an' if label[0].lower() in 'aeiou' else 'a'} {label.lower()} known for {_lc(items[0])}."
    tagline = re.split(r"(?<=[.!?])\s|\s[–—|]\s", desc)[0].strip()
    if len(tagline) > 90:
        tagline = tagline[:90].rsplit(" ", 1)[0].rstrip(",;:") + "…"
    swatches = [Swatch(**s) for s in (palette or [])] or [Swatch(name=n, hex=h) for n, h in DEFAULT_PALETTE[category]]
    where = hood or city
    return BrandProfile(
        name=name, category=category, business_type=label, tagline=tagline, description=desc[:300],
        location=location,
        neighborhood=(f"A neighborhood favorite in {where} with a loyal local following." if where
                      else "A neighborhood favorite with a loyal local following."),
        audience=d["audience"], audience_tags=d["tags"], voice=d["voice"], palette=swatches,
        visual_style=d["style"], signature_items=items,
        differentiators=[f"Known for {_lc(items[0])}", "Locally loved"], content_pillars=d["pillars"],
    )


# ---------------------------------------------------------------- campaign playbook

HOLIDAY_COPY: dict[str, dict] = {
    "Halloween": dict(headlines=["Treats. No tricks.", "Spooky season, served.", "Something wicked good."],
                      scene="{item} styled for Halloween at {name}: small heirloom pumpkins, a softly glowing jack-o'-lantern, dried autumn leaves",
                      mood="warm candlelight, deep shadows, burnt orange and brand tones", motion="candles flicker, a leaf drifts down, slow push-in",
                      caption="No costume required — just come hungry for {item_l}. Happy Halloween from {name}! 🎃", tags=["halloween", "spookyseason"]),
    "Día de los Muertos": dict(headlines=["Remember. Celebrate. Gather.", "Marigolds & good company."],
                               scene="{item} on a table with bright marigolds, papel picado and candles at {name}",
                               mood="vibrant marigold orange and magenta, warm candlelight", motion="papel picado flutters, candles flicker, slow push-in",
                               caption="Honoring the ones we love, together. Come gather with us at {name}.", tags=["diadelosmuertos", "marigolds"]),
    "Daylight saving ends": dict(headlines=["Fall back. Slow down.", "Cozy hour starts now."],
                                 scene="{item} glowing under a warm lamp at dusk inside {name}, early evening blue outside the window",
                                 mood="blue hour outside, warm amber inside", motion="lights flicker on outside, steam rises, slow push-in",
                                 caption="Darker evenings call for {item_l}. Your cozy hour starts at {name}.", tags=["fallback", "cozyseason"]),
    "Diwali": dict(headlines=["Light it up.", "Made for the season of light."],
                   scene="{item} surrounded by glowing diyas and marigold petals at {name}", mood="golden glow, jewel tones",
                   motion="diya flames flicker, warm bokeh, slow push-in", caption="Wishing you light and sweetness this Diwali. ✨", tags=["diwali", "festivaloflights"]),
    "Veterans Day": dict(headlines=["Thank you for your service."], scene="{item} on the counter at {name}, a small folded flag and morning light",
                         mood="calm, respectful, natural light", motion="soft light shift, slow push-in",
                         caption="To every veteran in our community: thank you. Come see us at {name}.", tags=["veteransday", "thankyou"]),
    "Thanksgiving": dict(headlines=["Grateful for you.", "Gather 'round.", "Bring something good."],
                         scene="{item} at the center of a shared harvest table with candles, linen and autumn leaves",
                         mood="golden-hour warmth, harvest tones", motion="candles flicker, hands pass a plate, slow push-in",
                         caption="We're grateful for every one of you. Pre-order {item_l} for the table and let us do the work.", tags=["thanksgiving", "grateful"]),
    "Black Friday": dict(headlines=["Our best deal of the year.", "Friday, but better."], scene="{item} styled as a gift with bold tags at {name}",
                         mood="high-contrast, punchy brand colors", motion="tag swings, light sweep, slow push-in",
                         caption="The best of {name}, our best deal of the year. This Friday only.", tags=["blackfriday", "deal"]),
    "Small Business Saturday": dict(headlines=["Shop small. Feel big.", "Thank you, neighbors.", "Local looks good on you."],
                                    scene="Inviting storefront of {name} at golden hour with {item_l} in the window",
                                    mood="warm late-afternoon glow, welcoming", motion="people pass by, warm light flickers, slow push-in",
                                    caption="To everyone who walks through our door — thank you. Shop small with us this Saturday.", tags=["smallbusinesssaturday", "shopsmall"]),
    "Cyber Monday": dict(headlines=["Gift it in one click."], scene="{item} and a gift card on a clean desk next to a laptop",
                         mood="crisp, bright, modern", motion="gift card slides in, slow push-in",
                         caption="Gift cards and online orders from {name} — the easiest gift you'll give.", tags=["cybermonday", "giftideas"]),
    "Giving Tuesday": dict(headlines=["Give local."], scene="{item} on the counter at {name} beside a donation jar with handwritten sign",
                           mood="warm, hopeful, natural light", motion="soft light shift, slow push-in",
                           caption="This Giving Tuesday we're giving back to the neighborhood that gives us so much.", tags=["givingtuesday", "givelocal"]),
    "Hanukkah begins": dict(headlines=["Eight nights of good things."], scene="{item} beside a glowing menorah and blue and silver accents",
                            mood="candle glow, blue and gold", motion="candle flames flicker, slow push-in",
                            caption="Happy Hanukkah from all of us at {name}. 🕎", tags=["hanukkah", "festivaloflights"]),
    "First day of winter": dict(headlines=["Winter, warmly.", "Hello, cozy season."], scene="{item} by a frosty window with warm lights inside {name}",
                                mood="cool blue outside, warm glow inside", motion="snow-like dust drifts past the window, steam rises",
                                caption="Winter's here. We've got the {item_l} and the warm seat. ❄️", tags=["winter", "cozyseason"]),
    "Christmas": dict(headlines=["Merry everything.", "Wrapped with love."], scene="{item} with evergreen sprigs, twinkle lights and kraft-paper gifts",
                      mood="twinkle-light glow, rich greens and reds", motion="lights twinkle, slow push-in",
                      caption="Merry everything from {name}. Holiday hours are in our bio. 🎄", tags=["christmas", "holidays"]),
    "New Year's Eve": dict(headlines=["Here's to next year.", "One last toast."], scene="{item} with gold confetti and sparkling glasses at {name}",
                           mood="sparkle, gold and deep night tones", motion="confetti falls, glasses clink, slow push-in",
                           caption="Thank you for an amazing year. See you in the next one! 🥂", tags=["newyearseve", "cheers"]),
    "New Year's Day": dict(headlines=["New year, same favorite."], scene="{item} in crisp morning light at {name}", mood="fresh, bright, clean",
                           motion="light pours in, slow push-in", caption="New year, same favorite. Start it right at {name}.", tags=["newyear", "freshstart"]),
    "Valentine's Day": dict(headlines=["Made for two.", "Love at first taste."], scene="two {item_l} side by side with a few petals and a handwritten note",
                            mood="soft pinks and warm light", motion="petals drift, slow push-in", caption="Bring your favorite person. Or treat yourself. ❤️", tags=["valentinesday", "datenight"]),
}

FOOD = {"cafe", "bakery", "restaurant", "bar"}
DECOR = {
    "Halloween": "heirloom pumpkins, a softly glowing jack-o'-lantern and autumn leaves",
    "Día de los Muertos": "bright marigolds, papel picado and candles",
    "Daylight saving ends": "warm lamps glowing against the early dusk",
    "Diwali": "glowing diyas and marigold petals",
    "Veterans Day": "a small folded flag and soft morning light",
    "Thanksgiving": "candles, linen and harvest leaves",
    "Black Friday": "bold sale tags and gift wrap",
    "Small Business Saturday": "a welcoming open sign and warm window light",
    "Cyber Monday": "gift cards and a glowing laptop",
    "Giving Tuesday": "a handwritten community donation sign",
    "Hanukkah begins": "a glowing menorah with blue and silver accents",
    "First day of winter": "frosted windows and twinkle lights",
    "Christmas": "evergreen sprigs, twinkle lights and kraft-paper gifts",
    "New Year's Eve": "gold confetti and sparkling lights",
    "New Year's Day": "crisp morning light and a fresh start",
    "Valentine's Day": "a few rose petals and a handwritten note",
}

SEASONAL = [
    dict(key="pumpkin", window=((8, 25), (11, 30)), cats={"cafe", "bakery"}, title="The fall flavor drop",
         moment="Pumpkin spice season", headlines={"cafe": ["Fall, in every sip."], "bakery": ["Fall, in every bite."]},
         scene="{item} with seasonal autumn details — mini pumpkins, cinnamon sticks and fallen leaves — on a rustic table",
         mood="warm amber, spice tones", motion="cinnamon dust floats, steam rises, slow push-in",
         why="Peak season for spiced fall flavors — customers are actively looking for them.",
         caption="Our fall lineup just landed. {item} is calling your name. 🍂", tags=["fallflavors", "pumpkinseason"]),
    dict(key="cozy", window=((10, 15), (2, 28)), cats=FOOD | {"retail", "beauty", "florist", "services", "other"}, title="Sweater-weather {item_short}",
         moment="Cozy season", headlines={"*": ["Sweater weather, served.", "Cozy is a flavor.", "Stay a while."]},
         scene="{item} on a wooden table by a rain-speckled window, a chunky knit blanket and a warm lamp glowing at {name}",
         mood="warm amber light, soft shadows, rainy blue outside", motion="rain drifts down the window, steam rises, slow push-in",
         why="Shorter, colder days push people toward comfort — cozy content is at its seasonal peak.",
         caption="Rain outside, {item_l} inside. Come get cozy at {name}. ☔", tags=["cozyseason", "sweaterweather"]),
    dict(key="gifting", window=((11, 15), (12, 24)), cats=None, title="The {name} gift guide",
         moment="Holiday gifting season", headlines={"*": ["Gift the good stuff.", "Wrapped and ready."]},
         scene="{item} and a gift card wrapped in kraft paper with twine and a sprig of pine",
         mood="warm, festive, natural light", motion="ribbon unties, slow push-in",
         why="Gift searches climb every week until Christmas — be the easy answer.",
         caption="Stuck on gifts? {item} and {name} gift cards are always a hit. 🎁", tags=["giftguide", "shoplocal"]),
    dict(key="january", window=((11, 1), (1, 31)), cats={"fitness"}, title="Start before January",
         moment="New-year goal season", headlines={"*": ["Don't wait for January.", "Start strong.", "Your strongest season."]},
         scene="energetic shot of members mid-session at {name}, {item_l}, dramatic light and real effort",
         mood="high energy, dramatic contrast, brand colors", motion="chalk dust bursts, dynamic push-in",
         why="Goal-setting peaks between Thanksgiving and mid-January — catch people before the crowd.",
         caption="Why wait for January? Start your strongest season at {name} today. 💪", tags=["newyougoals", "fitnessmotivation"]),
    dict(key="patio", window=((5, 15), (9, 15)), cats={"cafe", "bakery", "restaurant", "bar"}, title="Patio season",
         moment="Patio season", headlines={"*": ["Sunshine, served.", "Find us outside."]},
         scene="{item} on an outdoor table in bright sun with dappled shade at {name}",
         mood="bright, sunny, vivid", motion="leaf shadows sway, slow push-in",
         why="Long sunny days send people outdoors — show them where to sit.",
         caption="The patio is open and {item_l} tastes better in the sun. ☀️", tags=["patioseason", "summer"]),
]

EVERGREEN = [
    dict(key="craft", title="Behind the scenes at {name}", moment="Trending format: how it's made",
         headlines=["Made by hand, every time.", "The craft behind it all."],
         scene="close-up of skilled hands making {item_l} behind the counter at {name}, tools and texture in natural light",
         mood="natural light, tactile detail", motion="hands work in rhythm, slow push-in",
         why="Process and 'how it's made' clips keep earning saves and shares on Reels and TikTok.",
         caption="Every {item_l} starts here. This is how we do it at {name}.", tags=["behindthescenes", "howitsmade"],
         cats=FOOD | {"florist", "beauty", "retail"}),
    dict(key="crew", title="Member spotlight", moment="Trending format: community",
         headlines=["Stronger together.", "Meet the crew."],
         scene="candid shot of members cheering each other on at {name}, {item_l}, natural energy",
         mood="bright, candid, energetic", motion="high-five moment, slow push-in",
         why="Real-member stories build trust faster than any offer.",
         caption="This crew. 🙌 Come see what the {name} community is about.", tags=["community", "memberspotlight"], cats={"fitness"}),
    dict(key="regulars", title="The regulars' order", moment="Trending format: the usual",
         headlines=["Ask any regular.", "The usual?"],
         scene="{item} on the counter with a handwritten name label, a friendly blur of the room behind",
         mood="friendly, warm, candid", motion="a hand slides it across the counter, slow push-in",
         why="Community-first posts turn regulars into ambassadors — they tag friends.",
         caption="Our regulars know. Tag the friend who always orders {item_l}.", tags=["regulars", "locallove"], cats={"cafe", "bakery", "restaurant", "bar"}),
    dict(key="ritual", title="POV: your weekend ritual", moment="Trending format: POV",
         headlines=["POV: Saturday, sorted.", "Your weekend ritual."],
         scene="first-person view of {item_l} on a table at {name}, sunlight, a book or phone at the edge of frame",
         mood="soft morning light, relaxed", motion="hand reaches in, light shifts, slow push-in",
         why="First-person 'POV' framing is one of the most native formats on Reels and TikTok right now.",
         caption="POV: your Saturday just got a whole lot better. See you at {name}.", tags=["pov", "weekendritual"],
         cats=FOOD | {"retail", "florist"}),
    dict(key="golden", title="Golden hour at {name}", moment="Evergreen",
         headlines=["Golden hour, every hour.", "Come as you are."],
         scene="the interior of {name} bathed in golden late-afternoon light, {item_l} in the foreground",
         mood="golden hour glow, long shadows", motion="sunbeams drift across the room, slow push-in",
         why="Atmosphere posts sell the experience, not just the product.",
         caption="This light. This spot. Come find your seat at {name}.", tags=["goldenhour", "neighborhoodspot"], cats=None),
    dict(key="new", title="What's new at {name}", moment="Product drop",
         headlines=["Just dropped.", "New on the menu."],
         scene="hero shot of {item} on a clean pedestal with a bold color backdrop from the brand palette",
         mood="bold, graphic, studio light", motion="slow orbit around the product",
         why="'New' is the most clicked word in local marketing — give people a reason to visit now.",
         caption="Say hello to {item_l}. Available now at {name}.", tags=["newmenu", "justdropped"], cats=None),
]


COMMON_TERMS = {t for terms in LEXICON.values() for t in terms}


def _lc(item: str) -> str:
    """Lowercase common nouns ("cold brew") but keep proper product names ("Philtered Soul")."""
    return item.lower() if item.lower() in COMMON_TERMS or item.lower() in {
        "espresso drinks", "seasonal lattes", "house pastries", "morning pastries", "fresh bread", "seasonal bakes",
        "house specialty", "seasonal special", "dessert", "signature cocktails", "bar snacks", "new arrivals",
        "bestsellers", "gift sets", "intro class", "memberships", "signature class", "signature service",
        "treatments", "gift cards", "seasonal bouquets", "arrangements", "event florals", "signature product",
        "bestseller", "new arrival", "our signature"} else item


def _sentence(text: str) -> str:
    return text[:1].upper() + text[1:]


def _short(item: str) -> str:
    words = item.split()
    return " ".join(words[-2:]) if len(words) > 2 else item


def _fill(text: str, p: BrandProfile, item: str) -> str:
    return (text.replace("{item_short}", _short(item)).replace("{item_l}", _lc(item))
            .replace("{item}", item).replace("{name}", p.name))


def _tags(p: BrandProfile, extra: list[str]) -> list[str]:
    base = re.sub(r"[^a-z0-9]", "", p.name.lower())[:28] or "shoplocal"
    city = re.sub(r"[^a-z]", "", (p.location.split(",")[-1] if p.location else "").lower()) if "," in p.location else \
        re.sub(r"[^a-z]", "", p.location.lower())
    tags = [base, *extra, "shoplocal"] + ([f"{city}eats" if p.category in ("cafe", "bakery", "restaurant") else city] if city else [])
    return list(dict.fromkeys(t for t in tags if t))[:7]


def _season_active(window: tuple[tuple[int, int], tuple[int, int]], today: date) -> bool:
    (sm, sd), (em, ed) = window
    md = (today.month, today.day)
    return (sm, sd) <= md <= (em, ed) if (sm, sd) <= (em, ed) else (md >= (sm, sd) or md <= (em, ed))


TYPO = {
    "cafe": "bold rounded friendly sans-serif", "bakery": "elegant high-contrast serif", "restaurant": "chunky bold display type",
    "bar": "sleek condensed sans-serif", "retail": "refined editorial serif", "fitness": "huge heavy condensed uppercase sans-serif",
    "beauty": "refined thin serif", "florist": "romantic thin serif", "services": "clean bold sans-serif", "other": "clean bold sans-serif",
}


def ideas_for(profile: BrandProfile | dict, brief: str = "", today: Optional[date] = None, seed: int = 0) -> IdeaSet:
    p = profile if isinstance(profile, BrandProfile) else BrandProfile.model_validate(profile)
    today = today or date.today()
    rng = random.Random(int(hashlib.md5(f"{p.name}:{today.isoformat()}:{seed}".encode()).hexdigest()[:8], 16))
    items = p.signature_items or ["our signature"]
    hero = items[0]
    typo = TYPO.get(p.category, TYPO["other"])
    ideas: list[CampaignIdea] = []
    notes: list[str] = []

    def add(title, moment, mtype, mdate, hook, why, headline, subline, scene, mood, motion, caption, tags, cta, formats):
        ideas.append(CampaignIdea(
            title=title, moment=moment, moment_type=mtype, moment_date=mdate, hook=hook, why_now=why, headline=headline,
            subline=subline, scene=scene, typography=typo, mood=mood, video_motion=motion, caption=caption,
            hashtags=_tags(p, tags), cta=cta, formats=formats))

    if brief:
        add(brief[:70].strip().rstrip(".").capitalize(), "Your brief", "product", "",
            brief[:160], "Built straight from your request — Higgsfield writes the copy around it.", "", "",
            f"{brief}. Feature {hero.lower()} and the look and feel of {p.name}.", "on-brand, inviting, premium",
            "gentle natural motion, slow push-in", f"{brief[:180]} — only at {p.name}.", [], "Visit us",
            ["post", "story", "video"])

    upcoming = [m for m in moments.upcoming(today, 40) if m["name"] in HOLIDAY_COPY
                and (m["fits"] == "all" or p.category in m["fits"])]
    for i, m in enumerate(upcoming[:2]):
        copy = HOLIDAY_COPY[m["name"]]
        item = items[i % len(items)]
        when = date.fromisoformat(m["date"]).strftime("%b %-d")
        add(f"{m['name']} at {p.name}", f"{m['name']} · {when}", "holiday", m["date"],
            f"A {m['name']} moment starring your {_lc(item)}.",
            f"{m['name']} is {m['days_until']} days away — {m['note'][0].lower() + m['note'][1:]}",
            rng.choice(copy["headlines"]), f"{p.name} · {when}",
            _fill(copy["scene"], p, item) if p.category in FOOD else
            f"Inside {p.name}, tastefully decorated for {m['name']} with {DECOR.get(m['name'], 'seasonal details')}, {_lc(item)} front and center",
            copy["mood"],
            copy["motion"], _fill(copy["caption"], p, item), copy["tags"], "Stop by",
            ["post", "story", "video"])
        notes.append(f"{m['name']} in {m['days_until']} days")

    seasons = [s for s in SEASONAL if _season_active(s["window"], today) and (s["cats"] is None or p.category in s["cats"])]
    rng.shuffle(seasons)
    for s in seasons[:1]:
        item = items[min(1, len(items) - 1)] if len(items) > 1 else hero
        heads = s["headlines"].get(p.category) or s["headlines"].get("*") or ["Made for the season."]
        add(_fill(s["title"], p, item), s["moment"],
            "seasonal", "", f"Lean into {s['moment'].lower()} with {_lc(item)}.", s["why"], rng.choice(heads), item,
            _fill(s["scene"], p, item), s["mood"], s["motion"], _fill(s["caption"], p, item), s["tags"], "Come in",
            ["post", "story", "banner"])
        notes.append(f"{s['moment']} is in full swing")

    product_like = p.category in FOOD | {"retail", "florist"}
    add(f"The {hero} spotlight", "Product spotlight", "product", "",
        f"Put {_lc(hero)} on a pedestal." if product_like else f"Make {_lc(hero)} the hero this week.",
        "Your best-known offer is your best ad — make it the hero this week.",
        rng.choice(["Our favorite. Yours too.", "You already know.", "Worth the trip."]), hero,
        f"Close-up hero shot of {_lc(hero)} from {p.name} on a stone plinth, clean backdrop in brand colors, crisp detail"
        if product_like else f"Dynamic hero shot of {_lc(hero)} in action at {p.name}, the space dramatic in the background",
        "crisp studio light with soft shadows" if product_like else "dramatic, energetic light",
        "slow orbit around the product" if product_like else "dynamic slow-motion push-in",
        f"Meet {_lc(hero)}. You already know. 😉" if product_like else f"{hero} at {p.name} hits different. Come see for yourself.",
        ["bestseller"], "Order now" if product_like else "Book now", ["post", "banner", "flyer"])

    evergreen = [e for e in EVERGREEN if e["cats"] is None or p.category in e["cats"]]
    rng.shuffle(evergreen)
    for e in evergreen[: max(1, 5 - len(ideas))]:
        item = rng.choice(items)
        heads = [h for h in e["headlines"] if p.category in FOOD or "menu" not in h.lower()] or e["headlines"]
        add(_fill(e["title"], p, item), e["moment"], "trend" if e["moment"].startswith("Trending") else "evergreen", "",
            _sentence(_fill(e["scene"], p, item).split(",")[0]) + ".", e["why"], rng.choice(heads), p.name,
            _fill(e["scene"], p, item), e["mood"], e["motion"], _fill(e["caption"], p, item), e["tags"], "See you soon",
            ["post", "story", "video"] if e["key"] in ("craft", "ritual") else ["post", "story", "wallpaper"])
        if e["moment"].startswith("Trending"):
            notes.append(e["moment"].replace("Trending format: ", "Trending: ") + " posts")

    return IdeaSet(trend_notes=notes[:4] or ["Seasonal calendar"], ideas=ideas[:5])
