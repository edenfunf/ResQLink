"""Demo-only: populate an incident with realistic citizen reports,
supply/volunteer offers and dispatch records so the public rescue site and
every backend look alive the moment an incident is created — including
incidents created from natural language via the agent (which carry no
coordinates or activity of their own).

Idempotent: if the incident already has reports, it does nothing (pass
``force=True`` to top up anyway). Gated by settings.DEMO_AUTO_APPROVE so it
never fires when the review gate is on.
"""
from __future__ import annotations

import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import DisasterReport, Incident
from app.schemas.report import DisasterReportCreate, ReportNeedType, ReportSeverity
from app.schemas.resource import OfferType, ResourceOfferCreate
from app.services import dispatch_service, report_service, resource_service
from app.utils.geo import TAIWAN_CENTER, centroid_for

_NEEDS_BY_SCENARIO: dict[str, list[str]] = {
    "barrier_lake": ["mud_removal", "flooding", "road_blocked", "trapped_person",
                     "supply_need", "medical_need", "power_outage"],
    "earthquake": ["building_collapse", "trapped_person", "fire", "gas_leak",
                   "medical_need", "missing_person", "supply_need", "road_blocked",
                   "power_outage"],
    "typhoon": ["power_outage", "flooding", "road_blocked", "supply_need",
                "medical_need", "other"],
    "flood": ["flooding", "mud_removal", "power_outage", "supply_need",
              "trapped_person", "medical_need"],
}
_DEFAULT_NEEDS = ["flooding", "road_blocked", "supply_need", "medical_need", "other"]

# Several concrete, human-sounding stories per need type; placeholders are
# filled per report so no two look alike.
_DESC: dict[str, list[str]] = {
    "flooding": [
        "一樓全部泡水，家中 2 位長者行動不便，需要協助撤離到收容所",
        "巷內積水約 {depth} 公分一直沒退，機車汽車全泡在水裡",
        "地下室持續進水，自家抽水機來不及抽，需要大型抽水機支援",
        "水淹到小腿，家裡有 {n} 個小孩，想先送去收容所安置",
    ],
    "mud_removal": [
        "一樓淤泥約 {depth} 公分，家中只有兩位老人家清不動，需要志工 {n} 名",
        "騎樓和店面全是泥漿，冰箱貨架全毀，需要鏟子、水桶和人力",
        "獨居長輩家中內埕淤泥堆積，無力自行清理，拜託協助",
        "巷道淤泥太厚機車無法進出，希望能有小山貓或人力支援",
    ],
    "road_blocked": [
        "聯外道路遭土石掩埋約 {depth} 公尺，車輛完全無法通行",
        "橋面出現裂縫已封閉，村民進出要多繞 40 分鐘山路",
        "路樹倒塌壓到電線橫躺路中，佔住雙向車道",
        "產業道路坍方，山上還有 {n} 戶居民尚未撤出",
    ],
    "power_outage": [
        "整條街停電超過 {hours} 小時，家中長輩使用製氧機，急需供電或發電機",
        "變電箱疑似進水故障，全里都停電，晚上完全沒有照明",
        "停電導致社區抽水馬達停擺，地下室的水一直抽不出去",
        "家裡有需要冷藏的胰島素藥品，停電太久想詢問哪裡能寄放",
    ],
    "building_collapse": [
        "隔壁老屋倒塌，疑似還有 1 人未撤出，已報消防但希望加派人力",
        "住家樑柱龜裂、明顯傾斜，全家已撤出，需要結構安全評估",
        "鐵皮屋頂整片被掀落砸到路邊車輛，殘骸擋住巷口",
    ],
    "fire": [
        "電線走火引發火警，火勢已撲滅，但 2 戶暫時無法居住需要安置",
        "疑似瓦斯外洩起火，消防已到場，周邊住戶需要臨時收容",
    ],
    "gas_leak": [
        "整棟公寓瓦斯味很重，住戶已先撤到騎樓，等待人員檢查",
        "瓦斯管線疑似被落石打斷，整排住家都不敢開伙",
    ],
    "trapped_person": [
        "長者受困 2 樓，樓梯間淹水下不來，需要橡皮艇或救生員",
        "一家 {n} 口受困屋頂，水勢還在上漲，情況緊急請盡快救援",
        "工寮內有工人受困，聯外道路中斷，可能需要空中勘查",
    ],
    "missing_person": [
        "78 歲失智長輩災後失聯，最後身影出現在市場附近，穿深色外套",
        "家人昨晚外出巡田水後失聯至今，手機打不通，拜託協尋",
    ],
    "medical_need": [
        "洗腎患者後天要洗腎，聯外道路中斷，需要協助安排後送",
        "慢性病藥物全部泡水，需要協助就醫重新領藥",
        "孕婦預產期將近，擔心道路再中斷，希望能先行後送待產",
        "長輩跌倒疑似骨折，巷口淹水救護車進不來",
    ],
    "supply_need": [
        "臨時收容點約 {n} 人，缺飲用水、乾糧和嬰兒奶粉",
        "全村停水第 2 天，需要瓶裝水與盥洗用水",
        "需要清淤工具：圓鍬、畚箕、水桶、雨鞋（尺寸不拘）",
        "家中長輩需要成人紙尿褲與常備藥品，附近買不到",
    ],
    "other": [
        "家裡的狗無法帶進收容所，需要寵物臨時安置協助",
        "屋頂被吹掀一大片，下雨一直漏水，需要帆布和人力協助遮蓋",
        "果園農田全毀，想詢問災損補助申請方式",
    ],
}

_NAMES = ["王小明", "陳美玲", "林志豪", "黃淑芬", "張家豪", "李怡君", "吳建宏",
          "劉雅婷", "蔡宗翰", "鄭淑惠", "許文雄", "楊惠雯", "謝明道", "郭婉如",
          "邱志偉", "潘秀英", "簡宏達", "曾麗華", "賴國棟", "洪佳穎"]
_PROVIDERS = ["在地青年志工隊", "社區發展協會", "慈善會救助組", "里辦公處",
              "大學山地服務社", "教會救援志工團", "紅十字志工分會", "義消協勤隊",
              "農會產銷班", "獅子會服務隊", "同鄉會互助組"]
_SUPPLY_ITEMS = ["瓶裝飲用水（600ml，箱）", "即食乾糧餐盒", "睡袋", "毛毯",
                 "行動發電機（2kW）", "抽水機（3吋）", "N95 口罩（盒）",
                 "清淤圓鍬", "雨鞋（各尺寸）", "急救醫療包", "嬰兒尿布（包）",
                 "嬰幼兒奶粉（罐）", "成人紙尿褲（包）", "乾洗手（瓶）",
                 "工作手套（打）", "帆布（4x6m）"]
_SKILLS = ["清淤人力", "物資搬運", "護理照護", "收容所照護", "交通接駁（自備車輛）",
           "無線電通訊", "空拍勘災", "重機具操作", "水電修繕", "心理支持關懷",
           "外語翻譯", "炊事供餐"]
_AVAIL = ["平日 09:00-17:00", "週末全天", "24 小時待命", "白天時段", "晚間支援",
          "隨時可出發", "需前一天聯繫"]

# Street-level address pools so reports read like real dispatch tickets.
_ROADS = ["中正路", "中山路", "中華路", "民權街", "和平路", "光復街", "成功街",
          "博愛街", "林森路", "自強路", "大同街", "復興街", "民族街", "信義路",
          "仁愛街", "文化街", "新興路", "忠孝街"]
_LANDMARKS = ["市場旁", "國小對面", "活動中心旁", "便利商店旁", "農會倉庫後方",
              "堤防邊", "天主堂旁", "加油站斜對面", "橋頭第一戶", "土地公廟旁"]


def _has_reports(db: Session, incident_id: uuid.UUID) -> bool:
    n = db.scalar(
        select(func.count()).select_from(DisasterReport).where(
            DisasterReport.incident_id == incident_id
        )
    )
    return bool(n)


def _phone(rng: random.Random) -> str:
    return "09" + "".join(rng.choice("0123456789") for _ in range(8))


def _address(rng: random.Random, county: str, town: str) -> str:
    road = rng.choice(_ROADS)
    if rng.random() < 0.30:
        return f"{county}{town}{road}{rng.choice(_LANDMARKS)}"
    section = f"{rng.choice(['一', '二', '三'])}段" if rng.random() < 0.35 else ""
    if rng.random() < 0.25:
        return f"{county}{town}{road}{section}{rng.randint(2, 45)}巷{rng.randint(1, 60)}號"
    return f"{county}{town}{road}{section}{rng.randint(1, 260)}號"


def _description(rng: random.Random, need: str) -> str:
    tpl = rng.choice(_DESC.get(need, ["災情通報，請派員現勘"]))
    return tpl.format(
        n=rng.randint(2, 6) if "{n}" in tpl else "",
        depth=rng.choice([30, 40, 50, 60, 80, 100]),
        hours=rng.choice([6, 8, 12, 18, 24, 36]),
    )


def ensure_coordinates(db: Session, incident: Incident) -> None:
    """Give the incident a map centre if it has none (agent/NL incidents)."""
    if incident.lat is not None and incident.lon is not None:
        return
    lat, lon = centroid_for(incident.county) or TAIWAN_CENTER
    incident.lat, incident.lon = lat, lon
    db.add(incident)
    db.commit()
    db.refresh(incident)


def seed_incident_activity(
    db: Session, incident_id: uuid.UUID, force: bool = False
) -> dict:
    """Create demo reports + resource offers + dispatches for an incident.
    No-op if disabled or if the incident already has reports (unless force)."""
    if not settings.DEMO_AUTO_APPROVE:
        return {"enabled": False}
    incident = db.get(Incident, incident_id)
    if incident is None:
        return {"error": "incident not found"}
    if not force and _has_reports(db, incident_id):
        return {"skipped": True, "reason": "already has reports"}

    ensure_coordinates(db, incident)
    base_lat = incident.lat if incident.lat is not None else TAIWAN_CENTER[0]
    base_lon = incident.lon if incident.lon is not None else TAIWAN_CENTER[1]

    # OS-entropy CSPRNG. The values are only demo content, but SystemRandom
    # keeps this module free of statistical-PRNG usage; idempotency is already
    # guaranteed by the _has_reports guard above, not by a fixed seed.
    rng = random.SystemRandom()
    needs = _NEEDS_BY_SCENARIO.get(incident.scenario_type, _DEFAULT_NEEDS)
    county = incident.county or ""
    town = incident.town or ""
    now = datetime.now(timezone.utc)

    def jitter(v: float, spread: float = 0.02) -> float:
        return round(v + rng.uniform(-spread, spread), 5)

    def backdate(row, max_hours: float = 36.0) -> None:
        """Spread created_at over the past hours, biased toward recent."""
        age = rng.uniform(0.2, max_hours) * rng.uniform(0.3, 1.0)
        row.created_at = now - timedelta(hours=age)
        db.add(row)

    created_reports: list[DisasterReport] = []
    for _ in range(rng.randint(18, 24)):
        need = rng.choice(needs)
        sev = rng.choices(
            [ReportSeverity.critical, ReportSeverity.high,
             ReportSeverity.medium, ReportSeverity.low],
            weights=[2, 4, 3, 1],
        )[0]
        geo = rng.random() < 0.9
        try:
            report = report_service.create_report(db, incident_id, DisasterReportCreate(
                reporter_name=rng.choice(_NAMES),
                reporter_contact=_phone(rng),
                need_type=ReportNeedType(need),
                description=_description(rng, need),
                severity=sev,
                lat=jitter(base_lat) if geo else None,
                lon=jitter(base_lon) if geo else None,
                address=_address(rng, county, town),
            ))
            backdate(report)
            created_reports.append(report)
        except Exception:  # noqa: BLE001 — demo seeding is best-effort
            db.rollback()

    # a handful already resolved, so the board shows progress, not just backlog
    for report in rng.sample(created_reports, k=min(3, len(created_reports))):
        report.status = "resolved"
        db.add(report)

    supplies = 0
    for _ in range(rng.randint(6, 9)):
        try:
            offer = resource_service.create_offer(db, incident_id, ResourceOfferCreate(
                offer_type=OfferType.supply,
                item=rng.choice(_SUPPLY_ITEMS),
                quantity=rng.choice([20, 30, 50, 80, 100, 150, 200, 300]),
                provider_name=rng.choice(_PROVIDERS),
                provider_contact=_phone(rng),
                lat=jitter(base_lat, 0.015),
                lon=jitter(base_lon, 0.015),
                address=_address(rng, county, town),
                available_time=rng.choice(_AVAIL),
            ))
            backdate(offer, 30.0)
            supplies += 1
        except Exception:  # noqa: BLE001
            db.rollback()

    volunteer_offers = []
    for _ in range(rng.randint(6, 9)):
        try:
            offer = resource_service.create_offer(db, incident_id, ResourceOfferCreate(
                offer_type=OfferType.volunteer,
                item=rng.choice(_SKILLS),
                quantity=rng.choice([3, 5, 8, 10, 12, 15, 20, 30]),
                provider_name=rng.choice(_PROVIDERS),
                provider_contact=_phone(rng),
                lat=jitter(base_lat, 0.015),
                lon=jitter(base_lon, 0.015),
                address=_address(rng, county, town),
                available_time=rng.choice(_AVAIL),
            ))
            backdate(offer, 30.0)
            volunteer_offers.append(offer)
        except Exception:  # noqa: BLE001
            db.rollback()

    # dispatch a few volunteer teams to the most urgent open reports, so the
    # situation board shows real movement (已派工 / 進行中)
    dispatched = 0
    urgent = [r for r in created_reports
              if r.status != "resolved" and r.triage_priority in ("critical", "high")]
    rng.shuffle(urgent)
    for report, offer in zip(urgent, volunteer_offers[:5]):
        try:
            assignment = dispatch_service.create_assignment(
                db, incident_id, report.id, offer.id,
                note=f"已聯繫{offer.provider_name or '志工隊'}前往支援（{offer.item}）",
            )
            if rng.random() < 0.5:
                assignment.status = "in_progress"
                db.add(assignment)
            dispatched += 1
        except Exception:  # noqa: BLE001
            db.rollback()

    db.commit()
    return {
        "seeded": True,
        "reports": len(created_reports),
        "supply": supplies,
        "volunteer": len(volunteer_offers),
        "assignments": dispatched,
    }
