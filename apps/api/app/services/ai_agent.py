from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor

from app.core.config import settings
from app.db.models import Incident

_TIMEOUT = 20


def is_enabled() -> bool:
    return bool(settings.OPENAI_API_KEY)


def _chat(messages: list[dict], *, json_mode: bool = False, max_tokens: int = 400) -> str:
    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    kwargs: dict = {
        "model": settings.OPENAI_MODEL,
        "messages": messages,
        "temperature": 0.4,
        "max_tokens": max_tokens,
        "timeout": _TIMEOUT,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    resp = client.chat.completions.create(**kwargs)
    return resp.choices[0].message.content or ""


def _place(incident: Incident) -> str:
    return "".join(p for p in (incident.county, incident.town, incident.river) if p)


def _draft_notice(incident: Incident) -> dict | None:
    try:
        content = _chat(
            [
                {
                    "role": "system",
                    "content": "你是台灣防災資訊承辦，用繁體中文撰寫簡潔、冷靜、不誇大的公告，只輸出 JSON。",
                },
                {
                    "role": "user",
                    "content": (
                        f"事件：{incident.title}；地點：{_place(incident)}；嚴重度：{incident.severity}。"
                        '請產生公開公告草稿，格式 {"title": ..., "body": ...}；body 不超過 120 字，'
                        "提醒民眾以政府官方公告為準，不要捏造數字或時間。"
                    ),
                },
            ],
            json_mode=True,
        )
        data = json.loads(content)
        title = str(data.get("title") or "").strip()
        body = str(data.get("body") or "").strip()
        return {"title": title, "body": body} if title and body else None
    except Exception:
        return None


def _draft_site_title(incident: Incident) -> str | None:
    try:
        text = _chat(
            [
                {"role": "system", "content": "用繁體中文取一個簡短正式的災害資訊入口標題，10 字內，只輸出標題本身。"},
                {"role": "user", "content": f"事件：{incident.title}；地點：{_place(incident)}。"},
            ],
            max_tokens=40,
        )
        return text.strip().strip('"「」') or None
    except Exception:
        return None


def _draft_damage_desc(incident: Incident) -> str | None:
    try:
        text = _chat(
            [
                {"role": "system", "content": "用繁體中文寫一句災情回報表單的引導說明，30 字內，只輸出該句。"},
                {"role": "user", "content": f"事件：{incident.title}。"},
            ],
            max_tokens=60,
        )
        return text.strip().strip('"「」') or None
    except Exception:
        return None


def draft_texts(incident: Incident) -> dict:
    """Draft the free-text fields in parallel. Returns only the fields that
    succeeded; callers fall back to rule-based content for the rest."""
    if not is_enabled():
        return {}

    jobs = {
        "notice": _draft_notice,
        "site_title": _draft_site_title,
        "damage_desc": _draft_damage_desc,
    }
    out: dict = {}
    with ThreadPoolExecutor(max_workers=len(jobs)) as ex:
        futures = {key: ex.submit(fn, incident) for key, fn in jobs.items()}
        for key, future in futures.items():
            try:
                out[key] = future.result(timeout=_TIMEOUT + 5)
            except Exception:
                out[key] = None
    return {key: value for key, value in out.items() if value}
