from __future__ import annotations

from pydantic import BaseModel


class ModuleSpecItem(BaseModel):
    id: str
    name: str
    description: str
    category: str
    category_label: str
    module_type: str
    applicable_scenarios: list[str]
    default_enabled: bool
    implemented: bool
    requires_review: bool
    dependencies: list[str]
    endpoint: str | None = None


class ModuleListResponse(BaseModel):
    items: list[ModuleSpecItem]
    total: int


class CategoryItem(BaseModel):
    key: str
    label: str


class CategoryListResponse(BaseModel):
    items: list[CategoryItem]
