import pytest
from datacurrent.api.auth import require_registration_enabled
from datacurrent.core.config import Settings
from datacurrent.core.errors import DataCurrentError


def test_registration_can_be_disabled_for_public_deployments() -> None:
    settings = Settings(datacurrent_allow_registration=False)

    with pytest.raises(DataCurrentError) as caught:
        require_registration_enabled(settings)

    assert caught.value.code == "registration_disabled"
    assert caught.value.status_code == 403


def test_registration_remains_available_for_local_development() -> None:
    require_registration_enabled(Settings(datacurrent_allow_registration=True))
