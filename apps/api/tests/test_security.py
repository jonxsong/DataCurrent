import uuid

import pytest
from datacurrent.core.errors import DataCurrentError
from datacurrent.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hash_round_trip() -> None:
    password_hash = hash_password("Correct Horse 42")
    assert verify_password("Correct Horse 42", password_hash)
    assert not verify_password("wrong", password_hash)


def test_token_round_trip() -> None:
    user_id = uuid.uuid4()
    assert decode_access_token(create_access_token(user_id)) == user_id


def test_invalid_token_rejected() -> None:
    with pytest.raises(DataCurrentError):
        decode_access_token("invalid")
