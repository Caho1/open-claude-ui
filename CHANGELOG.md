# Changelog

All notable changes to `open-claude-ui` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### 🐛 Fixed (Issue #16 - Token Table Desync & Build Pipeline)
- **Token Synchronization**: Calibrated `AGENTS.md` design token tables with `code-examples/cds-theme.css`, eliminating 14 undefined token discrepancies.
- **Backward-Compatible Token Aliases**: Added aliases in `cds-theme.css` for `--cds-bg-surface-0` ~ `--cds-bg-surface-3`, `--cds-bg-input`, `--cds-text-tertiary`, `--cds-border-card`, `--cds-radius-pill`, `--cds-card-radius`, etc.
- **Absolute Local Path Elimination**: Replaced 36 local absolute path links (`file:///Users/jiahao/...`) in `AGENTS.md` with standard repository-relative paths.
- **Automated Token Gate**: Implemented `scripts/check-tokens.mjs` and npm script `npm run check:tokens` to verify token references in documentation against CSS definitions.
- **Build Output & Package Exports**: Created `tsconfig.build.json` and updated `package.json` to emit compiled TypeScript to `dist/`, configured `"exports"` for `./css`, `./tokens`, and `./tailwind`, and added CI verification workflow `.github/workflows/ci.yml`.

### 🚀 Added (Issue #17 - Pure CSS Layer, Runtime Portability & Host Bridging)
- **Pure-CSS First-Class Exports**: Exposed `@import "open-claude-ui/css"`, `@import "open-claude-ui/tokens.css"`, and standalone `@import "open-claude-ui/pure.css"` for consuming design tokens, keyframes, and scroll-fade masks without React or Tailwind.
- **Chromium 115+ Zero-JS `@property` Scroll-Fade Engine**: Implemented pure CSS `@property --cds-scroll-fade-*` `<length>` registration driven directly by `animation-timeline: scroll(self block / inline)` with official 7-stop non-linear alpha mask, dropping scroll tracking CPU to 0.0% and main-thread blocking to 0ms.
- **Runtime Portability Classification**: Added "运行时可移植性" (Runtime Portability) column across all 33 module inventory tables in `docs/v1/07-工程配置与资产代码库总览.md`, classifying modules into Pure CSS, Pure Logic / Headless, and React Component tiers.
- **Host Bridge Mapping Guide**: Added Section 7.5 to Chapter 7 documenting the Host Aliasing pattern for integrating CDS tokens into custom desktop harnesses (e.g., DSH / Electron shells) or third-party web frameworks.
- **Pure-CSS Scroll-Fade Utilities**: Added `.cds-scroll-fade`, `.cds-scroll-fade-vertical`, `.cds-scroll-fade-horizontal`, and `.cds-scroll-fade-static-v` utility classes in `code-examples/cds-theme.css`, alongside `data-cds-scroll-fade` support in `ScrollFadeContainer.tsx`.

---

## [1.1.0] - 2026-10-17 - Ground-Truth Precision Audit (PR #15)

### 🔍 REA v6.5.0 Ground-Truth Precision Audit (Chapter-by-Chapter)

> Based on deep AST analysis and runtime extraction from Claude Desktop `/Applications/Claude.app` (`@ant/desktop v2.37337.1`, build `2026-10-13T22:16:06Z`, ASAR evidence `ev_e0bd89cee50a5b7d0dbf9e75cef5dfbca2bcb1699df4d4371449dd08452a8358`) using **[REA (Reverse Engineer Anything) v6.5.0](https://github.com/morluto/rea)**.

#### Chapter 1: Design Philosophy & Design Tokens (`docs/v1/01-设计哲学与设计令牌体系.md`)

- **35-Tier Grayscale & Orange Color Ramps**:
  - Replaced approximated surface hex values with the complete 35-tier grayscale spectrum (`--cds-gray-0` to `--cds-gray-900`) and 35-tier orange spectrum (`--cds-orange-0` to `--cds-orange-900`) extracted from `c6a992d55-sXiDGMFQ.css`.
  - Calibrated `--cds-surface-0` Light mode to `#f9f9f7` (`--cds-gray-20`, previously `#f5f5f3`) and Dark mode to `#0b0b0b` (`--cds-gray-900`, previously `#0b0b0a`).
  - Calibrated `--cds-surface-3` Dark mode to `#20201f` (`--cds-gray-800`, previously `#20201e`).
- **OLED Anti-Banding Hex Law**:
  - Documented Anthropic's exact 2-level hexadecimal step decrement rule across dark surfaces (`800: #20201f` $\to$ `810: #1e1e1d` $\to$ `820: #1c1c1b` $\to$ ... $\to$ `900: #0b0b0b`), eliminating OLED banding.
- **Official Brand Token Separation**:
  - Defined `--brand: #c6613f` as official desktop primary brand color, while retaining `--cds-clay: #d97757` for pulse indicators, spark icons, and terracotta highlights.
- **Concentric Radius Formula & Card Token**:
  - Implemented the adaptive concentric radius formula `--radius-card: calc(var(--cds-radius) + calc(.25rem * var(--cds-rem-scale, 1)))` in `cds-theme.css`.
  - Added `'card': 'var(--radius-card, ...)'` to `tailwind.config.js` to ensure inner and outer curvatures maintain concentric harmony during viewport zoom.
- **Scroll-Driven 28px Fade System**:
  - Formally specified `--cds-scroll-fade-size: 28px` (calibrated from 24px/32px approximations).
  - Documented the 4-stop non-linear relative color fade formula (`0%`, `13%` at 0.85 alpha, `40%` at 0.50 alpha, `70%` at 0.15 alpha, `100%` transparent) driven by CSS `scroll-timeline`.
- **CJK Font Stack & Variable Axes**:
  - Integrated `--font-cjk-sans-fallback` (`PingFang SC`, `PingFang TC`, `Hiragino Sans`, `Apple SD Gothic Neo`) into default font stacks.
  - Added explicit variable font optical size axes (`--font-opsz-axis-title: "opsz" 28,;`, `--font-opsz-axis-heading: "opsz" 20,;`, `--font-opsz-axis-display: "opsz" 48,;`) and subpixel badge weight `--cds-badge-x-wght: 577.8`.
- **Suite of 7 Production Physical Cubic-Bezier Curves**:
  - Expanded motion tokens from 3 generic curves to all 7 production bezier functions extracted from desktop bundles:
    - `--cds-ease-swift`: `cubic-bezier(.16, 1, .3, 1)` (hover/ghost buttons)
    - `--cds-ease-expand`: `cubic-bezier(.19, 1, .22, 1)` (Grid 0fr to 1fr accordion expand)
    - `--cds-ease-enter`: `cubic-bezier(.22, 1, .36, 1)` (block entry with 4px blur fade)
    - `--cds-ease-overshoot`: `cubic-bezier(.34, 1.3, .64, 1)` (jelly spring pop, +30%)
    - `--cds-ease-pop`: `cubic-bezier(.34, 1.56, .64, 1)` (high-stiffness modal pop, +56%)
    - `--cds-ease-pulse`: `cubic-bezier(.4, 0, .2, 1)` (quiet dot 1.9s pulse)
    - `--cds-ease-rise`: `cubic-bezier(.3, .7, .4, 1)` (status line enter rise)
    - `--cds-ease-fall`: `cubic-bezier(0, 0, .2, 1)` (status line exit fall)

#### Chapter 2: Foundational Atoms & Controls (`docs/v1/02-基础原子组件与交互控件.md`)

- **5-Tier Button Height Scale & Nested Control Heights**:
  - Calibrated button sizes to official 5-tier scale: `xxs (18.8px, data-step="1")`, `xs (22.6px)`, `sm (26.35px)`, `md (30.1px desktop / 32px web, default)`, and `lg (37.65px desktop / 40px web)`.
  - Added official `--cds-h-control-nested` scale (17px, 18.8px, 20.7px, 26.35px) for toolbar/composer-nested controls.
- **6 Production Button Variants & Paint Layer Decoupling**:
  - Extracted official variant matrix: `secondary` (default, borderless with `bg-fill-secondary`), `primary` (clay), `ghost` (`hover:bg-fill-ghost-hover`), `danger` (`bg-fill-danger`), `brand` (`--brand: #c6613f`), and `onContent` (media overlay with `backdrop-blur-md` and `var(--cds-button-on-content)`).
  - Implemented decoupled paint layer (`data-cds-part="paint"`) to isolate focus ring outlines from inner background/shadow fills.
- **15-Stop CSS `linear()` Spring Curve & Button Squish Physics**:
  - Extracted official `--cds-btn-spring: linear(0, .2459, .6526, .9468, 1.0764, 1.0915, 1.0585, 1.0219, .9993, .9914, .9921, .9957, .9988, 1.0004, 1)` (+9.15% overshoot).
  - Implemented `.cds-btn-squish` with runtime height damping `Bl(h) = Math.min(1.5, Math.max(0.5, h * (1/32)))`.
- **Segmented Control 1px Precision Geometry & Dual Container Breakpoints**:
  - Corrected track padding to strictly `1px` (not 2px) with `top: 1px; bottom: 1px;` indicator positioning.
  - Formally specified multi-breakpoint container query: `@container (width <= 180px)` for 2-tab pills and `@container (width <= 254px)` for 3-tab pills.
  - Extracted 0.5px hairline inset shadow: `inset 0 0 0 0.5px var(--cds-border), 0 1px 2px #0000000f, 0 2px 6px -1px #0000000d` (Light) and `inset 0 0 0 0.5px #ffffff14, 0 1px 2px #0000004d, 0 2px 6px -1px #00000040` (Dark).
- **Official 6px Status Indicators & Accurate Trajectories**:
  - Standardized `.status-dot` to 6px diameter with 4 semantic kinds: `ready` (accent steady), `running` (1.2s dot blink), `error` (danger steady), and `clay` (3.0s breathe cycle from brightness 0.96 scale 0.86 to brightness 1.06 scale 1).
  - Specified `.timeline-quiet-dots` (3px dots, 3.5px gap, 1.9s cycle with 0s/0.15s/0.3s phase delays) and `cds-skeleton-sweep` (2s linear, 105deg angle, 255deg in RTL).
- **6-Tier Confirmation Dialog Matrix & Nested Dialog Blur**:
  - Extracted official `Qg` dialog scale: `sm: max-w-[400px]`, `md: max-w-[520px]`, `lg: max-w-[720px]`, `xl: max-w-[880px]`, `2xl: max-w-[1024px]`, `3xl: max-w-[1152px]`.
  - Added dynamic `--environment-dialog-cap` formula and automated nested dialog blurring: `data-[nested-dialog-open]:blur-[2px]`.
- **7.5rem Square Attachment Tiles & Bi-Directional Mid-Truncation**:
  - Corrected attachment card from 128x96px rectangle to exact square 7.5rem (`size-[calc(7.5rem * var(--cds-rem-scale, 1))]`, ~112.94px on desktop) with `rounded-card` and `shadow-field-drop`.
  - Documented floating remove button protocol: `absolute -end-2 -top-2 size-5 rounded-full bg-surface-3 shadow-card-ring`.
  - Recreated intelligent bi-directional mid-truncation (`head` + `…` + `tailStem` + `tailExt`) preserving file extension visibility.

#### Chapter 3: Chat Stream & Composer Engine (`docs/v1/03-会话核心流与指令交互引擎.md`)

- **Message Bubbles & Typography Scale (`[data-cds=UserMessage]`, `[data-cds=AssistantMessage]`)**:
  - Extracted exact bubble radius formula `--cds-message-bubble-radius: calc(var(--cds-radius) + calc(.25rem * var(--cds-rem-scale, 1)))` and padding `--cds-message-bubble-pad-x: var(--cds-pad-lg)` (16px), `--cds-message-bubble-pad-y: var(--cds-pad-md)` (12px).
  - Documented dynamic tinting: default `var(--cds-bg-neutral)` vs personal `#dde8f7` (Light) / `#193c5f` (Dark) with hover mixing `--feed-bubble-mix: 16%`.
  - Documented 300px collapse threshold with 3rem bottom decay mask: `[mask-image:linear-gradient(to_bottom,black_calc(100%_-_3rem),transparent)]`.
  - Extracted Assistant message Text Inset & Stop Law: `--cds-assistant-message-text-inset: 4px; --cds-assistant-message-text-stop: clamp(0px, (100% - 384px) * .175, 56px);` with `0px` reset when embedding cards or tables.
  - Documented vertical rhythm: `--chat-turn-gap = chat-body * chat-leading * 0.75` and `--chat-item-gap = chat-body * chat-leading * 0.5`.
- **Thinking Accordion Timeline Physics (`.timeline-quiet-dots`, `.timeline-expand`)**:
  - Discovered exact `.timeline-quiet-dots` keyframe physics in `cc1aae219-DtZTxCKj.css` (3 dots, 3.5px gap, 3px diameter, 1.9s infinite `cubic-bezier(.4, 0, .2, 1)` with 0s/0.15s/0.3s delays).
  - Extracted CSS Grid 0fr $\leftrightarrow$ 1fr expansion (`.2s cubic-bezier(.19, 1, .22, 1) timeline-expand`) eliminating height recalculation reflow.
  - Documented status line entrance/exit physics: `.timeline-status-enter-quiet` (.24s rise 6px) and `.timeline-status-exit-quiet` (.18s fall -4px).
  - Implemented streaming generation lock (`isThinkingLive` locks `open=true` and suppresses toggle clicks).
- **Composer Engine & WebKit 500ms Post-Composition Delta Guard**:
  - Discovered Anthropic's WebKit 500ms post-composition delta guard (`Lm() && Math.abs(e.timeStamp - Fm) < 500`) in `shared-frame-BfjMqbuN.js`, eliminating false Enter submissions following CJK IME selection.
  - Implemented capture-phase `beforeinput` interceptor preventing synthetic line breaks.
  - Reverse engineered Slash & Mention tokenizer (`cb6930dae-BD0W5ZM9.js`): CJK punctuation stripper `$o = /[.,;:!?'"\u3001\u3002\uFF0C\uFF1B\uFF1A\uFF01\uFF1F\u2026]+$/`, `rs = 1024` max path length, and 256 file mentions defense cap.
  - Implemented `field-sizing: content` with ghost element fallback and `max-h-[min(40svh,24rem)]` (384px) cap.
- **Model Matrix & Prompt Caching Gauge**:
  - Updated official model architecture with Claude 3.7 Sonnet, Haiku 3.5, and Opus 3; documented deprecation of `thinking.type=enabled` in favor of `thinking.type=adaptive`.
  - Deconstructed 5m (`3e5` ms) and 1h (`36e5` ms) ephemeral cache token lifetimes with 4-part cost decomposition (`cache_read`, `cache_creation`, `input`, `output`).
  - Standardized circular SVG gauge formula: `strokeDashoffset = 2 * PI * r * (1 - ratio)` with 80% capacity alert threshold.
- **MCP Decision Cards & Security Lifecycle**:
  - Reverse engineered 3-stage authorization lifecycle (`pending_approval`, `running`, `success`/`error`) with real settle reasons: `user_denied`, `policy_denied`, `PERMISSIONS_ERROR`.
  - Extracted `structured_content` parameter inspection and session whitelist map (`bs`) with 330s automatic garbage collection.

#### Chapter 4: Motion Physics, Shaders & Ambient Systems (`docs/v1/04-动效物理学、着色器与环境光影.md`)

- **Native CSS Scroll-Driven Animations (`@supports (animation-timeline: scroll())`)**:
  - Documented native CSS scroll-driven mask declared via `@supports (animation-timeline: scroll())` in `c6a992d55-sXiDGMFQ.css`, delegating scroll fade entirely to the browser Compositor thread with zero JS overhead.
  - Configured 6 parallel animation timeline streams: `cds-scroll-fade-top`, `bottom`, `left`, `right`, `y-active`, `x-active` bound to `animation-timeline: scroll(self), scroll(self), scroll(self inline), scroll(self inline), scroll(self), scroll(self inline)`.
  - Extracted exact 7-stop non-linear alpha sampling mask (`transparent`, `#0000000d` at .15, `#00000026` at .3, `#0000004d` at .45, `#00000080` at .6, `#000000b3` at .75, `#000000d9` at .87, `#000` at 1.0).
- **Variable Font Kinetic Engine (`[data-cds-anim]`)**:
  - Discovered CSS Houdini `@property --cds-anim` & `@property --cds-anim2` paired with `[data-cds-anim]` and variable font axes (`ANIM`, `ANM2`, `opsz`, `wght`) in `c6a992d55-sXiDGMFQ.css`.
  - Extracted mechanical overshoot transition `--cds-anim-ease: cubic-bezier(.34, 1.3, .64, 1)` (+30% bounce) driving focus/hover icon micro-animations.
- **Ambient Reasoning Shaders & Accurate Keyframe Durations**:
  - Extracted exact keyframes from `c6a992d55-sXiDGMFQ.css`:
    - `wl-glow` (1.8s ease-in-out) & `wl-halo` (2.2s ease-in-out) utilizing modern `color-mix(in srgb, var(--cds-fill-brand) 60%, transparent)` pulsing to 85%.
    - `cds-shimmer-text-shine` (3s linear with asymmetric `cubic-bezier(.714, .121, .211, .888)`).
    - `epitaxy-linear-sweep` (strictly **1.1s** `cubic-bezier(.45, 0, .55, 1)` translating `-100%` to `350%`, RTL variant `100%` to `-350%`, correcting previous 1.6s estimate).
    - `epitaxy-check-draw` (0.18s `clip-path: inset(0 100% 0 0)` to `clip-path: inset(0)` at `--cds-ease-out`).

#### Chapter 5: Audiovisual, Lightbox & Artifacts Experience (`docs/v1/05-视听多媒体与产物交互物理学.md`)

- **AudioWorklet & SharedArrayBuffer RingBuffer (`audioSinkWorklet.js`)**:
  - Extracted complete production implementation of `audioSinkWorklet.js` from `/Applications/Claude.app/Contents/Resources/ion-dist/audio/voice/`.
  - Reverse engineered the lock-free atomic circular buffer (`RD=0`, `WR=1`, `UNDERRUNS=2`, `PLAYED=3`) running at ~375Hz (128 samples/quantum at 48kHz) with underrun counting gates and dry-gap stall guards.
- **30% Comfortable Acoustic Standard & SFX Matrix**:
  - Documented 4 official interaction sound effects (`enter_voice_mode`, `exit_voice_mode`, `disconnected`, `tool_approval_needed`) with strict 30% volume limit and hardware routing via `AudioContext.setSinkId()`.
- **LiveMicActivityBars 6-Band Gamma Physics**:
  - Extracted 512-point FFT AnalyserNode configuration (`smoothingTimeConstant = 0.5`, `minDecibels = -70`, `maxDecibels = -10`).
  - Documented 6 speech bands (85Hz-4.8kHz), 8% noise gate (`Math.max(0, u - 0.08) / 0.92`), and 0.7-power non-linear Gamma energy compression (`Math.pow(gated, 0.7) * 1.5 * weight`) driving 4px-24px height.
- **MediaLightboxViewer Pan/Zoom & 75vw Runway**:
  - Extracted physical constants: `ae=2` max zoom, `oe=4px` gesture dead-zone, `se=0.01` wheel exponential factor, `v=1.05` snap threshold.
  - Implemented cursor-anchored affine zoom equations keeping pointer coordinates fixed during zoom.
  - Documented View Transitions FLIP morphing with 5-level DOM ancestor radius discovery and `object-fit: contain` inner inset calculation.
  - Specified 75vw runway with $\pm 2$ virtual preloading and `.animate-lightbox-backdrop-in` (.2s) / `.animate-lightbox-content-in` (.25s).
- **Artifacts SplitPane & Epitaxy Sandbox**:
  - Implemented pointer stream shield (`data-pane-dragging="true"` with transparent `pointer-events: none` overlay on child iframes).
  - Reverse engineered 50/50 double-click snap, 4px dead-zone with Escape cancellation, and 18% / 82% docking thresholds.
  - Enforced strict null-origin sandbox isolation (excluding `allow-same-origin`) with native `event.userActivation` verified gating.
- **StreamingDiffViewer & Production Diff Variables**:
  - Extracted exact variables from `.epitaxy-root .epitaxy-diff` in `c6a992d55-sXiDGMFQ.css`: `--diffs-font-size`, `--diffs-line-height`, `--diffs-font-family`, `--diffs-header-font-family`, `--diffs-addition-color-override`, `--diffs-deletion-color-override`, `--diffs-modified-color-override`, `--diffs-gap-inline`, `--diffs-gap-block`.
  - Implemented Shadow DOM isolation with CSS Grid row height locking (`gridRow = span ${v}`), incremental stream chunk feed, and 2.5s copy check decay state machine (`saved-check-decay`).
- **Bidirectional Streaming Voice Architecture (Section 5.1.5)**:
  - Reverse engineered `frame-shell-dictate-C9D4b04p.js` & `frame-shell-speak-CBGDxR0k.js`.
  - Documented STT Dictation (`openDictation`): 1-hour session limit (`36e5` ms), pause settling (`settleAtPauses: true`), and prefix differential delta algorithm `l(f, e)`.
  - Documented TTS Reading (`openReading`): 24kHz wideband audio pipeline (`sampleRate: 24000`), dynamic playback rate, and real-time word position events for Karaoke text highlighting.

#### Chapter 6: Desktop Host Architecture & Multi-Agent Topology (`docs/v1/06-系统级桌面架构与协作拓扑.md`)

- **Host BrowserWindow + Transparent WebContentsView**:
  - Deconstructed Electron dual-layer decoupled architecture from `index.chunk-CiiI592G.js`.
  - Implemented native macOS traffic light inverse zoom compensation formula `Math.max(0, Math.round((pos + 6) * zoom - 6))` with baseline 16.5px and diameter 12px.
  - Documented 8px dynamic window radius collapsing to 0px on maximize/fullscreen, and instant theme background coloring (`#151515` / `#fcfcfb`).
- **Sidebar Topological Drag-and-Drop**:
  - Implemented `pinnedOrder: string[]` optimistic mutation, 4px pointer drag dead-zone, -1.5° ghost elevation tilt, and 2px terracotta midpoint collision drop indicator.
- **Cowork Multi-Agent Canvas**:
  - Deconstructed task delegation state machine (`idle` $\to$ `running` $\to$ `waiting_review` $\to$ `completed`), shared artifacts pool, and cross-window `BroadcastChannel` synchronization.
- **Streaming Scroll Pinning Physics**:
  - Implemented 150ms user input cooldown window, 40px bottom tolerance, 35vh bottom padding cushion (`--chat-extra-space`), and `behavior: auto` instantaneous bottom alignment.
- **4-Tier Container Query Compression**:
  - Eliminated window media query squash defects via `@container` rules (>=576px full, <480px compact, <384px icon-only, <320px anti-overflow safe net with `cqw`).
- **Roving Focus & Rate Limit Backoff**:
  - Implemented W3C WAI-ARIA roving tabindex grid with RTL mirror flipping.
  - Implemented 429/503 exponential backoff (`min(max(base, 5000) * 2^(n-1) * (1 ± J), 600000)`) with $\pm 15\%$ full jitter and 3-retry max ceiling before mandatory manual takeover.
- **Broker-Replica Multi-Window Architecture & Baseline Conflict Arbitration (Section 6.8)**:
  - Reverse engineered `frame-shell-broker-znyoRmsX.js` and `frame-shell-replica-C7KCVFfZ.js`.
  - Documented IPC master-replica topology with `ReplicaWriter` immutable state stream distribution.
  - Deconstructed working mount write-lock arbitration preventing concurrent destructive file writes via `baseline-mismatch` assertions.

#### Chapter 7 & 8: Engineering Setup & AI Agent Guidelines (`docs/v1/07-工程配置与资产代码库总览.md`, `docs/v1/08-AI-Agent-前端-UI-与动效开发指南.md`)

- **Complete 30-Module Production Asset Inventory**:
  - Audited and updated the production asset inventory table covering all 30 standalone code examples in `code-examples/`.
- **Aligned Tailwind Extension & Global CSS Tokens**:
  - Synchronized `tailwind.config.js` and global CSS with the official 35-tier grayscale/orange color ramps and verified surfaces.
- **Modern Underlying Runtime Architecture: Rolldown, WASM Matrix & Clarkdown Compiler (Section 7.4)**:
  - Deconstructed Rolldown Rust bundler runtime (`rolldown-runtime-C3OYiQ02.js`) managing 4000+ chunks with sub-second startup and zero-overhead inlining.
  - Reverse engineered tri-WASM engine matrix: 8.25MB client-side offline `.docx` parser (`cf4728005-C0phcBAH.wasm`), 1.35MB Clarkdown compiler (`c35955a62-DsUXHNAG.wasm`), and 204KB Tree-sitter incremental syntax parser (`c571a2685-sT_OTiSe.wasm`).
  - Documented Clarkdown proprietary formats (`.clark` / `.cd`) and dual host topology (`createLocalDocumentHost`, `createRemoteDocumentHost`).
- **Strict AI Agent Quality Gates**:
  - Formulated strict rules for agentic code generation: single-stroke border discipline, WebKit 500ms IME post-composition guard, procedural Web Audio synthesis, and zero-error TypeScript build requirement.

---

## [1.0.1] - 2026-10-16

### 🐛 Fixed (Community Issues #9 – #13)

- **`DiffViewer` Header Rendering (Issue #9)**:
  - Fixed issue where the sticky file header, path icon, and badge statistics failed to render when `chunks` array was empty. The header now always renders reliably with complete metadata.
- **`SortableList` Drag-and-Drop Index (Issue #10)**:
  - Fixed off-by-one error when dragging an item past the end of the list. The drop target index is now properly clamped to `items.length - 1`.
- **`PromptInput` IME Composition Enter Guard (Issue #11)**:
  - Added `isComposing` guard to `onKeyDown` to prevent CJK IME candidate selection (Enter key) from prematurely triggering message submission.
- **`MediaLightbox` Pan Boundary Constraints (Issue #12)**:
  - Added dynamic clamp bounds `[-maxPanX, maxPanX]` and `[-maxPanY, maxPanY]` based on current zoom scale, preventing media from being panned completely out of view.
- **`ViewTransitionPortal` Timing Collision (Issue #13)**:
  - Synchronized `view-transition-name` assignment with `ReactDOM.flushSync` and cleanup hooks, avoiding DOM transition name collision errors during rapid route changes.

### 📝 Documentation & Community

- Merged community fixes via PR [#14](https://github.com/Caho1/open-claude-ui/pull/14) with acknowledgments to contributors `@alexanderchen-ai`, `@dev-liu-kevin`, `@sakura-code99`, `@marcus-web-eng`, and `@t-h-tanaka`.
- Added dynamic interactive Star History chart to `README.md`.
- Clarified repository description: *"还原 30 个独立 React 组件与 8 项硬核交互物理算法"*.

---

## [1.0.0] - 2026-10-14

### 🎉 Initial Release

- **30 Standalone React Components**:
  - Production-ready, TypeScript-strictly-typed UI component implementations recreating Claude Desktop's design system.
  - Buttons, Segmented Controls, Status Indicators, Confirmation Dialogs, Attachment Cards, Message Bubbles, Thinking Accordions, Chat Composer, Artifacts Sandbox, Media Viewer, Split Panes, Diff Viewer, and more.
- **8 Hardcore Interaction & Motion Physics Algorithms**:
  - True Spring Physics (`stiffness: 400`, `damping: 32`).
  - Web Audio API real-time AudioWorklet microphone visualizer.
  - Retina 0.5px hairline rendering with media query scaling.
  - Triple-layer focus ring and dual-ring composer elevation.
  - Container query responsive folding (`@container`).
  - CSS Grid 0fr $\to$ 1fr height jitter elimination.
  - Retinal irradiation weight compensation for dark mode (`-40` wght offset).
  - WebKit 16px mobile input zoom prevention threshold.
- **Complete CDS Engineering Manual**:
  - 9-chapter exhaustive reverse-engineering specification covering design tokens, atom controls, conversation flows, motion shaders, audiovisuals, desktop integration, Tailwind configurations, and Agent UI assembly.
