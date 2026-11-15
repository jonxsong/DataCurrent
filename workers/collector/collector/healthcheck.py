from celery.app.control import Inspect

from collector.celery_app import app


def main() -> int:
    inspector: Inspect = app.control.inspect(timeout=2)
    return 0 if inspector.ping() else 1


if __name__ == "__main__":
    raise SystemExit(main())
