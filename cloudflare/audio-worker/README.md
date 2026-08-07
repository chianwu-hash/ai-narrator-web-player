# Private Drive audio Worker

This Worker validates a short-lived HMAC URL, obtains a short-lived Google Drive read-only OAuth token from the Vercel token broker, and streams one bounded Range directly from private Google Drive. The Google service-account private key stays only in Vercel and is never copied to Cloudflare or exposed to the browser.

Copy `wrangler.toml.example` to `wrangler.toml`, set the two listed secrets with `wrangler secret put`, and deploy to the Cloudflare Workers Free plan. Use the resulting HTTPS URL as Vercel's `AUDIO_WORKER_URL`.

The same random `AUDIO_SIGNING_SECRET` (at least 32 characters) must be configured as a secret in both Vercel and this Worker. A separate random `AUDIO_TOKEN_BROKER_SECRET` (also at least 32 characters) authenticates Worker-to-Vercel token requests and must likewise match in both environments. Set `AUDIO_TOKEN_BROKER_URL` to the Vercel origin's `/api/worker/drive-token` endpoint. `ALLOWED_ORIGINS` is a comma-separated list and must include every production/preview origin that is allowed to play audio.
