"""Marketing calendar: holidays, food days and seasonal windows a local business can post about."""

from datetime import date, timedelta
from typing import Optional

# Movable feasts that don't follow a simple weekday rule
LUNAR_NEW_YEAR = {2026: date(2026, 2, 17), 2027: date(2027, 2, 6), 2028: date(2028, 1, 26)}
HANUKKAH = {2026: date(2026, 12, 4), 2027: date(2027, 12, 24), 2028: date(2028, 12, 12)}
DIWALI = {2026: date(2026, 11, 8), 2027: date(2027, 10, 29), 2028: date(2028, 10, 17)}


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    """n-th weekday (0=Mon) of a month; n=-1 means the last one."""
    if n > 0:
        d = date(year, month, 1)
        d += timedelta(days=(weekday - d.weekday()) % 7)
        return d + timedelta(weeks=n - 1)
    nxt = date(year + (month == 12), month % 12 + 1, 1)
    d = nxt - timedelta(days=1)
    return d - timedelta(days=(d.weekday() - weekday) % 7)


def _easter(year: int) -> date:
    a, b, c = year % 19, year // 100, year % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def _moments_for(year: int) -> list[dict]:
    thanksgiving = _nth_weekday(year, 11, 3, 4)
    m = [
        ("New Year's Day", date(year, 1, 1), "holiday", "all", "Fresh starts, new routines, resolutions."),
        ("National Croissant Day", date(year, 1, 30), "food-day", "bakery cafe", "A playful excuse to feature pastries."),
        ("Valentine's Day", date(year, 2, 14), "holiday", "all", "Gifts, dates, treats for two, self-love."),
        ("National Pizza Day", date(year, 2, 9), "food-day", "restaurant", "Fun, shareable food content."),
        ("International Women's Day", date(year, 3, 8), "cause", "all", "Celebrate the women behind the business."),
        ("St. Patrick's Day", date(year, 3, 17), "holiday", "restaurant bar cafe", "Green everything, festive specials."),
        ("First day of spring", date(year, 3, 20), "season", "all", "Fresh, bright, new-season launches."),
        ("Easter", _easter(year), "holiday", "all", "Brunch, pastel treats, family gatherings."),
        ("Earth Day", date(year, 4, 22), "cause", "all", "Sustainability, local sourcing, reusables."),
        ("Cinco de Mayo", date(year, 5, 5), "holiday", "restaurant bar", "Festive food and drink specials."),
        ("Mother's Day", _nth_weekday(year, 5, 6, 2), "holiday", "all", "Gifts, brunch, flowers, appreciation."),
        ("Memorial Day weekend", _nth_weekday(year, 5, 0, -1), "holiday", "all", "Kick-off of summer, long weekend."),
        ("National Donut Day", _nth_weekday(year, 6, 4, 1), "food-day", "bakery cafe", "Sweet, shareable, crowd-pleasing."),
        ("Father's Day", _nth_weekday(year, 6, 6, 3), "holiday", "all", "Gifts and experiences for dads."),
        ("First day of summer", date(year, 6, 21), "season", "all", "Iced drinks, patios, long evenings."),
        ("Fourth of July", date(year, 7, 4), "holiday", "all", "Cookouts, red-white-blue specials."),
        ("National Ice Cream Day", _nth_weekday(year, 7, 6, 3), "food-day", "cafe bakery restaurant", "Cold treats, summer fun."),
        ("Back to school", date(year, 8, 17), "season", "all", "Routines, fuel for busy mornings, deals for students."),
        ("Labor Day", _nth_weekday(year, 9, 0, 1), "holiday", "all", "Last long weekend of summer."),
        ("First day of fall", date(year, 9, 22), "season", "all", "Cozy flavors, warm colors, sweater weather."),
        ("National Coffee Day", date(year, 9, 29), "food-day", "cafe", "Coffee lovers' holiday — perfect for a deal."),
        ("International Coffee Day", date(year, 10, 1), "food-day", "cafe", "Celebrate the craft behind every cup."),
        ("Halloween", date(year, 10, 31), "holiday", "all", "Spooky specials, costumes, playful seasonal treats."),
        ("Día de los Muertos", date(year, 11, 1), "holiday", "all", "Marigolds, remembrance, vibrant color."),
        ("Daylight saving ends", _nth_weekday(year, 11, 6, 1), "season", "all", "Darker evenings — cozy nights in."),
        ("Veterans Day", date(year, 11, 11), "holiday", "all", "Gratitude, discounts for veterans."),
        ("Thanksgiving", thanksgiving, "holiday", "all", "Gratitude, gatherings, pre-orders and pies."),
        ("Black Friday", thanksgiving + timedelta(days=1), "retail", "retail boutique all", "Big deals, gift guides."),
        ("Small Business Saturday", thanksgiving + timedelta(days=2), "retail", "all", "Shop local — the local business's day to shine."),
        ("Cyber Monday", thanksgiving + timedelta(days=4), "retail", "retail boutique", "Online deals, gift cards."),
        ("Giving Tuesday", thanksgiving + timedelta(days=5), "cause", "all", "Community giving and local causes."),
        ("First day of winter", date(year, 12, 21), "season", "all", "Warm drinks, cozy interiors, holiday glow."),
        ("Christmas", date(year, 12, 25), "holiday", "all", "Gifts, festive menus, holiday hours."),
        ("New Year's Eve", date(year, 12, 31), "holiday", "all", "Celebrations, year-in-review, thank-yous."),
    ]
    for table, name, note in (
        (LUNAR_NEW_YEAR, "Lunar New Year", "Red and gold, reunion meals, good-luck treats."),
        (HANUKKAH, "Hanukkah begins", "Lights, gatherings, festive treats."),
        (DIWALI, "Diwali", "Lights, sweets, gifting and color."),
    ):
        if year in table:
            m.append((name, table[year], "holiday", "all", note))
    return [{"name": n, "date": d, "kind": k, "fits": f, "note": note} for n, d, k, f, note in m]


SEASONS = [
    # (name, start (m, d), end (m, d), note)
    ("Pumpkin spice season", (8, 25), (11, 30), "Peak demand for warm spiced seasonal flavors."),
    ("Holiday gifting season", (11, 15), (12, 24), "Gift cards, bundles, gift guides, pre-orders."),
    ("Patio season", (5, 15), (9, 15), "Outdoor seating, iced drinks, golden-hour content."),
    ("Wedding season", (5, 1), (10, 15), "Events, florals, catering, celebrations."),
    ("Cozy season", (10, 15), (2, 28), "Sweater weather, comfort food, warm interiors."),
]


def upcoming(today: Optional[date] = None, horizon_days: int = 60) -> list[dict]:
    today = today or date.today()
    items = _moments_for(today.year) + _moments_for(today.year + 1)
    out = []
    for item in items:
        delta = (item["date"] - today).days
        if 0 <= delta <= horizon_days:
            out.append({**item, "date": item["date"].isoformat(), "days_until": delta})
    out.sort(key=lambda x: x["days_until"])
    return out


def active_seasons(today: Optional[date] = None) -> list[dict]:
    today = today or date.today()
    active = []
    for name, (sm, sd), (em, ed), note in SEASONS:
        start = date(today.year, sm, sd)
        end = date(today.year + (1 if (em, ed) < (sm, sd) else 0), em, ed)
        if (em, ed) < (sm, sd) and today < start:
            start, end = date(today.year - 1, sm, sd), date(today.year, em, ed)
        if start <= today <= end:
            active.append({"name": name, "ends": end.isoformat(), "note": note})
    return active


def calendar_brief(today: Optional[date] = None) -> str:
    today = today or date.today()
    lines = [f"Today is {today.strftime('%A, %B %-d, %Y')}."]
    lines.append("Upcoming moments (next 60 days):")
    for m in upcoming(today):
        when = "today" if m["days_until"] == 0 else f"in {m['days_until']} days"
        lines.append(f"- {m['name']} — {m['date']} ({when}); fits: {m['fits']}. {m['note']}")
    seasons = active_seasons(today)
    if seasons:
        lines.append("Seasonal windows active right now:")
        for s in seasons:
            lines.append(f"- {s['name']} (until {s['ends']}). {s['note']}")
    return "\n".join(lines)
