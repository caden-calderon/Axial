# Announcement readiness: code and architecture review

Reviewed starting tree: `main` at `b272c28`, September 21, 2026. This review started read-only; the parent agent subsequently authorized narrow fixes for confirmed persistence and input-size failures. No deployment, branch, commit, or remote changes were made in this lane.

## Findings fixed in this working tree

### P2 — Browser storage failures interrupted hydration and AI turns

Before this change, `gameController.svelte.ts` read browser storage directly during hydration and wrote the active match before scheduling the AI response. With `localStorage.setItem` throwing `QuotaExceededError`, a valid human move was accepted and changed the current player to 2, but `finishPlacement` exited before `queueAiMove`. The UI showed the storage error as a move error; `aiThinking` was false and `aiError` empty, so the AI retry action was not available. Denied storage reads could instead abort initial hydration entirely. Online display-name writes could prevent room creation, while the client's former storage helpers caught method failures but not access to a denied storage getter.

Evidence: two temporary executable reproductions passed against the original behavior, checking the accepted move/current player, absence of an AI request, and thrown hydration error. These characterization tests were replaced by retained regression tests that assert successful gameplay.

Fix: `axial-web/apps/web/src/lib/browserStorage.ts` handles both getter and operation failures. Local match/preferences and Online credentials/snapshots use these shared helpers. The existing session-storage fallback remains. The parent agent updated tutorial storage access in `+page.svelte` to use the guarded getter. Failed storage access produces one explicit console warning per session explaining that saved games, preferences, and reconnect credentials may not persist. Current gameplay remains available; this does not claim persistence succeeded or guarantee recovery after a refresh if both backends fail.

Retained coverage:

- `gameController.lifecycle.test.ts`: quota failure still permits the AI response; denied storage getter permits hydration, a full AI turn, and reset.
- `onlineController.test.ts`: failed display-name persistence does not prevent room creation.
- `browserStorage.test.ts`: failure warning is emitted once; reads/writes/removals retain normal behavior.
- `client.persistence.test.ts`: denied local-storage getter still permits session-storage credential save/load/clear.

### P2 — Multiplayer body cap was applied after unbounded buffering

The previous `validation.ts:37` called `request.text()` before the 4096-character check. Chunked requests without Content-Length could be fully buffered first, and multibyte characters exceeded the intended byte limit. The socket handler parsed JSON without an application-size check.

Fix: `validation.ts:27` reads the body incrementally, counts incoming bytes, cancels the reader immediately after the limit is exceeded, and releases the lock. The same 4096-byte cap is enforced before WebSocket JSON parsing through `parseClientMessage` (`validation.ts:74`, used by `roomObject.ts:365`). The socket character-length check runs before UTF-8 encoding to avoid another unbounded allocation. Existing command validation and error envelopes remain intact. The runtime necessarily supplies an incoming socket message before the handler can inspect it; this cap bounds application parsing, not platform-level message reception.

Retained coverage in `test/validation.test.ts` checks cancellation after five 1024-byte chunks of a 1 MiB input, multibyte limits, an exactly 4096-byte valid payload with a split UTF-8 character, the Content-Length fast rejection, and empty/invalid JSON behavior. `test/roomObject.test.ts` verifies rejection over a real Worker socket followed by successful processing of a normal command on the same connection.

## Resource protections after owner authorization

The owner subsequently authorized creation limiting and expired-room cleanup using engineering judgment. The earlier open recommendations are now implemented in this working tree.

### Anonymous room creation limit

The parent lane added a Cloudflare rate-limit binding configured for 10 create attempts per 60 seconds, keyed by the trusted edge client address. Missing addresses share a limited bucket. The limit runs before body reading or room allocation, returns HTTP 429 with a 60-second retry hint, and fails closed if the limiter errors. Health/preflight and existing-room operations do not consume creation tokens.

Independent review found no actionable gap in the route/config/tests. Cloudflare documents this binding as approximate, eventually consistent, and local to each Cloudflare location; it is abuse resistance, not an exact global cost ceiling. Shared-network users also share the allowance. The live binding/account configuration remains a deployment verification item. Source: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/.

### Expired room retention and cleanup

`EXPIRED_RETENTION_MS` in `roomState.ts` sets a 24-hour grace period starting from the actual expired state's existing `expiresAt`. No new stored field or schema version is needed. `nextRoomAlarmAt` schedules expired rooms for cleanup instead of deleting their alarm. During grace, old links return `room-expired` and room creation treats the code as reserved.

`RoomObject.prepareRoom` handles expired records during startup and room access; it restores a missing cleanup alarm for legacy records still within grace and purges overdue records. The alarm handler takes the same cleanup path. `storage.deleteAll()` removes SQL data, events, names, credential hashes, and any KV data, and clears the alarm atomically under the existing June 2026 compatibility date. Cached state and session attachments are cleared. Thereafter old requests return `room-not-found`.

Schema creation is deferred for empty objects, so missing-room lookups and reads after purge do not create persistent empty tables. A future room creation initializes the schema and new credentials normally; old credentials cannot enter the replacement room. Existing expired objects that never receive a request or wakeup cannot be discovered by this per-object logic, so this is not a claim that all historical production records have already been purged. No production sweep or live data deletion occurred.

Four retained integration cases cover: absent schema on a fresh missing-room lookup; the grace boundary, full SQL/KV/alarm deletion and subsequent code reuse; preserving active rooms and scheduling natural expiry; and restoring legacy missing alarms followed by lazy cleanup on access. The creation test helper now uses distinct simulated client addresses so fixture setup does not exhaust the new creation-rate bucket; dedicated rate tests validate that policy separately.

Verification after the compatible dependency refresh: 15/15 focused room-object/state tests, Worker `tsc --noEmit`, scoped ESLint, formatting, and whitespace checks passed. Parent owns the final integrated Worker/browser gate.

Current primary references consulted:

- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/ — atomic SQLite deleteAll and compatibility-date alarm behavior.
- https://developers.cloudflare.com/durable-objects/api/alarms/ — at-least-once alarms and constructor scheduling constraints.
- https://developers.cloudflare.com/fundamentals/reference/http-headers/ — edge client-address behavior and same-zone Worker trust boundary.

## Architecture assessment

The core/AI/browser-controller/room-authority boundaries remain coherent. Pure game rules, a native AI worker, server-authoritative online commands, existing session-epoch protection, and existing scene-history handling can be retained for this launch. No framework rewrite or broad decomposition is justified by this review. Historical worker proxy-cloning and duplicate-snapshot-animation findings were inspected as already-fixed behavior, not re-reported as new defects.

Reviewed local hydration/save/undo/redo/AI scheduling, Worker request lifecycle and room retention, Online credential/fallback/terminal handling, and route presentation orchestration. This was a targeted release review, not an exhaustive security audit or an independent proof of every game rule. The parent agent owns initial-HTML metadata, the known multiline AI browser-test contract, broad browser verification, and current dependency advisories.

## Verification performed in this lane

- Original storage characterization: 2/2 passing reproductions of broken behavior before the fix; temporary file removed.
- Focused web regressions: 4 files, 28/28 tests passed.
- Multiplayer Worker suite: 4 files, 19/19 tests passed.
- Multiplayer Worker `tsc --noEmit`: passed.
- Multiplayer Worker Prettier/ESLint: passed.
- Latest Cloudflare Workers best-practices reference and latest published Workers type declarations were consulted for request-stream reader/cancellation handling. Reference: https://developers.cloudflare.com/workers/best-practices/workers-best-practices/.

These results precede the other lane's dependency refresh and do not substitute for the parent's final integrated gates. No production data or live shared state was modified.

## Independent review of the parent lane

Inspected `app.html`, the removed per-route titles/descriptions, and the new sharing/storage browser tests plus the revised multiline-AI regression. No actionable issue was found in those changes. The multiline check still proves native worker activity, a legal returned move, persisted turn advancement, and continued play after a completed line. The storage test checks actual AI completion for denied getter and quota errors. Static metadata now exists independently of JavaScript; this is separate from producing and verifying a rich-image social preview, which still needs the later approved asset pass.

Scoped ESLint for all changed/new web files in this lane and final whitespace verification also passed. The dependency-refresh agent was notified that this lane's tests were finished before its installation began.
