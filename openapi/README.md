# OpenAPI

DisasterBlock 的 API 規格由 **FastAPI 自動產生**，不手寫。

## 線上瀏覽（服務啟動後）

- Swagger UI： <http://localhost:8000/docs>
- ReDoc： <http://localhost:8000/redoc>
- OpenAPI JSON： <http://localhost:8000/openapi.json>

## 匯出成檔案

```bash
docker compose up -d api
bash client/export_openapi.sh
```

會把 `http://localhost:8000/openapi.json` 寫入 [openapi/openapi.json](./openapi.json)。

> `openapi.json` 為產生物（generated artifact），內容會隨後端 router / schema 變動。
> 請勿手動編輯；需要更新時重新執行上面的匯出指令。

## 與 JSON Schema 的關係

- 本目錄的 `openapi.json` 是**完整 API 合約**（所有路徑、參數、回應模型）。
- [`schemas/`](../schemas/) 內的 `*.schema.json` 是**元件交換格式**的精簡版 JSON Schema，
  方便其他防災系統理解 Input / Output 形狀，不需先讀完整個 OpenAPI。
