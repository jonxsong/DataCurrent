from datacurrent.ai.investigator import InvestigationReport


def test_investigation_report_requires_evidence_kinds() -> None:
    report = InvestigationReport.model_validate(
        {
            "summary": "A scan is likely responsible for the observed cost.",
            "findings": [
                {
                    "title": "Large scan",
                    "kind": "observed",
                    "explanation": "The stored plan contains a sequential scan.",
                    "evidence": [
                        {"source_type": "plan", "source_id": "plan-1", "observation": "Seq Scan"}
                    ],
                    "recommendation": "Benchmark a selective index.",
                    "tradeoffs": ["More write amplification"],
                    "confidence": "medium",
                    "missing_evidence": ["Representative benchmark"],
                }
            ],
            "verification_plan": ["Run repeated measurements in an isolated database."],
            "limitations": [],
        }
    )
    assert report.findings[0].kind == "observed"
