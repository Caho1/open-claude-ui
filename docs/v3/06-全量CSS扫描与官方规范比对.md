---
title: "第六章：全量 CSS 扫描与官方 CDS 规范比对"
category: reverse-engineering
domain: architecture/desktop_application
version: "3.0 (3.6556.2)"
status: stable
date: 2026-10-26
author: "REA 逆向工程实验室"
evidence_root: "b2dfbbb40325d978dcb7561ad12a6f9bc199f8f46b7d3d2899af74ce8965d68a"
supplements: "04-系统底座全景解密.md"
---

# 第六章：全量 CSS 扫描与官方 CDS 规范比对

> 本章完成 [第七章 7.3.1](07-总结与后续工作.md) 列出的待核实项：扫描剩余 16 个 CSS 文件，并比对从 ASAR 中意外提取到的**官方 CDS 规范文档**。

---

## 6.1 扫描范围与方法

### 6.1.1 全部 17 个 CSS 文件

```bash
# 从 ASAR 提取全部 .css
node scripts/extract-all-css.mjs
```

| # | 路径 | 字节 |
| ---: | :--- | ---: |
| 1 | `.vite/renderer/main_window/assets/MainWindowPage-BjVtjJFx.css` | 237,153 |
| 2 | `.vite/renderer/main_window/assets/clawdQuestEngine-C2Z1JudX.css` | 10,425 |
| 3 | `.vite/renderer/about_window/window-shared.css` | 8,078 |
| 4 | `.vite/renderer/buddy_window/window-shared.css` | 8,078 |
| 5 | `.vite/renderer/find_in_page/window-shared.css` | 8,078 |
| 6 | `.vite/renderer/quick_window/window-shared.css` | 8,078 |
| 7 | `resources/artifact-libs/npm_gridjs@5.0.2_dist_theme_mermaid.min.css` | 7,762 |
| 8 | `.vite/renderer/about_window/window-legacy-pins.css` | 6,289 |
| 9 | `.vite/renderer/buddy_window/window-legacy-pins.css` | 6,289 |
| 10 | `.vite/renderer/find_in_page/window-legacy-pins.css` | 6,289 |
| 11 | `.vite/renderer/quick_window/window-legacy-pins.css` | 6,289 |
| 12 | `.vite/renderer/buddy_window/assets/main-a4mzyXdA.css` | 4,185 |
| 13 | `.vite/renderer/file_viewer/assets/main-1OAtvhCc.css` | 2,468 |
| 14 | `.vite/renderer/about_window/assets/main-CiwjW8Wn.css` | 2,226 |
| 15 | `.vite/renderer/find_in_page/assets/main-CiwjW8Wn.css` | 2,226 |
| 16 | `.vite/renderer/quick_window/assets/main-CiwjW8Wn.css` | 2,226 |
| 17 | `.vite/renderer/find_in_page/assets/FindInPage-BLyCri-A.css` | 159 |

### 6.1.2 按内容去重

17 个文件实际只有 **9 个唯一内容**：

```bash
# 内容哈希分组
find . -name "*.css" -type f -exec sh -c 'echo "$(shasum -a 256 "$1"|cut -c1-16)  $(basename "$1")  $(stat -f%z "$1")"' _ {} \; | sort
```

| 哈希（前 16 位） | 字节 | 副本数 | 代表文件 |
| :--- | ---: | ---: | :--- |
| `93ee8d85fbd02d47` | 237,153 | 1 | `MainWindowPage-BjVtjJFx.css` |
| `47b0fe3ef3465303` | 10,425 | 1 | `clawdQuestEngine-C2Z1JudX.css` |
| `13231ac1ec506296` | 8,078 | **4** | `window-shared.css`（四窗口共用） |
| `3e21976233fb7992` | 6,289 | **4** | `window-legacy-pins.css`（四窗口共用） |
| `5368cc350f8fd0ce` | 2,226 | **3** | `main-CiwjW8Wn.css`（三窗口共用） |
| `dd1222b75448fcc2` | 4,185 | 1 | `buddy_window/assets/main-a4mzyXdA.css` |
| `f0eeaab7f54d0e6f` | 2,468 | 1 | `file_viewer/assets/main-1OAtvhCc.css` |
| `0a92ad466a253c79` | 159 | 1 | `FindInPage-BLyCri-A.css` |

**结论**：实际需要分析的是 **9 个唯一文件**，其中 8 个在 `.vite/renderer/`，1 个是第三方（grid.js mermaid 主题）。

---

## 6.2 结论一：44 个缺失 keyframes 全部在主样式表中

### 6.2.1 全 17 文件并集

```bash
cat $(find . -name "*.css" -type f) | grep -o "@keyframes [a-zA-Z0-9_-]*" | sed 's/@keyframes //' | sort -u | wc -l
# → 59
```

对比：

| 范围 | keyframes 数 |
| :--- | ---: |
| 仅主样式表 | **55** |
| 全部 17 个文件并集 | **59** |

### 6.2.2 主表之外多出的 4 个

```bash
comm -13 <主表55项> <全并集59项>
```

```
cq-fadeIn
cq-slipIn
shimmer
turn
```

| keyframe | 来源文件 | 说明 |
| :--- | :--- | :--- |
| `cq-fadeIn` | `clawdQuestEngine-C2Z1JudX.css` | `cq-` 前缀，独立命名空间（`--cq-*` token），非 CDS |
| `cq-slipIn` | 同上 | 同上 |
| `shimmer` | `npm_gridjs@5.0.2_dist_theme_mermaid.min.css` | 第三方库（grid.js） |
| `turn` | `file_viewer/assets/main-1OAtvhCc.css` | file_viewer 窗口局部 |

**关键结论**：**没有任何一个新的 `cds-*` keyframes 出现在主样式表之外。**

### 6.2.3 对 44 个缺失项的最终裁定

```bash
# 44 = 客户端 55 项中我们缺失的
comm -13 <(ours 32项) <(主表 55项) | wc -l
# → 44

# 这 44 项在 59 项并集中的命中数
comm -12 <missing44.txt> <kf-all17.txt> | wc -l
# → 44（全部命中，但命中来源全是主表）
```

**判定**：44 项确实都"存在于"并集，但并集 = 主表 55 + 4 个非 `cds-*`（`cq-fadeIn`/`cq-slipIn`/`shimmer`/`turn`）。因此 **44 项全部来自主样式表，没有一项来自其它 16 个文件**。

**另一角度交叉验证**：我们自己的 32 项中，只有 11 项在并集里，21 项是客户端完全没有的（见 [4.1.3](04-系统底座全景解密.md)）。

**因此 [第四章 4.1.3](04-系统底座全景解密.md) 的 44 个缺失项，无法通过扫描其它 CSS 文件解决。** 它们是真实缺失，必须从主样式表移植。

### 6.2.4 各文件的 keyframes 分布

```bash
for f in $(find . -name "*.css" -type f); do
  echo "$f: $(grep -o '@keyframes [a-zA-Z0-9_-]*' "$f" | sort -u | tr '\n' ' ')"
done
```

| 文件 | keyframes |
| :--- | :--- |
| `MainWindowPage-BjVtjJFx.css` | 55 个 `cds-*` + `spin` |
| `clawdQuestEngine-C2Z1JudX.css` | `cq-fadeIn`、`cq-slipIn` |
| `file_viewer/assets/main-1OAtvhCc.css` | `turn` |
| `npm_gridjs…mermaid.min.css` | `shimmer` |
| `window-shared.css`（×4） | **无** |
| `window-legacy-pins.css`（×4） | **无** |
| `main-CiwjW8Wn.css`（×3） | **无** |
| `buddy/assets/main-a4mzyXdA.css` | **无** |
| `FindInPage-BLyCri-A.css` | **无** |

---

## 6.3 结论二：`window-shared.css` 揭示 CDS 的真实分发路径

### 6.3.1 该文件的性质

`window-shared.css` 是一个 **Tailwind v4 CSS-first 入口**，不含任何实际规则，只有 `@import` 与 `@theme`。它的头部注释（原文）：

```css
/*
 * Tailwind v4 CSS-first entry for every desktop shell document; each window's
 * HTML inline-imports this file, except the main window, which loads it with
 * its page chunk (src/renderer/mainWindow/deferredStyles.css) (legacy
 * documents also import window-legacy-pins.css after it; see that file for
 * the coexistence pins and their per-document removal model). Ordering rules
 * for this file, each of which fails silently when broken:
 * - the bare "@layer cds-card;" line must stay first so that layer sorts
 *   lowest (packages/cds docs/getting-started.md section 2; without it
 *   CdsRoot logs an error in dev).
 * - the imports must come directly after it: CSS ignores an @import that
 *   follows any statement other than @charset or an @layer declaration.
 * - theme.css pulls in tokens.css itself; importing tokens.css here would
 *   bundle the token set twice.
 */
```

### 6.3.2 实际生效的 import（剥离注释后）

```bash
python3 -c "
import re
s=open('window-shared.css').read()
nc=re.sub(r'/\*[\s\S]*?\*/','',s)
print(nc.strip()[:400])
"
```

输出：

```css
@layer cds-card;

@import "tailwindcss";
@import "@ant/cds/theme.css";

@import "@ant/cds/root-weight-pin.css";

@config "../tailwind.config.js";
```

### 6.3.3 关键事实：`@ant/cds` 在 ASAR 中不存在

```bash
# 全 ASAR 629 条目中，路径含 @ant/cds 的：
node -e '...' → count: 0
# 含 theme.css / tokens.css / root-weight-pin.css 的：
→ (none)
```

**含义**：`@import "@ant/cds/theme.css"` 是一个**构建期引用**，在打包后的 ASAR 中已被**内联/展开**进 `MainWindowPage-BjVtjJFx.css`。这与文件头注释「theme.css pulls in tokens.css itself」一致。

**因此**：
- `--cds-*` 前缀的 token 是本仓库（Claude 桌面端）对 CDS 的**包内构建产物**
- `window-shared.css` 的 `@theme` 块定义了 Tailwind 的 `--color-*` 变量，与 CDS token 是两套

### 6.3.4 `window-shared.css` 中的内联早期绘制保护

注释（原文）：

```
 * shell's very first paint is already the right color. windowBaseCore.ts
 * only adds .darkTheme once its module graph has loaded, and the body
 * paints before that: without this block a dark-mode window flashed
 * light (#fcfcfb) for a few frames on launch, masked where the window is
 * revealed only after load and exposed where it is shown on construction.
 * Same values as .darkTheme below. The main window's index.html restates
 * this block inline, since it loads this sheet only with its page chunk.
```

对应 CSS：

```css
@media (prefers-color-scheme: dark) {
  :root {
    --claude-foreground-color: white;
    --claude-background-color: #151515;
    --claude-text-500: #a6a39b;
  }
}

.darkTheme {
  --claude-foreground-color: white;
  --claude-background-color: #151515;
  --claude-text-500: #a6a39b;
}
```

**这解释了暗色的第二套机制**：除了 CDS 的 `[data-mode=dark]`，桌面壳还有一套 `--claude-*` 变量 + `.darkTheme` class，专为**首次绘制防闪白**设计。

| 机制 | 变量前缀 | 触发方式 | 时机 |
| :--- | :--- | :--- | :--- |
| CDS 主题 | `--cds-*` | `[data-mode=dark]` | 组件级 |
| 桌面壳早期保护 | `--claude-*` | `.darkTheme` + `prefers-color-scheme` | 首屏绘制 |

### 6.3.5 `window-legacy-pins.css` 的性质

头部注释（原文）：

```
 * Legacy-value pins for the desktop shell documents that still render
 * pre-CDS (Tailwind v3 era) markup while the CDS pipeline is wired in.
 * Loaded by each legacy document's HTML AFTER window-shared.css, so every
 * rule here lands later in source order than the theme.css/tokens.css rule
 * it overrides, winning at tied specificity; layer names join the layers
 * the Tailwind build in window-shared.css already declared.
 *
 * Removal model: when a surface is rebuilt on CDS components, its document
 * simply stops importing this file (and any pin whose last consumer that
 * removes gets deleted here).
```

它是一层**兼容性 pin**，用于尚未迁移到 CDS 组件的旧标记。不含 `cds-*` keyframes。

---

## 6.4 结论三：提取到官方 CDS 规范文档

### 6.4.1 意外的发现

在扫描 JS 时发现 `index.chunk-CbnfBP-3.js`（467,734 字节）内嵌了一段**官方 CDS 文档**，由构建脚本生成并注入：

```
<!-- @generated by apps/cds-docs/scripts/gen-cds-skill.mjs from
     packages/cds/{CLAUDE.md,docs/**}. Do not edit by hand —
     edit the source docs and re-run `yarn workspace @ant/cds-docs gen:cds-skill`. -->
```

**提取方式**：

```bash
node -e '...' # 从 index.chunk-CbnfBP-3.js 中定位 "\\x3c!-- @generated by apps/cds-docs" 并解转义
# → 58,354 字符的 Markdown 文档
```

### 6.4.2 文档性质

该文档标题为 `# CDS tokens — vanilla`，明确说明：

```
The Claude Design System token vocabulary for plain HTML/CSS/SVG
surfaces without React or Tailwind. Tokens are unprefixed CSS custom
properties (--text-primary, --surface-1, --border) declared on
:root by @ant/cds/tokens.vanilla.css, with dark-mode overrides under
[data-mode="dark"] and @media (prefers-color-scheme: dark).
```

**关键**：官方 vanilla token 是**无前缀**的（`--surface-1`），而我们仓库用的是 **`--cds-` 前缀**。

### 6.4.3 官方六层 token 模型（原文）

```
1. Base palette   --{hue}-{stop}      literal hex, mode-stable (gray, red, orange,
                                      yellow, green, aqua, blue, violet, magenta)
2. Theme ramps    --neutral-N         gray-N in light, gray-(900-N) in dark
                  --alpha-N           neutral-900 @ fixed opacity (so it flips too)
3. Elevation      --surface-{0..3}    0 = darkest, 3 = lightest, in BOTH modes
4. Purpose        --surface-{popover, what components actually consume; includes the
                   panel}, --text-*,  role mappings ({fill|bg|border|text}-{role})
                   --fill-*, --on-*
—  page-bg        --page-bg           hook the host app sets to its canvas color
5. Density        --h-control*,       rem lengths (px ÷ 16); remapped by
                   --pad-*, --gap-*, [data-density]
                   --radius, --font-size-*,
                   --leading-*
6. Motion         --dur-*,            durations + easing curves (mode/density-invariant)
                   --ease-*
```

> **Components only read layer 4 (and 5 for sizing). Layers 1–3 are wiring.**

### 6.4.4 官方 Elevation 表（原文）

| Token | Light | Dark | Use case |
| :--- | :--- | :--- | :--- |
| `--surface-0` | `gray-20` | `gray-900` | Page |
| `--surface-1` | `gray-10` | `gray-850` | In-flow card |
| `--surface-2` | `gray-0` | `gray-830` | Panel |
| `--surface-3` | `gray-0` | `gray-800` | Popover |

与 [第四章 4.4](04-系统底座全景解密.md) 的实测完全一致。

### 6.4.5 官方 Motion 规范（原文）

```
| Motion | --dur-{fast,snap,base,slow} · --ease-{out,snap,overshoot} |
```

**官方只有 3 个 ease**：`out`、`snap`、`overshoot`。

对比 [第四章 4.6.2](04-系统底座全景解密.md) 的实测：

| 来源 | ease 值 |
| :--- | :--- |
| 官方文档 | 3 个（out / snap / overshoot） |
| 主样式表实测 | 4 个值（`out` 有 2 个值 + snap + overshoot） |

**差异解释**：主样式表的 `--cds-ease-out` 有两值（`cubic-bezier(.165,.84,.44,1)` 与 `cubic-bezier(0,0,.2,1)`），其中后者出现在旧代码路径。官方的是前者：

```css
/* 官方 vanilla */
--ease-out: cubic-bezier(0.165, 0.84, 0.44, 1)
--ease-snap: cubic-bezier(0.32, 0.72, 0, 1)
--ease-overshoot: cubic-bezier(0.34, 1.3, 0.64, 1)
```

我们当前实现与官方**完全一致**（仅小数点书写差异）：

```css
--cds-ease-out: cubic-bezier(.165, .84, .44, 1)
--cds-ease-snap: cubic-bezier(.32, .72, 0, 1)
--cds-ease-overshoot: cubic-bezier(.34, 1.3, .64, 1)
```

### 6.4.6 官方 Density 规范（原文）

```
## Density adapts to the surface

Console, claude.ai and antfarm share the same components — `compact` for
dev tools and power users, `comfortable` for consumer apps. Density is one
switch on `CdsRoot`, not a per-component prop, so a product can change
its feel without forking a single component.
```

**两档**：`compact` / `comfortable`。

### 6.4.7 官方 Design Rules（原文节选）

**Dark mode rule**：

```
Dark mode is `[data-mode="dark"]` on `:root` (or `prefers-color-scheme: dark`
with no explicit `data-mode`). All tokens flip automatically — never hardcode
a dark-mode override.
```

**Muted text rule**：

```
Supporting copy uses `color: var(--text-secondary)`; reserve
`var(--text-muted)` for placeholders, captions, and metadata. **Never**
`opacity` on text — opacity multiplies against the background and drifts
per-surface.
```

**Accent rule**：

```
At most **one** accent-filled (`variant="primary"`) Button per view;
siblings use `secondary` or `ghost`. The `brand` (clay) role is reserved
for Claude-initiated actions — send, generate — never ordinary user CTAs.
```

**Restraint rule**：

```
Default to the quieter, lighter option — "too cluttered" is the most
common design note.

- `secondary` is the default Button; `primary` / `brand` read as aggressive.
- Avoid disabled buttons. Keep them enabled and respond on use.
- Dense lists: bordered rows, not rounded-rect cards.
```

**Corners**（来自 interactive 模块章节）：

```
- **Corners**: use `border-radius: var(--radius)` for controls, `12px` for
  cards. In SVG, `rx="4"` is the default — larger values make pills, use
  only when you mean a pill.
- **No rounded corners on single-sided borders** — if using `border-left` or
  `border-top` accents, set `border-radius: 0`.
- **Layout**: `--radius` (8px), `--pad-{sm,md,lg,xl}`, `--gap-{xs,sm,md,lg,xl}`;
  for larger corners use literal `12px`/`16px`
```

---

## 6.5 结论四：`--cds-*` 与官方 token 的逐项比对

### 6.5.1 名称映射：`--cds-X` ≡ `--X`

去掉 `--cds-` 前缀后，与官方 vanilla token 名称求交集：

```bash
# ours: 210 个 --cds-*
# vanilla: 704 个无前缀 token
# 交集: 131
```

**131 个同名 token**。这确认了 `--cds-*` 就是官方 token 的**加前缀镜像**。

**交集清单（131 项）**：

```
alpha-0 alpha-1 alpha-2 alpha-3 alpha-4
bg-neutral bg-neutral-hover bg-tint-blue bg-user-message blue-450
border border-accent border-strong btn-spring clay clay-emphasized
dur-base dur-fast dur-sheet dur-slow dur-snap
ease-out ease-overshoot ease-snap
fill-accent fill-brand fill-brand-hover fill-danger
fill-ghost-hover fill-ghost-selected fill-secondary fill-secondary-hover
focus-shadow gap-xl
gray-0 gray-10 gray-100 gray-150 gray-20 gray-200 gray-250 gray-30
gray-300 gray-350 gray-40 gray-400 gray-450 gray-50 gray-500 gray-550
gray-60 gray-600 gray-650 gray-70 gray-700 gray-750 gray-80 gray-800
gray-810 gray-820 gray-830 gray-840 gray-850 gray-860 gray-870 gray-880
gray-890 gray-90 gray-900
h-control h-control-nested icon
orange-0 … orange-900（35 项，同上结构）
page-bg radius radius-composer
ring-color ring-hairline ring-inner ring-outer
role-accent-450 role-accent-fill
shadow-color shadow-drop-glow shadow-lg shadow-md shadow-popover shadow-sm
surface-0 surface-1 surface-2 surface-3 surface-popover
text-accent text-muted text-primary text-secondary
```

### 6.5.2 差异分类

```bash
python3 scripts/compare-tokens.py
```

| 分类 | 数量 | 说明 |
| :--- | ---: | :--- |
| **仅前缀差异** | **90** | `var(--cds-alpha-1)` vs `var(--alpha-1)`，语义完全相同 |
| **单位/写法差异** | **4** | `.2s` vs `200ms`、`#fff` vs `#ffffff` |
| **真实语义差异** | **37** | 需逐项处理 |

### 6.5.3 37 项真实语义差异

```bash
comm 后归一化对比 → 37 项
```

**A 类：alpha 系列（5 项）—— 明暗翻转正确，但不透明度数值不同**

先澄清一个容易误判的点：**我们的 `--cds-alpha-*` 在暗色下确实翻转为白色**，不是固定黑色。

```bash
# 我们的完整定义（含作用域）
python3 -c "
import re
s=open('code-examples/cds-theme.css').read()
for m in re.finditer(r'--cds-alpha-(\d)\s*:\s*([^;]+)', s):
    print(m.group(0).strip())
"
```

```
:root {                              [data-mode="dark"], .dark {
  --cds-alpha-0: hsla(0,0%,8%,0)     --cds-alpha-0: hsla(0,0%,100%,0)
  --cds-alpha-1: hsla(0,0%,8%,0.05)  --cds-alpha-1: hsla(0,0%,100%,0.05)
  --cds-alpha-2: hsla(0,0%,8%,0.10)  --cds-alpha-2: hsla(0,0%,100%,0.09)
  --cds-alpha-3: hsla(0,0%,8%,0.20)  --cds-alpha-3: hsla(0,0%,100%,0.18)
  --cds-alpha-4: hsla(0,0%,8%,0.35)  --cds-alpha-4: hsla(0,0%,100%,0.30)
}
```

官方是单一表达式由 `neutral-900` 自动翻转：

```css
--alpha-0: hsl(from var(--neutral-900) h s l / 0%)
--alpha-1: hsl(from var(--neutral-900) h s l / 5%)
--alpha-2: hsl(from var(--neutral-900) h s l / 10%)
--alpha-3: hsl(from var(--neutral-900) h s l / 20%)
--alpha-4: hsl(from var(--neutral-900) h s l / 35%)
```

**真实差异有两处**：

| Token | 差异 | ours（dark） | 官方（dark） |
| :--- | :--- | :--- | :--- |
| `--alpha-0`/`--alpha-1` | 不透明度一致 | `0` / `0.05` | `0%` / `5%` | ✅ |
| `--alpha-2` | **暗色不透明度不同** | `0.09` | **`10%`** | ❌ |
| `--alpha-3` | **暗色不透明度不同** | `0.18` | **`20%`** | ❌ |
| `--alpha-4` | **暗色不透明度不同** | `0.30` | **`35%`** | ❌ |

**判定**：
1. **翻转机制正确**——我们在暗色块里切换为白色，与官方 `neutral-900` 在暗色下解析为 `gray-0` 的效果一致
2. **暗色数值有偏差**——`alpha-2/3/4` 在暗色下分别少了 1/2/5 个百分点
3. **实现方式不同**——官方单表达式，我们双块硬编码。后者会在新增 `data-mode=system` 等作用域时漏写

**修正建议**：改为官方表达式，同时消除数值偏差：

```css
:root {
  --cds-alpha-0: hsl(from var(--cds-neutral-900) h s l / 0%);
  --cds-alpha-1: hsl(from var(--cds-neutral-900) h s l / 5%);
  --cds-alpha-2: hsl(from var(--cds-neutral-900) h s l / 10%);
  --cds-alpha-3: hsl(from var(--cds-neutral-900) h s l / 20%);
  --cds-alpha-4: hsl(from var(--cds-neutral-900) h s l / 35%);
}
/* 不需要暗色块覆盖 --cds-alpha-* */
```

> **前提**：必须先定义 `--cds-neutral-900`，且它在暗色下解析为 `--cds-gray-0`（白色）。当前实现已有 `--cds-neutral-900`（见 4.3）。

**B 类：文本色（3 项）—— 真实值不同**

| Token | ours | 官方链 | 官方实际值（light / dark） |
| :--- | :--- | :--- | :--- |
| `--text-primary` | `#151515` | `neutral-900` → `gray-900` / `gray-0` | **`#0b0b0b` / `#ffffff`** |
| `--text-secondary` | `#525252` | `neutral-600` → `gray-600` / `gray-300` | **`#52514e` / `#a5a49a`** |
| `--text-muted` | `#8a8a8a` | `neutral-400` → `gray-400` / `gray-500` | **`#898781` / `#6d6b67`** |

**三个都错**。且 `--text-muted` 在暗色下官方是 `#6d6b67`（比 light 的 `#898781` **更暗**），不是更亮。

**C 类：品牌色（3 项）**

| Token | ours | 官方 | 判定 |
| :--- | :--- | :--- | :--- |
| `--clay-emphasized` | `var(--cds-clay-hover)` | **`#c6613f`** | 已在 [5.2.1](05-open-claude-ui差异审计.md) 指出 |
| `--fill-brand` | `var(--brand)` | `var(--clay-emphasized)` = `#c6613f` | 我们指向 `--brand`（`#c6613f`），**值一致** |
| `--fill-brand-hover` | `var(--cds-clay-hover)` | `var(--clay)` = `#d97757` | **语义反了**：官方 hover 是更浅的 `#d97757`，我们用了 `#cc5a36`（更深） |

**D 类：accent 用蓝色，不是 clay（2 项）**

| Token | ours | 官方 |
| :--- | :--- | :--- |
| `--border-accent` | `var(--cds-clay)`（陶土） | `var(--role-accent-250)` = `var(--blue-250)` |
| `--text-accent` | `var(--cds-clay)`（陶土） | `var(--role-accent-600)` = `var(--blue-600)` = **`#184f95`** |

**这是根本性误读**：官方 `accent` 角色是**蓝色**，`brand`（clay）才是陶土色。我们把两者混为一谈。

官方原文（7.4.7 Accent rule）明确：

> The `brand` (clay) role is reserved for Claude-initiated actions — send, generate — never ordinary user CTAs.

**关于 `--fill-secondary` 的说明**

官方在浅色用 `hsl(0 0% 100% / 0.1)`（**白色** 10%），在暗色块里改用 `var(--alpha-2)`（黑底上的白 10%）。我们统一用 `var(--cds-alpha-2)`，浅色下是**黑色** 10%。

两者在浅色下视觉不同：官方的 secondary 填充在浅色表面上几乎不可见（白叠白），我们用黑色 10% 会有明显灰底。这可能是刻意差异（也可能是我们的误读），**需运行时光照验证**，本文不做进一步判定。

**E 类：缩放未乘 `--cds-rem-scale`（5 项）**

| Token | ours | 官方 | 差异 |
| :--- | :--- | :--- | :--- |
| `--radius` | `8px` | `calc(0.5rem * var(--cds-rem-scale,1))` | 无密度缩放 |
| `--radius-composer` | `20px` | `calc(0.875rem * …)` = **14px** | 值 + 缩放都错 |
| `--h-control` | `32px` | `calc(2rem * …)` = 32px | 值对，无缩放 |
| `--h-control-nested` | `24px` | `calc(1.375rem * …)` = **22px** | 值错 |
| `--gap-xl` | `1.5rem` | `calc(2.5rem * …)` = **40px** | 值错 |

> **注**：[第五章 5.2](05-open-claude-ui差异审计.md) 曾记录 `--cds-gap-xl: 1.5rem` 与 v2 文档的 40px 不符。本次确认**官方是 40px**，我们的 24px 错误。

**F 类：阴影体系（7 项）—— 最大差异**

| Token | ours | 官方 |
| :--- | :--- | :--- |
| `--shadow-color` | `rgba(0, 0, 0, 0.08)` | `hsl(from var(--gray-900) h s l / 8%)`，暗色 `rgba(0,0,0,0.24)` |
| `--shadow-sm` | `0 1px 2px 0 rgba(0,0,0,0.05), 0 2px 8px 0 var(--cds-shadow-color)` | `0 1px 2px 0 hsl(from gray-900 / 6%), 0 2px 8px 0 var(--shadow-color)` |
| `--shadow-md` | `0 2px 4px 0 rgba(0,0,0,0.05), …` | `0 2px 4px 0 hsl(from gray-900 / 7%), …` |
| `--shadow-lg` | `0 4px 8px 0 rgba(0,0,0,0.06), …` | `0 4px 8px 0 hsl(from gray-900 / 8%), …` |
| `--shadow-popover` | `inset 0 0 0 var(--cds-ring-inner) …` | **`0 8px 24px rgb(0 0 0 / .12), 0 2px 6px rgb(0 0 0 / .08)`**（无 inset ring） |
| `--shadow-drop-glow` | `inset 0 0 24px -2px rgba(217,119,87,0.20), inset 0 0 0 2px var(--cds-clay)` | `inset 0 0 24px -2px hsl(from var(--fill-accent) h s l / 20%)`（蓝色，非 clay） |
| `--focus-shadow` | `inset … var(--cds-surface-1), 0 0 0 1.5px var(--cds-clay), …` | `inset … var(--page-bg), 0 0 0 1px var(--fill-accent)=蓝, 0 0 6px 1px var(--bg-accent)` |

**`--shadow-popover` 是重大差异**：官方是纯投影（两层 `0 8px 24px` + `0 2px 6px`），不含 inset ring；我们把 ring 塞进了 shadow-popover。

**G 类：其余（12 项）**

| Token | ours | 官方 | 说明 |
| :--- | :--- | :--- | :--- |
| `--bg-tint-blue` | `#f0f4f8`（不透明） | `rgb(from var(--blue-100) …)`（反解半透明） | 官方用 `color-mix` 反解，见 7.4 |
| `--btn-spring` | `linear(0, .2459, …)` | 同值，仅小数点 | 等价 |
| `--ease-out` | `cubic-bezier(.165,.84,.44,1)` | `cubic-bezier(0.165,0.84,0.44,1)` | 等价 |
| `--ease-overshoot` | `cubic-bezier(.34,1.3,.64,1)` | 同值 | 等价 |
| `--ease-snap` | `cubic-bezier(.32,.72,0,1)` | 同值 | 等价 |
| `--fill-danger` | `#ef4444` | `var(--role-danger-fill)` | 未走角色链 |
| `--fill-secondary` | `var(--cds-alpha-2)` | `hsl(0 0% 100% / 0.1)`（`:root`）/ `var(--alpha-2)`（暗色块） | 见下方说明 |
| `--fill-secondary-hover` | `rgba(21,21,21,0.14)` / 暗色 `rgba(255,255,255,0.14)` | `var(--alpha-1)` / `hsl(from neutral-900 / 14%)` | hover 不透明度官方为 5%，我们为 14% |
| `--surface-popover` | `var(--cds-gray-0)` | `var(--surface-3)` | 等价（surface-3 也是 gray-0），但未走层级链 |
| `--gray-0` | `#fff` | `#ffffff` | 等价 |
| `--orange-0` | `#fff` | `#ffffff` | 等价 |
| `--icon` | `1.25rem` | `calc(1.25rem * scale)` | 缺缩放 |

### 6.5.4 语义等价的 90 项

`--cds-X: var(--cds-Y)` vs `--X: var(--Y)`，仅前缀差异。**这些不影响视觉，但影响「是否与官方语义一致」。**

---

## 6.6 对前序章节结论的修正

### 6.6.1 修正：`--cds-h-control-nested` 24px 是错的

**[第五章 5.2](05-open-claude-ui差异审计.md) 未列出此项。** 本次确认：

| 来源 | 值 |
| :--- | :--- |
| 我们的实现 | `24px`（硬编码） |
| v2 文档（03 章 :88） | `22px`（`calc(1.375rem * scale)`）|
| **官方 vanilla** | **`calc(1.375rem * var(--cds-rem-scale,1))` = 22px** |

**v2 文档在这个值上是正确的**，我们的实现错了。这修正了 [第三章](03-架构重构与对比分析.md) 中对 v2 的整体否定——v2 的取值并非全错。

### 6.6.2 修正：`--cds-gap-xl` 应为 40px

| 来源 | 值 |
| :--- | :--- |
| 我们的实现 | `1.5rem` = 24px |
| **官方 vanilla** | **`calc(2.5rem * scale)` = 40px** |

[第五章 5.2.1](05-open-claude-ui差异审计.md) 曾记录此项（v2 说 40px，我们 24px），本次确认**官方是 40px**。

### 6.6.3 新增：`--radius-composer` 应为 14px 且带缩放

| 来源 | 值 |
| :--- | :--- |
| 我们的实现 | `20px` |
| 主样式表实测 | `calc(.75rem…)`=12px 与 `calc(.875rem…)`=14px 两值 |
| **官方 vanilla** | **`calc(0.875rem * var(--cds-rem-scale,1))` = 14px** |

**我们的 20px 是 v1 时代的遗留值**，v2 文档说降为 12px/14px 是对的。

### 6.6.4 新增：alpha / text / accent / shadow 四类系统性问题

这四类在 [第五章](05-open-claude-ui差异审计.md) 中均未涉及，因为当时只对比了主样式表的 `--cds-*`，没有官方 vanilla 作为参照。

---

## 6.7 更新后的差异优先级

在 [5.5 修复优先级总表](05-open-claude-ui差异审计.md) 基础上，新增以下项（按优先级排序）：

| 优先级 | 项 | 预估影响 |
| :--- | :--- | :--- |
| **P0** | `--text-primary/secondary/muted` 三个值全错 | 全局文本色偏差 |
| **P0** | `--border-accent` / `--text-accent` 用了 clay 而非 blue | accent 角色语义错误 |
| **P0** | `--shadow-popover` 混入 inset ring | 弹层阴影结构错误 |
| **P1** | `--radius-composer` 20px → 14px | 输入框圆角偏大 |
| **P1** | `--gap-xl` 24px → 40px | 间距偏小 |
| **P1** | `--h-control-nested` 24px → 22px | 嵌套控件偏高 |
| **P1** | 5 个尺寸 token 未乘 `--cds-rem-scale` | 密度系统失效 |
| **P1** | `--alpha-2/3/4` 暗色不透明度偏差 1/2/5 百分点；建议改单表达式 | 半透明遮罩略淡；新增作用域易漏写 |
| **P2** | `--fill-brand-hover` 语义反转 | hover 方向错 |
| **P2** | `--fill-secondary` 浅色用黑而非白 | 次级填充色偏差 |

---

## 本章证据索引

| 断言 | 命令 |
| :--- | :--- |
| 17 个 CSS / 8 个唯一 | `find … -exec shasum …` 分组 |
| 全并集 59 项 | `cat *.css \| grep -o "@keyframes …" \| sort -u \| wc -l` |
| 主表外多出 4 项 | `comm -13 <55项> <59项>` |
| 44 个缺失全在主表 | `comm -12 <missing44> <kf-all17>` = 44，且并集内 cds-* 全来自主表 |
| `@ant/cds` 0 条目 | ASAR 629 条目全路径搜索 |
| 官方文档 58,354 字符 | 从 `index.chunk-CbnfBP-3.js` 定位 `@generated by apps/cds-docs` 并解转义 |
| 131 个同名 token | 去前缀后 `comm -12` |
| 90/4/37 分类 | 归一化后逐项比对 |
| text 三色实际值 | 解析 `neutral-N` → `gray-N` / `gray-(900-N)` 链 |
| accent 是蓝色 | `--role-accent-600 = var(--blue-600) = #184f95` |
