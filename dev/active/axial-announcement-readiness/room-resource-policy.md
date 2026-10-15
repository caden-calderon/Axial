# Room creation and retention policy

Caden delegated these choices in the announcement-readiness follow-up. Implemented locally; not deployed and no live data has been deleted.

## Creation

Allow **10 room-creation attempts per 60 seconds per network address**, using a Cloudflare rate-limit binding before body parsing or Durable Object creation. Return the existing `rate-limited` protocol error with HTTP 429, `Retry-After: 60`, and a readable retry message. Health, preflight, joining, reconnecting, commands and rematches do not spend creation tokens. If the limiter fails, creation fails through the normal error response; it does not bypass protection.

Use Cloudflare's `CF-Connecting-IP`, not a request-body identifier or `X-Forwarded-For`. Requests without that header share an `unknown` bucket, so local/service callers cannot bypass the limit by omitting it. There is no application IP table and addresses are not added to request logs.

The game has no authenticated accounts before room creation. An IP limit is a practical first control for this anonymous route, but people behind one network share the allowance. Ten attempts per minute gives ordinary two-player sessions ample room; repeated games can use rematches. Revisit the threshold if logs show legitimate 429 responses. The binding namespace is `1084783157`, with an Axial-specific key prefix; preserve this configuration across releases.

Cloudflare's limiter is approximate, eventually consistent and local to a Cloudflare location. This is burst protection, not an exact worldwide quota or a complete distributed-abuse/billing safeguard. The [rate-limit documentation](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) explains those semantics and the shared-IP tradeoff. No new CAPTCHA or login flow is introduced.

## Retention

Keep expired room data for **24 hours after its recorded expiry**, then delete its stored state, player names, credential hashes, event history and schema. The existing active/waiting/ended TTL rules are unchanged. During the grace period, the code remains reserved and old clients receive the room-expired response. After cleanup, old invites receive room-not-found. A future randomly generated room may reuse the code, with fresh credentials; old credentials do not authenticate into it.

Use the room's existing alarm and `expiresAt` timestamp, without adding a database field or a new scheduler. Cleanup clears the in-memory state too. Schema creation occurs only when creating a room, so requests for nonexistent or already-cleaned rooms do not recreate stored tables.

Legacy expired rooms can have no alarm. Access repairs their cleanup alarm, or deletes already-overdue data immediately. An untouched, already-dormant legacy object cannot be swept by this code without a separate object inventory/operational pass. No live sweep is included or claimed. New expiry events receive cleanup alarms automatically once this code is deployed.

## Validation

Final workspace check and lint passed. All **29 Worker tests passed**, and the deployment dry run bundled the Worker successfully with the configured 10-per-60-second binding. A fresh production frontend build and the focused browser run passed **2/2** with one worker and no retries: visible rate-limit feedback with continued local play, and the real two-client creation/countdown/move/reconnect/leave flow. The first browser attempt matched both displayed error copies; the corrected test targets the accessible alert and the complete rerun passed.

Retained tests cover denial before body consumption, retry/CORS headers, missing-IP behavior, allowed creation, unrelated routes, limiter failure, the configured allowance and independent buckets. Alarm tests cover grace periods, deletion, old credentials, code reuse and legacy alarm repair. The browser rate-limit response is mocked to test UI behavior; the Worker tests separately exercise the actual configured local binding.
