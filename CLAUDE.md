# CLAUDE.md

This repository uses repo-local memory. Before making changes, Claude Code must read the project memory documents listed below.

## Required startup steps

1. Read `docs/PROJECT_MEMORY.md`.
2. Read `docs/RUNBOOK.md` when the task involves deployment, infrastructure, audio streaming, Cloudflare, Vercel, Google Drive, Supabase, Telegram, auth, admin pages, or production behavior.
3. Read `docs/OPERATIONS_LOG.md` when recent work may matter.
4. Treat repository memory documents as the source of truth over chat memory.
5. Do not overwrite unrelated user changes.

## Memory update policy

Update memory docs after important changes to:

- architecture
- deployment
- production behavior
- external services
- security, legal, or privacy policy
- recurring workflow
- confirmed bug root cause

Never write secrets, tokens, passwords, invitation codes, admin codes, API keys, service role keys, or private keys.

