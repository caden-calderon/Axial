# Multiplayer recovery pass

## Existing architecture

The web app uses `createOnlineController` to own room credentials, cached snapshots, connection state, setup, countdowns, and rematch state. It reconnects through a WebSocket and polls HTTPS every 2.5 seconds when the socket is unavailable. Session epochs already discard responses from abandoned sessions; snapshot revisions prevent older room state replacing newer state.

The backend is a Cloudflare Worker with one SQLite Durable Object per room. It owns Classic rules, move validation, readiness, start/countdown, alternating rematch starters, reconnect token hashes, duplicate socket ownership, HTTP presence leases, and room expiry. Local/AI play does not depend on the backend.

## Fixed

- HTTP fallback treated expired rooms, missing rooms, invalid credentials, and unsupported protocols as transient transport failures. It kept retrying and reconnecting indefinitely. Both transports now share terminal-error handling and stop timers/sockets when recovery cannot succeed.
- A terminal session now invalidates its epoch, so already pending HTTP responses and late socket callbacks cannot revive it.
- Room expiry and connection failure now take precedence in the status text. The final board remains visible, while move/setup/rematch actions and turn indicators stop.
- Expired room credentials are removed; the final expired snapshot remains available for display/inspection. Authentication failure clears unusable cached credentials/snapshot. A duplicate tab does **not** clear shared credentials, preserving the newer tab's reconnect ability.
- A stale-revision rejection requests a fresh snapshot. It does not retry the rejected move automatically. Players choose their next move against the refreshed board.

No protocol or Worker changes were necessary.

## Verification

- Worker baseline before edits: 3 test files, 11 tests passed.
- Local service audit: eight disposable rooms, each receiving four simultaneous join requests. Every room accepted one guest and rejected the remaining three with 409. Audit rooms were explicitly expired afterward.
- Added 12 controller transport tests using the actual Svelte module with mocked network clients and fake timers. Cases cover HTTP terminal errors, duplicate-tab takeover, late socket callbacks, in-flight HTTP responses, action gating, expired snapshots, WebSocket/HTTP stale-revision recovery, and transient network recovery.
- Multiplayer web tests: 2 files, 15 tests passed.
- Web Svelte check: 0 errors, 0 warnings.
- ESLint passed for both changed multiplayer TypeScript files; Prettier applied.

## Follow-ups identified, not changed

- Command IDs exist in the protocol, but the server does not maintain an idempotency receipt ledger. The current client sends expected revisions for moves, so ordinary duplicate submissions are rejected by revision/turn validation. Deduplication would improve future retry semantics but was not required for this recovery fix.
- Some room methods read state before awaiting token hashing/authentication. Cloudflare documents that synchronous SQLite work is atomic, while asynchronous work may yield. The concurrent join probes did not reproduce lost updates. Treat this as an unproven audit concern, not a confirmed bug or a reason to add broad locking.
- HTTP input is buffered before the 4 KB limit is enforced; WebSocket text messages lack an explicit size cap.

Concurrency reference reviewed: https://developers.cloudflare.com/durable-objects/api/state/
