"""Report triage / auto-classification (module: report_auto_classify).

Deterministic, rule-based priority assignment so triage is predictable,
reproducible and auditable — no model call on the hot path. Life-threatening
need types are escalated; severity dominates. Runs automatically on report
submission and can be re-run via the retriage endpoint.
"""
from __future__ import annotations

# need types that imply a threat to life/safety → escalated
_LIFE_SAFETY_NEEDS = frozenset(
    {
        "trapped_person",
        "missing_person",
        "medical_need",
        "building_collapse",
        "fire",
        "gas_leak",
    }
)

TRIAGE_PRIORITIES = ("critical", "high", "normal", "low")


def classify(need_type: str, severity: str) -> str:
    """Return one of critical/high/normal/low."""
    if severity == "critical":
        return "critical"
    if need_type in _LIFE_SAFETY_NEEDS:
        # a life-safety need is at least high; high severity makes it critical
        return "critical" if severity == "high" else "high"
    if severity == "high":
        return "high"
    if severity == "low":
        return "low"
    return "normal"
