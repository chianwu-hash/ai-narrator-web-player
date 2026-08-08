# Runbook Index

Last reviewed: 2026-08-08

This file is the entry point for operational procedures. It avoids duplicating every runbook; read the linked document for the task area before making changes.

## Required first checks

Before operational changes:

1. Read `docs/PROJECT_MEMORY.md`.
2. Run `git status --short`.
3. Identify whether the task is local-only, production-facing, or VM-facing.
4. Do not deploy from a dirty or stale worktree unless the user explicitly authorizes the exact scope.

## Topic-specific runbooks

| Topic | Read first |
|---|---|
| Current production audio delivery and Vercel traffic fix | `docs/VERCEL_HOBBY_TRAFFIC_FIX.md`, `cloudflare/audio-worker/README.md` |
| Vercel and Google Drive setup | `docs/VERCEL.md` |
| Architecture overview | `docs/ARCHITECTURE.md`, then reconcile with `docs/PROJECT_MEMORY.md` for current audio delivery |
| Supabase cross-device sync | `docs/SUPABASE_SYNC.md` |
| Comments and admin comment management | `docs/ADMIN_COMMENTS.md` |
| Wish pool | `docs/WISH_POOL.md` |
| Device monitoring | `docs/DEVICE_MONITORING.md` |
| Play statistics / rankings | `docs/PLAY_STATS.md` |
| Telegram `/help` copy | `docs/TELEGRAM_HELP.md` |
| Roadmap and open tasks | `docs/ROADMAP.md` |
| Codex VM / remote workflow | `docs/codex-vm-runbook.md` |
| Gemini TTS fiction audiobook SOP | `docs/GEMINI_TTS_FICTION_AUDIOBOOK_SOP.md` |
| Qwen3 voice clone MVP | `docs/QWEN3_TTS_VOICE_CLONE_MVP.md` |

## Production audio delivery rule

Production audio bytes should stream through Cloudflare Worker, not Vercel Functions.

When touching audio:

1. Verify signed Worker URLs are generated only for authenticated users.
2. Verify Worker returns bounded Range responses with `206` where expected.
3. Verify Google service-account private key remains only in Vercel.
4. Verify browser does not send listener session cookies to Cloudflare.
5. Verify fallback behavior does not silently make Vercel the main production byte path.

## Telegram bot boundary

The website does not modify Telegram bot behavior by itself.

If updating Telegram `/help`:

1. Update or verify `docs/TELEGRAM_HELP.md`.
2. Locate the actual bot source on `news-vm:/home/vboxuser/nblm-audio`.
3. Apply bot-side changes there if authorized.
4. Restart or reload the user-level `nblm-bot.service` only when the user authorizes operational changes.

## Google Drive cover boundary

The admin cover page may create or update cover files inside a book folder. It must not move, rename, or delete unrelated Drive files.

For cover upload failures:

1. Check service account folder permission.
2. Viewer permission is enough for reading.
3. Editor permission is required for `/admin/covers` replacement.
4. Do not broaden Drive access beyond the intended library root.

## Supabase privacy boundary

Do not add features that record individual listening history by user, device, IP, book, episode, or playback timeline unless the user explicitly changes the privacy policy.

Allowed current data:

- anonymous sync profile state
- public comments
- anonymous wish entries
- anonymous device activity count / last active time
- content-level play rankings

## Memory update rule

After a major change, update:

- `docs/PROJECT_MEMORY.md` for durable decisions
- `docs/OPERATIONS_LOG.md` for dated operations
- specific topic docs if the old wording would mislead future agents

