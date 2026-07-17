# Supabase 跨設備同步設定

這個同步功能只把播放狀態存到 Supabase，不會存音檔或書籍內容。

## 1. 建立資料表

在 Supabase 專案後台打開 SQL Editor，執行：

`supabase/migrations/202607170001_sync.sql`

執行後會建立：

- `sync_profiles`：匿名收聽檔案
- `sync_devices`：已配對設備或瀏覽器
- `sync_states`：播放進度、最愛、倍速的 JSON 狀態
- `sync_pairing_codes`：5 分鐘有效的一次性配對碼

這些表已開啟 RLS，但前端不直接碰資料表；網站只透過 Vercel API 使用 `service role key` 存取。

## 2. 設定 Vercel 環境變數

到 Vercel Project Settings -> Environment Variables，新增：

```text
SUPABASE_URL=https://你的-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=你的 server-side Secret key 或 legacy service_role key
```

Supabase 新版金鑰可能顯示為 `sb_secret_...`，舊專案可能顯示為 `service_role`。兩者都只能放在 Vercel server 環境變數，不能放到前端，也不能提交到 GitHub。Supabase 官方文件也明確區分：publishable key 可公開，secret / service_role key 只能用在後端。

## 3. 本機測試

在 `.env.local` 加同樣兩個變數後，重新啟動開發伺服器。

登入播放器後會看到「跨設備同步」：

1. 第一台設備按「開啟同步」
2. 第一台設備按「連結新設備」，取得 6 位數配對碼
3. 第二台設備登入網站後按「輸入配對碼」
4. 之後兩台設備會共用播放進度

## 4. 部署

Vercel 環境變數設定完成後重新部署。部署完成後，第一台設備需要按一次「開啟同步」。
