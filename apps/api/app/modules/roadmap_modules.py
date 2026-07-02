"""Extended capability modules — the second wave of building blocks.

Generator modules here are rule-based like ``extended_modules`` (deterministic,
auditable, scenario-aware via ScenarioProfile). Processor/action specs at the
bottom stay ``implemented=False``: the catalogue doubles as the roadmap.
"""
from __future__ import annotations

from app.modules.base import ModuleSpec
from app.modules.registry import registry
from app.modules.scenarios import ScenarioProfile, place_label

_WATER = ("barrier_lake", "flood", "typhoon")

_CONTACTS = [
    {"name": "消防 / 救護", "phone": "119"},
    {"name": "警察", "phone": "110"},
    {"name": "災害應變專線", "phone": "1991"},
]


# ── ① 資訊匯流平台 ────────────────────────────────────────────


def _multilingual_notice(incident, profile: ScenarioProfile) -> dict:
    place = place_label(incident)
    return {
        "title": f"{place}{profile.hazard_name}多語公告",
        "source_ref": "public_notice_draft",
        "languages": [
            {"lang": "en", "label": "English",
             "headline": f"{profile.hazard_name} advisory for {place}",
             "body": "Follow official evacuation instructions. Shelters, report forms and maps are available on this portal."},
            {"lang": "ja", "label": "日本語",
             "headline": f"{place} 災害情報",
             "body": "自治体の避難指示に従ってください。避難所・被害報告・地図は本ポータルで確認できます。"},
            {"lang": "vi", "label": "Tiếng Việt",
             "headline": f"Cảnh báo thiên tai khu vực {place}",
             "body": "Vui lòng tuân theo hướng dẫn sơ tán chính thức. Nơi trú ẩn và bản đồ có trên cổng thông tin này."},
            {"lang": "id", "label": "Bahasa Indonesia",
             "headline": f"Peringatan bencana wilayah {place}",
             "body": "Ikuti instruksi evakuasi resmi. Tempat penampungan dan peta tersedia di portal ini."},
        ],
        "note": "譯文由公告草稿生成，發布前請母語者或翻譯志工複核。",
        "requires_review": True,
    }


def _accessibility_notice(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}{profile.hazard_name}易讀版公告",
        "style": "plain_language",
        "sections": [
            {"heading": "發生什麼事", "body": f"這裡發生了{profile.hazard_name}。可能不安全。"},
            {"heading": "你要做什麼", "body": "聽從政府的廣播。需要離開家的時候，會有人通知你。"},
            {"heading": "去哪裡", "body": "去「收容所」。收容所有水、食物和床。地點看地圖，或問里長。"},
            {"heading": "需要幫忙", "body": "打電話 119（受傷、受困）或 1991（其他困難）。"},
        ],
        "screen_reader_hints": ["所有圖片附替代文字", "標題階層正確", "對比度 AA 以上"],
        "requires_review": True,
    }


def _sms_alert_draft(incident, profile: ScenarioProfile) -> dict:
    place = place_label(incident)
    body = f"【{profile.label}警戒】{place}居民請提高警覺，依政府指示避難，勿靠近危險區域。資訊入口：{{portal_url}}"
    return {
        "title": f"{place}災防簡訊草稿",
        "channel": "cell_broadcast / sms",
        "max_length": 70,
        "body": body,
        "length": len(body),
        "action_hint": "送交告警發送權責單位；簡訊不可含個資。",
        "requires_review": True,
    }


def _radio_script(incident, profile: ScenarioProfile) -> dict:
    place = place_label(incident)
    return {
        "title": f"{place}{profile.hazard_name}廣播稿",
        "duration_seconds": 45,
        "pace": "每分鐘 160 字，重點語句放慢",
        "script": (
            f"各位{place}的鄉親請注意，這裡是災害應變中心廣播。"
            f"{place}目前發生{profile.hazard_name}，請大家保持冷靜。"
            f"{profile.evacuation_tips[0]}"
            "收容所已經開設，提供飲水、熱食與臨時住宿。"
            "需要救援請撥打一一九，生活協助請撥打一九九一。"
            "本則廣播每三十分鐘重播一次，請告知家中長輩與鄰居。"
        ),
        "replay_interval_minutes": 30,
        "requires_review": True,
    }


def _school_closure_notice(incident, profile: ScenarioProfile) -> dict:
    place = place_label(incident)
    return {
        "title": f"{place}轄內學校停課公告（草稿）",
        "scope": f"{place}轄內各級學校與公立幼兒園",
        "body": (
            f"因{profile.hazard_name}影響，為維護師生安全，轄內學校今日起停課，"
            "復課時間待校舍安全評估完成後另行公告。停課期間請家長留意學校群組通知，"
            "安親與臨時照顧需求可洽各收容所服務台。"
        ),
        "resume_condition": "校舍完成安全評估且交通恢復",
        "requires_review": True,
    }


# ── ② 災情蒐集與通報 ──────────────────────────────────────────


def _field_survey_form(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}現地勘查表單",
        "audience": "勘災人員（非民眾）",
        "offline_capable": True,
        "fields": [
            {"key": "surveyor", "label": "勘查人員", "type": "text", "required": True},
            {"key": "location", "label": "勘查地點", "type": "text", "required": True},
            {"key": "building_damage", "label": "建物受損", "type": "select",
             "options": ["無", "輕微", "中度", "嚴重", "倒塌"], "required": True},
            {"key": "road_condition", "label": "道路狀況", "type": "select",
             "options": ["可通行", "單線管制", "封閉"], "required": True},
            {"key": "lifeline", "label": "維生設施（水電通訊）", "type": "select",
             "options": ["正常", "部分中斷", "全面中斷"], "required": True},
            {"key": "casualties_seen", "label": "現場傷亡（估）", "type": "number", "required": False},
            {"key": "photos", "label": "照片", "type": "file", "required": False},
            {"key": "note", "label": "補充說明", "type": "textarea", "required": False},
        ],
        "requires_review": True,
    }


# ── ③ 求援與緊急需求 ──────────────────────────────────────────


def _medical_priority_roster(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}維生醫療優先名冊",
        "purpose": "停電停水時的優先復電與後送排序",
        "fields": [
            {"key": "name", "label": "姓名", "type": "text", "required": True, "pii": True},
            {"key": "contact", "label": "聯絡電話", "type": "text", "required": True, "pii": True},
            {"key": "address", "label": "地址", "type": "text", "required": True, "pii": True},
            {"key": "device", "label": "維生設備", "type": "select",
             "options": ["洗腎", "呼吸器", "製氧機", "抽痰機", "其他"], "required": True},
            {"key": "backup_hours", "label": "備援電力可撐時數", "type": "number", "required": True},
        ],
        "sharing_policy": "名冊僅供應變中心與台電、衛生局調度使用，不對外公開。",
        "requires_review": True,
    }


def _missing_person_board(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}失聯協尋看板",
        "public_fields": ["暱稱/稱謂", "年齡層", "最後出現地點", "特徵描述", "查證狀態"],
        "restricted_fields": ["全名", "身分證字號", "聯絡人電話"],
        "workflow": ["家屬登記", "警政查證", "公開協尋（去識別化）", "尋獲結案"],
        "note": "公開版一律去識別化；與警政協尋系統欄位對齊。",
        "requires_review": True,
    }


def _pet_rescue_form(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}寵物救援與安置登記",
        "fields": [
            {"key": "owner", "label": "飼主姓名", "type": "text", "required": True, "pii": True},
            {"key": "contact", "label": "聯絡電話", "type": "text", "required": True, "pii": True},
            {"key": "species", "label": "動物種類", "type": "select",
             "options": ["犬", "貓", "鳥", "其他"], "required": True},
            {"key": "count", "label": "數量", "type": "number", "required": True},
            {"key": "situation", "label": "狀況", "type": "select",
             "options": ["受困待救", "需臨時安置", "走失協尋"], "required": True},
            {"key": "location", "label": "地點", "type": "text", "required": True},
        ],
        "partners": ["動保處", "在地動物醫院", "動物救援志工團"],
        "requires_review": True,
    }


def _psych_support_booking(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}災後心理支持預約",
        "services": ["安心關懷訪視", "一對一心理諮詢", "團體支持（收容所）", "兒童遊戲治療"],
        "fields": [
            {"key": "name", "label": "稱呼", "type": "text", "required": True},
            {"key": "contact", "label": "聯絡方式", "type": "text", "required": True, "pii": True},
            {"key": "service", "label": "需求服務", "type": "select",
             "options": ["安心訪視", "心理諮詢", "團體支持", "兒童支持"], "required": True},
            {"key": "preferred_time", "label": "方便時段", "type": "text", "required": False},
        ],
        "providers": ["衛生局安心服務隊", "心理師公會志願服務團"],
        "requires_review": True,
    }


# ── ④ 資訊擴散與觸及 ──────────────────────────────────────────


def _ig_info_card(incident, profile: ScenarioProfile) -> dict:
    place = place_label(incident)
    return {
        "title": f"{place}{profile.hazard_name} IG 圖卡",
        "format": "1080x1350 輪播 4 張",
        "cards": [
            {"seq": 1, "headline": f"{place}{profile.label}警戒中", "body": "現在該知道的 3 件事", "style": "封面·大字報"},
            {"seq": 2, "headline": "避難怎麼走", "body": profile.evacuation_tips[0], "style": "重點條列"},
            {"seq": 3, "headline": "通報與求助", "body": "災情通報、志工報名、物資捐贈都在資訊入口", "style": "重點條列"},
            {"seq": 4, "headline": "查證再轉傳", "body": "看到可疑訊息，先到官方入口確認", "style": "行動呼籲"},
        ],
        "hashtags": [f"#{place}", f"#{profile.label}", "#防災資訊", "#請廣傳"],
        "requires_review": True,
    }


def _line_rich_menu(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}LINE 災害模式圖文選單",
        "layout": "2x2",
        "cells": [
            {"pos": "A", "label": "災情通報", "action": "open_url", "target": "{portal_url}/report"},
            {"pos": "B", "label": "收容所地圖", "action": "open_url", "target": "{portal_url}#shelters"},
            {"pos": "C", "label": "物資與志工", "action": "open_url", "target": "{portal_url}#supply"},
            {"pos": "D", "label": "闢謠專區", "action": "open_url", "target": "{portal_url}#facts"},
        ],
        "active_period": "災害應變期間",
        "requires_review": True,
    }


def _media_kit(incident, profile: ScenarioProfile) -> dict:
    place = place_label(incident)
    return {
        "title": f"{place}{profile.hazard_name}媒體資料包",
        "sections": [
            {"heading": "事件摘要", "body": f"{place}發生{profile.hazard_name}，應變中心已開設並持續更新統計。"},
            {"heading": "最新統計", "body": "通報、收容、派工與物資數據以情勢摘要 API 為準（附連結）。"},
            {"heading": "採訪窗口", "body": "應變中心新聞聯絡人（值班手機於資料包內文提供）。"},
            {"heading": "可用素材", "body": "公開地圖截圖、統計圖表與公告全文，標註出處即可使用。"},
        ],
        "embargo": "無；統計數字請以發稿當下 API 數據為準。",
        "requires_review": True,
    }


def _community_group_pack(incident, profile: ScenarioProfile) -> dict:
    place = place_label(incident)
    return {
        "title": f"{place}社區群組轉傳素材包",
        "principle": "一則一重點、附官方連結、適合長輩閱讀",
        "messages": [
            f"【{place}{profile.label}】收容所已開設，需要安置的家人朋友看這裡：{{portal_url}}",
            f"【通報】家裡有災情（淹水、受困、缺物資）直接在這裡登記，救援比較快：{{portal_url}}/report",
            "【提醒】看到「堤防要潰堤」「停水一週」這類訊息，先到官方入口查證再轉傳，不要嚇到長輩。",
            f"【志工】想幫忙的請先線上報名，統一調度才不會塞在路上：{{portal_url}}",
        ],
        "requires_review": True,
    }


def _press_conference_brief(incident, profile: ScenarioProfile) -> dict:
    place = place_label(incident)
    return {
        "title": f"{place}應變中心記者會口徑摘要",
        "key_messages": [
            "以人命救援為第一優先，統計數字每小時更新於資訊入口。",
            "收容量能充足，撤離勸告地區請民眾配合。",
            "志工與物資請一律線上登記，由應變中心統一調度。",
        ],
        "anticipated_questions": [
            {"q": "傷亡數字是否會再上升？", "a": "以應變中心逐報統計為準，不做臆測。"},
            {"q": "網傳影片是否屬實？", "a": "已交查證小組，確認後於闢謠專區統一說明。"},
            {"q": "何時解除警戒？", "a": "依主管機關監測數據，達安全標準即公告。"},
        ],
        "requires_review": True,
    }


# ── ⑤ 志工動員 ────────────────────────────────────────────────


def _volunteer_shift_schedule(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}志工排班表",
        "shifts": [
            {"name": "早班", "time": "08:00–12:00"},
            {"name": "午班", "time": "12:00–16:00"},
            {"name": "晚班", "time": "16:00–20:00"},
        ],
        "teams": [{"skill": s, "min_per_shift": 4} for s in profile.volunteer_skills[:4]],
        "rules": ["單日至多兩班", "高風險任務需具證照志工帶隊", "報到後由現場組長編組"],
        "requires_review": True,
    }


def _volunteer_insurance_roster(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}志工平安保險名冊",
        "source": "volunteer_checkin 報到記錄",
        "fields": ["姓名", "身分證字號", "出生日期", "服務日期", "服務地點"],
        "policy": "名冊僅供投保作業，不對外公開；投保後回填保單編號。",
        "coverage": "意外身故/失能 200 萬、意外醫療 20 萬（示範額度）",
        "requires_review": True,
    }


def _skill_certification_registry(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}專業技能志工登記",
        "categories": [
            {"key": "heavy_machinery", "label": "重機具操作", "cert_required": "技術士證照"},
            {"key": "radio", "label": "無線電通訊", "cert_required": "業餘無線電執照"},
            {"key": "medical", "label": "醫護", "cert_required": "醫事人員證書"},
            {"key": "structure", "label": "建物安全評估", "cert_required": "技師證書"},
            {"key": "diving_swiftwater", "label": "激流/潛水救援", "cert_required": "救援證照"},
        ],
        "verification": "證照上傳後由承辦人工查驗，通過才可派遣高風險任務。",
        "requires_review": True,
    }


def _corporate_volunteer_pack(incident, profile: ScenarioProfile) -> dict:
    place = place_label(incident)
    return {
        "title": f"{place}企業志工團對接包",
        "sections": [
            {"heading": "報名方式", "body": "由企業窗口統一造冊報名（10 人以上），回傳名冊後排定服務日。"},
            {"heading": "集合與接駁", "body": "統一於指定集合點報到，由應變中心安排接駁進入災區。"},
            {"heading": "裝備需求", "body": "雨鞋、工作手套、口罩自備；工具與飲水由現場提供。"},
            {"heading": "保險與免責", "body": "名冊內志工統一投保；未成年者需監護人同意書。"},
        ],
        "contact_window": "應變中心志工組",
        "requires_review": True,
    }


# ── ⑥ 物資募集與調度 ──────────────────────────────────────────


def _donation_ledger(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}捐贈徵信名冊",
        "columns": ["日期", "捐贈者（可匿名）", "品項/金額區間", "用途", "狀態"],
        "privacy": "金額以區間呈現；捐贈者可選擇匿名，個資不公開。",
        "publish_cycle": "每日 18:00 更新於公開入口",
        "requires_review": True,
    }


# ── ⑦ 媒合與派遣 ──────────────────────────────────────────────


def _cross_region_mutual_aid(incident, profile: ScenarioProfile) -> dict:
    place = place_label(incident)
    return {
        "title": f"{place}跨縣市支援請求單",
        "request_items": [
            {"category": "人力", "detail": "搜救/醫護/行政支援人力", "unit": "人"},
            {"category": "機具", "detail": "抽水機、山貓、照明車", "unit": "台"},
            {"category": "收容", "detail": "跨區收容床位", "unit": "床"},
            {"category": "運能", "detail": "物資運輸車次", "unit": "車次"},
        ],
        "format": "標準化欄位可機器介接（JSON），亦可匯出公文附件。",
        "approval_flow": "應變中心指揮官核定後發出",
        "requires_review": True,
    }


# ── ⑧ 地理態勢與地圖 ──────────────────────────────────────────


def _evacuation_route_plan(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}避難路線規劃設定",
        "inputs": ["住家位置（使用者提供）", "shelter_map 收容所點位", "hazard_zone_layer 危險區"],
        "routing_rules": ["避開封閉道路與警戒區", "優先步行可達（<2km）收容所", "考量無障礙需求"],
        "output": "步行路線 GeoJSON ＋ 文字指引",
        "requires_review": True,
    }


def _flood_depth_layer(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}淹水深度圖層設定",
        "layer_key": "flood_depth",
        "sources": ["民眾通報（含深度描述）", "水利感測站", "勘災回報"],
        "classes": [
            {"range": "0–30cm", "color": "#bfdbfe", "label": "機車勿行"},
            {"range": "30–60cm", "color": "#60a5fa", "label": "汽車勿行"},
            {"range": "60–120cm", "color": "#2563eb", "label": "危險，請撤離"},
            {"range": ">120cm", "color": "#1e3a8a", "label": "極危險"},
        ],
        "interpolation": "IDW（示範）",
        "requires_review": True,
    }


def _resource_poi_map(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}救災資源點位圖設定",
        "layer_key": "resource_poi",
        "poi_types": [
            {"key": "water_station", "label": "臨時取水點"},
            {"key": "charging", "label": "手機充電站"},
            {"key": "medical", "label": "醫療站"},
            {"key": "pharmacy", "label": "營業中藥局"},
            {"key": "meal", "label": "熱食供應點"},
            {"key": "shower", "label": "盥洗點"},
        ],
        "data_entry": "承辦人員後台維護＋公所回報",
        "requires_review": True,
    }


# ── ⑨ 查證與信任 ──────────────────────────────────────────────


def _official_source_links(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}官方資訊源",
        "links": [
            {"name": "中央氣象署", "url": "https://www.cwa.gov.tw", "scope": "警特報與觀測"},
            {"name": "公路局即時路況", "url": "https://168.thb.gov.tw", "scope": "省道封閉管制"},
            {"name": "台電停電查詢", "url": "https://service.taipower.com.tw", "scope": "停電與搶修"},
            {"name": "台灣自來水公司", "url": "https://www.water.gov.tw", "scope": "停水公告"},
            {"name": "內政部消防署", "url": "https://www.nfa.gov.tw", "scope": "1991 報平安"},
            {"name": "衛福部", "url": "https://www.mohw.gov.tw", "scope": "救助與心理支持"},
        ],
        "usage": "公開入口引用此清單，提升可信度並分流查詢流量。",
        "requires_review": True,
    }


# ── ⑩ 協調與稽核 ──────────────────────────────────────────────


def _daily_sitrep(incident, profile: ScenarioProfile) -> dict:
    place = place_label(incident)
    return {
        "title": f"{place}{profile.hazard_name}每日情勢報告（SitRep）骨架",
        "cadence": "每日 06:00 / 18:00",
        "sections": [
            {"heading": "整體情勢", "source": "incident + summary API"},
            {"heading": "傷亡與收容", "source": "應變中心逐報統計"},
            {"heading": "通報與處理", "source": "reports / assignments 統計"},
            {"heading": "物資與志工", "source": "resources 統計"},
            {"heading": "明日重點", "source": "應變會議決議"},
        ],
        "distribution": ["應變中心各組", "上級機關", "公開入口（摘要版）"],
        "requires_review": True,
    }


def _eoc_meeting_brief(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}應變會議簡報骨架",
        "agenda": [
            {"item": "情勢更新", "minutes": 10, "owner": "情資組"},
            {"item": "救援進度與缺口", "minutes": 15, "owner": "搜救組"},
            {"item": "收容與民生", "minutes": 10, "owner": "收容組"},
            {"item": "待決事項", "minutes": 15, "owner": "指揮官"},
        ],
        "data_binding": "各頁數據自動帶入 summary / timeline API 最新值",
        "requires_review": True,
    }


def _damage_subsidy_helper(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}災損救助試算與檢查清單",
        "items": [
            {"item": "住宅淹水救助", "amount": "每戶 2 萬（淹水達 50cm）", "docs": ["受災照片", "戶籍證明"]},
            {"item": "住屋毀損救助", "amount": "半倒 10 萬／全倒 20 萬", "docs": ["勘查認定", "所有權證明"]},
            {"item": "死亡/失蹤慰問", "amount": "每人 100 萬", "docs": ["證明文件"]},
            {"item": "農損救助", "amount": "依品項公告", "docs": ["災損照片", "農民身分"]},
        ],
        "deadline": "災害發生日起 30 日內向公所申請",
        "disclaimer": "額度為示範值，實際依當年度公告基準。",
        "requires_review": True,
    }


def _after_action_review(incident, profile: ScenarioProfile) -> dict:
    return {
        "title": f"{place_label(incident)}災後檢討報告（AAR）骨架",
        "sections": [
            {"heading": "事件時序", "source": "coordination_timeline（outbox 稽核軌跡）"},
            {"heading": "應變作為與決策點", "source": "會議紀錄 + timeline"},
            {"heading": "量化成果", "source": "通報處理率、派工時效、物資滿足率"},
            {"heading": "問題與改善建議", "source": "各組回饋彙整"},
        ],
        "output": "報告草稿 + 改善追蹤清單",
        "requires_review": True,
    }


_GENERATOR_MODULES = [
    # ① 資訊匯流平台
    ModuleSpec(id="multilingual_notice", name="多語公告翻譯", category="info_hub",
               dependencies=("public_notice_draft",), generate=_multilingual_notice,
               description="將公告翻譯為英、日、越、印尼語版本，服務外籍居民與移工；譯文一律回到審核閘門。"),
    ModuleSpec(id="accessibility_notice", name="易讀版／無障礙公告", category="info_hub",
               dependencies=("public_notice_draft",), generate=_accessibility_notice,
               description="生成易讀（plain language）與螢幕閱讀器友善版本的公告，服務高齡者與身心障礙者。"),
    ModuleSpec(id="sms_alert_draft", name="災防簡訊草稿", category="info_hub",
               risk_override="high", generate=_sms_alert_draft,
               description="生成 70 字內的細胞廣播／簡訊草稿（含行動指示與資訊入口短網址），對接告警發送系統。"),
    ModuleSpec(id="radio_script", name="廣播稿", category="info_hub",
               generate=_radio_script,
               description="生成地方電台與村里廣播系統用的口播稿，長度與語速標註，適合停電無網路情境。"),
    ModuleSpec(id="school_closure_notice", name="停班停課公告", category="info_hub",
               generate=_school_closure_notice,
               description="生成停班停課公告草稿（適用範圍、復課條件、家長注意事項），與行政公告格式對齊。"),
    # ② 災情蒐集與通報
    ModuleSpec(id="field_survey_form", name="現地勘查表單", category="reporting",
               generate=_field_survey_form,
               description="生成勘災人員用的結構化現地勘查表單（建物、道路、維生設施分項），支援離線填寫。"),
    # ③ 求援與緊急需求
    ModuleSpec(id="medical_priority_roster", name="洗腎／維生設備優先名冊", category="help_request",
               risk_override="high", generate=_medical_priority_roster,
               description="登記洗腎、呼吸器、製氧機等維生醫療需求者，停電停水時供優先復電與後送排序。"),
    ModuleSpec(id="missing_person_board", name="失聯協尋看板", category="help_request",
               risk_override="high", generate=_missing_person_board,
               description="生成失聯協尋登記與公開看板（公開版去識別化、警政介接欄位）。"),
    ModuleSpec(id="pet_rescue_form", name="寵物救援與安置登記", category="help_request",
               generate=_pet_rescue_form,
               description="生成寵物受困通報與臨時安置需求表單，對接動保與收容量能。"),
    ModuleSpec(id="psych_support_booking", name="心理支持預約", category="help_request",
               generate=_psych_support_booking,
               description="生成災後心理支持預約表單，轉介衛生局安心服務與心理師公會志願者。"),
    # ④ 資訊擴散與觸及
    ModuleSpec(id="ig_info_card", name="IG 資訊圖卡", category="outreach",
               review_type_override="publication_review",
               dependencies=("public_notice_draft",), generate=_ig_info_card,
               description="將公告重點轉為 Instagram 圖卡文案與版型設定（標題、重點三則、行動呼籲）。"),
    ModuleSpec(id="line_rich_menu", name="LINE 官帳圖文選單", category="outreach",
               dependencies=("line_broadcast",), generate=_line_rich_menu,
               description="生成 LINE 官方帳號災害模式圖文選單設定（通報、收容所、物資、闢謠四格）。"),
    ModuleSpec(id="media_kit", name="媒體採訪資料包", category="outreach",
               review_type_override="publication_review", generate=_media_kit,
               description="生成媒體資料包：事件摘要、統計數據、聯絡窗口、可用素材清單，減少重複回覆記者。"),
    ModuleSpec(id="community_group_pack", name="社區群組轉傳素材", category="outreach",
               review_type_override="publication_review", generate=_community_group_pack,
               description="生成適合 LINE 家族群組轉傳的短訊息包（一則一重點、附官方連結），對抗轉傳謠言。"),
    ModuleSpec(id="press_conference_brief", name="記者會口徑摘要", category="outreach",
               review_type_override="publication_review", generate=_press_conference_brief,
               description="生成應變中心記者會的口徑摘要與 Q&A 預想題，統一對外訊息。"),
    # ⑤ 志工動員
    ModuleSpec(id="volunteer_shift_schedule", name="志工排班表", category="volunteer",
               dependencies=("volunteer_checkin",), generate=_volunteer_shift_schedule,
               description="依報名時段與技能自動排班（清淤、物資、接駁分組），輸出可列印的班表。"),
    ModuleSpec(id="volunteer_insurance_roster", name="志工保險名冊", category="volunteer",
               risk_override="high", dependencies=("volunteer_checkin",),
               generate=_volunteer_insurance_roster,
               description="由報到記錄生成志工平安保險投保名冊（個資僅供承保，不對外）。"),
    ModuleSpec(id="skill_certification_registry", name="專業技能登記", category="volunteer",
               generate=_skill_certification_registry,
               description="登記具證照的專業志工（重機具、無線電、醫護、結構評估），供高風險任務派遣篩選。"),
    ModuleSpec(id="corporate_volunteer_pack", name="企業志工團對接包", category="volunteer",
               generate=_corporate_volunteer_pack,
               description="生成企業/團體志工的對接資訊包（集合點、裝備需求、保險與免責說明、聯絡窗口）。"),
    # ⑥ 物資募集與調度
    ModuleSpec(id="donation_ledger", name="捐贈徵信名冊", category="supply",
               generate=_donation_ledger,
               description="生成物資與捐款的公開徵信名冊（金額區間化、可匿名），維持外界信任。"),
    # ⑦ 媒合與派遣
    ModuleSpec(id="cross_region_mutual_aid", name="跨縣市支援請求", category="matching",
               generate=_cross_region_mutual_aid,
               description="生成向鄰近縣市請求支援的標準化需求單（人力、機具、收容量能），可機器介接。"),
    # ⑧ 地理態勢與地圖
    ModuleSpec(id="evacuation_route_plan", name="避難路線規劃", category="geospatial",
               dependencies=("shelter_map", "hazard_zone_layer"),
               generate=_evacuation_route_plan,
               description="由住家位置避開危險區規劃至最近開放收容所的步行路線。"),
    ModuleSpec(id="flood_depth_layer", name="淹水深度圖層", category="geospatial",
               applicable_scenarios=_WATER, risk_override="low",
               generate=_flood_depth_layer,
               description="由通報與感測資料內插生成淹水深度圖層，輔助抽水機與救生艇調度。"),
    ModuleSpec(id="resource_poi_map", name="救災資源點位圖", category="geospatial",
               risk_override="low", generate=_resource_poi_map,
               description="彙整加水站、充電站、醫療站、營業藥局等資源點位為統一圖層與清單。"),
    # ⑨ 查證與信任
    ModuleSpec(id="official_source_links", name="官方資訊源連結集", category="verification",
               risk_override="low", generate=_official_source_links,
               description="生成事件相關的官方資訊源清單（氣象署、公路局、台電…），公開頁引用以提升可信度。"),
    # ⑩ 協調與稽核
    ModuleSpec(id="daily_sitrep", name="每日情勢報告", category="coordination",
               generate=_daily_sitrep,
               description="每日定時彙整通報、收容、派工與物資數據為情勢報告（SitRep），供應變會議與上級機關。"),
    ModuleSpec(id="eoc_meeting_brief", name="應變會議簡報", category="coordination",
               dependencies=("daily_sitrep",), generate=_eoc_meeting_brief,
               description="由情勢摘要自動生成應變會議簡報骨架（現況、缺口、待決事項）。"),
    ModuleSpec(id="damage_subsidy_helper", name="災損補助試算", category="coordination",
               generate=_damage_subsidy_helper,
               description="依受災情形試算可申請的救助項目與金額，生成申請文件檢查清單。"),
    ModuleSpec(id="after_action_review", name="災後檢討報告", category="coordination",
               dependencies=("coordination_timeline",), generate=_after_action_review,
               description="由事件時間軸與統計自動彙整災後檢討（AAR）報告草稿：時序、決策點、改善建議。"),
]

# Roadmap — processors / actions whose worker or connector doesn't exist yet.
_ROADMAP_MODULES = [
    ModuleSpec(id="lifeline_status_board", name="維生管線狀態看板", category="info_hub",
               module_type="processor", implemented=False,
               description="彙整台電、台水、電信搶修進度為統一看板資料源，供公開網站與地圖引用。"),
    ModuleSpec(id="cap_open_feed", name="CAP / RSS 開放資料輸出", category="info_hub",
               module_type="processor", implemented=False, requires_review=False,
               description="將審核通過的公告輸出為 CAP 1.2 與 RSS，讓其他防災系統可機器介接。"),
    ModuleSpec(id="photo_damage_triage", name="照片災損初判", category="reporting",
               module_type="processor", implemented=False,
               description="以影像模型初判通報照片的災損類型與嚴重度，輔助 triage；結果標註信心值，人工可覆核。"),
    ModuleSpec(id="voice_report_intake", name="語音通報轉文字", category="reporting",
               module_type="processor", implemented=False,
               description="電話／語音訊息通報自動轉文字並抽取地點、需求類型，服務不便打字的長者。"),
    ModuleSpec(id="social_signal_listener", name="社群災情訊號監測", category="reporting",
               module_type="processor", implemented=False,
               description="監測公開社群貼文中的災情訊號（關鍵字＋地理提及），生成待查證線索清單。"),
    ModuleSpec(id="duplicate_report_merge", name="重複通報合併", category="reporting",
               module_type="processor", implemented=False,
               dependencies=("report_auto_classify",),
               description="依地理距離與文字相似度歸併同一事件的重複通報，避免救援量能重複派遣。"),
    ModuleSpec(id="supply_route_plan", name="物資運送路線規劃", category="supply",
               module_type="processor", implemented=False,
               dependencies=("hazard_zone_layer",),
               description="避開封閉路段規劃集散點間的運送路線與班次，輸出司機用的路線單。"),
    ModuleSpec(id="warehouse_inventory", name="集散點庫存盤點", category="supply",
               module_type="processor", implemented=False,
               dependencies=("supply_dashboard",),
               description="集散點進出貨掃碼盤點，庫存回寫物資看板，達標品項自動標記「已足量」。"),
    ModuleSpec(id="cold_chain_tracker", name="冷鏈物資追蹤", category="supply",
               module_type="processor", implemented=False,
               description="追蹤藥品、胰島素等需冷藏物資的溫控與效期，異常即時告警。"),
    ModuleSpec(id="vehicle_dispatch", name="車輛與機具調度", category="matching",
               module_type="processor", implemented=False,
               dependencies=("needs_matching_engine",),
               description="登記可調度車輛（貨車、山貓、抽水機車），依任務與路況媒合派遣並追蹤位置。"),
    ModuleSpec(id="accommodation_match", name="臨時安置媒合", category="matching",
               module_type="processor", implemented=False,
               description="媒合旅宿業與民間空房給收容所滿載後的安置需求，記錄入住與退房。"),
    ModuleSpec(id="meal_supply_match", name="熱食供應媒合", category="matching",
               module_type="processor", implemented=False,
               description="媒合中央廚房、餐飲業者與收容點/工作站的每日熱食需求，統計份數避免浪費。"),
    ModuleSpec(id="drone_ortho_layer", name="無人機航拍圖層", category="geospatial",
               module_type="processor", implemented=False,
               description="匯入空拍正射影像為地圖圖層，與災前影像對比呈現受災範圍。"),
    ModuleSpec(id="rumor_tracker", name="謠言追蹤儀表板", category="verification",
               module_type="processor", implemented=False,
               dependencies=("clarification_notice",),
               description="登記流傳中的可疑訊息、追蹤擴散程度與查證狀態，串接澄清公告生成。"),
    ModuleSpec(id="report_verification_flow", name="通報查證工作流", category="verification",
               module_type="processor", implemented=True, requires_review=False,
               endpoint="POST /v1/reports/{id}/verification",
               description="人工查證民眾通報（verified / rejected / unverified），查證結果影響派遣優先序。"),
    ModuleSpec(id="recovery_tracker", name="復原進度追蹤", category="coordination",
               module_type="processor", implemented=False,
               description="災後復原任務清單與進度追蹤（清淤、修繕、補助發放），對外呈現重建進度。"),
]


def register() -> None:
    for spec in _GENERATOR_MODULES:
        registry.register(spec)
    for spec in _ROADMAP_MODULES:
        registry.register(spec)
