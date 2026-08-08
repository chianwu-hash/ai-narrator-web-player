# AGENTS.md

This repository uses repo-local memory. Before making changes, Codex must read the project memory documents listed below.

## Required startup steps

1. Read `docs/PROJECT_MEMORY.md`.
2. If the task involves deployment, audio streaming, Cloudflare, Vercel, Google Drive, Supabase, Telegram, admin pages, production behavior, auth, or data privacy, also read the relevant runbook documents listed in `docs/RUNBOOK.md`.
3. If the task may conflict with recent work, inspect `docs/OPERATIONS_LOG.md`, recent git history, and current `git status`.
4. Treat repository memory documents as the source of truth over chat memory.
5. Preserve unrelated user changes. This repository may contain dirty worktree changes and temporary Codex helper files; do not overwrite or clean them unless the user explicitly authorizes it.

## Memory update policy

After significant work, update memory docs when the task changes:

- architecture
- deployment flow
- production behavior
- external service integration
- security, legal, or privacy policy
- recurring workflow
- root cause of a production bug
- project terminology

Do not write secrets, tokens, passwords, invitation codes, admin codes, API keys, service role keys, or private keys into memory documents.

## Communication

Respond to the user in Traditional Chinese unless the user asks otherwise.

