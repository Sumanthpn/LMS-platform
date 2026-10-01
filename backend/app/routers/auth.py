from fastapi import APIRouter, HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.core.security import CurrentUser, create_access_token, hash_password, verify_password
from app.db import get_db
from app.models.user import AuthResponse, LoginRequest, SignupRequest, UserPublic

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest) -> AuthResponse:
    db = get_db()
    user = {
        "name": payload.name.strip(),
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "onboarding": None,
    }

    try:
        result = await db.users.insert_one(user)
    except DuplicateKeyError:
        # Relies on the unique index on users.email, so concurrent signups
        # with the same address cannot both succeed.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists",
        ) from None

    user["_id"] = result.inserted_id
    return AuthResponse(
        access_token=create_access_token(str(result.inserted_id)),
        user=UserPublic.model_validate(user),
    )


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest) -> AuthResponse:
    user = await get_db().users.find_one({"email": payload.email.lower()})

    # Same message for "no such user" and "wrong password" so the endpoint
    # cannot be used to enumerate registered addresses.
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    return AuthResponse(
        access_token=create_access_token(str(user["_id"])),
        user=UserPublic.model_validate(user),
    )


@router.get("/me", response_model=UserPublic)
async def me(user: CurrentUser) -> UserPublic:
    return UserPublic.model_validate(user)
