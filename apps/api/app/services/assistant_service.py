"""Site AI assistant — answers questions about 災鏈 ResQLink itself.

Grounded on a hand-written knowledge document plus live registry / incident
stats, so answers stay factual about this system. With an OpenAI key the
assistant is conversational; without one it falls back to keyword matching
over the same knowledge base, so the widget always works in demos.
"""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import DisasterReport, Incident
from app.modules import CATEGORIES, registry
from app.services import ai_agent

_MAX_HISTORY = 8

# ── knowledge document (also the fallback KB) ──────────────────

_SITE_OVERVIEW = """\
災鏈 ResQLink 是一組可重複使用的「防災積木元件」系統：把一筆災害事件（堰塞湖、地震、颱風、水災）
轉成標準化的事件（Incident）、救災元件（Artifacts）、審核任務（Review）、民眾通報（Reports）、
GeoJSON 圖層與公開入口，讓防災團隊快速拼接出救災網站與通報能力。
核心流程：建立/匯入事件 → 生成救災元件（規則式或 AI 草擬）→ 人工審核 → 審核通過才對外公開。
所有狀態變更寫入事件 outbox，可追溯稽核。本系統為公民科技輔助工具，不取代官方指揮與公告。"""

_PAGES = """\
主要頁面導覽：
- /console：事件列表管理台
- /console/agent：對話式 AI 編排（描述災害 → Agent 提案模組 → 平行生成）
- /console/modules：模組目錄（能力地圖，含已實作與規劃中）
- /console/connectors：開放資料介接（一鍵匯入官方範例警報）
- /console/new：手動建立事件
- /console/reviews：審核中心（元件上線閘門）
- /incidents/{id}：事件詳情（生成、審核、通報、情勢摘要、時間軸、六大成果卡）
- /incidents/{id}/site|fb|line|supply|volunteer：各成果的管理後台
- /preview/{slug}：對外公開的救災資訊網站（只顯示審核通過內容）
- /reports/{incidentId}：民眾災情通報與志工/物資登記"""

_HOWTO = """\
常見操作：
- 建立事件：到 /console/agent 用一句話描述災害讓 AI 編排，或 /console/new 手動建立，
  或 /console/connectors 匯入官方警報。
- 生成救災元件：事件詳情頁按 Bootstrap（核心六元件），或在 AI 編排勾選模組平行生成。
- 審核上線：/console/reviews 或各成果後台按「審核通過」；通過後公開網站才看得到。
- 發布到社群：FB/LINE 後台審核通過後按「發布」；未綁定憑證時走模擬連接器（記錄但不真發）。
- 民眾通報：公開網站的「災情通報」按鈕 → 表單送出後自動 triage 分流（critical/high/normal/low）。
- 需求媒合與派工：通報（需求）與志工/物資（供給）依類型與距離自動媒合建議，可建立派工單追蹤。
- Demo 模式：DEMO_AUTO_APPROVE=true 時生成元件直接上線並自動灌入示範通報資料。"""

_DATA_ETHICS = """\
資料與倫理：對外輸出（GeoJSON、公開入口）一律去識別化，不含通報者姓名電話；
AI 只草擬文字欄位且一律經人工審核；聯絡個資目前明文儲存，正式環境需加密與權限控管。"""


def _dynamic_context(db: Session) -> str:
    """Live stats so the assistant can answer about current data."""
    mods = registry.all()
    runnable = sum(1 for m in mods if m.is_bootstrap_executable())
    planned = sum(1 for m in mods if not m.implemented)
    lines = [
        f"模組目錄現況：共 {len(mods)} 個模組（可生成 {runnable}、規劃中 {planned}），"
        f"分為十大方向：{'、'.join(CATEGORIES.values())}。"
    ]
    try:
        n_inc = db.scalar(select(func.count()).select_from(Incident)) or 0
        n_rep = db.scalar(select(func.count()).select_from(DisasterReport)) or 0
        lines.append(f"目前系統內有 {n_inc} 筆災害事件、{n_rep} 筆民眾通報。")
        rows = db.scalars(
            select(Incident).order_by(Incident.created_at.desc()).limit(5)
        ).all()
        if rows:
            recent = "；".join(
                f"「{r.title}」（{r.scenario_type}，公開頁 /preview/{r.slug}）" for r in rows
            )
            lines.append(f"最近的事件：{recent}。")
    except Exception:  # stats are best-effort
        pass
    return "\n".join(lines)


_KNOWLEDGE = "\n\n".join([_SITE_OVERVIEW, _PAGES, _HOWTO, _DATA_ETHICS])

# keyword fallback KB: (keywords, answer)
_FALLBACK_KB: list[tuple[tuple[str, ...], str]] = [
    (("建立", "新增", "事件", "怎麼開始", "開始"),
     "建立事件有三種方式：① /console/agent 用一句話描述災害，AI 會標準化成事件並提案模組；"
     "② /console/new 手動填表建立；③ /console/connectors 匯入官方警報範例。"
     "建立後到事件詳情頁生成救災元件即可。"),
    (("審核", "上線", "閘門", "approve", "公開"),
     "所有生成元件預設為「待審核」，到 /console/reviews 或各成果管理後台按「審核通過」後，"
     "內容才會出現在對外公開網站。這是系統的上線閘門，AI 也不能繞過。"
     "（Demo 模式 DEMO_AUTO_APPROVE=true 時會自動通過。）"),
    (("模組", "積木", "能力", "目錄"),
     "模組目錄在 /console/modules，依十大救災方向分類，包含可直接生成的生成型模組、"
     "已內建的服務型能力（triage、媒合、派工、時間軸）與規劃中的路線圖積木。"
     "AI 編排時可勾選任意生成型模組平行生成。"),
    (("agent", "ai", "編排", "平行生成"),
     "到 /console/agent 描述災害狀況（例如「花蓮外海發生規模7.2地震」），"
     "Agent 會標準化事件、從模組目錄提案，你勾選後按「平行生成」即可一次產出所有元件；"
     "產出仍須經審核才公開。"),
    (("通報", "回報", "災情", "民眾"),
     "民眾在公開網站（/preview/{slug}）點「災情通報」即可回報淹水、受困、物資需求等；"
     "送出後系統自動 triage 分流（critical/high/normal/low），並輸出去識別化的 GeoJSON 供地圖使用。"),
    (("志工", "物資", "捐", "媒合", "派工"),
     "志工與物資在公開網站或 /reports/{id} 登記；系統會把通報需求與供給依類型與距離自動媒合"
     "（critical 優先），承辦可在志工/物資後台建立派工單並追蹤狀態。"),
    (("fb", "facebook", "粉專", "line", "推播", "發布"),
     "FB 粉專與 LINE 推播各有管理後台（事件詳情頁的成果卡進入）。貼文/訊息審核通過後按「發布」；"
     "未設定 FB/LINE 憑證時走模擬連接器（完整記錄但不實際對外），設定憑證後自動改走真實 API。"),
    (("地圖", "geojson", "圖層", "收容所"),
     "公開網站有即時災情地圖：民眾通報點（依危急程度分色）、收容所、醫療站、物資與志工佈點。"
     "開放資料 GeoJSON 在 /v1/incidents/{id}/reports.geojson，一律不含個資。"),
    (("api", "swagger", "介接", "openapi"),
     "完整 API 文件在 http://localhost:8000/docs（Swagger）。常用端點：事件 /v1/incidents、"
     "生成 /v1/bootstrap、Agent /v1/agent/plan 與 /v1/agent/execute、審核 /v1/reviews、"
     "通報 /v1/incidents/{id}/reports、公開入口 /v1/public/preview/{slug}。"),
    (("個資", "隱私", "倫理", "安全"),
     _DATA_ETHICS),
    (("demo", "示範", "假資料", "種子"),
     "Demo 模式（DEMO_AUTO_APPROVE=true）下，生成元件直接上線，且事件會自動灌入擬真的"
     "示範通報、物資志工與派工資料，方便展示。要恢復人工審核閘門請設為 false 後重啟。"),
    (("你是誰", "你能", "做什麼", "幫我什麼", "功能"),
     "我是災鏈 ResQLink 的網站助手，可以回答：系統是什麼、各頁面在哪、怎麼建立事件與生成元件、"
     "審核與發布流程、通報與媒合機制、模組目錄、API 介接、Demo 模式與資料倫理等問題。"),
]

_FALLBACK_DEFAULT = (
    "這個問題我沒有把握（目前未啟用 AI 金鑰，使用內建知識庫回答）。你可以問我：\n"
    "・怎麼建立事件、生成救災元件？\n・審核與上線流程？\n・民眾怎麼通報災情？\n"
    "・志工物資怎麼媒合派工？\n・FB/LINE 怎麼發布？\n・API 怎麼介接？"
)

SUGGESTIONS = [
    "這個系統是做什麼的？",
    "怎麼從一句話生成救災網站？",
    "審核流程怎麼運作？",
    "民眾通報後系統會做什麼？",
    "有哪些模組可以用？",
]


def _fallback_answer(message: str) -> str:
    text = message.lower()
    best: tuple[int, str] | None = None
    for keywords, answer in _FALLBACK_KB:
        hits = sum(1 for kw in keywords if kw.lower() in text)
        if hits and (best is None or hits > best[0]):
            best = (hits, answer)
    return best[1] if best else _FALLBACK_DEFAULT


def chat(db: Session, message: str, history: list[dict] | None = None) -> dict:
    history = (history or [])[-_MAX_HISTORY:]

    if not ai_agent.is_enabled():
        return {"reply": _fallback_answer(message), "mode": "kb", "suggestions": SUGGESTIONS}

    system = (
        "你是「災鏈 ResQLink」防災系統的網站助手，用繁體中文回答使用者關於這個網站的問題。"
        "回答要簡潔、具體、友善，適時給出頁面路徑；不知道就說不知道，不要捏造功能或數據。"
        "頁面一律用站內相對路徑表示（例如 /console/reviews、/preview/xxx），"
        "不要自行加上任何網域。輸出純文字（可用編號或「・」條列），"
        "不要使用 Markdown 語法（粗體、連結、標題都不要），也不要使用「——」破折號。"
        "與本系統無關的問題請婉轉拉回網站主題。\n\n=== 系統知識 ===\n"
        + _KNOWLEDGE
        + "\n\n=== 即時狀態 ===\n"
        + _dynamic_context(db)
    )
    messages = [{"role": "system", "content": system}]
    for h in history:
        role = "assistant" if h.get("role") == "assistant" else "user"
        content = str(h.get("content") or "")[:2000]
        if content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": message[:2000]})

    try:
        reply = ai_agent._chat(messages, max_tokens=600).strip()  # noqa: SLF001 — same package AI layer
        if not reply:
            raise ValueError("empty reply")
        return {"reply": reply, "mode": "ai", "suggestions": SUGGESTIONS}
    except Exception:
        return {"reply": _fallback_answer(message), "mode": "kb", "suggestions": SUGGESTIONS}
