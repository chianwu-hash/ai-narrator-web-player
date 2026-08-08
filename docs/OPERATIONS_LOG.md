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
- Older docs may still mention Vercel audio proxy; future agents should prefer `docs/VERCEL_HOBBY_TRAFFIC_FIX.md` for current audio-delivery truth.
- Secrets, invitation-code plaintext, admin-code plaintext, service role keys, and private keys must not be written into memory docs.

Validation:

- Files were added through patch, not shell redirection.
- UTF-8 readability was checked after writing.

Follow-up:

- Reconcile older audio wording in `README.md`, `docs/ARCHITECTURE.md`, and `docs/ROADMAP.md` when the user wants documentation cleanup.

