# CLAUDE.md - Claude Code Agent Guidance

This repository contains React components, design tokens, and interaction animations for the **Claude Design System (CDS)**.

## Core Reference
All architectural guidelines, design tokens, spring presets, component directories, and invariant rules are defined in **[`AGENTS.md`](AGENTS.md)**. Always refer to `AGENTS.md` before implementing or modifying UI components or motion behaviors.

## Quick Commands
- **Typecheck**: `npm run typecheck` (`tsc --noEmit`)
- **Build**: `npm run build` (`tsc`)
- **Format / Lint**: Ensure TypeScript compiles with zero errors and matches existing repository style.

## Key Principles
1. **Design Tokens**: Use semantic tokens from `code-examples/cds-theme.css` (`bg-surface-0`, `clay-500`, `text-primary`, etc.). Avoid hardcoded arbitrary HEX colors.
2. **Physics**: Always use the 4 canonical spring presets from `code-examples/ClaudeMotionPresets.ts` (`SPRING_BOUNCY`, `SPRING_SNAPPY`, `SPRING_GENTLE`, `SPRING_HEAVY_SNAP`).
3. **No Binary Assets**: Use system fallback font stacks and procedural Web Audio API synthesis. Never add `.ttf`, `.otf`, `.mp3`, or `.wav` files.
4. **Input & Viewport Guards**: Use CJK IME composition guards (`!(isComposing || keyCode === 229)`) and 150ms scroll pinning cooldown latch against viewport hijacking.
5. **Security**: Keep iframe sandbox strictly isolated (no `allow-same-origin`) and gated with `navigator.userActivation`.
