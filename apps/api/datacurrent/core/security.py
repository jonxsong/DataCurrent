import hashlib
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from passlib.context import CryptContext

from datacurrent.core.config import get_settings
from datacurrent.core.errors import DataCurrentError


password_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_context.verify(password, password_hash)


def create_access_token(user_id: uuid.UUID, *, expires_in: timedelta = timedelta(minutes=30)) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iss": "datacurrent",
        "aud": "datacurrent-api",
        "iat": now,
        "nbf": now,
        "exp": now + expires_in,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.datacurrent_secret_key.get_secret_value(), algorithm="HS256")


def decode_access_token(token: str) -> uuid.UUID:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.datacurrent_secret_key.get_secret_value(),
            algorithms=["HS256"],
            audience="datacurrent-api",
            issuer="datacurrent",
        )
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise DataCurrentError("Invalid or expired session", code="invalid_session", status_code=401) from exc


def privacy_hash(value: str) -> str:
    settings = get_settings()
    material = f"{settings.datacurrent_secret_key.get_secret_value()}:{value}".encode()
    return hashlib.sha256(material).hexdigest()
