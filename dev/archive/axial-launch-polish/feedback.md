# Feedback

Players open **Feedback** from the settings panel, pick Bug, Idea or Review, write 10 to 2,000 characters and optionally leave a name and an email for a reply. The message is emailed to Caden.

## Flow

1. `FeedbackDialog.svelte` validates the same limits as the server. The draft lives at module scope, so closing the dialog by accident keeps it; a successful send clears only the message.
2. `lib/feedback/turnstile.ts` loads Cloudflare's script on first send and renders a fresh invisible widget per attempt (action `feedback`), so a retry never reuses a spent token. Dev builds use the always-pass test key `1x00000000000000000000BB`.
3. `sendFeedback` in `lib/multiplayer/client.ts` posts to `/api/feedback` on the room Worker, which already had origin checks and rate limiting.
4. `handleFeedback` in `apps/multiplayer-worker/src/index.ts`, in order: parse and validate (`src/feedback.ts`), silently accept a filled honeypot without sending, apply the per-network then site-wide limiter, check secrets are configured, verify the Turnstile token with `siteverify`, then send.
5. The email is plain text from `feedback@playaxial.dev`, subject `[Axial <kind>] <first 60 characters>`, Reply-To set to the player's address when given. It includes game mode, viewport, build, browser and country to help reproduce bugs. The form says so.

## Spam protection

| Layer       | Detail                                                                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Turnstile   | Invisible widget; server-side `siteverify` with the player's IP; tokens are single use and checked for the `feedback` action.                                                            |
| Rate limits | `FEEDBACK_LIMITER` 3/min per network address; `FEEDBACK_GLOBAL_LIMITER` 10/min site-wide. Checked after validation so a typo doesn't use an attempt.                                     |
| Honeypot    | Off-screen `website` field. Filled → 202 with nothing sent, so bots learn nothing.                                                                                                       |
| Content     | 10–2,000 characters, at most 3 links, control characters removed; single-line fields have line breaks collapsed (no header injection). Strict email check for Reply-To. 16 KiB body cap. |
| Origin      | The Worker's existing `ALLOWED_ORIGINS` check.                                                                                                                                           |

Failures are never reported as success: an unreachable Turnstile or a failed send returns 503 with a plain sentence, and a failed send logs the full message (Workers observability) so it isn't lost.

## Cloudflare setup

Done on 2026-10-22; repeat only when rebuilding the account.

- Email Sending (arbitrary recipients) needs Workers Paid, so delivery uses **Email Routing**, which can send free to verified destination addresses. `wrangler email routing enable playaxial.dev` (the zone had no MX records), then `wrangler email routing addresses create <address>`. The account owner's address verifies immediately; any other address gets a verification email.
- The `FEEDBACK_EMAIL` send_email binding in `wrangler.jsonc` only allows the sender `feedback@playaxial.dev`. The recipient comes from the `FEEDBACK_RECIPIENT` secret so the address stays out of the repository.
- Turnstile widget "Axial feedback", invisible mode, domains `playaxial.dev`, `localhost`, `127.0.0.1`. The site key is public and lives in `turnstile.ts`; the secret is the `TURNSTILE_SECRET` Worker secret.
- Secrets: `wrangler secret put TURNSTILE_SECRET` and `wrangler secret put FEEDBACK_RECIPIENT` in `apps/multiplayer-worker`. Locally, copy `.dev.vars.example` to `.dev.vars` (Turnstile test secret; `wrangler dev` writes mail to a file).
- On NixOS, local `wrangler dev` can't verify TLS for outbound fetches (siteverify) unless started with `SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt`.

## Testing

`test/feedback.test.ts` covers parsing, email composition, Turnstile results, the honeypot, both limiters, delivery failure, missing secrets and origin rejection. `e2e/feedback.e2e.ts` stubs the Turnstile script and the `/api/feedback` route, so it sends nothing even against production.
