from datacurrent.analysis.plans import analyze_plan, parse_postgres_plan


def test_flags_large_sequential_scan() -> None:
    plan = parse_postgres_plan(
        [
            {
                "Plan": {
                    "Node Type": "Seq Scan",
                    "Relation Name": "orders",
                    "Plan Rows": 2_000_000,
                    "Total Cost": 280000,
                }
            }
        ]
    )
    findings = analyze_plan(plan)
    assert findings[0].code == "large_sequential_scan"
    assert findings[0].severity == "high"


def test_parses_nested_plan() -> None:
    plan = parse_postgres_plan(
        [
            {
                "Plan": {
                    "Node Type": "Hash Join",
                    "Plan Rows": 100,
                    "Plans": [
                        {"Node Type": "Index Scan", "Relation Name": "orders", "Plan Rows": 100}
                    ],
                }
            }
        ]
    )
    assert plan.children[0].relation == "orders"
    assert plan.children[0].id == "0.0"
