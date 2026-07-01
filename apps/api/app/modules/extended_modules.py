"""Extended module catalogue — the rest of the ten major directions.

Every generator here produces a *reviewable draft* artifact (text, form or map
config). Anything that talks to an external system (publishing to Facebook,
pushing LINE) or runs a background computation (matching, dedup) is registered
as a catalogue entry with ``implemented=False`` so the agent/console sees the
full roadmap without pretending the connector exists yet. None of these are
``default_enabled`` — they are opt-in, selected explicitly (by a human or, later,
the orchestrating agent).
"""
from __future__ import annotations

from app.modules.base import ModuleSpec
from app.modules.registry import registry
from app.modules.scenarios import ScenarioProfile, place_label, site_title

_EMERGENCY_CONTACTS = [
    {"name": "消防 / 救護", "phone": "119"},
    {"name": "警察", "phone": "110"},
    {"name": "災害應變專線", "phone": "1991"},
]


# ── ① 資訊匯流平台 ────────────────────────────────────────────────
def _evacuation_guide(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}{profile.hazard_name}避難與撤離指引",
        "hazard": profile.hazard_name,
        "steps": list(profile.evacuation_tips),
        "emergency_contacts": _EMERGENCY_CONTACTS,
        "shelter_layer_ref": "shelter_map",
        "disclaimer": "本指引為輔助參考，撤離與避難請以地方政府最新公告為準。",
        "requires_review": True,
    }


def _faq(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{profile.label}災害常見問答",
        "items": [{"q": q, "a": a} for q, a in profile.faq],
        "disclaimer": "如與官方公告不一致，以官方公告為準。",
        "requires_review": True,
    }


# ── ③ 求援與緊急需求 ─────────────────────────────────────────────
def _sos_form(incident, profile: ScenarioProfile) -> dict:
    return {
        "form_key": "sos",
        "title": "緊急求援登記",
        "priority": "critical",
        "notice": "生命危急請先撥打 119 / 110。本表單用於協調支援，非即時派遣。",
        "fields": [
            {
                "name": "need_type",
                "label": "求援類型",
                "type": "select",
                "required": True,
                "options": ["trapped_person", "medical_need", "missing_person", "other"],
            },
            {"name": "people_count", "label": "受困/需協助人數", "type": "number", "required": True},
            {"name": "description", "label": "現場狀況", "type": "textarea", "required": True},
            {"name": "address", "label": "地點", "type": "text", "required": True},
            {"name": "lat", "label": "緯度", "type": "number", "required": False},
            {"name": "lon", "label": "經度", "type": "number", "required": False},
            {"name": "reporter_contact", "label": "聯絡方式", "type": "text", "required": True, "pii": True},
        ],
    }


def _medical_need_form(incident, profile: ScenarioProfile) -> dict:
    return {
        "form_key": "medical_need",
        "title": "醫療需求登記",
        "fields": [
            {"name": "condition", "label": "傷病狀況", "type": "textarea", "required": True},
            {
                "name": "urgency",
                "label": "急迫程度",
                "type": "select",
                "required": True,
                "options": ["critical", "high", "medium", "low"],
            },
            {"name": "mobility", "label": "行動能力", "type": "select", "required": False,
             "options": ["可自行行走", "需攙扶", "需擔架/輪椅"]},
            {"name": "address", "label": "所在地點", "type": "text", "required": True},
            {"name": "reporter_contact", "label": "聯絡方式", "type": "text", "required": True, "pii": True},
        ],
    }


def _vulnerable_care_list(incident, profile: ScenarioProfile) -> dict:
    return {
        "list_key": "vulnerable_care",
        "title": "弱勢族群關懷名單",
        "categories": ["獨居長者", "身心障礙者", "慢性病/洗腎患者", "孕產婦與嬰幼兒", "行動不便者"],
        "fields": [
            {"name": "category", "label": "關懷類別", "type": "select", "required": True},
            {"name": "address", "label": "居住地點", "type": "text", "required": True},
            {"name": "needs", "label": "特殊需求", "type": "textarea", "required": False},
            {"name": "contact", "label": "聯絡方式", "type": "text", "required": False, "pii": True},
        ],
        "privacy_note": "名單含個資，僅供救災協調使用，對外輸出一律去識別化。",
    }


# ── ④ 資訊擴散與觸及 ─────────────────────────────────────────────
def _fb_page_post(incident, profile: ScenarioProfile) -> dict:
    place = place_label(incident)
    return {
        "platform": "facebook",
        "post_type": "announcement",
        "title": f"{place}{profile.hazard_name}資訊整合",
        "body": (
            f"【{place}{profile.hazard_name}】我們已建立「{site_title(incident, profile)}」，"
            "整合災情回報、志工報名、物資需求與災情地圖。請有需要或可協助的鄉親多多分享，"
            "並以政府官方公告為準。"
        ),
        "hashtags": [f"#{profile.label}", "#防災", f"#{incident.county or '救災'}"],
        "call_to_action": "點我前往救災資訊入口",
        "publish_action_ref": "fb_publish_action",
        "requires_review": True,
    }


def _line_broadcast(incident, profile: ScenarioProfile) -> dict:
    return {
        "platform": "line",
        "message_type": "broadcast",
        "text": (
            f"{place_label(incident)}{profile.hazard_name}資訊更新：救災資訊入口已上線，"
            "可回報災情、報名志工、登記物資需求並查看災情地圖。緊急危及生命請撥 119。"
        ),
        "quick_replies": ["災情回報", "志工報名", "物資需求", "災情地圖"],
        "publish_action_ref": "line_broadcast_action",
        "requires_review": True,
    }


def _press_release(incident, profile: ScenarioProfile) -> dict:
    place = place_label(incident)
    return {
        "doc_type": "press_release",
        "headline": f"{place}{profile.hazard_name}救災資訊整合入口上線",
        "subheadline": "整合災情回報、志工招募、物資需求與災情地圖，協助救災資訊流通",
        "body_paragraphs": [
            f"因應{place}{profile.hazard_name}，{incident.title}相關救災資訊已整合於單一入口。",
            "民眾可透過入口回報災情、登記物資與報名志工，所有對外內容皆經人工審核後公開。",
            "本系統為公民科技輔助工具，相關撤離與災情資訊仍以政府官方公告為準。",
        ],
        "contact": "（請填入發布單位聯絡窗口）",
        "requires_review": True,
    }


# ── ⑤ 志工動員 ─────────────────────────────────────────────────
def _volunteer_recruit_post(incident, profile: ScenarioProfile) -> dict:
    return {
        "post_type": "volunteer_recruitment",
        "platform": "multi",
        "title": f"{place_label(incident)}{profile.hazard_name}志工招募",
        "body": (
            f"{place_label(incident)}需要您的協助！我們正在招募志工協助救災，"
            "報名後將依現場需求與您的專長進行調度。請評估自身安全與時間再報名。"
        ),
        "needed_skills": list(profile.volunteer_skills),
        "signup_section_ref": "volunteer_form",
        "safety_note": "請攜帶適當裝備、評估自身安全，未成年請由監護人陪同。",
        "requires_review": True,
    }


def _volunteer_checkin(incident, profile: ScenarioProfile) -> dict:
    return {
        "checkin_key": "volunteer_checkin",
        "title": "志工報到 / 簽到",
        "method": "qr",
        "fields": [
            {"name": "display_name", "label": "姓名或暱稱", "type": "text", "required": True, "pii": True},
            {"name": "team", "label": "編組/隊伍", "type": "text", "required": False},
            {"name": "skills", "label": "可協助項目", "type": "multi_select", "required": False,
             "options": list(profile.volunteer_skills)},
            {"name": "checkin_time", "label": "報到時間", "type": "datetime", "required": True},
        ],
        "safety_note": "報到時請領取識別、確認任務分組與安全須知。",
    }


# ── ⑥ 物資募集與調度 ─────────────────────────────────────────────
def _supply_donation_form(incident, profile: ScenarioProfile) -> dict:
    return {
        "form_key": "supply_donation",
        "title": "物資捐贈登記",
        "fields": [
            {"name": "item_type", "label": "物資類型", "type": "select", "required": True,
             "options": list(profile.supply_items)},
            {"name": "quantity", "label": "捐贈數量", "type": "number", "required": True},
            {"name": "donor_name", "label": "捐贈者/單位", "type": "text", "required": False, "pii": True},
            {"name": "delivery_method", "label": "交付方式", "type": "select", "required": True,
             "options": ["自行送達集散點", "需協助收取", "宅配/物流"]},
            {"name": "available_time", "label": "可交付時間", "type": "text", "required": False},
        ],
        "note": "捐贈前請先對照需求看板，避免捐贈已足量的品項。",
    }


def _supply_dashboard(incident, profile: ScenarioProfile) -> dict:
    return {
        "dashboard_key": "supply_status",
        "title": "物資需求即時看板",
        "source": "supply_requests",
        "columns": ["item_type", "needed", "fulfilled", "status"],
        "statuses": ["urgent", "collecting", "sufficient", "stop"],
        "tracked_items": list(profile.supply_items),
        "stop_rule": "品項達標後請標記為 stop，前台同步顯示「已足量、暫停捐贈」以避免重複捐贈與物資爆量。",
        "requires_review": True,
    }


# ── ⑧ 地理態勢與地圖 ─────────────────────────────────────────────
def _shelter_map(incident, profile: ScenarioProfile) -> dict:
    return {
        "map_key": "shelter_map",
        "center": {"lat": incident.lat, "lon": incident.lon},
        "zoom": 13,
        "layers": [
            {"key": "shelters", "type": "point", "title": "避難收容所", "enabled": True, "items": []},
            {"key": "incident_center", "type": "point", "title": "事件中心點", "enabled": True},
        ],
        "note": "收容所座標待承辦填入，或串接地方政府避難收容所開放資料。",
    }


def _hazard_zone_layer(incident, profile: ScenarioProfile) -> dict:
    return {
        "layer_key": "hazard_zones",
        "title": "危險區與道路封閉圖層",
        "aoi": incident.aoi_geojson,
        "zone_types": ["淹水潛勢", "封閉道路", "禁止進入", "土石流警戒"],
        "features": [],
        "note": "圖徵待填入或串接官方公告之封閉路段與警戒範圍。",
    }


# ── ⑨ 查證與信任 ───────────────────────────────────────────────
def _clarification_notice(incident, profile: ScenarioProfile) -> dict:
    return {
        "doc_type": "clarification",
        "title": f"{place_label(incident)}{profile.hazard_name}澄清與闢謠",
        "body": (
            "近期出現未經查證之災情訊息。請民眾勿轉傳未經證實內容，"
            "並以政府官方公告與本入口審核後資訊為準。"
        ),
        "verified_sources": [],
        "requires_review": True,
    }


_GENERATOR_MODULES = [
    # ① 資訊匯流平台
    ModuleSpec(id="evacuation_guide", name="避難與撤離指引", category="info_hub",
               description="生成避難與撤離指引（步驟、緊急電話），步驟隨災種調整。",
               generate=_evacuation_guide),
    ModuleSpec(id="faq", name="常見問答", category="info_hub",
               description="生成災害常見問答，內容隨災種調整。", generate=_faq),
    # ③ 求援與緊急需求
    ModuleSpec(id="sos_form", name="緊急求援登記", category="help_request",
               description="生成高優先的緊急求援表單（受困/醫療/協尋）。",
               risk_override="high", generate=_sos_form),
    ModuleSpec(id="medical_need_form", name="醫療需求登記", category="help_request",
               description="生成醫療需求登記表單（傷病狀況、急迫程度）。",
               risk_override="high", generate=_medical_need_form),
    ModuleSpec(id="vulnerable_care_list", name="弱勢關懷名單", category="help_request",
               description="生成弱勢族群關懷名單設定（含個資，對外去識別化）。",
               risk_override="high", generate=_vulnerable_care_list),
    # ④ 資訊擴散與觸及
    ModuleSpec(id="fb_page_post", name="FB 粉專貼文草稿", category="outreach",
               description="生成 Facebook 粉專貼文草稿；發布動作另由 connector 處理。",
               review_type_override="publication_review", generate=_fb_page_post),
    ModuleSpec(id="line_broadcast", name="LINE 推播訊息草稿", category="outreach",
               description="生成 LINE 推播訊息草稿；推播動作另由 connector 處理。",
               review_type_override="publication_review", generate=_line_broadcast),
    ModuleSpec(id="press_release", name="新聞稿 / 懶人包", category="outreach",
               description="生成新聞稿/懶人包草稿。",
               review_type_override="publication_review", generate=_press_release),
    # ⑤ 志工動員
    ModuleSpec(id="volunteer_recruit_post", name="志工招募貼文草稿", category="volunteer",
               description="生成志工招募貼文草稿，所需專長隨災種調整。",
               review_type_override="publication_review", generate=_volunteer_recruit_post),
    ModuleSpec(id="volunteer_checkin", name="志工報到/簽到", category="volunteer",
               description="生成志工現場報到/簽到設定（QR、編組）。",
               generate=_volunteer_checkin),
    # ⑥ 物資募集與調度
    ModuleSpec(id="supply_donation_form", name="物資捐贈登記", category="supply",
               description="生成物資捐贈登記表單，品項隨災種調整。",
               generate=_supply_donation_form),
    ModuleSpec(id="supply_dashboard", name="物資需求即時看板", category="supply",
               description="生成物資需求即時看板設定，含『已足量/喊停』狀態以避免重複捐贈。",
               generate=_supply_dashboard),
    # ⑧ 地理態勢與地圖
    ModuleSpec(id="shelter_map", name="避難收容所地圖", category="geospatial",
               description="生成避難收容所地圖圖層設定。",
               risk_override="low", generate=_shelter_map),
    ModuleSpec(id="hazard_zone_layer", name="危險區/道路封閉圖層", category="geospatial",
               description="生成危險區與封閉道路圖層設定。",
               risk_override="low", generate=_hazard_zone_layer),
    # ⑨ 查證與信任
    ModuleSpec(id="clarification_notice", name="澄清/闢謠公告", category="verification",
               description="生成澄清與闢謠公告草稿。",
               review_type_override="publication_review", generate=_clarification_notice),
]

# Future capabilities — catalogued for the roadmap, not yet executable.
_PLANNED_MODULES = [
    ModuleSpec(id="report_auto_classify", name="通報自動分類分級", category="reporting",
               module_type="processor", implemented=True, requires_review=False,
               endpoint="POST /v1/incidents/{id}/reports（送出即自動 triage）、POST /v1/reports/{id}/retriage",
               description="通報送出時自動依需求類型與嚴重度判定 triage 優先序（critical/high/normal/low），可重算。"),
    ModuleSpec(id="needs_matching_engine", name="需求-資源媒合引擎", category="matching",
               module_type="processor", implemented=True, requires_review=False,
               endpoint="POST /v1/incidents/{id}/resources、GET /v1/incidents/{id}/matches",
               description="將開放通報（需求）與已登記的志工/物資（供給）依類型與距離配對，"
                           "critical 優先；為建議層，不自動派工。"),
    ModuleSpec(id="volunteer_dispatch", name="志工任務派遣", category="matching",
               module_type="processor", implemented=True, requires_review=False,
               dependencies=("needs_matching_engine",),
               endpoint="POST /v1/incidents/{id}/assignments、PATCH /v1/assignments/{id}",
               description="將資源派遣至通報需求並追蹤狀態（assigned→in_progress→done/cancelled），"
                           "同步更新通報與資源狀態。"),
    ModuleSpec(id="fb_publish_action", name="FB 貼文發布", category="outreach",
               module_type="action", implemented=True,
               dependencies=("fb_page_post",),
               endpoint="POST /v1/artifacts/{id}/publish?channel=facebook（限 approved）",
               description="將審核通過的貼文草稿發布至 Facebook（模擬連接器，未實際發文；正式環境需 FB 憑證）。"),
    ModuleSpec(id="line_broadcast_action", name="LINE 推播發送", category="outreach",
               module_type="action", implemented=True,
               dependencies=("line_broadcast",),
               endpoint="POST /v1/artifacts/{id}/publish?channel=line（限 approved）",
               description="將審核通過的訊息經 LINE 推播（模擬連接器，未實際發送；正式環境需 LINE 憑證）。"),
    ModuleSpec(id="coordination_timeline", name="事件時間軸", category="coordination",
               module_type="processor", implemented=True, requires_review=False,
               endpoint="GET /v1/incidents/{id}/timeline",
               description="由 event_outbox 彙整事件時間軸與稽核記錄（事件建立、生成、審核、通報、Agent 動作）。"),
]


def register() -> None:
    for spec in _GENERATOR_MODULES:
        registry.register(spec)
    for spec in _PLANNED_MODULES:
        registry.register(spec)
