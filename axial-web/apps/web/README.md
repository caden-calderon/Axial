# Axial frontend

The SvelteKit application for [Axial](https://playaxial.dev), built with Svelte 5, TypeScript, Three.js, Threlte, and Tailwind CSS. Start with the [workspace engineering guide](../../README.md) for installation, game rules, the local multiplayer service, and verification commands.

## Development

Install dependencies from the workspace root (`axial-web/`) with `pnpm install --frozen-lockfile`, then run:

```sh
pnpm --filter @axial/web dev --host 127.0.0.1
```

The frontend imports `@axial/core`, `@axial/ai`, and `@axial/multiplayer-protocol` from the same workspace. Local and AI matches require no backend; Online uses the separate `apps/multiplayer-worker` service.

## Source map

| Location                  | Responsibility                                                          |
| ------------------------- | ----------------------------------------------------------------------- |
| `src/routes/+page.svelte` | Main game surface and mode orchestration                                |
| `src/routes/layout.css`   | Shared layout, visual styling, and responsive behavior                  |
| `src/lib/game/state/`     | Match lifecycle, persistence, preferences, and AI worker coordination   |
| `src/lib/game/scene/`     | Board rendering, camera, picking, and animation                         |
| `src/lib/game/audio/`     | Optional procedural Web Audio                                           |
| `src/lib/game/bridge/`    | Validated messaging for portfolio iframe integration                    |
| `src/lib/multiplayer/`    | Room client, transport, reconnect, and synchronization                  |
| `e2e/`                    | Playwright interaction and integration tests                            |
| `static/`                 | App icons, install metadata, locally served fonts, and embed smoke page |

## Configuration

`PUBLIC_AXIAL_MULTIPLAYER_API` overrides the room service URL. Without an override, local development uses the current hostname on port 8787; production uses the frontend's origin.

`PUBLIC_AXIAL_BRIDGE_ORIGINS` is the comma-separated allow-list for external parents using the optional iframe bridge. The bridge activates only when framed with `?embed=1&bridge=1`. These variables are public configuration and must not contain secrets.

## Checks and build

From the workspace root:

```sh
pnpm --filter @axial/web check
pnpm --filter @axial/web lint
pnpm --filter @axial/web test:unit -- --run
pnpm --filter @axial/web test:e2e
pnpm --filter @axial/web build
```

Playwright builds and serves a production preview and starts the local multiplayer Worker; see [the workspace verification notes](../../README.md#verification) for ports and browser prerequisites. The SvelteKit Cloudflare adapter is already configured. Hosting details and historical deployment notes are in [deployment.md](../../../dev/archive/axial-web-rebuild/deployment.md).
