# Project Memory

Last reviewed: 2026-08-08

This file records durable project knowledge for AI assistants. It is not a full chat transcript. Repository memory files are the source of truth for future Codex / Claude sessions.

## Project identity

- Project name: AI 說書人通用網頁播放器
- Local repo path: `D:\projects\nblm-book-audio`
- GitHub repo: `chianwu-hash/ai-narrator-web-player`
- Vercel project: `ai-narrator-web-player`
- Production URL: `https://ai-narrator-web-player.vercel.app`
- Main app: Next.js + TypeScript web player
- Book library source: Google Drive root folder
- Production book-making / Telegram flow: `news-vm:/home/vboxuser/nblm-audio`, managed by user-level `nblm-bot.service`

## Current architecture summary

- Browser users log in with the shared player invitation code.
- Listener sessions and admin sessions are separate and use different cookies.
- Google Drive is the private source of books, episodes, and cover images.
- Vercel hosts the Next.js app, auth/session APIs, library indexing, token broker, admin pages, and Supabase-backed APIs.
- Supabase stores anonymous cross-device sync, public comments, wish pool entries, anonymous device activity, and play statistics.
- Cloudflare Worker streams private audio bytes from Google Drive using short-lived signed URLs and Range requests.
- The website does not operate the Telegram bot or the audio generation pipeline.

## Critical active decisions

### 2026-10-04 新增筆記本按鈕改名修復

- 使用者正式製書任務卡在建立筆記本；18800／18801 首頁 DOM 都正常載入且 aria-label 為「新增筆記本」，舊程式只接受「建立新的筆記本／建立筆記本」，故先前錯誤訊息判成暫時連線逾時不準確。
- 兩服務改共用 notebook_controls.py，支援新版及舊版完整中英文名稱、排除隱藏／停用／多匹配與 Create report 等非筆記本動作；主題帳號在等待控制項前及點擊前檢查。正式製書 repo commit／push `4793a95a6e93102f02d770dbbe2a42e28b8b4ff7`，191 項隔離測試含 9 個离線 DOM 子案例通過，兩個正式頁面唯讀匹配通過。
- 官方提供固定首頁 https://notebook.google.com/，並指示從首頁按建立；沒有找到官方固定新增路由。實際新增是 BUTTON、無 href；建立後 notebook/<uuid> 才是該筆記本地址。不猜測內部 /creating 等路由，保持 authuser 綁定。
- 沒有為驗證建立 Notebook／新增來源／生成音訊／發訊，亦未替使用者重送任務；使用者可在原 Telegram 失敗任務按斷點回復。worker 下次執行載入新程式，bot 未重啟；原遠端 dirty 與本機其他修改保留。

### 2026-10-04 ElevenMusic 書籍版已接入產線

- 使用者接受音樂品質並授權修改；主題版 nblm-audio 保持固定分類音樂，僅書籍版改以 ElevenMusic v2.5／單首／60 秒／Instrumental 替代 Suno。詳見 `docs/ELEVENMUSIC_INTEGRATION.md`。
- 正式製書 commit／push `41f52f9d63a3dce7c49542b47369ae4c9ffcc238`，bot 重啟 active，190 項隔離測試通過；18801 多曲目精確辨識與表單預檢通過，未新送出。單首先保存提交意圖、保留恢復斷點，不明狀態不重送；不足或失敗改曲庫，保留免費作品署名。
- 播放器可見署名與整合記錄已 commit／push `f019061`；正式播放器部署狀態另見最新操作紀錄。整本書自動流程仍待下一正常任務驗證。
- 舊測試的正式硬編碼 import 路徑造成兩首非預期 Test Book 音樂生成，該輪部署已中止並修正；隔離測試一律 ELEVENMUSIC_DISABLE_BROWSER=1。雲端兩曲未發布／交付，未刪除。詳細經過與最新可見額度在整合文件。

### 2026-08-08 Audio bytes must not stream through Vercel Functions

Status: active
Scope: production audio delivery
Primary source: `docs/VERCEL_HOBBY_TRAFFIC_FIX.md`, `cloudflare/audio-worker/README.md`

Decision:

- Vercel must not directly proxy large audio bytes in production.
- Vercel should authenticate the listener and issue short-lived signed Worker URLs.
- Cloudflare Worker validates the HMAC URL, obtains a short-lived Google Drive readonly token through the Vercel token broker, and streams bounded Range responses from private Drive.
- Google service-account private key stays only in Vercel. Do not copy it to Cloudflare.

Reason:

- Avoid Vercel Hobby Fast Origin Transfer / Function pressure from long audio playback.
- Preserve private Drive authorization without making Drive files public.
- Keep browser audio behavior stable with `206`, `Content-Range`, and `Accept-Ranges`.

Next-time warnings:

- Do not reintroduce direct Drive-to-browser public links.
- Do not change `/api/audio/[fileId]` back into the primary production audio streaming path.
- If touching audio playback, verify `currentSrc` points to Cloudflare Worker in production and that Range requests return `206`.
- `README.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, and `docs/VERCEL.md` were reconciled on 2026-08-08 to describe Cloudflare Worker as the production audio bytes path. Prefer `docs/VERCEL_HOBBY_TRAFFIC_FIX.md` and `cloudflare/audio-worker/README.md` for operational details.

### 2026-08-08 Vercel token broker owns Google private credentials

Status: active
Scope: secrets, Cloudflare Worker, Google Drive auth
Primary source: `cloudflare/audio-worker/README.md`, `docs/VERCEL_HOBBY_TRAFFIC_FIX.md`

Decision:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` stay in Vercel server environment only.
- Cloudflare Worker stores only Worker-specific secrets such as `AUDIO_SIGNING_SECRET` and `AUDIO_TOKEN_BROKER_SECRET`.
- Worker-to-Vercel token requests use the broker secret; browser sessions are not sent to Cloudflare.

Next-time warnings:

- Never commit or document actual secret values.
- Secret names may be documented; values must not be.
- Preview environments may not have access to all production secrets.

### 2026-08-08 Shared invitation code and sync pairing code are different concepts

Status: active
Scope: auth, UX copy, Telegram help, documentation
Primary source: `README.md`, `docs/SUPABASE_SYNC.md`, `docs/TELEGRAM_HELP.md`

Decision:

- 「邀請碼」 means the shared code used to enter the private player.
- 「配對碼」 means a short-lived one-time code used to link a new device or browser to an existing anonymous sync profile.
- Do not call the first-login player code a device sync code.

Reason:

- Avoid confusing access control with cross-device sync identity.
- Shared invitation code is not a personal account and must not be used as a playback-progress identity.

Next-time warnings:

- Telegram `/help`, website help, login copy, and sync UI must use the same terminology.
- Do not store invitation code plaintext in docs or memory.

### 2026-08-08 Cross-device sync is anonymous and profile-based

Status: active
Scope: Supabase sync
Primary source: `docs/SUPABASE_SYNC.md`, `docs/ARCHITECTURE.md`

Decision:

- Playback state starts local.
- When sync is enabled, playback progress, favorites, speed, last episode, and player theme sync through an anonymous Supabase profile.
- Each browser/device receives its own HttpOnly sync device token.
- New devices or browsers pair once using a 6-digit, 5-minute code generated from an already-synced device.

Next-time warnings:

- Different browsers count as different devices.
- Clearing site data removes that browser's sync credential and requires pairing again.
- Do not use the shared invitation code as the sync identity.

### 2026-08-08 Privacy boundary for monitoring and rankings

Status: active
Scope: Supabase data, admin dashboard, legal/privacy policy
Primary source: `docs/DEVICE_MONITORING.md`, `docs/PLAY_STATS.md`, `docs/ADMIN_COMMENTS.md`, `docs/WISH_POOL.md`

Decision:

- Anonymous device monitoring may show approximate device/browser type and activity timestamps.
- It must not record what book, episode, or playback position a user listened to.
- Play rankings record content-level popularity, not user/device/IP-level personal history.
- Comments and wish pool are public to logged-in users, but do not require real names.

Next-time warnings:

- Avoid adding personally identifying analytics.
- Admin pages should support management without becoming user-surveillance tools.

### 2026-08-08 Google Drive write boundary is limited to admin cover replacement

Status: active
Scope: Drive permissions, admin cover management
Primary source: `docs/ARCHITECTURE.md`, `docs/VERCEL.md`, `docs/ROADMAP.md`

Decision:

- Normal library, audio, and cover reads are Drive read-only.
- The only website Drive write path is `/admin/covers`.
- `/admin/covers` may create or update a standard cover file inside a book folder.
- The website must not move, rename, or delete books, audio files, or unrelated Drive files.

Next-time warnings:

- The service account needs editor permission on the Drive library folder for cover replacement.
- Viewer permission is enough for read-only playback but not enough for cover upload.

### 2026-08-08 Legal and product-positioning statement

Status: active
Scope: help page, Telegram help, website statement
Primary source: user decision, `docs/TELEGRAM_HELP.md`

Decision:

- The site is for personal research and guided reading.
- It is not intended to replace reading.
- Original books should still be read to appreciate the beauty of the writing.
- Use is limited to a small private circle with invitation-code access.
- Users should not privately forward the invitation code, player URL, audio files, or summarized content.
- The administrator may periodically rotate the invitation code.

Next-time warnings:

- Legal and copyright-risk copy should remain visible in website help and Telegram `/help`.
- Do not frame the invitation code as DRM; it is only limited private access control.

## Current feature memory

- Home page includes personal playback context and content discovery sections such as recent additions and rankings.
- Player supports themes including 書房綠, 暖紙米, and 夜間墨.
- Full player cover click should open the book playlist.
- Media Session improvements were added to improve Bluetooth/headset playback resume behavior, but iOS may still hand control back to the default music app after longer pauses.
- Public comments support book-level and episode-level feedback; same browser can edit/delete its own new comments; admin can manage comments.
- Wish pool allows anonymous wish entries and shows public wish content to logged-in users.
- Admin pages include links back to the player and navigation for comments, wishes, device activity, and cover management.

### Gemini TTS 小說有聲書每日產線

Status: active
Scope: 《臺灣漫遊錄》製作、Gemini TTS、Google Drive 上傳、自動排程
Primary source: `docs/GEMINI_TTS_FICTION_AUDIOBOOK_SOP.md`

- Codex automation `automation` 每日臺灣時間 15:05 從最早未完成的 Request 精確接續。
- 固定使用 `gemini-2.5-flash-preview-tts`、Speaker1=Sulafat、Speaker2=Aoede、雙女聲小說接力與現行 SOP A 版節奏。
- 每個 API Request 都必須用於正式成品；只有實際收到 HTTP 429／配額錯誤才停止，且不得盲目重試。
- 每集完成後立即製作、驗證母帶，轉成 `libmp3lame -q:a 4` MP3，透過 `news-vm` 的 rclone 上傳至 `gdrive:aitalktoyou_book/臺灣漫遊錄` 並驗證遠端雜湊。
- Drive 上傳前只清理同一 EP 編號的舊 MP3，不得刪除其他集數或其他檔案。
- 全書完成且每集均確認在 Drive 後，才刪除 automation。

Next-time warnings:

- 已有有效 WAV、metadata、母帶或遠端 MP3 時，禁止重複生成或上傳。
- TTS 渲染稿可依既定 mapping 將「千鶴子」改成同音字「千賀子」，但原文、字幕與公開逐字稿必須維持正字。
- 人工試聽仍須檢查機械聲、專名／外來語發音，以及章名停頓與整體節奏。

## Audio migration source hierarchy

If audio-delivery documents appear to conflict, prefer:

- `docs/VERCEL_HOBBY_TRAFFIC_FIX.md`
- `cloudflare/audio-worker/README.md`
- this `docs/PROJECT_MEMORY.md`

for the current audio-delivery architecture.

## Secret policy

Never write actual values for:

- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` if it is not already public in project docs
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`
- `APP_ACCESS_CODE_SHA256` source plaintext
- `ADMIN_ACCESS_CODE_SHA256` source plaintext
- `AUDIO_SIGNING_SECRET`
- `AUDIO_TOKEN_BROKER_SECRET`
- Telegram bot token
- Cloudflare API token

It is acceptable to document environment variable names and where they are configured.

## Common safety checks before work

1. Run `git status --short` before editing.
2. Check whether the task touches files with existing user changes.
3. If deploying or changing production behavior, confirm the current source branch and deployment path.
4. If touching audio delivery, read `docs/VERCEL_HOBBY_TRAFFIC_FIX.md`.
5. If touching sync or comments/wishes/devices/rankings, read the relevant Supabase docs and migrations.
6. If touching Telegram `/help`, remember the website does not automatically update the bot running on `news-vm`.
