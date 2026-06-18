# AGENTS.md - Engineering Configuration

## Project Overlay - Axial

Axial is a browser-native rebuild of a 3D strategy game. The active web app lives in `axial-web/apps/web`; the preserved Unity project lives in `axial-unity/`.

Project stack:

- SvelteKit, Svelte 5, TypeScript, pnpm
- Tailwind 4, lucide-svelte
- Three.js and Threlte for the 3D board scene
- Pure TypeScript game/AI packages under `axial-web/packages`
- Cloudflare Pages deployment with `@sveltejs/adapter-cloudflare`

Common commands:

- `cd axial-web && pnpm dev`
- `cd axial-web && pnpm check`
- `cd axial-web && pnpm lint`
- `cd axial-web && pnpm test`
- `cd axial-web && pnpm build`
- `cd axial-web && pnpm smoke:production`

For Axial web UI, gameplay feel, animation, 3D board composition, portfolio iframe/embed polish, and browser visual QA, prefer the existing Svelte/Threlte patterns and the Codex Browser workflow when available. Do not pull Axial into another repo unless explicitly asked.

Owner: Caden | Updated: February 2026

Philosophy: Plan first. Think thoroughly. Test everything. Build for the future.

## Developer Profile

Role: Creative Technologist / Software Engineer (CS, AI/ML focus)

Mindset: Staff-engineer thinking. Plan before building. Every decision should consider maintainability, extensibility, and correctness.

Stack: Polyglot - Python, Rust, C/C++, C#, TypeScript/JS, and whatever the project needs.

## Core Principles

### 1. Plan First, Always

Never write code without understanding the problem space first.

- Non-trivial tasks: discuss architecture, explore alternatives, and document decisions before writing code.
- Trivial tasks: still do a quick mental check and flag concerns if any.
- Use `dev/active/[task]/` docs for anything spanning multiple sessions:
  - `plan.md` - decisions, architecture, trade-offs considered.
  - `context.md` - current state for session continuity.
  - `tasks.md` - checklist of what is done and pending.

### 2. Think Thoroughly

Approach problems like a staff engineer reviewing a design doc.

- Consider edge cases, failure modes, and second-order effects before implementing.
- Challenge assumptions constructively and propose 2-3 options when architecture matters.
- Think out loud on complex decisions.
- When uncertain about an API or library, verify with docs rather than guessing.

### 3. Always Test

Code without tests is unfinished code.

- Write tests alongside implementation, not as an afterthought.
- Test boundaries: happy path, error cases, and edge cases.
- Run existing tests before and after changes to catch regressions.
- If a project has no test infrastructure, flag it and propose one.

### 4. Never Cut Corners

Quality and speed come from good planning, not from skipping steps.

- No TODO/FIXME debt without explicit acknowledgment.
- No "it works on my machine" - think about environments, CI, and reproducibility.
- No silencing errors or swallowing exceptions without justification.
- No deprecated patterns without warning first.
- No breaking changes without explicit approval.

### 5. Build for the Future

Every change should leave the codebase better than it was found.

- Design interfaces and abstractions that accommodate reasonable future growth.
- Choose well-maintained dependencies and flag anything abandoned or risky.
- Write code that other engineers can read, modify, and extend.
- Document the "why" in comments, not the "what".

## Workflow

### Partnership Dynamic

We are collaborators, not prompter/executor. Challenge ideas when you see flaws. Ask clarifying questions when requirements are ambiguous.

### Phase Discipline

```text
IDLE -> PLANNING -> ARCHITECTURE -> IMPLEMENTING -> REVIEWING -> IDLE
```

Do not skip phases. If Caden says "just build X quickly", still do a quick architecture check and flag concerns before proceeding.

## Code Style

### Universal

- Readability over cleverness.
- Descriptive names, minimal comments. Comment the "why".
- Strong typing where the language supports it.
- Consistent formatting using the project's formatter/linter.

### Python

- Use type hints.
- Prefer `pathlib` over `os.path`.
- Use dataclasses or Pydantic for data structures.
- Use Ruff for linting and pytest for testing.
- For PyTorch, use explicit device management and tensor shape comments.

### Rust

- Follow standard Rust idioms.
- Run `cargo fmt` and `cargo clippy`.
- Prefer `Result`/`Option` over panics.
- Derive traits generously.

### C/C++

- Prefer modern C++ 17/20 where possible.
- Use RAII and smart pointers.
- Use CMake unless the project dictates otherwise.

### TypeScript/JavaScript

- Use ES modules.
- Use TypeScript where possible.
- Use strict mode.
- Clean up resources such as event listeners, subscriptions, and Three.js objects.

### C# / Unity

- Use PascalCase for public members and `_camelCase` for private members.
- Prefer ScriptableObjects for config.
- Prefer events/delegates over tight coupling.

## Communication

- Be direct, technical, and concise.
- Think out loud on complex decisions.

## Codex Browser Use

When a task asks to use the Codex app's in-app browser, use the bundled Browser Use plugin rather than external Playwright, shell browser open commands, or Computer Use fallback.

- Read and follow the current Browser Use skill before browser work.
- Use the plugin/runtime path exposed in the current session; do not assume legacy `js_repl` tools exist.
- If Browser Use fails, report the concrete plugin/runtime error before choosing any fallback.
