# Agent Guidelines for Claude Design System (CDS)

Welcome, AI Agent! This repository ([`open-claude-ui`](https://github.com/Caho1/open-claude-ui)) contains the production-grade, clean-room reverse-engineered implementation of Anthropic's **Claude Design System (CDS)** and its interaction physics.

When assisting users with building, modifying, or reviewing frontend components, interfaces, or animations based on this repository, you **MUST** strictly follow the design tokens, physics laws, component guidelines, and quality gates detailed below.

---

## 🧭 Quick Reference: Core Philosophy & Rules

1. **Editorial Warmth, Not Cyberpunk**:
   - Main brand accent is warm **Clay / Terracotta (`#d97757` in light mode, `#cc6b49` in dark mode)**.
   - Surfaces use subtle warm grays (`#fcfcfb`, `#f7f7f5`, `#1b1b19`), never stark pure black `#000` (except code blocks `#0d0d0c`) or harsh pure white `#fff`.
   - Never use neon blues, magenta, or cold purple gradients.
2. **Low-Contrast Surface Layering**:
   - Differentiate layers using micro-luminance contrast (`Surface 0 ~ 3`) and hairline borders (`border-subtle`: `rgba(0,0,0,0.06)` / `rgba(255,255,255,0.08)`).
   - Single-stroke border discipline: inside bordered containers (such as cards or the chat composer), secondary buttons and chips must NOT have redundant borders (`border-none`).
3. **Organic Motion Physics**:
   - Never use generic `linear` or exaggerated bouncy CSS transitions.
   - Use the 4 calibrated Framer Motion spring presets from [`code-examples/ClaudeMotionPresets.ts`](code-examples/ClaudeMotionPresets.ts).
4. **Pure Code & Zero Copyright Violations**:
   - Zero proprietary binary fonts (`.otf`/`.ttf`) or audio files (`.mp3`/`.wav`).
   - Use the calibrated system fallback font stacks and procedural Web Audio API oscillator synthesis.
5. **Strict Edge-Case Guards**:
   - Always guard chat/composer inputs against CJK IME composition accidents (`!(e.nativeEvent.isComposing || e.keyCode === 229)`).
   - Latch scroll pinning with a 150ms cooldown timestamp to prevent LLM streaming from hijacking manual user scrolling.

---

## 🎨 1. Design Tokens & Styling Architecture

All tokens are defined in [`code-examples/cds-theme.css`](code-examples/cds-theme.css) and exposed through Tailwind classes via [`code-examples/tailwind.config.js`](code-examples/tailwind.config.js).

### Surface & Background Tokens
| Token | Light Mode Value | Dark Mode Value | Usage |
| :--- | :--- | :--- | :--- |
| `--cds-surface-0` | `#f9f9f7` | `#0b0b0b` | Base application background, page canvas (alias: `--cds-bg-surface-0`, `--cds-bg-primary`) |
| `--cds-surface-1` | `#fcfcfb` | `#151515` | Sidebar panels, secondary cards (alias: `--cds-bg-surface-1`, `--cds-bg-secondary`) |
| `--cds-surface-2` | `#ffffff` | `#1a1a19` | Input bars, dialog backdrops, floating popovers (alias: `--cds-bg-surface-2`, `--cds-bg-surface`) |
| `--cds-surface-3` | `#ffffff` | `#20201f` | Active states, hover fills, elevated tags (alias: `--cds-bg-surface-3`, `--cds-bg-surface-elevated`) |
| `--cds-surface-popover` | `#ffffff` | `#262624` | Floating popovers, dropdown menus |
| `--cds-bg-input` | `var(--cds-surface-3)` | `var(--cds-surface-3)` | Text fields, chat input background |

### Text & Border Tokens
| Token | Light Mode Value | Dark Mode Value | Usage |
| :--- | :--- | :--- | :--- |
| `--cds-text-primary` | `#151515` | `#ffffff` | Headings, primary body text, active labels |
| `--cds-text-secondary` | `#525252` | `#c2c2c2` | Timestamps, subtitles, secondary actions |
| `--cds-text-muted` | `#8a8a8a` | `#808080` | Placeholders, disabled text, hotkey hints (alias: `--cds-text-tertiary`) |
| `--cds-text-accent` | `var(--cds-clay)` | `var(--cds-clay)` | Highlighted brand terracotta text |
| `--cds-border` | `var(--cds-alpha-2)` | `var(--cds-alpha-2)` | Dividers, subtle list borders (alias: `--cds-border-subtle`, `--cds-border-card`) |
| `--cds-border-strong` | `var(--cds-alpha-3)` | `var(--cds-alpha-3)` | Emphasized component borders |
| `--cds-border-subtle` | `var(--cds-alpha-2)` | `var(--cds-alpha-2)` | Fine hairline dividers |
| `--cds-border-accent` | `var(--cds-clay)` | `var(--cds-clay)` | Focus and active borders |

### Skeleton & Motion Tokens
| Token | Light Mode Value | Dark Mode Value | Usage |
| :--- | :--- | :--- | :--- |
| `--cds-skel-i` | `0` | `0` | Cascading index for skeleton wave delay (`calc(var(--cds-skel-i, 0) * 90ms)`) |
| `--cds-skeleton-base` | `rgba(0, 0, 0, 0.05)` | `rgba(255, 255, 255, 0.06)` | Base skeleton placeholder container surface |
| `--cds-skeleton-sheen` | `rgba(255, 255, 255, 0.25)` | `rgba(255, 255, 255, 0.08)` | 105° linear sweep band highlight (2s linear) |

### Brand Clay Palette
* `--brand`: `#c6613f` (Official desktop brand primary color)
* `--cds-clay`: `#d97757` (Light / pulse indicator) / `#cc6b49` (Dark)
* **官方佐证 (v3 取证)**：Claude 桌面端 3.6556.2 内置的官方 `frontend-design` skill 原文确认 #D97757 为 "Anthropic's own Claude-interaction accent"（见 `docs/v3/06` §6.10.4），与 REA 运行时实测一致
* 角色区分 (运行时实证 3.6556.2)：`brand`=陶土（Claude 发起的动作，如发送/生成）；`accent`=**蓝色**（`--cds-text-accent: #184f95`、`--cds-border-accent: #86b6ef`）——二者是不同角色，不可互换
* Focus shadow: `var(--cds-focus-shadow)` (`inset 0 0 0 1px var(--cds-page-bg), 0 0 0 1px var(--cds-fill-accent), 0 0 6px 1px var(--cds-bg-accent)`, 即蓝色 ring + 蓝色 glow，运行时实证)

### Geometric Corner Radii
* `var(--cds-radius)`: `8px` (Base component radius)
* `var(--radius-card)` / `--cds-card-radius`: `calc(var(--cds-radius, 8px) + calc(.25rem * var(--cds-rem-scale, 1)))` (12px standard / concentric card radius, alias: `--cds-radius-card`)
* `--cds-radius-composer`: `20px` (Main chat composer terminal)
* `--cds-panel-radius`: `10px` (Panels, attachment cards)
* `--df-radius-pill` / `--cds-radius-pill`: `999px` / `9999px` (Pill buttons, segmented control tracks)
* `--cds-message-bubble-radius`: `calc(var(--cds-radius, 8px) + calc(.25rem * var(--cds-rem-scale, 1)))` (User message bubble radius, alias: `--cds-radius-message-bubble`)
* Precision scale: `--radius-xs` (2px), `--radius-sm` (4px), `--radius-md` (6px, alias: `--cds-radius-btn-xs`), `--radius-lg` (8px, alias: `--cds-radius-btn-md`), `--radius-xl` (12px, alias: `--cds-radius-code`), `--radius-2xl` (16px, alias: `--cds-radius-dialog`), `--radius-3xl` (24px)

---

## ⚡ 2. Motion Physics & Spring Presets

Always import canonical spring presets from [`code-examples/ClaudeMotionPresets.ts`](code-examples/ClaudeMotionPresets.ts) instead of hardcoding random transition parameters.

```typescript
import {
  SPRING_BOUNCY,
  SPRING_SNAPPY,
  SPRING_GENTLE,
  SPRING_HEAVY_SNAP,
} from './ClaudeMotionPresets';
```

### The 4 Canonical Spring Presets

Presets 1, 2 and 4 are observed values extracted from `Claude.app` `ion-dist`.
Preset 3 (`SPRING_GENTLE`) is a project-local addition, not a CDS observation —
no client release checked here contains `stiffness:380` or `damping:18`. Values
below are recomputed from the exported constants, not copied from prose.
`Observed use` lines record call sites found in the shipped bundle, not inferred intent.

> **Provenance and version scope.** `Observed use` and the client inventory in
> this section were verified against **`/Applications/Claude.app` 2.42304.2**.
> The `docs/v1` chapters describe **v1.28** and are deliberately left as the
> historical record of that release; the `docs/v2` chapters describe
> **v2.37337.1** but do not carry a spring table. Constant values are stable
> across these releases; call sites are not.

1. **`SPRING_BOUNCY`** (`stiffness: 600, damping: 30, mass: 1.0`, $\zeta = 0.612$):
   - **Overshoot**: `+8.8%`.
   - **Observed use**: Microphone button mount/unmount `scale`+`opacity`, voice-bar
     `width: 0 → 32` expansion, button padding morphs, and `popLayout` icon swaps.
   - **Source**: `ion-dist/assets/v1/shared-8-PHXy9B6B.js`.
2. **`SPRING_SNAPPY`** (`stiffness: 320, damping: 28, mass: 1.0`, $\zeta = 0.783$):
   - **Overshoot**: `+1.9%`.
   - **Observed use**: Drag-release rebound — paired `animate(dx|dy, target, {...preset, velocity})`
     calls that settle a dragged element onto its slot using the release velocity.
     Not an entrance animation. Guarded by `prefers-reduced-motion`, which snaps instead.
   - **Source**: `ion-dist/assets/v1/c427176b2-DuM09fKk.js`.
3. **`SPRING_GENTLE`** (`stiffness: 380, damping: 18, mass: 1.0`, $\zeta = 0.462$):
   - **Overshoot**: `+19.5%`.
   - **Observed use**: none — this preset has no client call site.
   - **Source**: none. Project-local preset filling the gap between the
     near-critically-damped pair and the high-frequency pop; do not present it as a Claude reading.
   - **Do not equate it with `duration .32 / bounce .15`.** That real client config
     (`shared-9-Co0ph6Xn.js`, dictation↔rest state swap) resolves through framer-motion
     `tn()` to `stiffness ≈ 244, damping ≈ 26.6, ζ ≈ 0.85` — `+0.6%` overshoot, not `+19.5%`.
4. **`SPRING_HEAVY_SNAP`** (`stiffness: 1200, damping: 80, mass: 0.1`, $\zeta = 3.652$, overdamped):
   - **Overshoot**: `0%` (Zero overshoot).
   - **Observed use**: `file_viewer` panel width animation — `animate(width, 384, preset)`
     on open and back to the computed initial width on close. In the same module
     `kt = 320` is the minimum width and `At = 480` the default width.
   - **Source**: `ion-dist/assets/v1/c8ad300b7-07P9B-v4.js`.

### Other spring presets observed in the client

The four names above are a project convention, not a complete client inventory.
The shipped bundle contains 14 distinct spring configs; these three are missing
from the preset file and are worth knowing about:

| Config | ζ | Overshoot | Observed use | Source |
| :--- | :--- | :--- | :--- | :--- |
| `420 / 28` | 0.683 | `+5.3%` | Draggable capture popover, `scale .25 → 1` entrance with `dragElastic: .05` | `c0447db9a-KKfDTbDr.js` |
| `260 / 16` | 0.496 | `+16.6%` | Capture-selection handle rotation, `-90°` arrow marker; exit `scale .6` | `c0447db9a-KKfDTbDr.js` |
| `300 / 35 / mass 1` | 1.01 | `0%` | Staggered list entrance, `translateY 32 → 0` with `staggerChildren: .15` and a separate `opacity` ease-out | `ccd647019-DrnyijvI.js` |

Two more appear as timing variants rather than reusable presets: `320 / 30`
(`delay: 1`, credits controls row) and `500 / 30 / mass .7`.

### Version caveat

`docs/v1` records the matrix as it appeared in client **v1.28**, labelling
`600 / 30` as "buttons" and `1200 / 80 / .1` as "sidebar drag damping". That
mapping was correct for that release. In **2.42304.2** both constants survive
unchanged but their call sites moved: `600 / 30` now drives the microphone and
voice bar, and `1200 / 80 / .1` drives the `file_viewer` panel width. Neither
`docs/v1` nor `docs/v2` covers 2.42304.2, so the table above is the only
current-version record in this repo. When a scenario label matters, re-derive it
from the bundle rather than trusting either volume.

### 7-Stop Non-Linear Fade Mask
Never use a linear gradient for scroll fading. Use the calibrated 7-stop non-linear mask:
```css
mask-image: linear-gradient(
  to bottom,
  transparent 0%,
  rgba(0, 0, 0, 0.05) 15%,
  rgba(0, 0, 0, 0.18) 32%,
  rgba(0, 0, 0, 0.38) 50%,
  rgba(0, 0, 0, 0.64) 68%,
  rgba(0, 0, 0, 0.88) 85%,
  black 100%
);
```
See [`code-examples/ScrollFadeContainer.tsx`](code-examples/ScrollFadeContainer.tsx) for dynamic top/bottom edge zeroing logic.

---

## 🧩 3. Component Directory: 30 Production Modules

Refer to or import from [`code-examples/`](code-examples/) when composing UI:

### Atomic Controls (5)
* [`CdsButton.tsx`](code-examples/CdsButton.tsx): 4-tier ladder (XS: 24/6px, SM: 28/8px, MD: 32/8px, LG: 40/12px), 5 variants (Primary, Secondary, Ghost, Outline, Danger).
* [`SegmentedControl.tsx`](code-examples/SegmentedControl.tsx): 9999px rounded pill track, 2px geometric padding, CSS & Framer Motion dual-mode.
* [`StatusIndicators.tsx`](code-examples/StatusIndicators.tsx): Clay 2.4s breathing light, 1.2s active run pulse, 3-dot wave, skeleton sweep.
* [`ConfirmationDialog.tsx`](code-examples/ConfirmationDialog.tsx): 16px corner radius, dual-ring popover shadow, focus trap.
* [`AttachmentCard.tsx`](code-examples/AttachmentCard.tsx): 10px panel radius, desktop card grid (128×96px) and inline composer pill dual-mode.

### Conversation Stream & Input (6)
* [`ChatComposer.tsx`](code-examples/ChatComposer.tsx): 20px core input terminal, dual-ring focus shadow, `field-sizing: content` auto-resize.
* [`ChatMessageBubbles.tsx`](code-examples/ChatMessageBubbles.tsx): User 18px radius with soft tint vs Assistant zero-border transparent layout.
* [`ThinkingAccordion.tsx`](code-examples/ThinkingAccordion.tsx): Framer Motion height spring expansion, single clay breathing pulse dot, active generation mutex.
* [`RichComposerWithMentions.tsx`](code-examples/RichComposerWithMentions.tsx): CJK IME composition guard, `/` command & `@` context dual triggers, token budget estimator.
* [`ModelSwitcherWithTokenGauge.tsx`](code-examples/ModelSwitcherWithTokenGauge.tsx): 3-tier model switcher, Extended Thinking toggle, Prompt Caching 4-color memory SVG gauge.
* [`McpToolDecisionCard.tsx`](code-examples/McpToolDecisionCard.tsx): 3-state authorization lifecycle (`pending_approval` → `running` → `success`/`error`), 3-tier action array.

### Atmosphere & Motion (3)
* [`ClaudeMotionPresets.ts`](code-examples/ClaudeMotionPresets.ts): 4 calibrated physics presets.
* [`ReasoningAmbientGlow.tsx`](code-examples/ReasoningAmbientGlow.tsx): Warm Clay diffuse light field, `cds-shimmer-text-shine` asymmetric sweep, caustic canvas.
* [`ScrollFadeContainer.tsx`](code-examples/ScrollFadeContainer.tsx): 7-stop non-linear mask with edge sensors.

### Audiovisual & Media (8)
* [`ClaudeAudioPlayer.ts`](code-examples/ClaudeAudioPlayer.ts): Procedural Web Audio API oscillator synthesis, 30% gentle volume standard, anti-pop gain ramp smoothing.
* [`LiveMicActivityBars.tsx`](code-examples/LiveMicActivityBars.tsx): 6-band speech spectrum visualizer (85Hz-4.8kHz), 8% noise floor gate, `Math.pow(energy, 0.7)` non-linear Gamma power compression.
* [`MediaLightboxViewer.tsx`](code-examples/MediaLightboxViewer.tsx): 75vw runway viewport, cursor-anchored affine pan/zoom equation, 4px drag deadzone, Ctrl + wheel zooming.
* [`useClaudeSharedElementTransition.ts`](code-examples/useClaudeSharedElementTransition.ts): `startViewTransition` wrapper with dynamic corner radius detection and `object-fit: contain` clip calculation.
* [`ArtifactsSplitPaneResizer.tsx`](code-examples/ArtifactsSplitPaneResizer.tsx): Iframe pointer shield, 4px deadzone, double-click 50/50 spring snap, collapse thresholds.
* [`EpitaxyIframeBridge.tsx`](code-examples/EpitaxyIframeBridge.tsx): Strict Origin validation & channel-isolated postMessage RPC, user-gesture gating (`navigator.userActivation`).
* [`StreamingDiffViewer.tsx`](code-examples/StreamingDiffViewer.tsx): Table line-number alignment with `tabular-nums`, incremental streaming pipeline, unified/split view, 2.5s copy cooldown.
* [`CodeBlock.tsx`](code-examples/CodeBlock.tsx): 12px radius, `#0d0d0c` solid black background, inline optical alignment for language tags.

### Desktop & System Architecture (8)
* [`createClaudeMainWindow.ts`](code-examples/createClaudeMainWindow.ts): Electron host window factory: `hiddenInset` titlebar, macOS Vibrancy (`under-window`) glass blending, 1200×800 default, 600×400 min.
* [`ClaudeDesktopHeader.tsx`](code-examples/ClaudeDesktopHeader.tsx): macOS traffic light 74px inverse zoom compensation slot (`ew = 74`), 45px global drag band.
* [`DraggableSessionList.tsx`](code-examples/DraggableSessionList.tsx): `pinnedOrder` optimistic topological reordering, 4px deadzone, tilted ghost shadow.
* [`CoworkAgentCanvas.tsx`](code-examples/CoworkAgentCanvas.tsx): Multi-agent task delegation state machine, team-shared artifact asset pool, cross-window `BroadcastChannel` sync.
* [`useClaudeScrollPinning.ts`](code-examples/useClaudeScrollPinning.ts): 150ms cooldown latch against scroll hijacking, 40px bottom-tolerance scroll pin, GPU subpixel blur elimination.
* [`ContainerResponsiveBar.tsx`](code-examples/ContainerResponsiveBar.tsx): `@container`-driven 4-tier fluid compression matrix (>=576px / <480px / <384px / <320px), preventing glyph breaks.
* [`useClaudeRovingFocus.ts`](code-examples/useClaudeRovingFocus.ts): W3C WAI-ARIA compliance: 1D & 2D arrow key grid navigation, Home/End boundary jumps.
* [`useRateLimitBackoff.ts`](code-examples/useRateLimitBackoff.ts): 429/503 truncated exponential backoff (`t = min(t_max, t_base * 2^a) * (1 ± J)`), full jitter, circuit breaker.

---

## 🛡️ 4. Agent Coding Invariants (Do's and Don'ts)

### ✅ DO
1. **Always use semantic tokens**: Use `var(--cds-bg-surface-0)` or Tailwind classes (`bg-surface-0`, `text-primary`, `bg-clay-500`) instead of arbitrary hardcoded HEX values.
2. **Apply `tabular-nums` for dynamic numbers**: Every timer, countdown, token counter, audio frequency indicator, and line number MUST use `tabular-nums` (or `font-mono`) to prevent layout jitter.
3. **Guard CJK IME inputs**:
   ```typescript
   const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
     if (e.nativeEvent.isComposing || e.keyCode === 229) return;
     if (e.key === 'Enter' && !e.shiftKey) {
       e.preventDefault();
       handleSendMessage();
     }
   };
   ```
4. **Support Dark Mode**: Always test that UI looks correct under both light (`:root`) and dark mode (`.dark`).
5. **Enforce Single-Stroke Borders**: If a container has a border, its internal action buttons or chips should have `border-none`.

### ❌ DON'T
1. **Never introduce raw linear jumps**: Do not write `transition: all 0.3s linear` or `transition: all 0.5s ease`. Use Framer Motion springs or the calibrated cubic-bezier curves (`[0.16, 1, 0.3, 1]`).
2. **Never commit binary assets**: Never introduce `.ttf`, `.otf`, `.mp3`, or `.wav` files into the repository.
3. **Never bypass Sandbox Security**: Never add `allow-same-origin` to an iframe bridge running arbitrary LLM-generated HTML.
4. **Never hijack scroll during streaming**: Do not force-scroll to bottom if `Date.now() - lastUserScrollTime < 150ms`.

---

## 🧪 5. Verification & Quality Gates

Whenever you write or modify code in this repository, you **MUST** run the following verification commands to ensure zero regressions:

```bash
# 1. Typecheck the entire project
npm run typecheck

# 2. Verify design token consistency
npm run check:tokens

# 3. Build library output
npm run build
```

Both commands must exit with code 0 and output **0 errors**.

---

## 🔌 6. Runtime Portability & Host Bridging (运行时分层与宿主桥接)

To maximize consumption surface across different host environments (e.g. non-React web apps, Electron desktop harnesses like DSH, or custom plugin shells), the repository assets are structured into 3 portability tiers:

### 1. The Three Portability Tiers
* 🎨 **Pure CSS (Tokens & Shaders)**: Zero JavaScript runtime dependency. Includes `code-examples/cds-theme.css`, CSS-driven scroll fade (`.cds-scroll-fade`), breathing lights (`.cds-dot-breathe`), and skeleton sweeps. Can be consumed by any HTML/CSS project directly.
* ⚡ **Pure Logic / Headless**: Pure math and browser APIs without React UI bindings. Includes `code-examples/ClaudeMotionPresets.ts` (spring formulas), `code-examples/ClaudeAudioPlayer.ts` (Web Audio synthesis), `code-examples/useClaudeScrollPinning.ts`, and `code-examples/useRateLimitBackoff.ts`.
* ⚛️ **React Components**: Stateful, interactive UI controls relying on React hooks/refs. Includes `MediaLightboxViewer.tsx`, `DraggableSessionList.tsx`, `McpToolDecisionCard.tsx`, `ChatComposer.tsx`, etc.

### 2. Host Bridge Mapping Pattern (宿主别名桥接)
If your host application uses a custom design token prefix (e.g., `--app-*` or `--dsw-*`), bridge to CDS by defining aliases in your host stylesheet:

```css
/* Host application stylesheet */
:root {
  --app-brand-primary: var(--brand);                  /* #c6613f */
  --app-brand-accent: var(--cds-clay);                /* #d97757 */
  --app-bg-canvas: var(--cds-surface-0);              /* #f9f9f7 / #0b0b0b */
  --app-bg-card: var(--cds-surface-2);                /* #ffffff / #1a1a19 */
  --app-border-base: var(--cds-border);               /* hairline divider */
  --app-radius-card: var(--radius-card);              /* concentric card radius */
  --app-shadow-composer: var(--cds-shadow-composer);  /* composer diffuse shadow */
}
```
