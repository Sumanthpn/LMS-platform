from pydantic import BaseModel, EmailStr, Field

from app.models.common import MongoModel, PyObjectId


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class OnboardingRequest(BaseModel):
    domain_id: str
    topic_id: str


class Onboarding(BaseModel):
    domain_id: PyObjectId
    topic_id: PyObjectId
    domain_name: str
    topic_name: str


class UserPublic(MongoModel):
    """The only shape of a user ever sent to a client. Note: no password_hash."""

    name: str
    email: EmailStr
    onboarding: Onboarding | None = None

    @property
    def is_onboarded(self) -> bool:
        return self.onboarding is not None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
