"""Google Forms outbound connector (real Forms API).

Unlike FB/LINE (which post to an existing channel), this genuinely builds a form
from 0→1: it creates a brand-new Google Form and adds questions mapped from a
generated form artifact's fields. Configured via a service-account JSON key file
(GOOGLE_SERVICE_ACCOUNT_FILE) with the Forms API (and Drive API, for sharing)
enabled. When unset, ``is_configured()`` is False and the caller falls back to a
simulated result.

google-api-python-client / google-auth are imported lazily so the app runs (and
the simulated path works) even if those libraries are absent.
"""
from __future__ import annotations

from app.connectors.base import ConnectorError
from app.core.config import settings

CONNECTOR_NAME = "google_forms"

_SCOPES = [
    "https://www.googleapis.com/auth/forms.body",
    "https://www.googleapis.com/auth/drive",
]


def is_configured() -> bool:
    return bool(settings.GOOGLE_SERVICE_ACCOUNT_FILE)


def _question_for(field: dict) -> dict | None:
    """Map one of our form fields to a Google Forms `question` object."""
    ftype = field.get("type")
    options = [{"value": str(o)} for o in (field.get("options") or [])]
    if ftype == "select":
        return {"choiceQuestion": {"type": "RADIO", "options": options or [{"value": "—"}]}}
    if ftype == "multi_select":
        return {"choiceQuestion": {"type": "CHECKBOX", "options": options or [{"value": "—"}]}}
    if ftype == "textarea":
        return {"textQuestion": {"paragraph": True}}
    if ftype == "datetime":
        return {"dateQuestion": {"includeTime": True, "includeYear": True}}
    # text / number / anything else → short text answer
    return {"textQuestion": {"paragraph": False}}


def _create_item_requests(fields: list[dict]) -> list[dict]:
    requests: list[dict] = []
    for idx, field in enumerate(fields):
        question = _question_for(field)
        if question is None:
            continue
        question["required"] = bool(field.get("required"))
        label = field.get("label") or field.get("name") or f"問題 {idx + 1}"
        requests.append(
            {
                "createItem": {
                    "item": {"title": label, "questionItem": {"question": question}},
                    "location": {"index": idx},
                }
            }
        )
    return requests


def create_form(*, title: str, description: str | None, fields: list[dict]) -> dict:
    """Create a Google Form with the given questions. Returns a result dict
    (connector / external_ref=formId / url=responder link / edit_url / detail).
    Raises ConnectorError on any failure."""
    try:
        from google.oauth2 import service_account  # type: ignore
        from googleapiclient.discovery import build  # type: ignore
    except ImportError as exc:  # library not installed
        raise ConnectorError(
            "未安裝 google-api-python-client / google-auth，無法建立 Google 表單。"
        ) from exc

    try:
        creds = service_account.Credentials.from_service_account_file(
            settings.GOOGLE_SERVICE_ACCOUNT_FILE, scopes=_SCOPES
        )
        forms = build("forms", "v1", credentials=creds, cache_discovery=False)

        created = forms.forms().create(body={"info": {"title": title[:300]}}).execute()
        form_id = created["form_id"] if "form_id" in created else created["formId"]
        responder_uri = created.get("responderUri")

        requests: list[dict] = []
        if description:
            requests.append(
                {
                    "updateFormInfo": {
                        "info": {"description": description[:4000]},
                        "updateMask": "description",
                    }
                }
            )
        requests.extend(_create_item_requests(fields))
        if requests:
            forms.forms().batchUpdate(
                formId=form_id, body={"requests": requests}
            ).execute()

        _maybe_share(creds, form_id)
    except ConnectorError:
        raise
    except Exception as exc:  # API / auth / network error
        raise ConnectorError(f"Google 表單建立失敗：{exc}") from exc

    return {
        "connector": CONNECTOR_NAME,
        "status": "published",
        "external_ref": form_id,
        "url": responder_uri,
        "edit_url": f"https://docs.google.com/forms/d/{form_id}/edit",
        "detail": "已透過 Google Forms API 建立表單。",
    }


def _maybe_share(creds, form_id: str) -> None:
    """Best-effort: share the created form (owned by the service account) with a
    human editor so it is reachable in their Drive."""
    email = settings.GOOGLE_FORMS_SHARE_WITH
    if not email:
        return
    try:
        from googleapiclient.discovery import build  # type: ignore

        drive = build("drive", "v3", credentials=creds, cache_discovery=False)
        drive.permissions().create(
            fileId=form_id,
            body={"type": "user", "role": "writer", "emailAddress": email},
            sendNotificationEmail=False,
        ).execute()
    except Exception:
        # sharing is non-fatal — the form already exists and is usable
        pass
