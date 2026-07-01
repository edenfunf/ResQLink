"""In-memory module registry — the agent/console's capability catalogue.

Registration order is preserved (dict insertion order), so bootstrap and the
``/v1/modules`` listing return modules in a stable, predictable order.
"""
from __future__ import annotations

from app.modules.base import ModuleNotFoundError, ModuleSpec


class ModuleRegistry:
    def __init__(self) -> None:
        self._modules: dict[str, ModuleSpec] = {}

    def register(self, spec: ModuleSpec) -> ModuleSpec:
        if spec.id in self._modules:
            raise ValueError(f"Duplicate module id: {spec.id}")
        self._modules[spec.id] = spec
        return spec

    def get(self, module_id: str) -> ModuleSpec | None:
        return self._modules.get(module_id)

    def require(self, module_id: str) -> ModuleSpec:
        spec = self._modules.get(module_id)
        if spec is None:
            raise ModuleNotFoundError(module_id)
        return spec

    def all(self) -> list[ModuleSpec]:
        return list(self._modules.values())

    def for_scenario(
        self,
        scenario_type: str,
        *,
        implemented_only: bool = False,
    ) -> list[ModuleSpec]:
        return [
            m
            for m in self._modules.values()
            if m.applies_to(scenario_type)
            and (not implemented_only or m.implemented)
        ]

    def defaults_for_scenario(self, scenario_type: str) -> list[ModuleSpec]:
        """The modules bootstrap runs when no explicit selection is given."""
        return [
            m
            for m in self._modules.values()
            if m.default_enabled and m.applies_to(scenario_type)
        ]


registry = ModuleRegistry()
