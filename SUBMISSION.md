# 災鏈 ResQLink — Submission Guide

> 給評審的最短驗收文件。完整說明見 [README.md](./README.md)。

## 1. 作品名稱

**災鏈 ResQLink：堰塞湖災害通報與救災入口生成元件**

## 2. 一句話定位

將堰塞湖災害事件轉換為 Incident、Generated Artifacts、Review Tasks、Disaster Reports、GeoJSON 與
Public Preview API 的**可拼接防災積木元件**。

## 3. 對應競賽主題

「防災積木元件創新賽」——以可重複使用的元件，讓民間團隊、政府系統或後續平台快速拼接出救災入口與通報能力，
而非各自從零重做平台。

## 4. 核心元件

| 元件 | 說明 |
| --- | --- |
| Incident | 標準化災害事件 |
| Generated Artifacts | 由事件一鍵生成的 6 種救災元件（rule-based） |
| Review Tasks | 公開前的人工審核閘門 |
| Disaster Reports | 民眾災情通報（保留原始 raw_payload） |
| Reports GeoJSON | 標準地圖圖層（去 PII、僅含座標者） |
| Public Preview API | 只回審核通過內容的公開入口 |
| Module Registry | 27 個模組（21 生成型 + 6 處理/動作型）依十大方向分類，全部已實作 |
| Agent Orchestrator | 對話式編排：自然語言 → 提案模組 → 平行生成（產出仍經審核） |
| Triage / Matching / Dispatch | 通報自動分流、需求-資源媒合、派工與狀態追蹤 |
| Timeline / Publish | 事件時間軸（outbox 稽核）、對外發布（FB/LINE 模擬連接器，限 approved） |

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

1. 開啟 <http://localhost:3000>
2. 進入 `/console/new` 建立 incident（已預填馬太鞍溪，可直接送出）
3. 進入 incident detail 點 **Bootstrap**（生成 6 元件 + 6 審核任務）
4. **Approve** `microsite_config` / `public_notice_draft` / `map_bundle`
5. 開 **Public Preview**（只會看到審核通過的內容）
6. 到 **Report Form** 提交一筆通報
7. 回 Preview / Report 頁，地圖確認出現通報點
8. 開 **GeoJSON endpoint** 確認標準資料輸出（且不含 PII）

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
- **未串接真實官方 API**，以 `source_refs` 保留 connector 擴充點。
- `reporter_contact` 等 PII 目前**明文儲存**，production 需加密 / 權限 / 遮罩。
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
