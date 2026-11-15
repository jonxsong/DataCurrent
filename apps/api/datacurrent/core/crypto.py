import base64
import hashlib
import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from datacurrent.core.config import get_settings
from datacurrent.core.errors import DataCurrentError


def _fernet() -> Fernet:
    key = get_settings().datacurrent_encryption_key
    if key is None:
        if get_settings().is_production:
            raise RuntimeError("DATACURRENT_ENCRYPTION_KEY is required in production")
        digest = hashlib.sha256(
            get_settings().datacurrent_secret_key.get_secret_value().encode()
        ).digest()
        return Fernet(base64.urlsafe_b64encode(digest))
    return Fernet(key.get_secret_value().encode())


def encrypt_config(config: dict[str, Any]) -> bytes:
    return _fernet().encrypt(json.dumps(config, separators=(",", ":")).encode())


def decrypt_config(payload: bytes) -> dict[str, Any]:
    try:
        return json.loads(_fernet().decrypt(payload))
    except (InvalidToken, json.JSONDecodeError) as exc:
        raise DataCurrentError(
            "Stored connection configuration cannot be decrypted",
            code="credential_decryption_failed",
            status_code=500,
        ) from exc
