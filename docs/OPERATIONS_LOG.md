# Operations Log

## 2026-10-04 Gemini Notebook 工作室探查與錯誤更名修復

- 使用者截圖回報三個不同時長語音都成 EP01。對當時 resume-job 子程序 SIGSTOP，避免繼續改名／交付。只讀逐列提示詞確認七個 EP 唯一且來源數均 3，UUID／時長各自保留。
- 根因：新 audio_spark 圖示與讀取狀態混入標題，舊解析造成已正確更名仍判失敗；列表改名重排，fallback 舊 index 改錯列；panel 全域名稱存在又不代表原列成功。改以結構化標題、UUID、原列精確提交驗證與失去身分即停止；提示詞與下載傳遞 UUID，非標題欄狀態徽章仍保留。
- 正式碼 4904742、da0f904、e06e982 均 push。197 項隔離測試通過，狀態補強後 6 項相關重測通過；含 stale index、改名重排、另列同名不算成功、提交失敗、生成中／排程／失敗。未對正式刪除做破壞性驗證。
- 按提示詞 EP＋UUID 修復原名稱，reload 後七集逐一驗證名稱、身分、3來源、時長及可播放。第一轮 reload 的空清單被拒絕，等完整 hydration 後再核對，沒有假成功。
- book state 存乾淨 inventory／organized，停止父 bot、終止 paused 舊 child，再由持久 FIFO 恢復同一 job；略過企劃／來源上傳，保留七集與配樂，不重生音樂或語音。正式 log 再确认七集唯一可播放，七集全部下載且解碼／原時長通過，收集 7/7 並進入正常後製；交付狀態另行觀察。
- 備份 artifact_identity_20261004_223317、artifact_recovery_20261004_223914；bot active/running、NRestarts=0。操作細節與後續規則在 docs/GEMINI_NOTEBOOK_UI_20261004.md；其他 dirty 修改未納入提交。

## 2026-10-04 新增筆記本 UI 相容修正

- 確認兩個正式 Chrome 首頁都有可見且可用的「新增筆記本」，button 沒有 href。書籍與主題舊 selector 都漏掉新名稱；不是已證明的網路逾時。官方流程來源：https://support.google.com/gemininotebook/answer/16206563?hl=zh-Hant 。
- 共用完整名稱比對、舊中英文相容、排除非建立筆記本／隱藏／停用與歧義。正式程式替換並 commit／push `4793a95a6e93102f02d770dbbe2a42e28b8b4ff7`；191 項隔離單元測試通過，新增 Chrome headless 离線 DOM 回歸含 9 子案例；18800／18801 實際新按鈕唯讀匹配成功，不點擊。
- 首輪測試發現 AST 抽取的帳號測試不含新 import；未部署即停止。將主題帳號檢查前移至控制項等待前，強化不符帳號立即停止，完整重測通過。所有隔離測試 ELEVENMUSIC_DISABLE_BROWSER=1，未消耗音樂／語音額度。
- 只提交本次 topic selector 差異，nblm_cdp.py 既有域名修改及 nblm_monitor.py dirty 保留；未重啟 bot、未按 Telegram 回復、未發訊或新建測試筆記本。下次 worker 會讀新程式。完整書籍流程仍待原任務恢復驗證。

## 2026-10-04 ElevenMusic 書籍配樂正式切換

- 使用者確認主題版採固定音樂風格，因此不修改主題版分類曲庫；書籍版才替換 Suno。詳細決策、恢復、額度及測試事故見 `docs/ELEVENMUSIC_INTEGRATION.md`。
- news-vm 正式製書 commit／push `41f52f9d63a3dce7c49542b47369ae4c9ffcc238`，190 項隔離測試通過，bot 重啟 active/running、NRestarts=0。備份 `/home/vboxuser/nblm-account-backups/elevenmusic_20261004_162150`，原 nblm_cdp.py／nblm_monitor.py dirty 保留。
- 書籍配樂 v2.5／單首／60 秒／Instrumental，提交前保存意圖、精確曲目群組尋回、不自動重送；不足／忙碌／失敗退回曲庫。下載驗證後入庫，署名傳遞到信用檔、Drive、原交付訊息及混音 metadata。
- 先前一轮隔離測試因硬編碼 production import 路徑誤用正式舊測試，造成兩首 Test Book 音樂生成，該輪部署中止；現修正相對 import、完整 discovery 與 ELEVENMUSIC_DISABLE_BROWSER=1 guard。兩曲未發布／交付、未刪除；最新唯讀預檢生成 22、Download 3 left，不推論固定額度。
- 播放器可見署名已提交／推送 `f019061`；本機 typecheck、37 項測試、lint 與 build 通過（lint 保留既有工具檔一項 warning）。從該提交的乾淨 archive 部署，未帶入本機其他 dirty／helper／音樂檔。
- Vercel deployment `https://ai-narrator-web-player-aruen46ly-chianwu-4755s-projects.vercel.app` 建置成功並 alias 正式網址。正式 login HTTP 200、未登入 library HTTP 401。首次正常整本書端到端流程仍待實務驗證，未額外生成測試曲或發測試訊息。

This file records significant project changes for future AI handoff. It is not a full chat transcript.

## 2026-08-08 Add repo-local AI memory entrypoint

Status: completed
Changed by: Codex
Related task: AI memory system discussion and rollout

Summary:

- Added `AGENTS.md` for Codex startup rules.
- Added `CLAUDE.md` for Claude Code startup rules.
- Added `docs/PROJECT_MEMORY.md` as the project-level source of truth for future AI sessions.
- Added `docs/RUNBOOK.md` as the operational runbook index.
- Created this operations log.

Important notes captured:

- Current production audio architecture uses Cloudflare Worker for audio bytes and Vercel as token broker.
- Older docs initially mentioned Vercel audio proxy; this was later reconciled in the 2026-08-08 audio-delivery docs entry below.
- Secrets, invitation-code plaintext, admin-code plaintext, service role keys, and private keys must not be written into memory docs.

Validation:

- Files were added through patch, not shell redirection.
- UTF-8 readability was checked after writing.

Follow-up:

- Completed later on 2026-08-08: audio-delivery wording was reconciled in `README.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/VERCEL.md`, and `docs/PROJECT_MEMORY.md`.

## 2026-08-08 《臺灣漫遊錄》每日 TTS 產線接續

Status: quota-blocked after successful episode delivery
Changed by: Codex
Related task: Gemini TTS 小說有聲書每日自動製作

Summary:

- 從 EP06 Request 04 精確接續，完成 EP06 Request 04～05、EP07 Request 01～05、EP08 Request 01～05。
- EP06、EP07、EP08 均完成母帶格式、聲音活動、持續靜音、零振幅拼接邊界與 SHA-256 驗證。
- 三集都已轉成 MP3 並上傳至 `gdrive:aitalktoyou_book/臺灣漫遊錄`，遠端大小與 SHA-256 均經 rclone 驗證。
- 已完成 EP09〈五、肉臊（上）〉五段 TTS 稿、發音表、聲線分配與 manifest 準備。
- EP09 Request 01 實際收到 HTTP 429 `RESOURCE_EXHAUSTED` 後立即停止，沒有重試，沒有產生該段 WAV 或 metadata。

Delivery records:

- EP06 `EP06_麻薏湯（下）.mp3`：Drive file id `1Ip_M3RLvX4wNKE_coyueceGltNI49EFf`，remote SHA-256 `d6b147dc0c01f7427e95a65317b0dd92b38ba537f94cb4e86f3b8265d495ca2f`。
- EP07 `EP07_生魚片（上）.mp3`：Drive file id `1gtv6P9FAcNUJoPPPZHe3_5sG8Pc-7oje`，remote SHA-256 `281f9f2120bba1b5c433841014fe692714fe32a0cf9c04970979fd5e137d6f65`。
- EP08 `EP08_生魚片（下）.mp3`：Drive file id `1huZr-8zn88fyz74aqj-oBix5EiDBhdBm`，remote SHA-256 `355114bf847c847b69a6ac09f133fa6a3868081d79660ea0dae5f01899d14cf6`。

Exact continuation point:

- 下次排程從 `work/quality_review/taiwan_travelogue_ep09_rou_sao/ep09_request01.txt` 開始。
- 送出前先確認 `ep09_request01.wav` 與 `ep09_request01.json` 仍不存在；若不存在，只送出一次正式請求。
- EP08 章名區有三秒與六秒低訊號停頓；EP07／EP08 的機械聲、專名／外來語發音及整體節奏仍待人工試聽。

## 2026-08-08 Reconcile repo-local memory and audio delivery docs

Status: completed
Changed by: Codex
Related task: AI memory system onboarding consolidation

Summary:

- Reconciled `README.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, and `docs/VERCEL.md` with the current Cloudflare Worker production audio-delivery architecture.
- Updated `docs/PROJECT_MEMORY.md` so it no longer warns that those files still contain stale Vercel audio proxy wording.
- Added the Cloudflare Worker audio environment variables to `.env.example` and replaced the example Drive root folder ID with a placeholder.

Important notes captured:

- Production audio bytes should stream through Cloudflare Worker with short-lived signed URLs and Range requests.
- Vercel remains responsible for listener authentication, library APIs, signed URL issuance, and the Drive token broker.
- The old Vercel audio route remains only as fallback for environments without Worker configuration.
- Real folder IDs, secrets, access codes, service role keys, private keys, and Worker signing / broker secrets must not be committed or written into memory.

Validation:

- The reconciliation was checked against `docs/VERCEL_HOBBY_TRAFFIC_FIX.md` and `cloudflare/audio-worker/README.md`.

## 2026-08-08 Triage local untracked artifacts

Status: completed
Changed by: Codex
Related task: AI memory system onboarding consolidation

Summary:

- Classified remaining untracked files after commit `484b0db`.
- Added `.gitignore` rules for local Codex scratch files, generated work outputs, deliverables, PDF inspection artifacts, Python cache files, and local-only helper / recommendation files.
- Did not delete, move, or modify the ignored artifacts.

Classification:

- `/.codex_*`, `/__pycache__/`, `/tmp_pdf_inspect/`, `/work/`, and `/deliverables/` are local scratch, generated output, cache, or bulky production artifacts.
- `/docs/READING_RECOMMENDATIONS.md` is a personal recommendation note and should stay local/private unless explicitly promoted.
- `/tools/rg_lite.py` is a local fallback helper not referenced by the committed runbooks.

Next-time warnings:

- Do not assume ignored local artifacts are disposable; inspect before deletion.
- Promote any ignored file into repo history only after confirming its durable project value and checking for secrets or personal content.
