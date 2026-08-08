# Operations Log

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
