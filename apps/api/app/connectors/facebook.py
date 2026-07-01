"""Facebook Page outbound connector (real Graph API).

Posts an approved outreach draft to an *existing* Facebook Page. Meta does not
allow creating a Page via API, so the 0→1 flow is: the operator creates the Page
once and supplies a Page Access Token; this connector then publishes to it.

Configured via FB_PAGE_ID + FB_PAGE_ACCESS_TOKEN. When unset, ``is_configured()``
is False and the caller falls back to the simulated connector.
"""
from __future__ import annotations

import httpx

from app.connectors.base import ConnectorError
from app.core.config import settings

CONNECTOR_NAME = "facebook_graph"


def is_configured() -> bool:
    return bool(settings.FB_PAGE_ID and settings.FB_PAGE_ACCESS_TOKEN)


def publish_post(*, message: str, link: str | None = None) -> dict:
    """Publish a feed post to the configured Page. Returns a result dict
    (connector / external_ref / url / detail). Raises ConnectorError on failure."""
    base = settings.FB_GRAPH_API_VERSION
    url = f"https://graph.facebook.com/{base}/{settings.FB_PAGE_ID}/feed"
    data = {"message": message, "access_token": settings.FB_PAGE_ACCESS_TOKEN}
    if link:
        data["link"] = link

    try:
        resp = httpx.post(url, data=data, timeout=20)
    except httpx.HTTPError as exc:
        raise ConnectorError(f"Facebook 連線失敗：{exc}") from exc

    if resp.status_code >= 400:
        detail = _error_detail(resp)
        raise ConnectorError(f"Facebook 發文失敗（{resp.status_code}）：{detail}")

    post_id = resp.json().get("id", "")
    post_url = f"https://www.facebook.com/{post_id}" if post_id else None
    return {
        "connector": CONNECTOR_NAME,
        "status": "published",
        "external_ref": post_id or None,
        "url": post_url,
        "detail": "已透過 Facebook Graph API 發布到粉專。",
    }


def _error_detail(resp: httpx.Response) -> str:
    try:
        body = resp.json()
        return body.get("error", {}).get("message") or resp.text[:300]
    except Exception:
        return resp.text[:300]
