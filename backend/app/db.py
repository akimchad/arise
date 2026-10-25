from datetime import datetime, timezone
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorClient

from . import config

client = AsyncIOMotorClient(config.MONGO_URL, tz_aware=True)
db = client[config.DB_NAME]

users = db.users
brands = db.brands
generations = db.generations
uploads = db.uploads
events = db.events  # lightweight rate-limit ledger


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return uuid4().hex


async def ensure_indexes() -> None:
    await users.create_index("email", unique=True)
    await brands.create_index([("user_id", 1), ("created_at", -1)])
    await brands.create_index("anon_id")
    await generations.create_index([("user_id", 1), ("created_at", -1)])
    await generations.create_index("items.id")
    await events.create_index("created_at", expireAfterSeconds=60 * 60 * 24 * 2)
    await events.create_index([("kind", 1), ("key", 1), ("created_at", -1)])
