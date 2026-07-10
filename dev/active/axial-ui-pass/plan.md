# Axial UI Pass Plan

Status: implemented and locally verified; awaiting product review and real-device PWA smoke.

Date: 2026-07-09

## Outcome

Turn the current polished Axial build into a genuinely first-class desktop and mobile game surface without replacing its identity. The board remains the hero. The pass should improve responsive framing, mobile reachability, learnability, accessibility, light-theme parity, and state-driven motion while preserving local, AI, Tactical, Online, PWA, and portfolio-bridge behavior.

## Executive Assessment

Axial does not need a wholesale redesign. The dark-mode board, restrained acrylic chrome, welcome card, completed-line choreography, online start/rematch overlays, and compact desktop composition already feel intentional and distinctive. The deterministic Impeccable scan returned no generic UI anti-pattern findings.

The largest opportunity is the responsive product shell around that visual core:

- Coarse-pointer controls are visually crisp but materially undersized.
- Portrait and landscape share one compact camera preset, leaving the landscape board much too small.
- The right-side panel is dense and uses the same information architecture before, during, and after a match.
- The tutorial is polished, but it explains board interaction instead of letting the player practice it, and it cannot be reopened from the normal UI.
- Modal overlays look complete but do not yet behave like complete keyboard-accessible modals.
- Light mode is usable, but the board loses depth and contrast relative to dark mode.

## Evidence From the Audit

Live review covered dark and light desktop, common laptop widths, phone portrait, small phone, minimum-width phone, phone landscape, tutorial steps, Local, Online setup, and Tactical controls.

Representative viewports:

- Desktop: 1673 x 1261, 1366 x 768, 1024 x 768.
- Mobile portrait: 390 x 844, 375 x 667, 320 x 568.
- Mobile landscape: 844 x 390.

Measured findings:

- The 390 x 844 Online panel exposed 33 visible interactive elements; every one was under 44 CSS pixels in at least one dimension.
- Mobile toolbar buttons measured 32 x 32 CSS pixels.
- Mobile form fields used a 12.16px computed font size, which risks iOS input zoom.
- The mobile turn pill is intentionally hidden while controls are collapsed; this is a preserved product decision, not a defect.
- At 320px width, the brand lockup and collapsed control pill overlap.
- At 844 x 390, the board occupies only a small central region because all coarse-pointer layouts use the same fixed camera position and scale.
- At 1366 x 768 and 1024 x 768, the expanded 260px panel uses very small labels and hides its scrollbar even when content continues below the fold.
- Keyboard Tab traversal enters background toolbar controls before the welcome-tour buttons and escapes the dialog after the final button.
- Lighthouse mobile accessibility scored 94. The two failures are prohibited `aria-label` attributes on the brand-title and board-dimensions spans.
- The PWA uses `black-translucent` status-bar mode but the main shell has no safe-area insets or dynamic viewport units.
- A local development trace observed LCP at 2.12s, almost entirely render delay. This is a development-build signal only; production tracing is required before performance work is prioritized.

## Preserve

- The playable 3D board as the dominant composition.
- The dark-mode visual identity and restrained acrylic material language.
- Existing piece drops, last-move cue, completed-line animation, result delay, and online countdown/rematch flow.
- The current Local, AI, Online, Classic, and Tactical contracts.
- Server-authoritative Online state and timing.
- Existing persistence, recovery, PWA, and portfolio-bridge behavior.
- The first welcome card's tone and sense of occasion.

## Non-goals

- No new game rules or multiplayer authority changes.
- No public matchmaking, accounts, chat, ranking, or Tactical Online expansion.
- No rewrite of the Three/Threlte scene stack.
- No generic design-system replacement or unrelated marketing site.
- No visual effects that reduce board readability or ignore reduced motion.

## Priority Findings

### P1: Touch targets and mobile type are too small

The compact rail optimized for fitting every control, not for comfortable use. Mode buttons, rule choices, toolbar actions, toggles, and Online inputs fall below touch guidance; inputs are small enough to trigger iOS zoom.

Direction: give coarse-pointer controls a 44px minimum target and 16px input text. Do not simply scale the existing rail; change the portrait control surface so the larger controls have room.

### P1: Camera framing is not responsive to the usable playfield

The scene only distinguishes compact versus non-compact. It does not account for aspect ratio, panel occlusion, mobile game bar, safe areas, or board dimensions. Landscape therefore wastes most of the viewport and medium desktop can place the board against or under the panel.

Direction: calculate a board-safe viewport rectangle and fit the camera to it. Use aspect ratio, dimensions, and UI insets rather than fixed compact camera constants.

### P1: Dialog accessibility is incomplete

The welcome tour, local result modal, and Online overlays use dialog markup visually, but background controls remain tabbable and focus is not reliably trapped or restored.

Direction: introduce one reusable modal primitive backed by native `showModal()`, explicit initial focus, Escape behavior, background inertness, focus restoration, and reduced-motion transitions. Treat the non-interactive Online countdown as an announced status surface rather than a focus trap.

### P2: The control panel has one information architecture for every state

Pre-match setup, live match controls, Online room actions, appearance, and lifetime session data share one long rail. Locked settings remain visible during play, Online creation is nested below rules, and hidden scrollbars conceal continuation on shorter screens.

Direction: make the control surface state-driven. Pre-match emphasizes match creation; active play condenses locked setup into a summary; Online promotes room actions; completed matches prioritize review/rematch. Preserve access to advanced settings through progressive disclosure.

### P2: Touch placement and tutorial copy disagree

Confirm-drop defaults off. On touch, the first tap commits a move, while onboarding says a tap previews the gravity drop.

Direction: default new coarse-pointer users to staged placement. First tap arms and previews; a second tap or the mobile game bar confirms. Preserve an existing saved preference and keep one-click desktop play.

### P2: The tutorial teaches controls more than spatial play

Seven attractive cards describe the board and menu, but the player never practices orbiting, zooming, previewing, or confirming. There is no normal in-product way to reopen help.

Direction: keep the welcome moment, then teach one camera gesture and one practice placement. Move secondary settings education into contextual tips. Add a persistent How to Play entry that can replay the tour and show rules/gesture references.

### P2: Light mode lacks the depth hierarchy of dark mode

The field, grid, intersections, and labels converge into a pale lavender layer. The layout survives, but spatial depth becomes harder to parse.

Direction: retune the light scene as its own palette, not an inverted dark scene. Increase depth falloff and foreground/background separation, reduce bright intersection noise, and verify player-piece contrast.

### P3: Motion is polished but too continuously decorative in a few places

Brand, dimensions, and turn copy all run synchronized perpetual shine. It is attractive, but constant movement competes with the game and adds little state meaning.

Direction: keep the signature shine, but trigger it on first load and turn/state changes. Spend motion budget on selection, turn handoff, Online arrival, and Tactical sequence feedback.

## Target Responsive Model

### Fine pointer, wide desktop

- Right-side rail remains the primary secondary-control surface.
- The rail uses a readable width and type scale.
- The camera fits the board inside the space left of the rail when it is open.
- The rail starts expanded only when both width and height can support it.

### Fine pointer, medium desktop/tablet

- The rail starts collapsed below an agreed usable-width/height threshold.
- Expanding it adjusts the scene safe rectangle instead of covering playable columns.
- Locked sections collapse into concise summaries once play begins.

### Coarse pointer, portrait

- Use an accessible bottom sheet with collapsed, partial, and full states rather than a narrow full-height right rail.
- Controls are at least 44px; input text is at least 16px.
- The collapsed composition remains intentionally minimal; contextual confirmation appears only while a touch move is armed.
- The board is framed between the top brand region and the bottom safe-area inset.

### Coarse pointer, landscape

- Keep a compact right-side rail or sheet because horizontal space is abundant.
- Fit the board to the available height and remaining width.
- Preserve the intentionally minimal collapsed state.

## Architecture

### 1. Usable playfield contract

Define typed UI insets for top, right, bottom, and left occlusion. The page owns the responsive chrome state and passes the resulting safe rectangle to the scene. A pure camera-fit helper converts safe-rectangle aspect ratio, board bounds, FOV, and board dimensions into camera position, target/view offset, distance limits, and board scale.

Likely files:

- `src/routes/+page.svelte`
- `src/lib/game/scene/AxialWorld.svelte`
- new `src/lib/game/scene/cameraFit.ts`
- `src/routes/layout.css`

### 2. Responsive control-surface contract

Keep the current section components, but render them inside a shared control-surface shell with desktop-rail and portrait-sheet layouts. The shell owns collapse/snap state, scroll affordance, safe areas, and focus behavior. Content selection remains semantic and state-driven rather than duplicated per viewport.

Likely files:

- `src/lib/game/ui/GameStatusPanel.svelte`
- `src/lib/game/ui/MatchSettingsPanel.svelte`
- `src/lib/game/ui/OnlineRoomPanel.svelte`
- `src/lib/game/ui/AppearancePanel.svelte`
- optional new `src/lib/game/ui/MobileConfirmBar.svelte`
- new `src/lib/game/ui/ControlSurfaceShell.svelte`
- `src/routes/layout.css`

### 3. Placement-input contract

Separate selection from commitment at the controller boundary. Pointer type and stored preference determine the default, but both desktop and mobile paths use the same explicit `select`, `confirm`, `cancel`, and `commit` semantics. The scene owns the spatial preview; a contextual confirmation surface appears only while a touch move is armed.

Likely files:

- `src/lib/game/state/gameController.svelte.ts`
- `src/lib/multiplayer/onlineController.svelte.ts`
- `src/lib/game/scene/ColumnPicker.svelte`
- `src/lib/game/scene/DropPreview.svelte`

### 4. Modal and help contract

Use one dialog shell for welcome, result, and interactive Online result surfaces. It owns native modal lifecycle, focus loop, focus restore, Escape policy, and reduced motion. Add a normal Help entry so the tour and concise rules can be reopened without query parameters.

Likely files:

- new `src/lib/game/ui/DialogShell.svelte`
- `src/lib/game/onboarding/WelcomeTourOverlay.svelte`
- `src/lib/game/onboarding/welcomeTourSteps.ts`
- `src/lib/game/ui/GameOverModal.svelte`
- `src/lib/game/ui/OnlineMatchOverlay.svelte`

### 5. Visual and motion tokens

Add semantic tokens for z-index, target size, panel width, type scale, safe-area offsets, durations, and easing. Preserve existing theme colors initially; retune light scene colors only after responsive geometry is stable.

## Milestones

### Milestone 0: Baseline and contracts

- Record screenshots and geometry assertions for the audit viewport matrix.
- Add semantic responsive, motion, and z-index tokens.
- Add pure camera-fit tests before changing the scene.
- Add focus, touch-target, and input-font assertions that currently reproduce the failures.

Exit: failing tests describe the intended responsive/accessibility contract without changing product behavior.

### Milestone 1: Responsive playfield

- Implement safe-area and `dvh` shell sizing.
- Remove 320px brand/control collision.
- Implement aspect- and inset-aware camera fitting.
- Preserve the intentionally hidden collapsed-mobile turn/status state.
- Add view-reset affordance and contextual selected-column/landing feedback only when relevant.
- Keep desktop turn pill and wide-screen composition intact.

Exit: board framing is stable at every target viewport and the collapsed mobile composition stays intentionally minimal.

### Milestone 2: Touch-safe control surface and state-driven information architecture

- Introduce portrait bottom sheet and retain rail behavior for desktop/landscape.
- Increase coarse-pointer targets and mobile input type.
- Promote Online create/join/lobby actions when Online is selected.
- Collapse locked setup into a match summary during play.
- Add visible scroll continuation and preserve the user's chosen expanded state when appropriate.
- Make staged drop the default for new coarse-pointer users.

Exit: primary phone flows are comfortable one-handed, do not auto-zoom inputs, and do not require opening a dense rail to understand the match.

### Milestone 3: Onboarding, help, and accessibility

- Replace passive board explanation with one camera practice and one staged placement practice.
- Keep the welcome card; use fast state transitions after the first headline rather than typing every heading.
- Add How to Play / Replay tutorial in the normal UI.
- Move all interactive overlays to the shared dialog primitive.
- Fix invalid brand/dimensions ARIA.
- Add keyboard column navigation with announced row, column, and landing layer.
- Add non-color-only player differentiation, such as distinct rim/pattern treatment.

Exit: a first-time touch player can learn the core loop by doing it; keyboard focus never leaves an active modal; the main move flow has a keyboard path.

### Milestone 4: Theme and motion refinement

- Retune light-mode field/grid/label depth and player contrast.
- Convert perpetual shine to first-load and state-change moments.
- Add short turn-handoff, selection, Online-arrival, and Tactical-sequence feedback.
- Centralize reduced-motion behavior and verify no content is gated on animation.

Exit: light mode has comparable spatial readability, and motion communicates game state without competing with the board.

### Milestone 5: Quality, performance, and release QA

- Run production-build traces before selecting optimizations.
- Add Auto / High / Battery quality presets if production data justifies them.
- Consider lazy QR generation and lower-cost mobile rendering only after measurements.
- Run local/AI/Tactical/Online regression suites and the two-context multiplayer test.
- Run screenshot, keyboard, reduced-motion, light/dark, and coarse-pointer matrices.
- Run a real installed-PWA phone smoke, including safe areas, background/resume, and orientation changes.

Exit: all checks pass; no server-authority, persistence, bridge, or gameplay regressions; real-device smoke is recorded.

## Acceptance Criteria

- Collapsed mobile controls remain intentionally minimal and do not add a persistent turn/status element.
- All coarse-pointer interactive targets are at least 44 x 44 CSS pixels, except where a larger semantic label wraps a smaller visual control.
- Text inputs render at 16px or larger on mobile.
- The 320px layout has no brand/control overlap.
- The 844 x 390 board fills the usable playfield instead of using the portrait compact framing.
- Opening the control surface cannot hide required playable columns without camera compensation.
- Portrait controls respect top/bottom safe areas and dynamic browser chrome.
- The tutorial and result dialogs trap focus, support their intended Escape behavior, and restore focus.
- The tutorial can be reopened from the UI.
- Touch onboarding copy matches actual placement behavior.
- Light-mode grid, labels, and pieces remain distinguishable at common angles.
- Reduced-motion mode removes continuous and large spatial motion without hiding feedback.
- Lighthouse accessibility reaches 100 on the tested shell, supplemented by manual canvas and focus checks.
- Local, AI, Tactical, Online, recovery, persistence, PWA, and bridge flows remain intact.

## Recommended Product Decisions

Approved direction:

- Use a portrait bottom sheet instead of trying to enlarge the current narrow right rail.
- Default new coarse-pointer users to staged drop while preserving saved preferences and one-click desktop play.
- Keep light mode as a fully supported scene, not a best-effort alternate.
- Include keyboard board navigation in this pass so the new input architecture is designed once.
- Preserve hidden turn/status information while mobile controls are collapsed.
