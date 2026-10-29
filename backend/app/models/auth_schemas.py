from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., description="Unique user identifier.")
    email: str = Field(..., description="User email address.")
    name: str = Field(..., description="Display name.")
    auth_provider: str = Field(default="local", description="Provider: 'local' or 'google'.")
    created_at: str = Field(..., description="Account creation timestamp ISO 8601.")


class AuthConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    google_client_id: Optional[str] = Field(default=None, description="Google OAuth Client ID if configured.")
    registration_enabled: bool = Field(default=True, description="Whether self-registration is enabled.")
    password_min_length: int = Field(default=8, description="Minimum password length.")
    team_name: str = Field(default="BUTANE", description="Engineering team identifier.")
    product_name: str = Field(default="SkyCash", description="Product application title.")


class AuthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user: UserPublic
    token: str = Field(..., description="Bearer session token.")
    expires_in_seconds: int = Field(default=86400, description="Session lifespan in seconds.")


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str
    password: str
    remember_me: bool = False


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str
    password: str
    name: Optional[str] = None


class GoogleAuthRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    credential: str


class ForgotPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str
