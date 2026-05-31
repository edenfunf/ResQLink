# DisasterBlock

[![CI](https://github.com/edenfunf/disasterblock/actions/workflows/ci.yml/badge.svg)](https://github.com/edenfunf/disasterblock/actions/workflows/ci.yml)

DisasterBlock 是一組可被其他防災系統重複使用的防災積木元件。它把一筆堰塞湖災害事件，轉成標準化的災害事件、救災元件、審核任務、民眾通報、GeoJSON 圖層與公開入口，讓不同團隊能快速拼接，縮短災害初期「資訊能被整理、審核並公開使用」所需的時間。

作品定位、問題描述與設計構想見 [SUBMISSION.md](./SUBMISSION.md)。

## 功能

- 接收官方警戒或人工建案，標準化為一筆災害事件（Incident）。
- 由事件生成六種救災元件：救災資訊入口、災情回報表單、志工報名、物資需求、地圖組合、公開公告。生成方式可選規則式或 AI 草擬。
- 每個元件預設為待審核，須由人工 approve / reject，通過後才可對外公開。
- 民眾提交災情通報並落地，輸出標準 GeoJSON 圖層（不含個資）。
- 公開入口只顯示審核通過的內容。
- 情勢摘要：即時聚合元件、審核與通報狀態，呈現需求分布。
- 所有狀態變更寫入事件 outbox，供後續通知、派工或統計訂閱。

## 技術棧

- 後端：FastAPI、PostgreSQL、SQLAlchemy、Alembic
- 前端：Next.js、TypeScript、Tailwind CSS、Leaflet
- 容器：Docker Compose
- AI 草擬層（選用）：OpenAI

## 架構

```mermaid
flowchart TD
  A[官方警戒 / 人工建案] --> B[Incident]
  B --> C[Bootstrap：規則式或 AI 草擬]
  C --> D[Generated Artifacts]
  D --> E[Review Tasks]
  E -->|approve| F[Public Preview]
  H[民眾通報] --> I[Disaster Reports]
  I --> J[Reports GeoJSON]
  J --> K[Leaflet 地圖]
  B --> L[Situation Summary]
  B --> M[Event Outbox]
  C --> M
  E --> M
  I --> M
```

詳細架構見 [docs/architecture.md](./docs/architecture.md)。

## 快速啟動

需求：已安裝 Docker 與 Docker Compose。

```bash
docker compose up --build
```

- 前端：<http://localhost:3000>
- API 與 Swagger：<http://localhost:8000/docs>

API 服務啟動時會自動執行 Alembic migration 建表。

若本機 3000 埠已被占用，改用 3001：

```bash
cp docker-compose.override.example.yml docker-compose.override.yml
docker compose up --build
```

前端會改在 <http://localhost:3001>。

### 啟用 AI 草擬（選用）

預設以規則式生成元件，不需任何金鑰即可完整運作。若要啟用 AI 草擬層：

```bash
cp .env.example .env
# 在 .env 填入 OPENAI_API_KEY，再重新啟動
```

啟用後，生成時帶 `?use_ai=true`（或在事件頁按「以 AI 生成」）即可由 AI 並行草擬部分文字欄位；產出仍須經人工審核才公開，且金鑰不會進入版本控制。

## 載入展示資料

```bash
bash client/seed_demo.sh
```

會建立一筆事件、生成並審核部分元件、送出兩筆通報，並印出各頁網址。若使用 3001，前面加上 `WEB_BASE_URL=http://localhost:3001`。

## 測試

```bash
docker compose exec api pytest -q          # 後端整合測試
python scripts/validate_schemas.py         # JSON Schema 與範例（需先 pip install jsonschema）
```

提交前可一次跑完本機檢查：`bash scripts/preflight.sh`。

## API

| Method | Path | 說明 |
| --- | --- | --- |
| GET | `/v1/health` | 健康檢查 |
| POST | `/v1/events/alerts` | 接收警戒 / 建案，建立事件 |
| GET | `/v1/incidents` | 事件列表 |
| GET | `/v1/incidents/{id}` | 單筆事件 |
| POST | `/v1/bootstrap/incidents/{id}` | 生成 6 元件 + 審核任務（`?use_ai=true` 啟用 AI 草擬） |
| GET | `/v1/artifacts`、`/v1/artifacts/{id}` | 元件列表 / 內容 |
| GET | `/v1/reviews` | 審核任務列表 |
| POST | `/v1/reviews/{id}/approve`、`/reject` | 審核通過 / 退回 |
| POST | `/v1/incidents/{id}/reports` | 提交民眾通報 |
| GET | `/v1/incidents/{id}/reports` | 通報列表（不含聯絡方式） |
| GET | `/v1/reports/{id}` | 單筆通報（含個資，正式環境須權限控管） |
| GET | `/v1/incidents/{id}/reports.geojson` | 通報 GeoJSON（不含個資） |
| GET | `/v1/incidents/{id}/summary` | 情勢摘要 |
| GET | `/v1/public/preview/{slug}` | 公開入口（僅審核通過內容） |
| GET | `/v1/events/outbox` | 事件 outbox |

完整合約見 Swagger（`/docs`）或匯出的 [openapi/](./openapi/)；各元件交換格式見 [schemas/](./schemas/)。

## 前端頁面

| 路由 | 用途 |
| --- | --- |
| `/` | 首頁 |
| `/console` | 事件列表 |
| `/console/new` | 建立事件 |
| `/console/reviews` | 審核 |
| `/incidents/[id]` | 事件詳細：生成、審核、通報、情勢摘要 |
| `/preview/[slug]` | 公開入口與地圖 |
| `/reports/[incidentId]` | 民眾通報表單與地圖 |

## 目錄結構

```
disasterblock/
├── apps/
│   ├── api/                FastAPI 後端
│   │   ├── app/{routers,schemas,services,db,core,utils}/
│   │   ├── alembic/        資料庫 migration
│   │   └── tests/          pytest
│   └── web/                Next.js 前端
│       ├── app/            頁面
│       ├── components/     元件
│       └── lib/            API client 與型別
├── schemas/                元件交換格式 JSON Schema
├── openapi/                OpenAPI 匯出
├── samples/                範例輸入
├── client/                 煙霧測試與展示資料腳本
├── scripts/                schema 驗證、preflight 等
├── docs/                   架構與設計文件
└── docker-compose.yml
```

## AI 使用與資料倫理

預設以規則式生成，可預測、可重現、可稽核。啟用 AI 時，AI 僅並行草擬部分自由文字欄位（公告、入口標題、表單引導語），表單結構與風險分級仍由規則產生；AI 產出一律須經人工審核才公開，民眾個資不會送入模型，失敗時自動退回規則式。對外輸出（GeoJSON、公開入口）一律去識別化。本系統為公民科技輔助工具，不取代官方災害應變指揮與公告。完整聲明見 [SECURITY_AND_LIMITATIONS.md](./SECURITY_AND_LIMITATIONS.md)。

## 文件

- [SUBMISSION.md](./SUBMISSION.md)　作品定位、問題描述與驗收路徑
- [SECURITY_AND_LIMITATIONS.md](./SECURITY_AND_LIMITATIONS.md)　資料倫理與限制
- [docs/architecture.md](./docs/architecture.md)　系統架構
- [docs/demo-script.md](./docs/demo-script.md)　展示腳本

## 授權

MIT，見 [LICENSE](./LICENSE)。
