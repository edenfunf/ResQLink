"""The six core generator modules — the minimal viable rescue toolkit.

These are ``default_enabled`` and apply to every scenario, so a plain
``bootstrap`` (no module selection) reproduces the original six artifacts and
keeps backward compatibility. Disaster-specific content comes from the scenario
profile, so the same modules serve floods, earthquakes and typhoons.
"""
from __future__ import annotations

from app.modules.base import ModuleSpec
from app.modules.registry import registry
from app.modules.scenarios import ScenarioProfile, site_title


def _microsite_config(incident, profile: ScenarioProfile) -> dict:
    return {
        "site_title": site_title(incident, profile),
        "slug": incident.slug,
        "scenario_type": incident.scenario_type,
        "severity": incident.severity,
        "sections": [
            {"key": "notice", "title": "重要公告", "enabled": True},
            {"key": "damage_report", "title": "災情回報", "enabled": True},
            {"key": "volunteer_signup", "title": "志工報名", "enabled": True},
            {"key": "supply_request", "title": "物資需求", "enabled": True},
            {"key": "map", "title": "災情地圖", "enabled": True},
        ],
        "source_refs": incident.source_refs or [],
    }


def _damage_report_form(incident, profile: ScenarioProfile) -> dict:
    return {
        "form_key": "damage_report",
        "title": "災情回報表單",
        "description": profile.damage_form_desc,
        "fields": [
            {
                "name": "need_type",
                "label": "需求類型",
                "type": "select",
                "required": True,
                "options": [value for value, _ in profile.need_types],
            },
            {
                "name": "description",
                "label": "狀況描述",
                "type": "textarea",
                "required": True,
            },
            {
                "name": "address",
                "label": "地址或地點描述",
                "type": "text",
                "required": True,
            },
            {"name": "lat", "label": "緯度", "type": "number", "required": False},
            {"name": "lon", "label": "經度", "type": "number", "required": False},
            {
                "name": "reporter_contact",
                "label": "聯絡方式",
                "type": "text",
                "required": False,
                "pii": True,
            },
        ],
    }


def _volunteer_form(incident, profile: ScenarioProfile) -> dict:
    return {
        "form_key": "volunteer_signup",
        "title": "志工報名表單",
        "fields": [
            {
                "name": "display_name",
                "label": "姓名或暱稱",
                "type": "text",
                "required": True,
                "pii": True,
            },
            {
                "name": "skills",
                "label": "可協助項目",
                "type": "multi_select",
                "required": True,
                "options": list(profile.volunteer_skills),
            },
            {
                "name": "available_time",
                "label": "可支援時間",
                "type": "text",
                "required": True,
            },
        ],
    }


def _supply_form(incident, profile: ScenarioProfile) -> dict:
    return {
        "form_key": "supply_request",
        "title": "物資需求表單",
        "fields": [
            {
                "name": "item_type",
                "label": "物資類型",
                "type": "select",
                "required": True,
                "options": list(profile.supply_items),
            },
            {
                "name": "quantity",
                "label": "需求數量",
                "type": "number",
                "required": True,
            },
            {
                "name": "delivery_location",
                "label": "配送地點",
                "type": "text",
                "required": True,
            },
        ],
    }


def _map_bundle(incident, profile: ScenarioProfile) -> dict:
    return {
        "center": {"lat": incident.lat, "lon": incident.lon},
        "zoom": 13,
        "aoi": incident.aoi_geojson,
        "layers": [
            {
                "key": "incident_center",
                "type": "point",
                "title": "事件中心點",
                "enabled": True,
            },
            {
                "key": "aoi",
                "type": "geojson",
                "title": "影響範圍",
                "enabled": True,
            },
            {
                "key": "reports",
                "type": "geojson_endpoint",
                "title": "民眾災情通報",
                "endpoint": f"/v1/incidents/{incident.id}/reports.geojson",
                "enabled": True,
            },
        ],
    }


def _public_notice_draft(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{incident.river or incident.title}{profile.hazard_name}資訊提醒",
        "body": (
            f"目前系統已建立{site_title(incident, profile)}。本頁面提供災情回報、志工報名、"
            "物資需求與地圖資訊。所有公開內容須經人工審核後顯示，請民眾仍以政府官方公告為準。"
        ),
        "disclaimer": "本系統為公民科技輔助工具，不取代官方災害應變指揮與公告。",
        "requires_review": True,
    }


CORE_MODULES = [
    ModuleSpec(
        id="microsite_config",
        name="救災資訊入口設定",
        description="從事件一鍵生成救災資訊入口的版面與區塊設定，作為對外單一入口。",
        category="info_hub",
        default_enabled=True,
        generate=_microsite_config,
    ),
    ModuleSpec(
        id="damage_report_form",
        name="災情回報表單",
        description="生成讓民眾回報災情與需求的結構化表單，需求類型隨災種調整。",
        category="reporting",
        default_enabled=True,
        generate=_damage_report_form,
    ),
    ModuleSpec(
        id="volunteer_form",
        name="志工報名表單",
        description="生成志工報名表單，技能選項隨災種調整。",
        category="volunteer",
        default_enabled=True,
        generate=_volunteer_form,
    ),
    ModuleSpec(
        id="supply_form",
        name="物資需求表單",
        description="生成物資需求登記表單，物資品項隨災種調整。",
        category="supply",
        default_enabled=True,
        generate=_supply_form,
    ),
    ModuleSpec(
        id="map_bundle",
        name="災情地圖組合",
        description="生成地圖圖層組合（事件中心、影響範圍、通報圖層）。",
        category="geospatial",
        default_enabled=True,
        risk_override="low",
        generate=_map_bundle,
    ),
    ModuleSpec(
        id="public_notice_draft",
        name="公開公告草稿",
        description="生成對外公告草稿；屬高風險、發布前一律走 publication_review。",
        category="info_hub",
        default_enabled=True,
        risk_override="high",
        review_type_override="publication_review",
        generate=_public_notice_draft,
    ),
]


def register() -> None:
    for spec in CORE_MODULES:
        registry.register(spec)
