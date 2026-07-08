# 災鏈 ResQLink — Submission Guide

> 給評審的最短驗收文件。完整說明見 [README.md](./README.md)。

## 1. 作品名稱

**災鏈 ResQLink：AI Agent 編排的防災積木系統**

## 2. 一句話定位

一句話描述災情，AI Agent 從 72 個模組的註冊表找出該用的防災積木、提案給人確認後平行生成，
產出救災網站、通報、志工物資後台與擴散內容，全部經審核閘門才公開。

## 3. 對應競賽主題

「防災積木元件創新賽」。我們把「積木」做成機器可讀的模組註冊表，再加上一個會挑積木、
組積木的 Agent 編排器：民間團隊、政府系統或後續平台不只拿到可重複使用的元件，
還拿到把元件組起來的自動化能力，災害初期不必從零拼裝。

## 4. 核心元件

| 元件 | 說明 |
| --- | --- |
| Agent Orchestrator | 核心：plan（自然語言 → 標準化事件 → 依災別提案模組）＋ execute（平行生成、逐模組隔離失敗、冪等）。LLM 只做理解與提案這一個決策點，生成一律走確定性程式 |
| Module Registry | 72 個模組依十大方向分類：生成型 50（全部可由 Agent 生成）、處理型 20、動作型 2；已實作 57、規劃中 15，目錄即路線圖 |
| Incident | 標準化災害事件（堰塞湖／地震／颱風／水災） |
| Generated Artifacts | Agent 或 bootstrap 生成的救災元件，內容隨災種調整 |
| Review Tasks | 公開前的人工審核閘門 |
| Disaster Reports | 民眾災情通報（送出自動 triage 分流，保留原始 raw_payload） |
| Reports GeoJSON | 標準地圖圖層（去 PII、僅含座標者） |
| Public Preview API | 只回審核通過內容的公開入口 |
| Triage / Matching / Dispatch | 通報自動分流、需求-資源媒合、派工與狀態追蹤 |
| Timeline / Publish | 事件時間軸（outbox 稽核）、對外發布（FB/LINE/Google 表單連接器，限 approved） |

## 5. 快速啟動

```bash
docker compose up --build
```

- Web： <http://localhost:3000>
- API / Swagger： <http://localhost:8000/docs>

若 **3000 被佔用**：

```bash
cp docker-compose.override.example.yml docker-compose.override.yml
docker compose up --build
```

改開 <http://localhost:3001>（seed 時帶 `WEB_BASE_URL=http://localhost:3001`）。

## 6. 一鍵建立展示資料

```bash
bash client/seed_demo.sh
```

會建立 incident → bootstrap → approve 三個元件 → 提交兩筆通報，並印出 Console / Incident /
Public Preview / Report Form / GeoJSON 的 URL。

## 7. 建議驗收路徑

主路徑（Agent 編排，作品核心）：

1. 開啟 <http://localhost:3000/console/agent>
2. 輸入一句災情描述，例如「花蓮外海發生規模 7.2 強烈地震，市區傳出建物倒塌」
3. Agent 標準化事件並提案模組（地震災別會推薦緊急求援、避難地圖等），確認後平行生成
4. 生成完成後由成果卡開啟救災資訊網站與 FB／LINE／志工／物資後台
5. 到 `/console/modules` 看模組註冊表全貌（十大方向、實作狀態）

手動路徑（驗證審核閘門，先在 `.env` 設 `DEMO_AUTO_APPROVE=false`）：

1. `/console/new` 建立 incident（已預填馬太鞍溪，可直接送出）
2. 進入 incident detail 點 **Bootstrap**（生成核心元件＋審核任務）
3. Approve 其中幾項後開 **Public Preview**，確認只看得到審核通過的內容
4. 到 **Report Form** 提交通報，回 Preview 地圖確認出現通報點
5. 開 **GeoJSON endpoint** 確認標準資料輸出（不含 PII）

> 不想點 UI？`bash client/seed_demo.sh` 一鍵備好資料，再依印出的 URL 逐頁查看。

## 8. API / OpenAPI

- Swagger： <http://localhost:8000/docs>
- OpenAPI JSON： <http://localhost:8000/openapi.json>
- 匯出： `bash client/export_openapi.sh` → [openapi/openapi.json](./openapi/openapi.json)
- 元件交換格式 JSON Schema： [schemas/](./schemas/)

## 9. 測試與 CI

```bash
docker compose exec api pytest -q        # 後端 77 passed
python scripts/validate_schemas.py       # JSON Schema + samples（需 pip install jsonschema）
```

GitHub Actions（[.github/workflows/ci.yml](./.github/workflows/ci.yml)）：`backend-test` /
`frontend-build` / `schema-validation` 三項。本機提交前：`bash scripts/preflight.sh`。

## 10. 目前限制

- 預設 **rule-based** 生成；另提供**選用的 AI 草擬層**（`use_ai=true`），AI 僅並行草擬部分文字欄位，
  結構仍規則式、且**一律須人工審核才公開**、不碰個資、可退回規則式（human-in-the-loop）。
- 官方資料介接（CWA 地震、NCDR CAP、data.gov.tw）支援範例匯入與即時抓取（需授權碼）；
  對外發布（FB/LINE/Google 表單）填入憑證即走真實 API，未填則模擬。
- `reporter_contact` 等 PII 目前明文儲存；已提供 `ADMIN_API_KEY` 存取控制可保護
  含個資端點，production 仍需加密與更完整的權限 / 遮罩。
- 對外輸出（GeoJSON / Public Preview）**一律去除 PII**；未審核內容對外不可見。
- 本系統為**公民科技輔助工具，不取代官方災害應變指揮與公告**。

完整聲明見 [SECURITY_AND_LIMITATIONS.md](./SECURITY_AND_LIMITATIONS.md)。

## Suggested Release Tag

For final submission, we recommend creating a Git tag:

```bash
git tag v0.4.8
git push origin v0.4.8
```

This makes it easier for reviewers to identify the submitted version.
