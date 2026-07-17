# Supabase 跨設備同步設定紀錄

本文件記錄 AI 說書人播放器加入 Supabase 跨設備同步的實際設定流程。重點是：播放資訊仍先存在本機，啟用同步後再把進度、最愛、倍速與最後播放集數同步到 Supabase。

## 本次實作摘要

- GitHub repo：`chianwu-hash/ai-narrator-web-player`
- Vercel project：`ai-narrator-web-player`
- 正式網址：`https://ai-narrator-web-player.vercel.app`
- 同步功能 commit：`1f9a234 Add Supabase device sync`
- 同步資料表 SQL：`supabase/migrations/202607170001_sync.sql`

這次採用「匿名收聽檔案 + 每台設備配對一次」：

1. 第一台設備按「開啟同步」，建立匿名 profile。
2. 已同步設備按「連結新設備」，產生 6 位數配對碼。
3. 新設備或新瀏覽器登入網站後輸入配對碼。
4. 之後兩台設備共用同一份播放進度。

## Supabase 設定

### 1. 建立資料表

到 Supabase 專案後台：

`SQL Editor` -> `New query`

貼上並執行：

`supabase/migrations/202607170001_sync.sql`

會建立以下資料表：

- `sync_profiles`：匿名收聽檔案，一個人一筆
- `sync_devices`：已配對的設備或瀏覽器
- `sync_states`：播放進度、最愛、倍速與最後播放集數
- `sync_pairing_codes`：短效一次性配對碼

這些表已開啟 RLS。前端不會直接讀寫 Supabase，所有同步都經過 Vercel API。

### 2. 找 Supabase Project URL

在 Supabase 專案首頁的 `Copy` 下拉選單，選：

`Project URL`

這個值填到 Vercel：

```text
SUPABASE_URL
```

Project URL 長得像：

```text
https://xxxxx.supabase.co
```

### 3. 找 Supabase Secret Key

到 Supabase：

`Project Settings` -> `API Keys`

畫面會分成幾種 key：

- `Publishable key`：不要用來填 `SUPABASE_SERVICE_ROLE_KEY`
- `Secret keys` 裡的 `default`：這次要用這個
- 舊版專案可能顯示在 `Legacy anon, service_role API keys`，名稱叫 `service_role`

本專案要使用：

```text
Secret keys -> default -> sb_secret_...
```

或舊版：

```text
service_role
```

這個值填到 Vercel：

```text
SUPABASE_SERVICE_ROLE_KEY
```

不要使用：

- `Publishable key`
- `anon`
- `Direct connection string`
- `CLI setup commands`

`SUPABASE_SERVICE_ROLE_KEY` 權限很大，只能放在 Vercel server 環境變數，不要截圖、不要貼到聊天、不要提交到 GitHub。

## Vercel 設定

到 Vercel：

`Project` -> `ai-narrator-web-player` -> `Environment Variables`

在 `ai-narrator-web-player` 區塊右側按綠色 `+`，新增兩個 Production 變數：

```text
Name: SUPABASE_URL
Value: Supabase Project URL
Environment: Production
```

```text
Name: SUPABASE_SERVICE_ROLE_KEY
Value: Supabase Secret key，通常是 sb_secret_...
Environment: Production
Sensitive: enabled
```

原本已有的 6 個變數不要動：

- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- `AUTH_VERSION`
- `SESSION_SECRET`
- `APP_ACCESS_CODE_SHA256`

新增環境變數後，一定要重新部署。已經存在的舊 deployment 不會自動吃到新的環境變數。

## 部署流程

本次同步功能先在本機完成，確認通過：

```bash
npm run check
```

通過內容包含：

- typecheck
- tests
- lint
- production build

接著提交並推送：

```bash
git add <sync related files>
git commit -m "Add Supabase device sync"
git push origin main
```

Vercel 會自動建立新的 Production deployment。

## 如何確認部署正確

### 1. 看 Vercel commit

到 Vercel 最新 Production deployment，確認 Source commit 是：

```text
1f9a234 Add Supabase device sync
```

如果還是：

```text
75f0f1d Add audio loading feedback
```

代表部署還是舊版，線上不會有同步功能。

### 2. 看路由清單

正確部署後，Vercel build output 應該包含：

```text
/api/sync/state
/api/sync/profile
/api/sync/pairing/start
/api/sync/pairing/claim
```

如果 build output 裡沒有 `/api/sync/*`，代表不是同步版本。

### 3. 測 API 是否存在

未登入狀態打：

```text
https://ai-narrator-web-player.vercel.app/api/sync/state
```

正確結果應該是：

```text
HTTP 401
```

這代表 API 已部署，而且受網站認證保護。

如果是 404，代表同步 API 沒部署上去。

### 4. 測 UI

進入正式播放器：

1. 登入網站認證碼。
2. 首頁應該看到「跨設備同步」區塊。
3. 第一台設備按「開啟同步」。
4. 成功後按「連結新設備」，會產生 6 位數配對碼。
5. 第二台設備或第二個瀏覽器登入後按「輸入配對碼」。
6. 配對成功後，播放進度與最愛會同步。

## 常見問題

### Vercel 顯示 Ready，但沒有同步功能

先看 Source commit。如果不是 `1f9a234` 或更新版本，就是部署到舊程式。

處理方式：

1. 確認 GitHub `main` 已有同步 commit。
2. 到 Vercel `Deployments` 重新部署最新 commit。
3. 確認路由清單有 `/api/sync/*`。

### 按「開啟同步」後顯示 Supabase 尚未設定

通常是 Vercel 沒有設定這兩個 Production env，或設定後沒有重新部署：

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

### 按「開啟同步」後出錯

優先檢查：

1. Supabase SQL 是否已執行。
2. 四張表是否存在。
3. Vercel 的 `SUPABASE_SERVICE_ROLE_KEY` 是否用了 `Secret keys -> default`，而不是 `Publishable key`。
4. env 是否設定在 `Production`。
5. 設定 env 後是否有重新部署。

### 配對碼失敗

可能原因：

- 配對碼超過 5 分鐘。
- 輸入錯誤。
- 新設備尚未通過網站認證碼登入。
- Supabase `sync_pairing_codes` 表不存在或權限設定不完整。

重新從已同步設備按「連結新設備」產生新的配對碼即可。

### 換瀏覽器是否要重新配對

要。Safari、Chrome、Edge 對系統來說是不同設備。每個瀏覽器第一次使用都要配對一次；配對成功後就不用每次配對。

### 清除瀏覽器資料後會怎樣

這台設備的同步憑證會消失，需要重新用配對碼連結。

## 安全原則

- 網站認證碼負責保護播放器入口。
- Supabase 同步 token 負責辨識個人播放進度。
- 不要用網站認證碼當個人進度身份，否則所有使用同一組認證碼的人會共用同一份進度。
- `SUPABASE_SERVICE_ROLE_KEY` 只能放在 Vercel server env。
- 不要把 `sb_secret_...`、`service_role` 或任何 private key 寫進 repo。
