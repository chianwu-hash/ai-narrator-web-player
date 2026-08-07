# Private Drive audio Worker

This Worker validates a short-lived HMAC URL, obtains a Google OAuth access token from server-side service-account secrets, and streams one bounded Range directly from private Google Drive. It never makes Drive credentials available to the browser.

Copy `wrangler.toml.example` to `wrangler.toml`, set the three listed secrets with `wrangler secret put`, and deploy to the Cloudflare Workers Free plan. Use the resulting HTTPS URL as Vercel's `AUDIO_WORKER_URL`.

The same random `AUDIO_SIGNING_SECRET` (at least 32 characters) must be configured as a secret in both Vercel and this Worker. `ALLOWED_ORIGINS` is a comma-separated list and must include every production/preview origin that is allowed to play audio.
