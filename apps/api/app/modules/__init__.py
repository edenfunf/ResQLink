"""Module package — importing it registers every built-in module exactly once."""
from __future__ import annotations

from app.modules import core_modules, extended_modules
from app.modules.base import (
    CATEGORIES,
    ModuleNotExecutableError,
    ModuleNotFoundError,
    ModuleSpec,
)
from app.modules.registry import registry

core_modules.register()
extended_modules.register()

__all__ = [
    "registry",
    "ModuleSpec",
    "ModuleNotFoundError",
    "ModuleNotExecutableError",
    "CATEGORIES",
]
