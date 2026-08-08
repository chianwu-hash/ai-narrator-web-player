# Vercel 與 Google Drive 設定

最後核對：2026-07-25

## 1. Google Cloud

1. 建立或選擇 Google Cloud 專案，啟用 Google Drive API。
2. 建立 service account，建立 JSON key。
3. 在 Drive 中只把「AI說書人」根資料夾分享給 service account 的 email，不需要分享整個 Drive，也不需要網域全域委派。
4. 權限依功能選擇：
   - 只使用書庫、播放與封面讀取：`檢視者` 即可。
   - 使用 `/admin/covers` 新增或替換封面：必須設為 `編輯者`。
5. 網站的封面管理只會新增或更新書籍資料夾內的封面，不會移動、改名或刪除其他現有檔案。

播放器與製書 bot 使用相同的 Drive 書庫格式，但網站不會呼叫或修改 bot。

## 2. Vercel 環境變數

在 Project Settings → Environment Variables 設定 `.env.example` 中的正式值，至少套用到 Production；需要測試 Preview 時也套用到 Preview。

播放器與 Drive：

- `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`（整段私鑰；可用 `\n` 保存換行）
- `APP_ACCESS_CODE_SHA256`
- `SESSION_SECRET`
- `AUTH_VERSION`

管理後台：

- `ADMIN_ACCESS_CODE_SHA256`
- `ADMIN_AUTH_VERSION`

Supabase：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`（使用 `sb_secret_...` 或 legacy `service_role`，設為 Sensitive）

Cloudflare Worker audio delivery：

- `AUDIO_WORKER_URL`
- `AUDIO_SIGNING_SECRET`
- `AUDIO_URL_TTL_SECONDS`
- `AUDIO_TOKEN_BROKER_SECRET`

正式環境不要設定 `DRIVE_MODE=mock`，也不要把 JSON key 或 `.env.local` 提交到 Git。

`SESSION_SECRET` 同時簽署一般與管理者 session；兩種 session 仍使用不同 cookie、版本與 scope。

`AUDIO_SIGNING_SECRET` 必須同時設定於 Vercel 與 Cloudflare Worker；`AUDIO_TOKEN_BROKER_SECRET` 也必須在兩端相同，用於 Worker 呼叫 Vercel `/api/worker/drive-token`。兩者都不可寫入 repo 或聊天紀錄。

## 3. Supabase migration

依檔名順序執行 `supabase/migrations/` 內所有 SQL：

1. `202607170001_sync.sql`
2. `202607170002_content_comments.sql`
3. `202607170003_comment_ownership.sql`
4. `202607170004_book_wishes.sql`
5. `202607170005_device_activity.sql`
6. `202607180001_content_play_stats.sql`

未設定 Supabase 時，基本書庫與播放仍可使用；同步、留言、許願、設備監控和熱門排行會停用或顯示未設定。

## 4. 部署與檢查

本專案已連接 GitHub `chianwu-hash/ai-narrator-web-player` 與 Vercel project `ai-narrator-web-player`，正式網址為：

`https://ai-narrator-web-player.vercel.app`

推送至部署分支後由 Vercel 建置；新增或變更環境變數後必須重新部署，既有 deployment 不會自動套用。

部署前先在本機執行：

```bash
npm run check
```

部署後檢查：

1. 在 Preview 環境先驗證正確／錯誤邀請碼。
2. 登入後確認顯示的資料夾、書名、EP02 與 EP10 排序。
3. 在 Chrome Android 與 iOS Safari 實機測試播放、拖曳、鎖定畫面、背景播放與切集。
4. 更改 `AUTH_VERSION`，確認舊 cookie 失效。
5. 以管理者碼登入 `/admin`；若啟用封面管理，先用非關鍵書籍驗證上傳及 Drive 權限。
6. 驗證同步配對、留言、許願、設備統計與熱門排行。
7. 若正式啟用 Cloudflare Worker，確認 production audio `currentSrc` 指向 Worker URL，Range 回應為 `206`，Worker Analytics 有音訊請求，且 Vercel `/api/audio/[fileId]` 不再承擔主要音訊 bytes。
8. 觀察 Vercel Functions 用量、Worker request/error、Google Drive quota 與 iOS Safari／Android Chrome 實機播放。

更完整的 Supabase 設定與資料表用途見 `docs/SUPABASE_SYNC.md`、`docs/ADMIN_COMMENTS.md`、`docs/WISH_POOL.md`、`docs/DEVICE_MONITORING.md` 與 `docs/PLAY_STATS.md`。

Cloudflare Worker audio 設定與正式切換順序見 `docs/VERCEL_HOBBY_TRAFFIC_FIX.md`、`cloudflare/audio-worker/README.md` 與 `config/audio-delivery.env.example`。
