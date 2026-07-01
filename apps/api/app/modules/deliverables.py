"""Deliverable bundles — the outcome layer on top of the module registry.

A *module* is a single building block (a form, a post draft, a map config). A
*deliverable* is what an operator or citizen actually recognises as a finished
thing: a rescue website, a Facebook disaster page, a LINE broadcast channel.

Each deliverable groups a set of generator modules (by ``artifact_type``) and
declares two entry points:

  - ``front`` — where the finished product is seen (the public microsite, the
    fan page preview, the phone preview).
  - ``admin`` — where an operator manages / reviews it.

The grouping is a clean partition of every generator module, so the agent's
output can always be presented as a small set of outcomes instead of a flat list
of modules. URL templates are resolved per-incident by ``deliverables_service``.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DeliverableLink:
    """A front/admin entry point. ``url_template`` may contain ``{id}`` (incident
    id) and ``{slug}`` (incident slug). ``kind``:

    - ``internal``        — a page this system already serves.
    - ``external_pending``— a real external channel the operator binds later
      (e.g. a real Facebook page / LINE official account); until then the link
      points at an in-system preview.
    """

    label: str
    url_template: str
    kind: str = "internal"


@dataclass(frozen=True)
class DeliverableSpec:
    key: str
    name: str
    tagline: str
    # member module ids (== artifact_type); the union over all specs is a
    # partition of every generator module.
    members: tuple[str, ...]
    front: DeliverableLink
    admin: DeliverableLink
    accent: str  # hex, drives the card colour on the frontend
    icon: str  # icon key the frontend maps to an SVG


DELIVERABLES: tuple[DeliverableSpec, ...] = (
    DeliverableSpec(
        key="rescue_site",
        name="救災資訊網站",
        tagline="對外單一入口：公告、災情回報、避難指引與災情地圖。",
        members=(
            "microsite_config",
            "public_notice_draft",
            "damage_report_form",
            "map_bundle",
            "evacuation_guide",
            "faq",
            "sos_form",
            "medical_need_form",
            "vulnerable_care_list",
            "shelter_map",
            "hazard_zone_layer",
        ),
        front=DeliverableLink(label="開啟救災網站", url_template="/preview/{slug}"),
        admin=DeliverableLink(label="網站管理後台", url_template="/incidents/{id}/site"),
        accent="#8c3b2e",
        icon="globe",
    ),
    DeliverableSpec(
        key="fb_page",
        name="FB 災害粉專",
        tagline="把整合資訊主動擴散到民眾所在的社群，貼文一律經審核才發布。",
        members=(
            "fb_page_post",
            "press_release",
            "clarification_notice",
        ),
        front=DeliverableLink(
            label="預覽粉專", url_template="/incidents/{id}/fb?view=preview",
            kind="external_pending",
        ),
        admin=DeliverableLink(label="粉專管理後台", url_template="/incidents/{id}/fb"),
        accent="#2f5fa8",
        icon="facebook",
    ),
    DeliverableSpec(
        key="line_channel",
        name="LINE 推播頻道",
        tagline="以官方帳號推播最新災情與入口連結，訊息經審核才送出。",
        members=("line_broadcast",),
        front=DeliverableLink(
            label="手機預覽", url_template="/incidents/{id}/line?view=preview",
            kind="external_pending",
        ),
        admin=DeliverableLink(label="推播管理後台", url_template="/incidents/{id}/line"),
        accent="#3a7d44",
        icon="line",
    ),
    DeliverableSpec(
        key="supply_ops",
        name="物資調度",
        tagline="物資需求登記、捐贈媒合與即時看板，避免重複捐贈與物資爆量。",
        members=(
            "supply_form",
            "supply_donation_form",
            "supply_dashboard",
        ),
        front=DeliverableLink(label="物資需求頁", url_template="/preview/{slug}"),
        admin=DeliverableLink(label="物資管理後台", url_template="/incidents/{id}/supply"),
        accent="#9a6a1f",
        icon="box",
    ),
    DeliverableSpec(
        key="volunteer_ops",
        name="志工招募",
        tagline="志工報名、招募擴散與現場報到，依專長與現場需求調度。",
        members=(
            "volunteer_form",
            "volunteer_recruit_post",
            "volunteer_checkin",
        ),
        front=DeliverableLink(label="志工報名頁", url_template="/reports/{id}"),
        admin=DeliverableLink(label="志工管理後台", url_template="/incidents/{id}/volunteer"),
        accent="#6f6a3a",
        icon="users",
    ),
)


# artifact_type -> deliverable key (built once; the members are a partition)
_TYPE_TO_KEY: dict[str, str] = {
    member: spec.key for spec in DELIVERABLES for member in spec.members
}


def deliverable_for_type(artifact_type: str) -> str | None:
    return _TYPE_TO_KEY.get(artifact_type)
