# Agent Guidelines for Claude Design System (CDS)

Welcome, AI Agent! This repository ([`open-claude-ui`](https://github.com/Caho1/open-claude-ui)) contains React components, design tokens, and interaction animations for the **Claude Design System (CDS)**.

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
   - Use the 4 calibrated Framer Motion spring presets from [`code-examples/ClaudeMotionPresets.ts`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/ClaudeMotionPresets.ts).
4. **Pure Code & Zero Copyright Violations**:
   - Zero proprietary binary fonts (`.otf`/`.ttf`) or audio files (`.mp3`/`.wav`).
   - Use the calibrated system fallback font stacks and procedural Web Audio API oscillator synthesis.
5. **Strict Edge-Case Guards**:
   - Always guard chat/composer inputs against CJK IME composition accidents (`!(e.nativeEvent.isComposing || e.keyCode === 229)`).
   - Latch scroll pinning with a 150ms cooldown timestamp to prevent LLM streaming from hijacking manual user scrolling.

---

## 🎨 1. Design Tokens & Styling Architecture

All tokens are defined in [`code-examples/cds-theme.css`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/cds-theme.css) and exposed through Tailwind classes via [`code-examples/tailwind.config.js`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/tailwind.config.js).

### Surface & Background Tokens
| Token | Light Mode Value | Dark Mode Value | Usage |
| :--- | :--- | :--- | :--- |
| `--cds-bg-surface-0` | `#fcfcfb` | `#1b1b19` | Base application background, page canvas |
| `--cds-bg-surface-1` | `#fbfbfa` | `#21211e` | Sidebar panels, secondary cards |
| `--cds-bg-surface-2` | `#f7f7f5` | `#282824` | Input bars, dialog backdrops, floating popovers |
| `--cds-bg-surface-3` | `#efeee9` | `#32322d` | Active states, hover fills, elevated tags |
| `--cds-bg-input` | `#fdfdfc` | `#1e1e1b` | Text fields, chat input background |

### Text & Border Tokens
| Token | Light Mode Value | Dark Mode Value | Usage |
| :--- | :--- | :--- | :--- |
| `--cds-text-primary` | `#1f1e1d` | `#eeede8` | Headings, primary body text, active labels |
| `--cds-text-secondary` | `#6b6966` | `#b4b2ac` | Timestamps, subtitles, secondary actions |
| `--cds-text-tertiary` | `#999793` | `#7d7b76` | Placeholders, disabled text, hotkey hints |
| `--cds-border-subtle` | `rgba(0, 0, 0, 0.06)` | `rgba(255, 255, 255, 0.08)` | Dividers, subtle list borders |
| `--cds-border-card` | `rgba(0, 0, 0, 0.08)` | `rgba(255, 255, 255, 0.12)` | Component cards, attachments, popovers |

### Brand Clay Palette
* `clay-500` (Default brand): `#d97757` (Light) / `#cc6b49` (Dark)
* `clay-600` (Hover): `#c56445` (Light) / `#e07a58` (Dark)
* `clay-700` (Active): `#b2563a` (Light) / `#b55a3d` (Dark)
* Dual-ring focus shadow: `box-shadow: 0 0 0 2px var(--cds-bg-surface-0), 0 0 0 4px rgba(217, 119, 87, 0.4)`

### Geometric Corner Radii
* `9999px` (`--cds-radius-pill`): Pill buttons, segmented control tracks, model switcher capsules.
* `20px` (`--cds-radius-composer`): Main chat composer terminal.
* `18px` (`--cds-radius-message-bubble`): User message bubbles.
* `16px` (`--cds-radius-dialog`): Confirmation dialogs, modal popups.
* `12px` (`--cds-radius-code`): Code blocks, large buttons (`LG`).
* `10px` (`--cds-radius-card`): Attachment cards, image containers.
* `8px` (`--cds-radius-btn-md`): Standard interactive buttons (`MD`/`SM`), tool decision cards.
* `6px` (`--cds-radius-btn-xs`): Compact badge buttons (`XS`), shortcut chips.

---

## ⚡ 2. Motion Physics & Spring Presets

Always import canonical spring presets from [`code-examples/ClaudeMotionPresets.ts`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/ClaudeMotionPresets.ts) instead of hardcoding random transition parameters.

```typescript
import {
  SPRING_BOUNCY,
  SPRING_SNAPPY,
  SPRING_GENTLE,
  SPRING_HEAVY_SNAP,
} from './ClaudeMotionPresets';
```

### The 4 Canonical Spring Presets
1. **`SPRING_SNAPPY`** (`stiffness: 600, damping: 30, mass: 0.6`, $\zeta = 0.791$):
   - **Overshoot**: `+1.8%`, settle time: `~0.22s`.
   - **Where to use**: Primary button clicks, segmented control pill switching (`layoutId`), tabs, micro-interactions.
2. **`SPRING_BOUNCY`** (`stiffness: 400, damping: 25, mass: 0.8`, $\zeta = 0.612$):
   - **Overshoot**: `+8.8%`, settle time: `~0.38s`.
   - **Where to use**: Toggle switches, badge growth entrances, success confirmation pop-ins.
3. **`SPRING_GENTLE`** (`stiffness: 220, damping: 24, mass: 1.0`, $\zeta = 0.809$):
   - **Overshoot**: `+1.5%`, settle time: `~0.48s`.
   - **Where to use**: Modals, Thinking Accordion height expansion, message bubble entry, split-pane 50/50 reset.
4. **`SPRING_HEAVY_SNAP`** (`stiffness: 1200, damping: 80, mass: 0.1`, $\zeta = 1.826$, overdamped):
   - **Overshoot**: `0%` (Zero overshoot).
   - **Where to use**: Session item drag-and-drop placeholder collision, magnetic drawer snapping.

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
See [`code-examples/ScrollFadeContainer.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/ScrollFadeContainer.tsx) for dynamic top/bottom edge zeroing logic.

---

## 🧩 3. Component Directory: 30 Production Modules

Refer to or import from [`code-examples/`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/) when composing UI:

### Atomic Controls (5)
* [`CdsButton.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/CdsButton.tsx): 4-tier ladder (XS: 24/6px, SM: 28/8px, MD: 32/8px, LG: 40/12px), 5 variants (Primary, Secondary, Ghost, Outline, Danger).
* [`SegmentedControl.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/SegmentedControl.tsx): 9999px rounded pill track, 2px geometric padding, CSS & Framer Motion dual-mode.
* [`StatusIndicators.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/StatusIndicators.tsx): Clay 2.4s breathing light, 1.2s active run pulse, 3-dot wave, skeleton sweep.
* [`ConfirmationDialog.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/ConfirmationDialog.tsx): 16px corner radius, dual-ring popover shadow, focus trap.
* [`AttachmentCard.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/AttachmentCard.tsx): 10px panel radius, desktop card grid (128×96px) and inline composer pill dual-mode.

### Conversation Stream & Input (6)
* [`ChatComposer.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/ChatComposer.tsx): 20px core input terminal, dual-ring focus shadow, `field-sizing: content` auto-resize.
* [`ChatMessageBubbles.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/ChatMessageBubbles.tsx): User 18px radius with soft tint vs Assistant zero-border transparent layout.
* [`ThinkingAccordion.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/ThinkingAccordion.tsx): Framer Motion height spring expansion, single clay breathing pulse dot, active generation mutex.
* [`RichComposerWithMentions.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/RichComposerWithMentions.tsx): CJK IME composition guard, `/` command & `@` context dual triggers, token budget estimator.
* [`ModelSwitcherWithTokenGauge.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/ModelSwitcherWithTokenGauge.tsx): 3-tier model switcher, Extended Thinking toggle, Prompt Caching 4-color memory SVG gauge.
* [`McpToolDecisionCard.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/McpToolDecisionCard.tsx): 3-state authorization lifecycle (`pending_approval` → `running` → `success`/`error`), 3-tier action array.

### Atmosphere & Motion (3)
* [`ClaudeMotionPresets.ts`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/ClaudeMotionPresets.ts): 4 calibrated physics presets.
* [`ReasoningAmbientGlow.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/ReasoningAmbientGlow.tsx): Warm Clay diffuse light field, `cds-shimmer-text-shine` asymmetric sweep, caustic canvas.
* [`ScrollFadeContainer.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/ScrollFadeContainer.tsx): 7-stop non-linear mask with edge sensors.

### Audiovisual & Media (8)
* [`ClaudeAudioPlayer.ts`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/ClaudeAudioPlayer.ts): Procedural Web Audio API oscillator synthesis, 30% gentle volume standard, anti-pop gain ramp smoothing.
* [`LiveMicActivityBars.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/LiveMicActivityBars.tsx): 6-band speech spectrum visualizer (85Hz-4.8kHz), 8% noise floor gate, `Math.pow(energy, 0.7)` non-linear Gamma power compression.
* [`MediaLightboxViewer.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/MediaLightboxViewer.tsx): 75vw runway viewport, cursor-anchored affine pan/zoom equation, 4px drag deadzone, Ctrl + wheel zooming.
* [`useClaudeSharedElementTransition.ts`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/useClaudeSharedElementTransition.ts): `startViewTransition` wrapper with dynamic corner radius detection and `object-fit: contain` clip calculation.
* [`ArtifactsSplitPaneResizer.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/ArtifactsSplitPaneResizer.tsx): Iframe pointer shield, 4px deadzone, double-click 50/50 spring snap, collapse thresholds.
* [`EpitaxyIframeBridge.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/EpitaxyIframeBridge.tsx): Strict Origin validation & channel-isolated postMessage RPC, user-gesture gating (`navigator.userActivation`).
* [`StreamingDiffViewer.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/StreamingDiffViewer.tsx): Table line-number alignment with `tabular-nums`, incremental streaming pipeline, unified/split view, 2.5s copy cooldown.
* [`CodeBlock.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/CodeBlock.tsx): 12px radius, `#0d0d0c` solid black background, inline optical alignment for language tags.

### Desktop & System Architecture (8)
* [`createClaudeMainWindow.ts`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/createClaudeMainWindow.ts): Electron host window factory: `hiddenInset` titlebar, macOS Vibrancy (`under-window`) glass blending, 1200×800 default, 600×400 min.
* [`ClaudeDesktopHeader.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/ClaudeDesktopHeader.tsx): macOS traffic light 74px inverse zoom compensation slot (`ew = 74`), 45px global drag band.
* [`DraggableSessionList.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/DraggableSessionList.tsx): `pinnedOrder` optimistic topological reordering, 4px deadzone, tilted ghost shadow.
* [`CoworkAgentCanvas.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/CoworkAgentCanvas.tsx): Multi-agent task delegation state machine, team-shared artifact asset pool, cross-window `BroadcastChannel` sync.
* [`useClaudeScrollPinning.ts`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/useClaudeScrollPinning.ts): 150ms cooldown latch against scroll hijacking, 40px bottom-tolerance scroll pin, GPU subpixel blur elimination.
* [`ContainerResponsiveBar.tsx`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/ContainerResponsiveBar.tsx): `@container`-driven 4-tier fluid compression matrix (>=576px / <480px / <384px / <320px), preventing glyph breaks.
* [`useClaudeRovingFocus.ts`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/useClaudeRovingFocus.ts): W3C WAI-ARIA compliance: 1D & 2D arrow key grid navigation, Home/End boundary jumps.
* [`useRateLimitBackoff.ts`](file:///Users/jiahao/Desktop/PythonProject/open-claude-ui/code-examples/useRateLimitBackoff.ts): 429/503 truncated exponential backoff (`t = min(t_max, t_base * 2^a) * (1 ± J)`), full jitter, circuit breaker.

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

# 2. Build TypeScript output
npm run build
```

Both commands must exit with code 0 and output **0 errors**.
