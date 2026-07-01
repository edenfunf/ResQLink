#!/usr/bin/env python3
"""災鏈 ResQLink — rich demo data seeder.

Creates several complete incidents (barrier lake / earthquake / typhoon / flood),
generates every deliverable's modules for each, and fills them with realistic
citizen reports, supply & volunteer offers and dispatch assignments.

In demo mode (DEMO_AUTO_APPROVE=true, the default) generated content goes live
immediately, so every public front and every management backend has plenty to
show without any manual review step.

Usage:   python client/seed_demo.py
Env:     API_BASE_URL (default http://localhost:8000)
         WEB_BASE_URL (default http://localhost:3001)
"""
from __future__ import annotations

import json
import os
import random
import urllib.error
import urllib.request

API = os.environ.get("API_BASE_URL", "http://localhost:8000").rstrip("/")
WEB = os.environ.get("WEB_BASE_URL", "http://localhost:3001").rstrip("/")

random.seed(20260702)  # deterministic runs


def _req(method: str, path: str, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        f"{API}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        return {"__error__": f"{e.code} {e.read().decode('utf-8', 'ignore')[:200]}"}
    except Exception as e:  # noqa: BLE001
        return {"__error__": str(e)}


def post(path, payload=None):
    return _req("POST", path, payload)


def get(path):
    return _req("GET", path)


# Every generator module across all five deliverables. Bootstrapped one-by-one
# so a module that isn't executable for a scenario just gets skipped.
ALL_MODULES = [
    "microsite_config", "public_notice_draft", "damage_report_form", "map_bundle",
    "evacuation_guide", "faq", "sos_form", "medical_need_form",
    "vulnerable_care_list", "shelter_map", "hazard_zone_layer",
    "fb_page_post", "press_release", "clarification_notice",
    "line_broadcast",
    "supply_form", "supply_donation_form", "supply_dashboard",
    "volunteer_form", "volunteer_recruit_post", "volunteer_checkin",
]

NAMES = ["王小明", "陳美玲", "林志豪", "黃淑芬", "張家豪", "李怡君", "吳建宏",
         "劉雅婷", "蔡宗翰", "鄭淑惠", "許文雄", "楊惠雯", "謝明道", "郭婉如"]

PROVIDERS = ["某企業志工隊", "在地志工小隊", "慈善救助基金會", "里辦公室",
             "大學服務社", "宗教團體救援隊", "紅十字志工分會"]

SUPPLY_ITEMS = ["飲用水（箱）", "即食乾糧", "睡袋毛毯", "行動發電機", "抽水機",
                "口罩與衛生用品", "清淤鏟具", "急救醫療包", "嬰兒尿布奶粉"]

VOLUNTEER_SKILLS = ["清淤人力", "物資搬運", "醫療支援", "收容所照護",
                    "交通接駁", "通訊聯絡", "空拍勘災"]

AVAIL = ["平日 09:00-17:00", "週末全天", "24 小時待命", "白天時段", "晚間支援"]

# incident spec: event_type, title, severity, base location + report need mix
INCIDENTS = [
    {
        "event_type": "barrier_lake_alert",
        "title": "馬太鞍溪堰塞湖溢流警戒",
        "severity": "critical",
        "loc": {"county": "花蓮縣", "town": "光復鄉", "river": "馬太鞍溪",
                "lat": 23.66, "lon": 121.42},
        "needs": ["mud_removal", "flooding", "road_blocked", "trapped_person",
                  "supply_need", "medical_need", "power_outage"],
    },
    {
        "event_type": "earthquake_alert",
        "title": "花蓮近海規模 6.8 地震",
        "severity": "critical",
        "loc": {"county": "花蓮縣", "town": "花蓮市",
                "lat": 23.976, "lon": 121.604},
        "needs": ["building_collapse", "trapped_person", "fire", "gas_leak",
                  "medical_need", "missing_person", "supply_need"],
    },
    {
        "event_type": "typhoon_alert",
        "title": "強烈颱風海葵登陸恆春半島",
        "severity": "high",
        "loc": {"county": "屏東縣", "town": "恆春鎮",
                "lat": 22.003, "lon": 120.744},
        "needs": ["power_outage", "flooding", "road_blocked", "supply_need",
                  "medical_need", "other"],
    },
    {
        "event_type": "flood_alert",
        "title": "楠梓區豪雨積淹水事件",
        "severity": "high",
        "loc": {"county": "高雄市", "town": "楠梓區",
                "lat": 22.728, "lon": 120.326},
        "needs": ["flooding", "mud_removal", "power_outage", "supply_need",
                  "trapped_person"],
    },
]

DESC = {
    "flooding": "路面積水超過膝蓋，住戶受困需要協助",
    "mud_removal": "一樓淤泥約 40 公分，急需人力清理",
    "road_blocked": "落石與倒樹阻斷聯外道路，車輛無法通行",
    "power_outage": "整區停電已逾 12 小時，長者需要電力供醫療器材",
    "building_collapse": "老舊透天騎樓崩塌，疑有人受困",
    "fire": "瓦斯外洩引發小規模火警，需要消防與疏散",
    "gas_leak": "聞到濃烈瓦斯味，整棟住戶已撤出",
    "trapped_person": "低窪處有民眾受困待救援",
    "missing_person": "家中長輩失聯，最後出現在市場附近",
    "medical_need": "洗腎患者無法外出就醫，急需協助後送",
    "supply_need": "收容點缺乏飲用水與乾糧",
    "other": "其他災情需求，請派員現勘",
}


def phone():
    return "09" + "".join(random.choice("0123456789") for _ in range(8))


def jitter(v, d=0.02):
    return round(v + random.uniform(-d, d), 5)


def seed_incident(spec) -> dict:
    loc = spec["loc"]
    alert = {
        "source": "manual",
        "event_type": spec["event_type"],
        "title": spec["title"],
        "severity": spec["severity"],
        "location": loc,
        "source_refs": [{
            "source_name": "demo_seed",
            "source_ref": f"mock://{spec['event_type']}-{random.randint(1000, 9999)}",
            "fetched_at": "2026-07-02T08:00:00+08:00",
        }],
    }
    created = post("/v1/events/alerts", alert)
    iid = created.get("incident_id")
    slug = created.get("slug")
    if not iid:
        print(f"  ! failed to create incident: {created}")
        return {}

    # generate every deliverable's modules (skip any not executable)
    gen = 0
    for m in ALL_MODULES:
        r = post(f"/v1/bootstrap/incidents/{iid}?module_ids={m}")
        if "__error__" not in r:
            gen += 1

    # citizen reports (varied need types, geo-jittered around the incident)
    n_reports = random.randint(8, 12)
    for _ in range(n_reports):
        need = random.choice(spec["needs"])
        sev = random.choices(["critical", "high", "medium", "low"],
                             weights=[2, 4, 3, 1])[0]
        has_geo = random.random() < 0.85
        payload = {
            "reporter_name": random.choice(NAMES),
            "reporter_contact": phone(),
            "need_type": need,
            "description": DESC.get(need, "災情通報"),
            "severity": sev,
            "address": f"{loc['county']}{loc['town']}災區周邊",
        }
        if has_geo:
            payload["lat"] = jitter(loc["lat"])
            payload["lon"] = jitter(loc["lon"])
        post(f"/v1/incidents/{iid}/reports", payload)

    # supply offers
    n_supply = random.randint(5, 8)
    for _ in range(n_supply):
        post(f"/v1/incidents/{iid}/resources", {
            "offer_type": "supply",
            "item": random.choice(SUPPLY_ITEMS),
            "quantity": random.choice([50, 100, 150, 200, 300, 500]),
            "provider_name": random.choice(PROVIDERS),
            "provider_contact": phone(),
            "lat": jitter(loc["lat"]),
            "lon": jitter(loc["lon"]),
            "address": f"{loc['county']}{loc['town']}物資集散點",
            "available_time": random.choice(AVAIL),
        })

    # volunteer offers
    n_vol = random.randint(5, 8)
    for _ in range(n_vol):
        post(f"/v1/incidents/{iid}/resources", {
            "offer_type": "volunteer",
            "item": random.choice(VOLUNTEER_SKILLS),
            "quantity": random.choice([3, 5, 8, 10, 15, 20]),
            "provider_name": random.choice(PROVIDERS),
            "provider_contact": phone(),
            "lat": jitter(loc["lat"]),
            "lon": jitter(loc["lon"]),
            "address": f"{loc['county']}{loc['town']}",
            "available_time": random.choice(AVAIL),
        })

    # dispatch a few matched report<->offer pairs
    matches = get(f"/v1/incidents/{iid}/matches")
    dispatched = 0
    for item in matches.get("items", []):
        cands = item.get("candidates") or []
        if not cands:
            continue
        r = post(f"/v1/incidents/{iid}/assignments", {
            "report_id": item["report_id"],
            "offer_id": cands[0]["offer_id"],
            "note": "demo 派工",
        })
        if "__error__" not in r:
            dispatched += 1
        if dispatched >= 3:
            break

    print(f"  ✓ {spec['title']}")
    print(f"      modules {gen} · reports {n_reports} · supply {n_supply} "
          f"· volunteer {n_vol} · dispatched {dispatched}")
    return {"id": iid, "slug": slug, "title": spec["title"]}


def main():
    health = get("/v1/health")
    if health.get("status") != "ok":
        print(f"API not reachable at {API}: {health}")
        raise SystemExit(1)
    print(f"==> seeding rich demo data into {API}")

    seeded = [s for s in (seed_incident(spec) for spec in INCIDENTS) if s]

    print("\n" + "=" * 60)
    print(f" Seeded {len(seeded)} incidents. Open the console:")
    print(f"   {WEB}/console")
    print(" Per-incident (事件詳情 → 五個成果各自後台):")
    for s in seeded:
        print(f"   • {s['title']}")
        print(f"       事件詳情 {WEB}/incidents/{s['id']}")
        print(f"       公開網站 {WEB}/preview/{s['slug']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
