# Axial Deployment Plan

## Decision

Deploy the playable web app to Cloudflare Pages at `playaxial.dev`.

Why Cloudflare:

- SvelteKit has an official Cloudflare adapter and Cloudflare Pages build preset.
- The `.dev` domain requires HTTPS, and Cloudflare will issue/manage certificates for the Pages custom domain.
- Future live multiplayer maps cleanly to Cloudflare Workers plus Durable Objects, where one Durable Object can coordinate a room's two live players.

## Current Production Target

- Registrar: Porkbun.
- Public domain: `playaxial.dev`.
- DNS host: Cloudflare, once Caden changes the Porkbun nameservers to the pair Cloudflare assigns for the zone.
- Frontend host: Cloudflare Pages.
- Pages project name: `playaxial` unless Caden wants a different dashboard label.

## Cloudflare Pages Build Settings

Use these values when creating the Pages project from Git:

```text
Framework preset: SvelteKit
Production branch: main
Root directory: axial-web
Build command: pnpm build
Build output directory: apps/web/.svelte-kit/cloudflare
```

Environment variables:

```text
PNPM_VERSION=10.32.1
```

Runtime compatibility flags:

```text
nodejs_als
```

The repository pins Node with `axial-web/.node-version`, currently matching local development at Node `24.13.0`.

After the first successful deployment, add `playaxial.dev` under the Pages project's Custom domains tab. For the apex domain, Cloudflare expects the domain to be a Cloudflare zone, so Porkbun should keep registrar ownership while Cloudflare becomes the authoritative DNS provider.

## DNS Setup

Recommended path:

1. Add `playaxial.dev` as a site in Cloudflare.
2. Cloudflare will show two assigned nameservers.
3. In Porkbun, open `playaxial.dev` details and replace the default Porkbun nameservers with Cloudflare's assigned nameservers.
4. Wait for nameserver propagation.
5. In Cloudflare Pages, add `playaxial.dev` as the custom domain for the `playaxial` Pages project.
6. Optionally add `www.playaxial.dev` too, then redirect it to the apex domain.

Do not manually create only a CNAME in Porkbun for the apex domain. Cloudflare Pages supports external-DNS CNAME setup for subdomains, but its docs require apex Pages domains to be attached to a Cloudflare zone.

## Multiplayer Direction

Do not put real-time multiplayer inside the frontend bundle.

When ready, add a separate Cloudflare Worker app for room coordination:

- `apps/multiplayer-worker`: Worker entrypoint.
- Durable Object class per live room/code.
- Room IDs generated as short invite codes.
- Client route shape: `/room/[code]`.
- WebSocket endpoint shape: `/api/rooms/[code]/socket`.
- The Worker imports `@axial/core` so the server validates every move and broadcasts canonical game snapshots.
- Pages either calls the Worker through a service binding or the Worker is mounted under an `/api/*` route on `playaxial.dev`.

This keeps the current single-player deploy simple while leaving the architecture open for invite links, reconnects, spectators, and room persistence.

## Primary Sources Checked

- SvelteKit Cloudflare adapter: https://svelte.dev/docs/kit/adapter-cloudflare
- Cloudflare Pages SvelteKit guide: https://developers.cloudflare.com/pages/framework-guides/deploy-a-svelte-kit-site/
- Cloudflare Pages build settings and monorepos: https://developers.cloudflare.com/pages/configuration/build-configuration/ and https://developers.cloudflare.com/pages/configuration/monorepos/
- Cloudflare Pages custom domains: https://developers.cloudflare.com/pages/configuration/custom-domains/
- Cloudflare Durable Objects and WebSockets: https://developers.cloudflare.com/durable-objects/ and https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Google Registry `.dev` HTTPS policy: https://www.registry.google/policies/registration/dev/
