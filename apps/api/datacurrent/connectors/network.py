import asyncio
import ipaddress
import socket

from datacurrent.core.config import get_settings
from datacurrent.core.errors import DataCurrentError


def _is_restricted(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return any(
        (
            ip.is_private,
            ip.is_loopback,
            ip.is_link_local,
            ip.is_multicast,
            ip.is_reserved,
            ip.is_unspecified,
        )
    )


async def validate_database_host(host: str, port: int) -> None:
    settings = get_settings()
    normalized = host.rstrip(".").lower()
    if normalized in {item.lower() for item in settings.database_host_allowlist}:
        return
    if settings.allow_private_database_hosts and not settings.is_production:
        return
    try:
        addresses = await asyncio.get_running_loop().getaddrinfo(
            host, port, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM
        )
    except socket.gaierror as exc:
        raise DataCurrentError(
            "Database host could not be resolved", code="host_resolution_failed"
        ) from exc
    resolved = {ipaddress.ip_address(address[4][0]) for address in addresses}
    if not resolved or any(_is_restricted(ip) for ip in resolved):
        raise DataCurrentError(
            "Database host resolves to a restricted network address",
            code="restricted_database_host",
        )
