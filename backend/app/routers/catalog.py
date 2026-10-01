from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, Query, status

from app.db import get_db
from app.models.catalog import Domain, DomainWithTopics, Topic

router = APIRouter(prefix="/api", tags=["catalog"])


def parse_object_id(value: str, field: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid {field}",
        ) from None


async def _topics_for(domain_ids: list[ObjectId]) -> list[dict]:
    """Topics for the given domains, each with a live question count."""
    db = get_db()
    topics = await db.topics.find({"domain_id": {"$in": domain_ids}}).sort("name", 1).to_list(None)
    if not topics:
        return []

    counts = await db.questions.aggregate(
        [
            {"$match": {"topic_id": {"$in": [t["_id"] for t in topics]}}},
            {"$group": {"_id": "$topic_id", "count": {"$sum": 1}}},
        ]
    ).to_list(None)
    count_by_topic = {row["_id"]: row["count"] for row in counts}

    for topic in topics:
        topic["question_count"] = count_by_topic.get(topic["_id"], 0)
    return topics


@router.get("/domains", response_model=list[DomainWithTopics])
async def list_domains() -> list[DomainWithTopics]:
    """Full catalog in one call — the dashboard needs domains and their topics together."""
    domains = await get_db().domains.find().sort("name", 1).to_list(None)
    if not domains:
        return []

    topics = await _topics_for([d["_id"] for d in domains])
    by_domain: dict[ObjectId, list[dict]] = {}
    for topic in topics:
        by_domain.setdefault(topic["domain_id"], []).append(topic)

    return [
        DomainWithTopics.model_validate({**domain, "topics": by_domain.get(domain["_id"], [])})
        for domain in domains
    ]


@router.get("/domains/{domain_id}", response_model=Domain)
async def get_domain(domain_id: str) -> Domain:
    domain = await get_db().domains.find_one({"_id": parse_object_id(domain_id, "domain_id")})
    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")
    return Domain.model_validate(domain)


@router.get("/topics", response_model=list[Topic])
async def list_topics(domain_id: str = Query(...)) -> list[Topic]:
    topics = await _topics_for([parse_object_id(domain_id, "domain_id")])
    return [Topic.model_validate(topic) for topic in topics]
