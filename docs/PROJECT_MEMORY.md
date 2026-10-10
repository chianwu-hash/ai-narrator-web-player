## 2026-10-10 晚間：正式製書全面取消 Codex 情節調查

使用者明確要求把 Codex 驗證移出產線。原因：大谷翔平：武士初心第一集原文約22809字，兩輪1231.1秒／145695 tokens，第二輪對來源未交代或事件順序等4項疑義触發嚴格停止，stage=episode_facts_failed，0語音；程序已退出、queue/inflight空。這是單集成本，不能當全書實測。進度缺口與終止未回報仍是待修事項，這輪沒有修改Telegram報錯機制。

最新規則取代「文字來源仍保留Codex」：新製書與book_regen共同prepare_episode_facts入口，TXT／文字層PDF直接保留基底語音提示（原書優先、通用說書規則），清除舊自動情節附註／掃描警語，保存source_prompt_receipt.json（verification=skipped_by_policy、codex_calls=0、audio_quality_verified=false）；掃描PDF沿用既有文字層抽樣判斷並加一次原開場警語，不呼叫Codex。舊Codex工具、成功／失敗／待reconciliation紀錄均保留但正式入口不讀，不退回Notebook聊天抽取。新入口仍檢查來源唯一、提示长度，不自動重啟已停止的書或改已交付音訊。

已部署news-vm共同模組，backup=/home/vboxuser/nblm-account-backups/remove_codex_facts_20261010_221008，module SHA256=9063b937bdbc50642d6ff08671b66f092f2e3d94acc03bea68b065a638ae1cee。24歷史情節／入口保護+4新分流測試通過，安裝後4分流再通過；模型0呼叫，沒有新音訊、Drive變更或bot重啟。額外未修改的DOM測試因該venv缺Playwright未能執行，沒有新增依賴。VM其他dirty檔案保留，未pull／重置或commit push。這次停下的書仍需從斷點回復，部署本身不續作。權威流程docs/BOOK_AUDIO_MAINLINE.md。

# Project Memory

## 2026-10-10 掃描影像製書分流與提示詞警語（已部署）

- 目前Notebook主線步驟與來源分流以 `docs/BOOK_AUDIO_MAINLINE.md` 為準；原文ElevenLabs獨立線不混入此入口。

- 使用者定案：保留PDF原圖製書，但此線跳過Codex情節抽取／回查，接受成本與品質限制；可靠全文文字線保留Codex。此決策取代先前「所有PDF均跑兩輪Codex」規則。
- 不用後製插警語。每集提示詞要求一位主持人在開場正文前完整照唸一次：「本集由 AI 依原書掃描影像製作，文字辨識與情節轉述可能有誤；涉及人物、事件與細節，請以原書為準。」使用者回聽發現缺漏則 `/book_regen`，不新增自動語音驗收。
- news-vm共同入口episode_facts.py已部署：PDF經既有scanpdf.is_text_pdf判為掃描則跳過CLI，TXT／文字層PDF保留CLI；抽樣文字層檢查不等於可靠全文保證。每次生成／重生清除舊附註後重新編排，避免警語重複。跳過收據標skipped_image_pdf／codex_calls=0／audio_quality_verified=false。
- 備份news-vm `/home/vboxuser/nblm-account-backups/scan_warning_20261010_203430`；24項情節回歸＋3項分流測試通過，正式安裝3項通過。無模型查詢／新音訊／Drive改動／bot重啟；bot active。詳docs/EPISODE_FACTS.md。

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

- 2026-10-06 使用者授權修正夜間同步 bug，已套用本機原碼、未部署：SyncControls ack 使用送出 payload 快照＋single-flight；同位置進度不刷新 lastPlayedAt；hidden idle 不發 activity，背景真播放保留。修正後原碼 React mock 15 情境／14 組通過：paused/ended 每小時 60 PUT→1，慢回應最高 19 在途→1，最後待傳進度保留，背景播放仍 30 PUT/30min；40 node tests、typecheck、lint 通過。正式仍為先前 deployment；server full-state upsert／last_seen_at 無條件寫尚未改，IO 因果未定。詳見 Disk IO 報告最新「已授權並套用本機」節；報告內未套用候選描述為歷史。

- Browser users log in with the shared player invitation code.
- Listener sessions and admin sessions are separate and use different cookies.
- Google Drive is the private source of books, episodes, and cover images.
- Vercel hosts the Next.js app, auth/session APIs, library indexing, token broker, admin pages, and Supabase-backed APIs.
- Supabase stores anonymous cross-device sync, public comments, wish pool entries, anonymous device activity, and play statistics.
- Cloudflare Worker streams private audio bytes from Google Drive using short-lived signed URLs and Range requests.
- The website does not operate the Telegram bot or the audio generation pipeline.

## Critical active decisions

### 2026-10-04 工作室更名重排錯位修復

- 《如何造就一個好老師》七集生成後三列被改成 EP01。新版 audio_spark 圖示文字污染舊標題解析；更名後重排，重試在無法定位時沿用舊 index，且底層只看整個 panel 出現名稱，造成錯改其他音訊。來源數／提示詞識別碼仍完整，不是內容檔覆寫。
- 修復：結構化 artifact-title／details，保留外部狀態標記；捕捉 artifact-labels-UUID，提示詞盤點／更名／下載以此定位。只驗證同一 artifact 的精確標題，禁止失去原列後舊位置重試。正式程式 commit／push 4904742、da0f904、e06e982，保留原執行權限；197 項完整隔離測試及狀態補強後 6 項相關重測通過。详見 `docs/GEMINI_NOTEBOOK_UI_20261004.md`。
- 暫停原子程序後，按提示詞 EP＋UUID 修復七集名稱；reload 後逐集核對身分、標題、來源數及原時長通過。未重生／刪除音訊；恢復既有 FIFO job，新程序確認七集可播放且不重送生成，七集全部下載／解碼及原時長驗證通過，collected=7/7，已進入正常後製。全書交付以後續正式狀態為準。
- 備份於 news-vm 的 nblm-account-backups/artifact_identity_20261004_223317、artifact_recovery_20261004_223914。bot active/running、NRestarts=0；遠端及本機其他 dirty 保留。固定名稱不等同固定內容身分，列表 index 只能代表當下位置。

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

## 2026-10-09 news-vm Codex 情節閱讀正式整合

- 使用者在短／長集評估後要求繼續；07:52完成指定模組部署。正式 `prepare_episode_facts` 改接 `codex_facts.py`，新書生成及 `/book_regen` 同入口使用news-vm GPT-6.1 Sol/high兩輪原圖／完整TXT閱讀；Notebook繼續負責語音摘要。舊Notebook抽取函式僅保留測試，無自動fallback。
- 獨立固定CLI0.161.0安裝於 `~/.local/share/nblm-codex-cli`，沿用VM ChatGPT登入；不使用API key、不改全域CLI或其他用途預設模型。第一輪完整抽取、第二輪回讀原書並同次產生完整修正JSON與每案voice_notes；完整紀錄不受舊2600字卡限制，voice提示2400、整份prompt本地12000上限，超出或未解辨讀疑義就停止，不截尾。
- 新版真實QBQ EP03兩輪共82537token（71967input、10570output，cached24576為input子集）、303.8秒；四案例voice887字、整份prompt2433字。回查修正玻璃1.5乘1公尺、移除來源未記載咳嗽，補回Deb Weber及反覆業務員提問；代理目視原六張圖核對核心情節，不宣稱逐字／普遍無誤或語音驗收。
- 相同來源／規格重生與只改語音風格重跑均0新增模型呼叫。key不含語音基底，含來源、流程版本、模型／推理、CLI版本／路徑、render與兩輪prompt／voice預算；答案／完整紀錄雜湊驗證、防重複flock、失敗stage先reconciliation。不能直接重用舊Notebook錯稿。
- 既有生成／重生保護維持，準備失敗不刪tile或送音訊；CDP填入及送出前逐字核對整份prompt，截短／改動就不點生成。部署前及部署後各222測試通過，安裝後快取確認0呼叫；收據見 `work/codex_facts_integration_20261009/post_deploy_receipt.json`。
- 備份 `/home/vboxuser/nblm-account-backups/codex_episode_facts_20261009_075238`；bot恢復active、queue空、52本既有audio_prompts未改。本輪未生成音訊、替換Drive、批次重製、發Telegram或commit/push。詳細規則 `docs/EPISODE_FACTS.md`、可追蹤模組 `tools/vm_episode_facts/`，本地收據 `work/codex_facts_integration_20261009/`。此部署取代下方歷史「尚未接CLI產線」狀態。

## 2026-10-09 QBQ Codex CLI 情節抽取評估

- 使用者接受 Notebook 分析／推論，要求不偏離作者原意，並指定 news-vm Codex CLI，不走本機或另付費API。隔離CLI0.161.0可用gpt-6.1-sol/high；正式產線尚未改接CLI。
- QBQ短EP03／長EP08兩輪原圖閱讀實測81,313／111,993 token、466.1／532.4秒；核對稿2796／3903字元。代理另讀原頁確認核心情節，回查修正數字與內心想法／口頭發言混淆。兩集結果快取重跑0新增模型呼叫，指紋變更失效及答案完整性已驗證。
- 週用量觀察24%→25%，共用帳號且取整，不能作每本精確額度；九集量級粗估73–101萬token、70–80分鐘閱讀，未包含語音／重試。精簡提示詞本身尚無同集A/B節省證據。
- 下一步整合需分開完整核對紀錄與語音用關鍵情節提示，解決現有2600字元限制，保留角色、順序、間隔、否定與轉折，不截尾。原文特殊句須連同上下文解讀，不把孤立引句反轉成作者原則。
- 詳細證據及限制見 `docs/EPISODE_FACTS.md`、`work/qbq_codex_benchmark_20261008/ASSESSMENT.md`。本輪只評估讀書／回查／快取，沒有生成新語音、替換Drive、部署或提交git。
