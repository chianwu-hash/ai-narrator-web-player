# Vercel 與 Google Drive 設定

## 1. Google Cloud

1. 建立或選擇 Google Cloud 專案，啟用 Google Drive API。
2. 建立 service account，建立 JSON key。
3. 在 Drive 中把「AI說書人」根資料夾分享給 service account 的 email，權限只給「檢視者」。不需要把整個 Drive 分享，也不需要網域全域委派。
4. 不要移動、改名或刪除現有檔案。

目前 Codex 的 Google Drive 連線尚未授權，因此本次無法列出根目錄實際內容。完成上述分享後，播放器的 API 可直接用相同 ID 唯讀驗證；不需要修改既有 bot。

## 2. Vercel 環境變數

在 Project Settings → Environment Variables 設定 `.env.example` 中的正式值，至少套用到 Production 與 Preview：

- `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`（整段私鑰；可用 `\n` 保存換行）
- `APP_ACCESS_CODE_SHA256`
- `SESSION_SECRET`
- `AUTH_VERSION`

正式環境不要設定 `DRIVE_MODE=mock`，也不要把 JSON key 或 `.env.local` 提交到 Git。

## 3. 部署前檢查

1. 在 Preview 環境先驗證正確／錯誤認證碼。
2. 登入後確認顯示的資料夾、書名、EP02 與 EP10 排序。
3. 在 Chrome Android 與 iOS Safari 實機測試播放、拖曳、鎖定畫面、背景播放與切集。
4. 更改 `AUTH_VERSION`，確認舊 cookie 失效。
5. 觀察長音檔播放期間的 Vercel Functions 用量與錯誤紀錄。

本專案目前只完成部署準備，沒有自行發布到正式 Vercel。
