"""Needs-resource matching engine (module: needs_matching_engine).

Pairs open disaster reports (the demand) with open resource offers (the supply)
by compatible type and geographic proximity. Computed on read — a deterministic
suggestion layer; it does not auto-assign (human/dispatch decides). Reports are
processed critical-first so the most urgent needs surface their candidates first.
"""
from __future__ import annotations

import math
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import DisasterReport, ResourceOffer

_OPEN_REPORT_STATUSES = ("new", "triaged", "in_progress")
_TRIAGE_RANK = {"critical": 0, "high": 1, "normal": 2, "low": 3}

# need types a volunteer (labour) can address
_LABOUR_NEEDS = frozenset(
    {
        "mud_removal",
        "flooding",
        "road_blocked",
        "power_outage",
        "building_collapse",
        "fire",
        "trapped_person",
        "missing_person",
        "medical_need",
    }
)
_SUPPLY_NEEDS = frozenset({"supply_need"})

_MAX_CANDIDATES = 5


def _compatible(need_type: str, offer_type: str) -> bool:
    if offer_type == "supply":
        return need_type in _SUPPLY_NEEDS
    if offer_type == "volunteer":
        return need_type in _LABOUR_NEEDS
    return False


def _haversine_km(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _score(distance_km: float | None) -> float:
    # nearer => higher; unknown distance gets a modest baseline
    if distance_km is None:
        return 0.4
    return round(1.0 / (1.0 + distance_km), 4)


def compute_matches(
    db: Session, incident_id: uuid.UUID, *, limit: int = 50, offset: int = 0
) -> dict:
    reports = list(
        db.scalars(
            select(DisasterReport).where(
                DisasterReport.incident_id == incident_id,
                DisasterReport.status.in_(_OPEN_REPORT_STATUSES),
            )
        ).all()
    )
    offers = list(
        db.scalars(
            select(ResourceOffer).where(
                ResourceOffer.incident_id == incident_id,
                ResourceOffer.status == "open",
            )
        ).all()
    )

    reports.sort(
        key=lambda r: (_TRIAGE_RANK.get(r.triage_priority, 2), r.created_at)
    )
    total_reports = len(reports)

    # matched/unmatched counts are over ALL open reports (cheap existence check)
    matched = sum(
        1
        for r in reports
        if any(_compatible(r.need_type, o.offer_type) for o in offers)
    )
    unmatched = total_reports - matched

    # full candidate lists are built only for the requested page
    page = reports[offset : offset + limit]
    items = []
    for report in page:
        candidates = []
        for offer in offers:
            if not _compatible(report.need_type, offer.offer_type):
                continue
            distance_km = None
            if (
                report.lat is not None
                and report.lon is not None
                and offer.lat is not None
                and offer.lon is not None
            ):
                distance_km = round(
                    _haversine_km(report.lat, report.lon, offer.lat, offer.lon), 2
                )
            candidates.append(
                {
                    "offer_id": offer.id,
                    "offer_type": offer.offer_type,
                    "item": offer.item,
                    "quantity": offer.quantity,
                    "address": offer.address,
                    "distance_km": distance_km,
                    "score": _score(distance_km),
                }
            )
        candidates.sort(key=lambda c: c["score"], reverse=True)
        candidates = candidates[:_MAX_CANDIDATES]

        items.append(
            {
                "report_id": report.id,
                "need_type": report.need_type,
                "triage_priority": report.triage_priority,
                "description": report.description,
                "address": report.address,
                "candidates": candidates,
            }
        )

    return {
        "incident_id": incident_id,
        "matched_reports": matched,
        "unmatched_reports": unmatched,
        "open_offers": len(offers),
        "total_reports": total_reports,
        "limit": limit,
        "offset": offset,
        "items": items,
    }
