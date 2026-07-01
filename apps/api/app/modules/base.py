"""Module contract for the 災鏈 ResQLink capability registry.

A *module* is a reusable disaster-response building block. Generator modules
turn an incident (plus a scenario profile) into a reviewable artifact dict; the
structure stays deterministic so output is predictable and auditable. Action and
processor modules are catalogued here too (so the agent/console can see the full
capability map) and are marked ``implemented=False`` until their connector or
worker exists.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # avoid import cycles at runtime
    from app.db.models import Incident
    from app.modules.scenarios import ScenarioProfile

# generator signature: (incident, scenario_profile) -> artifact content dict
GenerateFn = Callable[["Incident", "ScenarioProfile"], dict]

# the ten major directions (大方向) every disaster response needs
CATEGORIES: dict[str, str] = {
    "info_hub": "資訊匯流平台",
    "reporting": "災情蒐集與通報",
    "help_request": "求援與緊急需求",
    "outreach": "資訊擴散與觸及",
    "volunteer": "志工動員",
    "supply": "物資募集與調度",
    "matching": "媒合與派遣",
    "geospatial": "地理態勢與地圖",
    "verification": "查證與信任",
    "coordination": "協調與稽核",
}

# generator | action | processor
MODULE_TYPES = ("generator", "action", "processor")

_SEVERITY_TO_RISK = {
    "low": "low",
    "medium": "medium",
    "high": "high",
    "critical": "high",
}


@dataclass(frozen=True)
class ModuleSpec:
    """A registered capability. ``id`` doubles as the artifact_type for
    generator modules, so it must be stable and unique."""

    id: str
    name: str
    description: str
    category: str
    module_type: str = "generator"
    applicable_scenarios: tuple[str, ...] = ("*",)
    default_enabled: bool = False
    implemented: bool = True
    requires_review: bool = True
    dependencies: tuple[str, ...] = ()
    # fixed risk; None => derive from incident severity
    risk_override: str | None = None
    # fixed review type; None => derive from risk
    review_type_override: str | None = None
    # where a live processor/action capability is served (None for generators)
    endpoint: str | None = None
    generate: GenerateFn | None = field(default=None, repr=False)

    def applies_to(self, scenario_type: str) -> bool:
        return "*" in self.applicable_scenarios or scenario_type in self.applicable_scenarios

    def is_bootstrap_executable(self) -> bool:
        """Only generator modules with a generate fn can be run via bootstrap /
        the agent execute path; processors and actions are served elsewhere."""
        return (
            self.implemented
            and self.module_type == "generator"
            and self.generate is not None
        )

    def risk_for(self, severity: str) -> str:
        if self.risk_override is not None:
            return self.risk_override
        return _SEVERITY_TO_RISK.get(severity, "medium")

    def review_type_for(self, risk_level: str) -> str:
        if self.review_type_override is not None:
            return self.review_type_override
        if risk_level == "high":
            return "risk_review"
        return "artifact_review"


class ModuleNotFoundError(Exception):
    """Raised when a requested module id is not in the registry."""

    def __init__(self, module_id: str) -> None:
        super().__init__(f"Unknown module: {module_id}")
        self.module_id = module_id


class ModuleNotExecutableError(Exception):
    """Raised when a module exists but cannot be run by bootstrap (not a
    generator / not yet implemented)."""

    def __init__(self, module_id: str, endpoint: str | None = None) -> None:
        if endpoint:
            msg = (
                f"Module '{module_id}' is a live capability served at "
                f"{endpoint}, not a bootstrap generator."
            )
        else:
            msg = (
                f"Module '{module_id}' is not executable yet "
                "(not a generator / not implemented)."
            )
        super().__init__(msg)
        self.module_id = module_id
        self.endpoint = endpoint
