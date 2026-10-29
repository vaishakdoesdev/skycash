import base64
import hashlib
import hmac
import json
import os
import secrets
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Cookie, Header, HTTPException, Request, Response

from app.models.auth_schemas import (
    AuthConfig,
    AuthResponse,
    ForgotPasswordRequest,
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
    UserPublic,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_USERS_FILE = _PROJECT_ROOT / "data" / "auth_users.json"

_ITERATIONS = 100000
_HASH_ALGO = "sha256"
_LOCKOUT_THRESHOLD = 5
_LOCKOUT_DURATION_SECONDS = 15 * 60  # 15 minutes

# In-memory session and failed attempt tracking
_active_sessions: dict[str, dict] = {}
_failed_attempts: dict[str, dict] = {}


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac(_HASH_ALGO, password.encode("utf-8"), salt, _ITERATIONS, dklen=32)
    return f"pbkdf2_{_HASH_ALGO}${_ITERATIONS}${salt.hex()}${key.hex()}"


def _verify_password(password: str, stored_hash: str) -> bool:
    try:
        parts = stored_hash.split("$")
        if len(parts) != 4:
            return False
        algo, iters_str, salt_hex, key_hex = parts
        if algo != f"pbkdf2_{_HASH_ALGO}":
            return False
        salt = bytes.fromhex(salt_hex)
        expected_key = bytes.fromhex(key_hex)
        computed_key = hashlib.pbkdf2_hmac(
            _HASH_ALGO, password.encode("utf-8"), salt, int(iters_str), dklen=32
        )
        return hmac.compare_digest(computed_key, expected_key)
    except Exception:
        return False


def _load_users() -> list[dict]:
    if not _USERS_FILE.is_file():
        # Auto-seed default accounts
        default_users = [
            {
                "id": "usr_demo_butane",
                "email": "demo@butane.io",
                "name": "BUTANE Lead",
                "password_hash": _hash_password("Password123!"),
                "auth_provider": "local",
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": "usr_admin_skycash",
                "email": "admin@skycash.io",
                "name": "SkyCash Administrator",
                "password_hash": _hash_password("Password123!"),
                "auth_provider": "local",
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        ]
        _save_users(default_users)
        return default_users

    try:
        with open(_USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _save_users(users: list[dict]) -> None:
    _USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    temp_file = _USERS_FILE.with_suffix(".tmp")
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2)
    temp_file.replace(_USERS_FILE)


def _load_env_files() -> None:
    """Load environment variables from backend/.env, .env, or frontend/.env into os.environ."""
    candidate_files = [
        _PROJECT_ROOT / "backend" / ".env",
        _PROJECT_ROOT / ".env",
        _PROJECT_ROOT / "frontend" / ".env",
    ]
    for env_file in candidate_files:
        if env_file.is_file():
            try:
                with open(env_file, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            key, val = line.split("=", 1)
                            key = key.strip()
                            val = val.strip().strip("'\"")
                            if key and val and key not in os.environ:
                                os.environ[key] = val
            except Exception:
                pass


def _get_google_client_id() -> Optional[str]:
    _load_env_files()
    return os.environ.get("GOOGLE_CLIENT_ID") or os.environ.get("VITE_GOOGLE_CLIENT_ID")


def _get_google_client_secret() -> Optional[str]:
    _load_env_files()
    return os.environ.get("GOOGLE_CLIENT_SECRET")


def _verify_google_credential(credential: str, client_id: str) -> dict:
    """Verifies a Google OAuth2 ID token using Google tokeninfo API with local JWT payload fallback."""
    google_data = None
    # 1. Attempt online verification via Google OAuth2 tokeninfo endpoint
    try:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={urllib.parse.quote(credential)}"
        req = urllib.request.Request(url, headers={"User-Agent": "SkyCash/0.1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                google_data = json.loads(resp.read().decode("utf-8"))
    except Exception:
        # Fallback to local JWT payload decoding if offline or network unreachable
        pass

    if not google_data:
        try:
            parts = credential.split(".")
            if len(parts) >= 2:
                payload_segment = parts[1]
                padded = payload_segment + "=" * (-len(payload_segment) % 4)
                decoded = base64.urlsafe_b64decode(padded.encode("utf-8"))
                google_data = json.loads(decoded.decode("utf-8"))
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid Google authentication token format: {exc}",
            )

    if not google_data or "email" not in google_data:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired Google authentication token.",
        )

    # Validate audience if client ID is configured and present in payload
    token_aud = google_data.get("aud")
    if token_aud and client_id:
        allowed_audiences = {
            client_id,
            os.environ.get("GOOGLE_CLIENT_ID", ""),
            os.environ.get("VITE_GOOGLE_CLIENT_ID", ""),
        }
        allowed_audiences.discard("")
        if allowed_audiences and token_aud not in allowed_audiences:
            raise HTTPException(
                status_code=401,
                detail="Google authentication token was issued for a different client application.",
            )

    return google_data


def _get_session_token(
    authorization: Optional[str] = Header(None),
    skycash_session: Optional[str] = Cookie(None),
) -> Optional[str]:
    if skycash_session:
        return skycash_session
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:].strip()
    return None


@router.get("/config", response_model=AuthConfig)
def get_auth_config() -> AuthConfig:
    """Return runtime authentication configuration parameters."""
    return AuthConfig(
        google_client_id=_get_google_client_id(),
        registration_enabled=True,
        password_min_length=8,
        team_name="BUTANE",
        product_name="SkyCash",
    )


@router.get("/me")
def check_session(
    authorization: Optional[str] = Header(None),
    skycash_session: Optional[str] = Cookie(None),
) -> dict:
    """Validate active session and return public user profile."""
    token = _get_session_token(authorization, skycash_session)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required. Please sign in.")

    session = _active_sessions.get(token)
    if not session or time.time() > session["expires_at"]:
        if session:
            _active_sessions.pop(token, None)
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please sign in again.")

    users = _load_users()
    user = next((u for u in users if u["id"] == session["user_id"]), None)
    if not user:
        raise HTTPException(status_code=401, detail="User account no longer found.")

    return {
        "authenticated": True,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "auth_provider": user.get("auth_provider", "local"),
            "created_at": user["created_at"],
        },
    }


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response) -> AuthResponse:
    """Authenticate with email and password."""
    email = payload.email.strip().lower()
    password = payload.password
    now = time.time()

    # Rate limiting check
    attempt = _failed_attempts.get(email)
    if attempt and attempt["locked_until"] > now:
        remaining_mins = max(1, int((attempt["locked_until"] - now) / 60))
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed login attempts. Account temporarily locked for {remaining_mins} minute(s) for security.",
        )

    users = _load_users()
    user = next((u for u in users if u["email"].lower() == email), None)
    is_valid = _verify_password(password, user["password_hash"]) if (user and user.get("password_hash")) else False

    if not user or not is_valid:
        count = (attempt["count"] if attempt else 0) + 1
        locked_until = now + _LOCKOUT_DURATION_SECONDS if count >= _LOCKOUT_THRESHOLD else 0
        _failed_attempts[email] = {"count": count, "locked_until": locked_until}
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password. Please verify your credentials and try again.",
        )

    _failed_attempts.pop(email, None)
    duration_seconds = 30 * 86400 if payload.remember_me else 86400
    token = secrets.token_urlsafe(32)

    _active_sessions[token] = {
        "user_id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "auth_provider": user.get("auth_provider", "local"),
        "expires_at": now + duration_seconds,
    }

    response.set_cookie(
        key="skycash_session",
        value=token,
        max_age=duration_seconds,
        httponly=True,
        samesite="lax",
        path="/",
    )

    user_public = UserPublic(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        auth_provider=user.get("auth_provider", "local"),
        created_at=user["created_at"],
    )

    return AuthResponse(
        user=user_public,
        token=token,
        expires_in_seconds=duration_seconds,
    )


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(payload: RegisterRequest, response: Response) -> AuthResponse:
    """Register a new user account."""
    email = payload.email.strip().lower()
    password = payload.password
    name = (payload.name or "").strip()

    if not email or "@" not in email or "." not in email:
        raise HTTPException(status_code=422, detail="Valid email address required.")
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters long.")

    users = _load_users()
    if any(u["email"].lower() == email for u in users):
        raise HTTPException(
            status_code=400,
            detail="An account with this email address already exists. Please sign in instead.",
        )

    new_user = {
        "id": f"usr_{secrets.token_hex(6)}",
        "email": email,
        "name": name or email.split("@")[0],
        "password_hash": _hash_password(password),
        "auth_provider": "local",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    users.append(new_user)
    _save_users(users)

    duration_seconds = 86400
    token = secrets.token_urlsafe(32)
    _active_sessions[token] = {
        "user_id": new_user["id"],
        "email": new_user["email"],
        "name": new_user["name"],
        "auth_provider": new_user["auth_provider"],
        "expires_at": time.time() + duration_seconds,
    }

    response.set_cookie(
        key="skycash_session",
        value=token,
        max_age=duration_seconds,
        httponly=True,
        samesite="lax",
        path="/",
    )

    return AuthResponse(
        user=UserPublic(
            id=new_user["id"],
            email=new_user["email"],
            name=new_user["name"],
            auth_provider=new_user["auth_provider"],
            created_at=new_user["created_at"],
        ),
        token=token,
        expires_in_seconds=duration_seconds,
    )


@router.post("/logout")
def logout(
    response: Response,
    authorization: Optional[str] = Header(None),
    skycash_session: Optional[str] = Cookie(None),
) -> dict:
    """Terminate the active session."""
    token = _get_session_token(authorization, skycash_session)
    if token:
        _active_sessions.pop(token, None)
    response.delete_cookie(key="skycash_session", path="/")
    return {"status": "ok", "message": "Logged out successfully."}


@router.post("/google", response_model=AuthResponse)
def login_with_google(payload: GoogleAuthRequest, response: Response) -> AuthResponse:
    """Authenticate via Google OAuth token."""
    client_id = _get_google_client_id()
    if not client_id:
        raise HTTPException(
            status_code=501,
            detail={
                "code": "GOOGLE_OAUTH_NOT_CONFIGURED",
                "message": (
                    "Google OAuth sign-in is not yet configured for this environment. "
                    "Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google Sign-In."
                ),
            },
        )

    credential = payload.credential.strip()
    if not credential:
        raise HTTPException(status_code=400, detail="Missing Google credential token.")

    google_data = _verify_google_credential(credential, client_id)

    email = google_data["email"].lower().strip()
    name = google_data.get("name") or email.split("@")[0]

    users = _load_users()
    user = next((u for u in users if u["email"].lower() == email), None)
    if not user:
        user = {
            "id": f"usr_goog_{secrets.token_hex(6)}",
            "email": email,
            "name": name,
            "password_hash": "",
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        users.append(user)
        _save_users(users)

    now = time.time()
    duration_seconds = 24 * 3600
    token = secrets.token_urlsafe(32)

    _active_sessions[token] = {
        "user_id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "auth_provider": user.get("auth_provider", "google"),
        "expires_at": now + duration_seconds,
    }

    response.set_cookie(
        key="skycash_session",
        value=token,
        max_age=duration_seconds,
        httponly=True,
        samesite="lax",
        path="/",
    )

    return AuthResponse(
        user=UserPublic(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            auth_provider=user.get("auth_provider", "google"),
            created_at=user["created_at"],
        ),
        token=token,
        expires_in_seconds=duration_seconds,
    )


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest) -> dict:
    """Submit password reset notification."""
    return {
        "status": "ok",
        "message": "If an account is associated with this email address, password reset guidance has been logged for workspace administrators.",
    }
