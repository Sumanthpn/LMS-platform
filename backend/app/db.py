from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    if _client is None:
        raise RuntimeError("Mongo client not initialised. Did the app lifespan run?")
    return _client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()[settings.mongodb_db_name]


async def connect() -> None:
    """Open the Mongo connection and make sure our indexes exist."""
    global _client
    _client = AsyncIOMotorClient(settings.mongodb_uri, uuidRepresentation="standard")
    # Fail fast with a clear error if Mongo is unreachable.
    await _client.admin.command("ping")
    await ensure_indexes()


async def disconnect() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


async def ensure_indexes() -> None:
    db = get_db()
    await db.users.create_index("email", unique=True)
    await db.domains.create_index("slug", unique=True)
    await db.topics.create_index([("domain_id", 1), ("slug", 1)], unique=True)
    await db.questions.create_index("topic_id")
    await db.exam_sessions.create_index([("user_id", 1), ("started_at", -1)])
