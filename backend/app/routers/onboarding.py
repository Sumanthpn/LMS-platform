from fastapi import APIRouter, HTTPException, status

from app.core.security import CurrentUser
from app.db import get_db
from app.models.user import OnboardingRequest, UserPublic
from app.routers.catalog import parse_object_id

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


@router.post("", response_model=UserPublic)
async def save_onboarding(payload: OnboardingRequest, user: CurrentUser) -> UserPublic:
    db = get_db()
    domain_id = parse_object_id(payload.domain_id, "domain_id")
    topic_id = parse_object_id(payload.topic_id, "topic_id")

    domain = await db.domains.find_one({"_id": domain_id})
    if domain is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found")

    # Checking domain_id too stops a topic being paired with the wrong domain.
    topic = await db.topics.find_one({"_id": topic_id, "domain_id": domain_id})
    if topic is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found in that domain",
        )

    onboarding = {
        "domain_id": domain_id,
        "topic_id": topic_id,
        "domain_name": domain["name"],
        "topic_name": topic["name"],
    }
    updated = await db.users.find_one_and_update(
        {"_id": user["_id"]},
        {"$set": {"onboarding": onboarding}},
        return_document=True,
    )
    return UserPublic.model_validate(updated)
