# 災鏈 ResQLink — 7 分鐘 Demo 簡報腳本

> 事前準備：`docker compose up -d` 後執行 `bash client/seed_demo.sh`，
> 把它印出的 URL 先開在分頁，現場可選擇「重現流程」或「直接展示已備資料」。

---

## 0. 一句話（10 秒）

> 「災鏈 ResQLink 不是一個完整救災平台，而是一組**可被任何防災系統重複使用的防災積木元件**——
> 把一個堰塞湖災害事件，自動變成救災入口、表單、地圖與通報通道。」

## 1. 要解決的痛點（45 秒）

- 災害發生時，**每個團隊各自從零做網站、表單、地圖**，重工又慢。
- 民眾通報散落在 LINE 群、表單、電話，**沒有標準格式、無法拼接**。
- 自動生成內容若直接公開，**錯誤資訊風險高**，又缺人工把關。

災鏈 ResQLink 把這三件事標準化成可重用元件。

## 2. 積木元件定位（30 秒）

六種輸出都是標準化「積木」，其他系統可挑著用：
`Incident`、`Generated Artifacts`、`Review Tasks`、`Disaster Reports`、`GeoJSON`、`Public Preview API`。
全部有 JSON Schema 與 OpenAPI，**可被政府系統或民間團隊直接拼接**。

## 3. 現場操作流程（3 分鐘，主秀）

1. **建立事件** `/console/new`：表單已預填「馬太鞍溪堰塞湖警戒事件」→ 直接送出。
   - 「這就是 **Input**：一筆官方警戒或人工建案。」
2. **Bootstrap** 在詳細頁按一下 → 立刻生成 **6 個防災元件**
   （救災入口設定、災情回報表單、志工報名、物資需求、地圖組合、公開公告草稿）。
   - 「這是 **Process**：rule-based 自動生成，可重現、可稽核，**不依賴外部 AI**。」
3. **人工審核**：對 `microsite_config`、`public_notice_draft`、`map_bundle` 按「通過」。
   - 「所有要公開的內容都要**人工 approve**，這是安全閘門。」
4. **公開 Preview** `/preview/{slug}`：只看得到**剛剛審核通過**的內容。
   - 「未審核 / 退回的元件，公開頁**完全看不到**。」
5. **民眾通報** `/reports/{id}`：填一筆有座標的通報送出。
   - 下方 **Leaflet 地圖即時長出一個通報點**。
6. **GeoJSON**：打開 `/v1/incidents/{id}/reports.geojson`。
   - 「這是 **Output**：標準 GeoJSON，**任何地圖系統都能直接吃**，且不含個資。」
7. **情勢摘要（Situation Summary）**：回事件詳細頁最上方的「情勢摘要」面板。
   - 「這是把整個事件的 artifacts / reviews / reports **即時聚合**成一個畫面：
     幾個元件可公開、幾筆待審、民眾在求助什麼（清淤×N、物資×N）、幾筆能上圖。」
   - 點出**斷點**：「災時資訊分散，協調者沒有單一畫面掌握全局——這個 read-model 元件就是補這個斷點。」

## 4. Input / Process / Output（30 秒）

| 階段 | 內容 |
| --- | --- |
| Input | Alert Event（官方警戒 / 人工建案）、民眾通報 |
| Process | 標準化 Incident → Bootstrap 生成 Artifacts → 人工 Review → **聚合情勢摘要** |
| Output | Public Preview（approved-only）、Reports GeoJSON、Situation Summary、Event Outbox |

## 5. AI / rule-based 自動化（20 秒）

- 目前生成是 **rule-based**：**可預測、可重現、可審核**，比賽階段刻意不接 LLM。
- 風險分級（risk_level）與審核類型（review_type）也由規則推導。
- 之後要接 AI 很容易——生成器是可替換的元件，介面不變。

## 6. approved-only 安全設計（20 秒）

- 每個 artifact 預設 `pending_review`，採**白名單式公開**。
- Public Preview API 只回 `approved`，**前端無從繞過**。
- 對外輸出（GeoJSON / Preview）一律**去除 PII**；個資只在需授權的後台 API 出現。

## 7. GeoJSON 可拼接（15 秒）

> 「因為輸出是標準 GeoJSON，今天用 Leaflet 畫，明天換 Google Maps、QGIS、政府 GIS 都行——
> 這就是『積木』的意思：**換掉外框，元件照用**。」

## 8. 結尾價值（20 秒）

> 「災鏈 ResQLink 讓災害發生的**第一個小時**，就能用一致格式快速拼出救災入口、
> 把民眾通報變成可用地圖資料，並用人工審核守住資訊品質。
> 它不搶平台的位置，而是讓**每個平台都更快上線**。」

---

### 備援：純後端展示（無前端時）

```bash
bash client/seed_demo.sh        # 建立資料並印出 URL
bash client/smoke_reports.sh    # 純 API 跑完整通報 + GeoJSON + preview 流程
```
