"""Module catalogue endpoints — the capability map the console/agent reads to
decide what to generate for an incident."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from app.modules import CATEGORIES, registry
from app.modules.base import ModuleSpec
from app.schemas.module import (
    CategoryItem,
    CategoryListResponse,
    ModuleListResponse,
    ModuleSpecItem,
)

router = APIRouter(prefix="/v1/modules", tags=["modules"])


def _to_item(spec: ModuleSpec) -> ModuleSpecItem:
    return ModuleSpecItem(
        id=spec.id,
        name=spec.name,
        description=spec.description,
        category=spec.category,
        category_label=CATEGORIES.get(spec.category, spec.category),
        module_type=spec.module_type,
        applicable_scenarios=list(spec.applicable_scenarios),
        default_enabled=spec.default_enabled,
        implemented=spec.implemented,
        requires_review=spec.requires_review,
        dependencies=list(spec.dependencies),
        endpoint=spec.endpoint,
    )


@router.get("", response_model=ModuleListResponse, summary="List modules")
def list_modules(
    scenario: str | None = Query(default=None, description="依災種篩選可用模組"),
    category: str | None = Query(default=None, description="依大方向篩選"),
    implemented: bool | None = Query(default=None, description="僅列已實作 / 未實作"),
) -> ModuleListResponse:
    specs = registry.all()
    if scenario is not None:
        specs = [s for s in specs if s.applies_to(scenario)]
    if category is not None:
        specs = [s for s in specs if s.category == category]
    if implemented is not None:
        specs = [s for s in specs if s.implemented is implemented]
    items = [_to_item(s) for s in specs]
    return ModuleListResponse(items=items, total=len(items))


@router.get(
    "/categories",
    response_model=CategoryListResponse,
    summary="List module categories (大方向)",
)
def list_categories() -> CategoryListResponse:
    return CategoryListResponse(
        items=[CategoryItem(key=k, label=v) for k, v in CATEGORIES.items()]
    )


@router.get(
    "/{module_id}",
    response_model=ModuleSpecItem,
    summary="Get a single module spec",
)
def get_module(module_id: str) -> ModuleSpecItem:
    spec = registry.get(module_id)
    if spec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found",
        )
    return _to_item(spec)
