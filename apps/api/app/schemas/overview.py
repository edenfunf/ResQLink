from __future__ import annotations

from pydantic import BaseModel


class OverviewResponse(BaseModel):
    incidents_total: int
    incidents_open: int
    reviews_pending: int
    artifacts_pending_review: int
    artifacts_approved: int
    reports_total: int
    reports_critical_open: int
    reports_unverified: int
    resources_open: int
    assignments_active: int
    publications_total: int
