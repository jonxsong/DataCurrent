import hashlib
from dataclasses import dataclass
from typing import Any

import sqlglot
from sqlglot import exp
from sqlglot.errors import ParseError

from datacurrent.core.errors import DataCurrentError


@dataclass(frozen=True)
class ParsedQuery:
    dialect: str
    operation: str
    normalized_sql: str
    redacted_sql: str
    fingerprint: str
    referenced_tables: tuple[str, ...]
    ast: dict[str, Any]


def _redact_literals(expression: exp.Expression) -> exp.Expression:
    copy = expression.copy()
    for literal in list(copy.find_all(exp.Literal)):
        placeholder = exp.Placeholder(this="value")
        literal.replace(placeholder)
    return copy


def parse_query(sql: str, *, dialect: str = "postgres") -> ParsedQuery:
    if not sql.strip():
        raise DataCurrentError("SQL is required", code="empty_sql")
    try:
        statements = sqlglot.parse(sql, read=dialect)
    except ParseError as exc:
        raise DataCurrentError("SQL could not be parsed", code="invalid_sql") from exc
    if len(statements) != 1:
        raise DataCurrentError("Exactly one SQL statement is allowed", code="multiple_statements")
    expression = statements[0]
    operation = expression.key.upper()
    normalized = expression.sql(dialect=dialect, pretty=True, normalize=True)
    redacted = _redact_literals(expression).sql(dialect=dialect, pretty=True, normalize=True)
    fingerprint = hashlib.sha256(redacted.encode()).hexdigest()
    tables = tuple(
        sorted(
            {table.sql(dialect=dialect, normalize=True) for table in expression.find_all(exp.Table)}
        )
    )
    return ParsedQuery(
        dialect=dialect,
        operation=operation,
        normalized_sql=normalized,
        redacted_sql=redacted,
        fingerprint=fingerprint,
        referenced_tables=tables,
        ast=expression.dump(),
    )


def assert_read_only_select(parsed: ParsedQuery) -> None:
    if parsed.operation not in {"SELECT", "UNION", "INTERSECT", "EXCEPT"}:
        raise DataCurrentError(
            "Query Lab supports read-only SELECT statements only",
            code="unsafe_statement",
        )
