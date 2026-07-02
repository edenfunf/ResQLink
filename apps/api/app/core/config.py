from __future__ import annotations

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = (
        "postgresql+psycopg://resqlink:resqlink@db:5432/resqlink"
    )

    # Comma-separated allowed CORS origins, or "*" for any origin
    # (credentials are disabled automatically in that case). Managed hosts
    # like Render / Cloudflare assign their own domains, so this is settable.
    CORS_ORIGINS: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:3001,http://127.0.0.1:3001"
    )

    APP_NAME: str = "災鏈 ResQLink API"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"

    # Demo mode: generated artifacts go live immediately (auto-approved) so the
    # public site / deliverable fronts show content the moment they are created,
    # without a manual review step. Set to false to restore the human review gate.
    DEMO_AUTO_APPROVE: bool = True

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # 中央氣象署開放資料授權碼（opendata.cwa.gov.tw）；未設定時 live 抓取停用，
    # 但仍可用 ingest/demo 以提供的 payload 建立事件。
    CWA_API_KEY: str = ""
    CWA_API_BASE: str = "https://opendata.cwa.gov.tw/api/v1/rest/datastore"

    # 對外公開網站基底（用於組出貼文/推播裡的救災入口連結）。
    WEB_PUBLIC_BASE_URL: str = "http://localhost:3000"

    # ── 真實對外連接器憑證（選用；未設定時自動退回模擬連接器） ──
    # Facebook 粉專發文：需先有粉專、FB App，並取得 Page Access Token
    # （權限 pages_manage_posts / pages_read_engagement）。
    FB_PAGE_ID: str = ""
    FB_PAGE_ACCESS_TOKEN: str = ""
    FB_GRAPH_API_VERSION: str = "v21.0"

    # LINE 官方帳號推播：需先建 LINE OA 並啟用 Messaging API 取得 Channel Access Token。
    LINE_CHANNEL_ACCESS_TOKEN: str = ""

    # Google 表單建立：服務帳號 JSON 金鑰檔路徑（需啟用 Forms API 與 Drive API）。
    # 設定 GOOGLE_FORMS_SHARE_WITH 可把建立出的表單以編輯權限分享給該 Email。
    GOOGLE_SERVICE_ACCOUNT_FILE: str = ""
    GOOGLE_FORMS_SHARE_WITH: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("DATABASE_URL")
    @classmethod
    def _normalize_db_url(cls, v: str) -> str:
        """Managed Postgres (e.g. Render) hands out postgres:// URLs; SQLAlchemy
        needs the psycopg driver spelled out."""
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+psycopg://", 1)
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def cors_allow_all(self) -> bool:
        return self.CORS_ORIGINS.strip() == "*"


settings = Settings()
