"""Scenario profiles — make one module reusable across disaster types.

Generator modules pull their disaster-specific vocabulary (need types, supply
items, volunteer skills, wording) from the profile, so the same module serves a
barrier-lake flood, an earthquake or a typhoon without code changes. Adding a
new disaster type is a new profile here, not a new module.

``need_types`` values MUST stay within ``app.schemas.report.ReportNeedType`` so a
generated form remains submittable to the reports endpoint.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ScenarioProfile:
    scenario_type: str
    label: str  # 堰塞湖 / 地震 ...
    hazard_name: str  # 堰塞湖災害 / 地震災害
    damage_form_desc: str
    # (value, label); value must be a valid ReportNeedType
    need_types: tuple[tuple[str, str], ...]
    supply_items: tuple[str, ...]
    volunteer_skills: tuple[str, ...]
    evacuation_tips: tuple[str, ...]
    faq: tuple[tuple[str, str], ...]


_COMMON_TAIL_NEEDS: tuple[tuple[str, str], ...] = (
    ("medical_need", "醫療需求"),
    ("supply_need", "物資需求"),
    ("other", "其他"),
)

BARRIER_LAKE = ScenarioProfile(
    scenario_type="barrier_lake",
    label="堰塞湖",
    hazard_name="堰塞湖災害",
    damage_form_desc="提供民眾回報淹水、清淤、道路中斷或其他災情需求。",
    need_types=(
        ("flooding", "淹水"),
        ("mud_removal", "清淤"),
        ("road_blocked", "道路中斷"),
        ("trapped_person", "人員受困"),
        *_COMMON_TAIL_NEEDS,
    ),
    supply_items=("飲用水", "乾糧", "清潔用品", "雨鞋", "手套", "鏟子", "藥品", "其他"),
    volunteer_skills=("清淤", "搬運", "物資整理", "交通接駁", "醫護支援", "行政協助"),
    evacuation_tips=(
        "接獲撤離通知請立即往高處或指定收容所移動，勿返回低窪住所。",
        "遠離溪流、橋樑與邊坡，注意上游溢流與二次潰決風險。",
        "攜帶證件、藥品、飲水與保暖衣物，關閉電源與瓦斯。",
        "協助行動不便的長者與鄰居一起撤離。",
    ),
    faq=(
        ("我家會被影響嗎？", "請對照地圖上的影響範圍，並以地方政府撤離公告為準。"),
        ("水退了可以回家嗎？", "需待主管機關確認結構與上游安全後，依官方通知返回。"),
        ("要去哪裡通報災情？", "可在本入口的災情回報表單登記，或撥打地方災害應變專線。"),
    ),
)

EARTHQUAKE = ScenarioProfile(
    scenario_type="earthquake",
    label="地震",
    hazard_name="地震災害",
    damage_form_desc="提供民眾回報建物受損、人員受困、火災或其他災情需求。",
    need_types=(
        ("building_collapse", "建物倒塌/受損"),
        ("trapped_person", "人員受困"),
        ("fire", "火災"),
        ("gas_leak", "瓦斯外洩"),
        ("missing_person", "失蹤協尋"),
        *_COMMON_TAIL_NEEDS,
    ),
    supply_items=("飲用水", "乾糧", "帳篷", "睡袋", "保暖衣物", "照明設備", "破壞器材", "藥品", "其他"),
    volunteer_skills=("搜救協助", "重機械操作", "醫護支援", "物資整理", "收容所服務", "行政協助"),
    evacuation_tips=(
        "搖晃時就地掩護（趴下、掩護、穩住），遠離窗戶與懸掛物。",
        "搖晃停止後循樓梯往空曠處避難，切勿搭乘電梯。",
        "確認瓦斯與電源是否關閉，留意餘震與建物結構裂損。",
        "貼近收音機或官方管道，依指示前往指定避難所。",
    ),
    faq=(
        ("房屋出現裂縫還能住嗎？", "請勿自行判斷，待專業人員或主管機關完成結構評估。"),
        ("要去哪裡避難？", "請依地方政府公告的避難收容所，並參考本入口的避難指引。"),
        ("家人失聯怎麼辦？", "可於求援登記填寫協尋，並向警消與收容所登記查詢。"),
    ),
)

TYPHOON = ScenarioProfile(
    scenario_type="typhoon",
    label="颱風",
    hazard_name="颱風災害",
    damage_form_desc="提供民眾回報淹水、坍方、停電或其他災情需求。",
    need_types=(
        ("flooding", "淹水"),
        ("road_blocked", "坍方/道路中斷"),
        ("power_outage", "停電/停水"),
        ("trapped_person", "人員受困"),
        *_COMMON_TAIL_NEEDS,
    ),
    supply_items=("飲用水", "乾糧", "雨衣", "雨鞋", "沙包", "照明設備", "行動電源", "藥品", "其他"),
    volunteer_skills=("清理復原", "搬運", "抽水排水", "物資整理", "交通接駁", "行政協助"),
    evacuation_tips=(
        "颱風期間非必要勿外出，遠離海邊、河岸與低窪地區。",
        "預備飲水、糧食、照明與行動電源，留意停電停水。",
        "接獲撤離通知請配合前往收容所，協助長者與鄰居。",
        "注意土石流與淹水警戒，勿涉水或駛入積水路段。",
    ),
    faq=(
        ("停班停課怎麼查？", "以地方政府公告為準，本入口不取代官方放假資訊。"),
        ("淹水了要找誰？", "可於災情回報表單登記，緊急危及生命請撥打 119。"),
        ("物資要去哪領？", "請參考公告的集散點與配送資訊，並留意需求看板狀態。"),
    ),
)

FLOOD = ScenarioProfile(
    scenario_type="flood",
    label="水災",
    hazard_name="水災",
    damage_form_desc="提供民眾回報淹水、清淤、道路中斷或其他災情需求。",
    need_types=(
        ("flooding", "淹水"),
        ("mud_removal", "清淤"),
        ("road_blocked", "道路中斷"),
        ("power_outage", "停電/停水"),
        *_COMMON_TAIL_NEEDS,
    ),
    supply_items=("飲用水", "乾糧", "清潔用品", "雨鞋", "手套", "抽水機", "藥品", "其他"),
    volunteer_skills=("清淤", "搬運", "抽水排水", "物資整理", "交通接駁", "行政協助"),
    evacuation_tips=(
        "水位上升時往高處避難，勿停留地下室或低窪住所。",
        "切勿涉水或開車強行通過積水路段，注意暗溝與孔蓋。",
        "撤離前關閉電源與瓦斯，攜帶證件與必要藥品。",
        "留意上游放流與持續降雨警戒，配合撤離通知。",
    ),
    faq=(
        ("積水何時會退？", "視降雨與排水狀況而定，請以官方公告為準。"),
        ("清淤需要幫忙嗎？", "可於志工報名表單登記，依現場調度前往支援。"),
        ("要怎麼回報災情？", "可在本入口的災情回報表單登記，或撥打地方專線。"),
    ),
)

# fallback for any unrecognised scenario_type
DEFAULT = ScenarioProfile(
    scenario_type="generic",
    label="災害",
    hazard_name="災害",
    damage_form_desc="提供民眾回報災情與需求。",
    need_types=(
        ("trapped_person", "人員受困"),
        ("road_blocked", "道路中斷"),
        *_COMMON_TAIL_NEEDS,
    ),
    supply_items=("飲用水", "乾糧", "清潔用品", "保暖衣物", "照明設備", "藥品", "其他"),
    volunteer_skills=("搬運", "物資整理", "醫護支援", "收容所服務", "行政協助"),
    evacuation_tips=(
        "接獲撤離通知請立即前往指定收容所。",
        "攜帶證件、藥品、飲水與保暖衣物，關閉電源與瓦斯。",
        "協助行動不便者一同撤離，留意官方最新公告。",
    ),
    faq=(
        ("要去哪裡避難？", "請依地方政府公告的避難收容所前往。"),
        ("如何回報災情？", "可在本入口的災情回報表單登記。"),
    ),
)

_PROFILES: dict[str, ScenarioProfile] = {
    p.scenario_type: p
    for p in (BARRIER_LAKE, EARTHQUAKE, TYPHOON, FLOOD)
}


def get_profile(scenario_type: str) -> ScenarioProfile:
    return _PROFILES.get(scenario_type, DEFAULT)


def place_label(incident) -> str:
    """Best human-readable place name for titles."""
    return incident.river or incident.town or incident.county or incident.title


def site_title(incident, profile: ScenarioProfile) -> str:
    base = incident.river or incident.town or incident.county
    if base:
        return f"{base}{profile.hazard_name}資訊入口"
    return f"{incident.title}資訊入口"
