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
- `README.md` and `docs/ARCHITECTURE.md` may still contain older wording about Vercel audio proxy. Prefer `docs/VERCEL_HOBBY_TRAFFIC_FIX.md` for current audio-delivery truth until those docs are reconciled.

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

## Known stale or conflicting docs

Some older documents may predate the Cloudflare Worker audio migration:

- `README.md` currently mentions audio through Vercel Functions.
- `docs/ARCHITECTURE.md` currently contains older Vercel audio proxy wording.
- `docs/ROADMAP.md` may contain older notes saying audio still goes through Vercel.

Until those are updated, prefer:

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

