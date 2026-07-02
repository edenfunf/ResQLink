# Zeabur 部署手冊（比賽 Demo 版）

全部服務都在 Zeabur 同一個專案裡：**Postgres ＋ FastAPI 後端 ＋ Next.js 前端**。
Zeabur 直接讀 GitHub repo 裡現成的 Dockerfile，不需要額外設定檔。

> 方案：免費 Trial 資源有限，三個常駐服務建議用 **Developer（US$5/月，含 $5 用量）**，
> 不會休眠、demo 不會冷啟動。

```
使用者 ──► resqlink-web（Next.js，*.zeabur.app 網域）
               │  NEXT_PUBLIC_API_BASE_URL
               ▼
           resqlink-api（FastAPI，開機自動跑 migration）
               │  DATABASE_URL
               ▼
           PostgreSQL（Zeabur 服務）
```

## 步驟 0：推上 GitHub

Zeabur 從 GitHub 部署，先把變更推上去：

```bash
git add -A
git commit -m "Deploy prep"
git push origin main
```

## 步驟 1：建專案 + Postgres（2 分鐘）

1. 登入 <https://zeabur.com>（可用 GitHub 登入）→ **Create Project**，
   區域選 **Tokyo** 或 **Taipei**（對台灣延遲最低）。
2. **Add Service → Database → PostgreSQL**，等它變成 Running。

## 步驟 2：部署後端 API（5 分鐘）

1. **Add Service → GitHub** → 選 `disasterblock` repo。
2. Root Directory 填 **`apps/api`**（Zeabur 會自動用該目錄的 Dockerfile）。
3. 到服務的 **Variables** 加入：

   | 變數 | 值 |
   | --- | --- |
   | `DATABASE_URL` | `${POSTGRES_CONNECTION_STRING}`（直接引用 Postgres 服務的變數） |
   | `DEMO_AUTO_APPROVE` | `true` |
   | `CORS_ORIGINS` | `*` |
   | `WEB_PUBLIC_BASE_URL` | 先填 `https://placeholder`，步驟 3 後回來改 |
   | `OPENAI_API_KEY` | 你的金鑰（要 AI 助手/AI 草擬才需要；可不填） |

4. **Networking → Generate Domain** 產生對外網址，形如
   `https://resqlink-api.zeabur.app`。
5. 驗證：開 `https://<API網址>/v1/health` 應回 `{"status":"ok",...}`。
   （容器啟動時會自動跑 Alembic migration 建表。）

## 步驟 3：部署前端（5 分鐘）

1. 同專案再 **Add Service → GitHub** → 同一個 repo。
2. Root Directory 填 **`apps/web`**。
3. **Variables** 加入（會在建置時內嵌進前端 bundle）：

   | 變數 | 值 |
   | --- | --- |
   | `NEXT_PUBLIC_API_BASE_URL` | `https://<步驟2的API網址>` |

4. **Networking → Generate Domain**，得到前端網址，形如
   `https://resqlink.zeabur.app`。
5. 回到 API 服務把 `WEB_PUBLIC_BASE_URL` 改成這個前端網址（服務會自動重啟）。

> 若前端開起來但資料是空的：九成是 `NEXT_PUBLIC_API_BASE_URL` 設錯或
> 是在設定變數「之前」就建置了——改好變數後按 **Redeploy** 重建即可。

## 步驟 4：灌 Demo 資料 + 檢查

在你本機執行（PowerShell）：

```powershell
$env:API_BASE_URL = "https://<API網址>"
$env:WEB_BASE_URL = "https://<前端網址>"
python client/seed_demo.py
```

Demo 前 checklist：
- [ ] 前端首頁與 `/console` 開得起來
- [ ] `/console/agent` 跑一次「一句話 → 平行生成」全流程
- [ ] 公開救災網站（成果卡「開啟救災網站」）地圖與資料正常
- [ ] FB / LINE 後台、網站助手正常
- [ ] 手機開前端網址測一次（評審可能用手機看）

## 疑難排解

| 症狀 | 解法 |
| --- | --- |
| API 起不來、log 顯示連不上 DB | `DATABASE_URL` 沒引用到 Postgres 變數；確認填的是 `${POSTGRES_CONNECTION_STRING}` |
| 前端有畫面沒資料 | `NEXT_PUBLIC_API_BASE_URL` 錯或建置早於變數設定 → 改好後 Redeploy 前端 |
| CORS 錯誤 | API 的 `CORS_ORIGINS` 要是 `*` |
| 要回本機開發 | 照舊 `docker compose up --build`，雲端設定不影響本機 |

> 備案：repo 內另有 Cloudflare + Render 的部署方案（見 [DEPLOY.md](./DEPLOY.md)），
> 兩者互不衝突。
