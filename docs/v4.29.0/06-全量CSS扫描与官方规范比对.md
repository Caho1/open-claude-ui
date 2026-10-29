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

## 6.6 静态可解项的最终裁定

本章额外完成了 [7.3](07-总结与后续工作.md) 原列为「需运行时观测」的 3 项，全部可静态解决。

### 6.6.1 `--cds-rem-scale` 从未被赋值，恒为 1

**结论**：`--cds-rem-scale` 在 CSS 中**零定义**，在 JS 中**零赋值**，所有 306 处引用都走 fallback `1`。

```bash
# CSS 中的声明
grep -c -- "--cds-rem-scale\s*:" MainWindowPage-BjVtjJFx.css
# → 0

# CSS 中的 fallback 引用
grep -c "var(--cds-rem-scale" MainWindowPage-BjVtjJFx.css
# → 306

# JS 中的赋值点（: / setProperty / =）
# → 0 处
```

**配套证据**——官方 px→rem 换算函数（来自 `find_in_page/assets/FindInPage-BDboRkUg.js`）：

```js
lt = "--cds-rem-scale",
ut = `calc(16rem * var(${lt}, 1))`,
H  = e => `calc(${e/16}rem * var(${lt}, 1))`
```

**含义**：
1. `--cds-rem-scale` 是为宿主预留的**密度缩放钩子**，Claude 桌面端自己**不设置**
2. 因此所有 `calc(Xrem * var(--cds-rem-scale,1))` 在桌面端等价于 `calc(Xrem)`
3. 但**写死 px 仍是错的**——一旦宿主设置该变量，写死的 px 不会跟着缩放

**对 open-claude-ui 的影响**：我们把 `--cds-radius-composer` 写成 `20px` 而非 `calc(...)`，即使将来由宿主设置 `--cds-rem-scale` 也不会缩放。这是结构性问题，不只是数值问题。

### 6.6.2 `--cds-radius-composer` 的 12px / 14px 切换条件

**结论**：切换条件是 **`[data-density=comfortable]`**。

```bash
# 提取两条定义所属的选择器
```

| 值 | 选择器 | 换算 |
| :--- | :--- | :--- |
| `calc(.75rem * var(--cds-rem-scale,1))` = **12px** | `.cds-root`（默认 = compact） | 12px |
| `calc(.875rem * var(--cds-rem-scale,1))` = **14px** | `.cds-root[data-density=comfortable]` | 14px |

同样的模式适用于全部尺寸 token：

| Token | `.cds-root`（compact） | `[data-density=comfortable]` |
| :--- | :--- | :--- |
| `--cds-radius` | `.5rem` = 8px | `.5rem` = 8px（不变） |
| `--cds-radius-composer` | `.75rem` = **12px** | `.875rem` = **14px** |
| `--cds-h-control` | `2rem` = 32px | `2rem` = 32px |
| `--cds-h-control-nested` | `1.375rem` = **22px** | `1.375rem` = 22px |
| `--cds-radius--xs` | `.3125rem` = **5px** | `.375rem` = **6px** |
| `--cds-radius--sm` | `.4375rem` = **7px** | 同 7px（另有 `.3125rem`=5px 在别处） |
| `--cds-radius--lg` | `.625rem` = **10px** | `.4375rem` = 7px |
| `--cds-gap-xl` | `2.5rem` = **40px** | `2.5rem` = 40px |

**`data-density` 只有 `comfortable` 一个显式块**（`compact` 出现 0 次）——即 **compact 是默认，无需显式标记**。

```bash
grep -c "data-density=comfortable" MainWindowPage-BjVtjJFx.css   # 3
grep -c "data-density=compact"     MainWindowPage-BjVtjJFx.css   # 0
```

三个 `comfortable` 块分别覆盖：
1. 基础尺寸（radius / h-control / icon / pad / gap / font-size / leading）
2. 尺寸变体（`--xs` / `--sm` / `--lg` 后缀）
3. 字体-字号组合（`--textsm` / `--textlg` 后缀）

与 [6.4.6](#64-结论三提取到官方-cds-规范文档) 引用的官方文档「Density is one switch on `CdsRoot`」完全对应。

### 6.6.3 「7 停非线性 mask」确定不存在

**结论**：3.6556.2 主样式表中**没有任何 6 停以上的 gradient**。

```bash
# 所有 mask-image 声明（共 9 处）
```

| mask-image 值 | 出现次数 | 用途 |
| :--- | ---: | :--- |
| `radial-gradient(circle at var(--btn-dot-x) …,transparent …,black …)` | 4 | Pulse 指示点镂空 |
| `linear-gradient(#000 0 0)` | 1 | **shimmer 克隆层的 mask-clip:text** |
| `linear-gradient(90deg,#000 calc(100% - 24px),#0000)` | 2 | 单侧硬切（非渐隐） |
| `linear-gradient(270deg,#000 calc(100% - 24px),#0000)` | 2 | 同上（RTL） |

```bash
# 统计 6 停以上的 gradient
node -e '过滤 linear-gradient 内含 >=6 个百分比的'
# → 0
```

**因此 v2 文档的「7 停非线性 fade mask」在 3.6556.2 中不存在。** 可能的解释（本文不判定）：
1. v2 的方案已被 `@property` + `animation-timeline` 取代
2. v2 的描述本身是推断而非取证

### 6.6.4 滚动渐隐的真实实现，以及一个未实现的类

**结论**：滚动渐隐的 token 体系（17 个 `@property` + 8 个 keyframes）是**完整注册**的，但**主样式表中没有任何 mask 规则消费它们**。

```bash
# 17 个 @property 已注册
grep -o "@property --cds-scroll-fade-[a-zA-Z0-9_-]*" MainWindowPage-BjVtjJFx.css | sort -u | wc -l   # 17

# 8 个 keyframes 已定义
```

已注册的关键帧：

```css
@keyframes cds-scroll-fade-top    { 0%{--cds-scroll-fade-top-raw:0px}    to{--cds-scroll-fade-top-raw:var(--cds-scroll-fade-size)} }
@keyframes cds-scroll-fade-bottom { 0%{--cds-scroll-fade-bottom-raw:var(--cds-scroll-fade-size)} to{--cds-scroll-fade-bottom-raw:0px} }
@keyframes cds-scroll-fade-left   { 0%{--cds-scroll-fade-left-raw:0px}   to{--cds-scroll-fade-left-raw:var(--cds-scroll-fade-size)} }
@keyframes cds-scroll-fade-right  { 0%{--cds-scroll-fade-right-raw:var(--cds-scroll-fade-size)} to{--cds-scroll-fade-right-raw:0px} }
@keyframes cds-scroll-fade-y-active { 0%,to{--cds-scroll-fade-y-active:1} }
@keyframes cds-scroll-fade-x-active { 0%,to{--cds-scroll-fade-x-active:1} }
```

**消费方是 Tailwind 工具类 `.scroll-fade-y`**，证据来自 `find_in_page/assets/impl-BfCfv0QC.js`：

```js
Ji = "relative min-h-0 overflow-y-auto overflow-x-hidden scroll-fade-y rounded-[inherit] …"
Yi = "relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-fade-y …"
```

**但 `.scroll-fade-y` 类在全部 9 个 CSS 文件中都没有定义**：

```bash
# 9 个 CSS 中搜索 .scroll-fade-y 选择器
# → 0 匹配
# 主样式表的 "scroll-fade-y" 4 处全部是 --cds-scroll-fade-y-active 变量名的一部分
```

同时：

```bash
grep -c "@utility"         MainWindowPage-BjVtjJFx.css   # 0
grep -c "@custom-variant"  MainWindowPage-BjVtjJFx.css   # 0
```

**这是一个重要发现**：`.scroll-fade-y` 是一个**在打包产物中未落地的 Tailwind 工具类**。可能是：
1. 由未包含在此窗口的 CSS 文件提供
2. Tailwind v4 的 `@theme` 定义在构建时被 tree-shake 掉了
3. 该功能当前是惰性的

**本文不判定原因**，但确认事实：**引用存在，定义缺失**。

---

## 6.7 运行时实证（Main Process Debugger）

本章前六节均基于字节静态分析。补充项（preload 路径、utility process）无法静态解析，改用 Claude 自带的 **Enable Main Process Debugger** 菜单项取得运行时事实。

### 6.7.0 运行时环境与取证通道概述

```
electron 版本 : 44.9.3
node 版本     : v24.22.0
app.getAppPath()       : /Applications/Claude.app/Contents/Resources/app.asar
userData 目录          : /Users/jiahao/Library/Application Support/Claude
```

`app.getAppPath()` 直接指向 asar，说明 `OnlyLoadAppFromAsar` fuse 为 Enabled（与 6.7.1 的 fuse 清单一致）。

---

### 6.7.1 取证通道

Claude 的 `EnableNodeCliInspectArguments` fuse 为 **Disabled**，因此 `--inspect` 启动参数无效：

```bash
npx @electron/fuses read --app /Applications/Claude.app
#   EnableNodeCliInspectArguments is Disabled
```

但应用层提供了绕过该 fuse 的菜单项。从 `index.chunk-jPKPzV-P.js` 提取的实现：

```js
var v7r = () => ({
  label: "Enable Main Process Debugger",
  type: "checkbox",
  checked: aX(),
  click: e => { aX() ? b7r() : y7r(), e.checked = aX() }
});

function aX() { return ce.url() !== undefined }   // ce = node:inspector

async function y7r() {
  if (LK(() => true)) try {
    aX() && b7r();
    ce.open();                                     // 无参 → 默认端口 9229
    await S7r();
  } catch (e) { N.debug("Debugger: Failed to enable main process debugger (node inspector)", e) }
}

async function S7r() {
  process.platform === "darwin"
    ? await xp("/usr/bin/open", ["-a", "Google Chrome", "chrome://inspect"])
    : ...
}
```

**关键**：`ce.open()` 不传端口，Node inspector 默认监听 **9229**，且只绑 `127.0.0.1`。

打开后：

```bash
curl -s http://127.0.0.1:9229/json/list
# [ { "description": "node.js instance", "webSocketDebuggerUrl": "ws://127.0.0.1:9229/…", "url": "file://" } ]
```

只有一个 target（类型 `node`），即 Electron **主进程**。

### 6.7.2 preload 的实际路径（已解决）

静态分析只能找到 `registerPreloadScript({type:"frame", filePath: t})` 这个调用形态，`t` 是压缩后的变量。运行时通过 Electron 内部方法 `webContents._getPreloadScript()` 取得真实值：

```js
BrowserWindow.getAllWindows().map(w => ({
  id: w.id,
  url: w.webContents.getURL(),
  preload: w.webContents._getPreloadScript()
}))
```

**实测结果**：

| 窗口 | URL | preload 路径 |
| :--- | :--- | :--- |
| id=1 | `.vite/renderer/main_window/index.html` | **`.vite/build/mainWindow.js`** |
| id=2 | `about:blank` | **`.vite/build/mainView.js`** |

`_getPreloadScript()` 的完整返回：

```json
{ "filePath": "/Applications/Claude.app/Contents/Resources/app.asar/.vite/build/mainWindow.js",
  "id": "", "type": "frame" }
```

**这解决了一个此前的重大误解**：

- 第 2 章曾说「preload 入口 0 个，路径由 `registerPreloadScript` 运行时拼接，静态不可解」
- 事实是：**preload 就是 `.vite/build/` 下的窗口脚本**（`mainWindow.js` / `mainView.js` / 以及同目录的 `aboutWindow.js`、`quickWindow.js`、`buddy.js`、`findInPage.js`）
- 这些文件在第 2 章已经分析过（`mainWindow.js` 88,843 字节、`ipcRenderer` 出现 22 次等），只是当时不知道它们同时是 preload

**为什么静态看不出**：`session.registerPreloadScript` 的 `filePath` 是运行时变量，且 asar 内**没有任何 preload 命名文件**（运行时确认：`app.getAppPath()` 下递归搜索 `preload` 命中 0 个）。

### 6.7.3 preload 注册的实际 API 是 session 级

运行时确认：

```
app.registerPreloadScript            → undefined
session.defaultSession.registerPreloadScript → function
session.defaultSession.getPreloadScripts()    → []
session.defaultSession.getPreloads()          → []
```

**关键**：`getPreloadScripts()` 返回空数组，但窗口确实有 preload。说明这些窗口的 preload **不是通过 `session.registerPreloadScript` 注册的**，而是走 `webPreferences.preload` 直接传给 BrowserWindow 构造器。

交叉验证：`webContents.getLastWebPreferences()` 的返回里**没有 `preload` 键**：

```json
{"allowRunningInsecureContent":false,"contextIsolation":true,"javascript":true,
 "nodeIntegration":false,"sandbox":true,"webSecurity":true,...}
```

Electron 在 `sandbox:true` 时不把 `preload` 回显到 `getLastWebPreferences`，但 `_getPreloadScript()` 仍能取到。

**安全配置实测**：`sandbox: true` + `contextIsolation: true` + `nodeIntegration: false`。这与「渲染进程只能通过 12 个 `exposeInMainWorld` 桥接 API 访问主进程」的设计一致。

### 6.7.4 utility process：实测 3 个，全部是 Chromium 内置

`app.getAppMetrics()` 实测：

```
{"Browser":1,"GPU":1,"Utility":3,"Tab":2}

utility serviceNames:
  network.mojom.NetworkService
  audio.mojom.AudioService
  video_capture.mojom.VideoCaptureService
```

对照 `ps` 的进程命令行：

```
--type=utility --utility-sub-type=network.mojom.NetworkService
--type=utility --utility-sub-type=audio.mojom.AudioService
--type=utility --utility-sub-type=video_capture.mojom.VideoCaptureService
```

**三个 Utility 全部是 Chromium 自带的，没有一个是 Claude 应用层 fork 的。**

对 `utilityProcess.fork` 挂运行时钩子后，未捕获到任何调用：

```js
utilityProcess.fork = new Proxy(...)   // 钩子已安装
globalThis.__FORK_HITS__               // → null（本次会话内零调用）
```

**结合静态证据**：`index.pre.js` 中的 `utilityProcess` 3 处出现全部是对 `fork` 的 Proxy 包装（注入 Sentry 的 `MessageChannelMain` 桥），无实际调用点。

**因此对 REA 的 `utility_processes = 1` 给出裁定**：

| 来源 | 值 | 口径 |
| :--- | ---: | :--- |
| REA `summary.utility_processes` | **1** | 静态推断（无法对应到实际进程） |
| REA `resolved_utility_entrypoints` | 0 | 入口未知 |
| 本文静态 | 0 个 fork 调用点 | 只有 Proxy 包装 |
| **本文运行时** | **3 个 Utility** | 全部是 Chromium 内置，非应用层 |

**结论**：REA 的 `1` 与实测的 `3` 都不是「Claude 应用层 utility process 的数量」。运行时证据表明**应用层当前没有 fork 任何 utility process**；`3` 是 Chromium 的内部服务。

> **不确定部分**：本次会话未触发应用层 utility process。若某个功能（如 `heavy-work-worker`、`pty-host`、`file-index-worker`）被使用时是否会 fork，本文**未验证**。这三个 worker 脚本在 asar 中存在（见 1.1.3 的 `pty-host`、`file-index-worker`、`heavy-work-worker` 目录），但属于 `node:worker_threads` 还是 `utilityProcess` 未确定。

### 6.7.5 运行时实测的双模完整值表（权威参考）

通过主进程 debugger 读取 main_window 渲染进程的 `getComputedStyle`，强制切换 `data-mode` 后取值。**这是本文件所有色彩结论的最终依据**，比静态 CSS 更权威（静态值在 `@layer` 与作用域竞争下的实际解析结果以运行时为准）。

**浅色（data-mode=light）**

| Token | 声明值 | 解析值 |
| :--- | :--- | :--- |
| `--cds-text-primary` | `var(--cds-neutral-900)` | `#0b0b0b` |
| `--cds-text-secondary` | `var(--cds-neutral-600)` | `#52514e` |
| `--cds-text-muted` | `var(--cds-neutral-400)` | `#898781` |
| `--cds-text-accent` | `var(--cds-role-accent-600)` | `#184f95` |
| `--cds-border-accent` | `var(--cds-role-accent-250)` | `#86b6ef` |
| `--cds-clay-emphasized` | `#c6613f` | `rgb(198,97,63)` |
| `--cds-fill-brand` | `var(--cds-clay-emphasized)` | `#c6613f` |
| `--cds-fill-brand-hover` | `var(--cds-clay)` | `#d97757` |
| `--cds-alpha-1..4` | `hsl(from #0b0b0b …/5,10,20,35%)` | srgb 0.043 / 0.05·0.1·0.2·0.35 |
| `--cds-skeleton-base` | 同 alpha-1 | `#0b0b0b / 5%` |
| `--cds-shadow-color` | `hsl(from gray-900 / 8%)` | `#0b0b0b / 8%` |
| `--cds-shadow-popover` | — | `0 8px 24px #0000001f, 0 2px 6px #00000014` |
| `--cds-focus-shadow` | — | `inset …#f9f9f7, 0 0 0 1px #2a78d6, 0 0 6px 1px #cde2fb` |
| `--cds-fill-secondary` | — | `rgba(255,255,255,0.1)`（**白 10%**） |
| `--cds-page-bg` | `#f9f9f7` | surface-0 |

**暗色（data-mode=dark）**

| Token | 解析值 | 与浅色关系 |
| :--- | :--- | :--- |
| `--cds-text-primary` | `#f0efec` | neutral-900 → gray-50 |
| `--cds-text-secondary` | `#c3c2b7` | neutral-600 → gray-200 |
| `--cds-text-muted` | **`#898781`** | **不变**（neutral-400 两侧同 gray-400） |
| `--cds-text-accent` | `#6da7ec` | blue 变亮 |
| `--cds-border-accent` | `#0d366b` | blue 变深 |
| `--cds-clay-emphasized` | `#c6613f` | **双模同值** |
| `--cds-fill-brand` / `hover` | `#c6613f` / `#d97757` | **双模同值** |
| `--cds-alpha-1..4` | 白色 `1 1 1 / 0.05·0.1·0.2·0.35` | 黑→白翻转，百分比与浅色一致 |
| `--cds-skeleton-base` | **白 7.5%** | base=sheen，加深而非提亮 |
| `--cds-shadow-color` | `rgba(0,0,0,0.24)` | 独立暗色值 |
| `--cds-shadow-popover` | `0 8px 24px #00000052, 0 2px 6px #0003` | 更重投影 |
| `--cds-focus-shadow` | `inset …#0b0b0b, 0 0 0 1px #2a78d6, glow hsl(from #184f95/60%)` | ring 底色跟随 page-bg |
| `--cds-neutral-900` | `#ffffff` | gray-0 |

**尺寸实测（data-density=comfortable）**

| Token | 声明 | 解析 |
| :--- | :--- | :--- |
| `--cds-radius` | `calc(.5rem×scale)` | **8px** |
| `--cds-radius-composer` | `calc(.875rem×scale)` | **14px** |
| `--cds-h-control` | `calc(2rem×scale)` | **32px** |
| `--cds-h-control-nested` | `calc(1.375rem×scale)` | **22px** |
| `--cds-gap-xl` | `calc(2.5rem×scale)` | **40px** |
| `--cds-icon` | `calc(1.25rem×scale)` | **20px** |
| `--cds-radius--xs / sm / lg` | `.375/.4375/.625rem` | **6 / 7 / 10px** |
| `--cds-dur-fast/snap/base/slow` | 60ms/120ms/200ms/450ms | 与静态一致 |
| `--cds-ease-out/snap/overshoot` | 三条 cubic-bezier | 与静态一致 |

`--cds-rem-scale` 实测为**空字符串**（未定义），全部走 fallback 1——与 6.6.1 的静态结论一致。

实测环境：`data-density="comfortable"`、`data-mode="system"`（跟随浅色）、Electron 44.9.3。

### 6.7.6 修复验证（open-claude-ui）

上述值表已作为修复目标落实在 `fix/cds-token-ground-truth-alignment` 分支。修复后用 headless Chrome 对 `cds-theme.css` 重测，9 项关键解析值与 Claude 真实渲染**全部一致**。

**修复同时扩大了与官方 token 的对齐面**：交集从 131 项增至 **154 项**（+23）。新增的对齐项包括：

```
neutral-0/50/100/…/900（12 项，主题翻转链）
gray-10…gray-900 中此前缺失的档位（23 项）
blue-100/250/600、bg-accent、role-accent-250/600（6 项，accent 角色链）
pad-xs/sm/md/lg/xl（5 项，间距 token）
```

```
textPrimary    rgb(11, 11, 11)        ✅
textSecondary  rgb(82, 81, 78)        ✅
textMuted      rgb(137, 135, 129)     ✅
textAccent     rgb(24, 79, 149)       ✅
borderAccent   rgb(134, 182, 239)     ✅
clayEmphasized rgb(198, 97, 63)       ✅
fillBrand      rgb(198, 97, 63)       ✅
fillBrandHover rgb(217, 119, 87)      ✅
focusShadow    inset …#2a78d6, #cde2fb ✅
```

结构修复同样实测通过：

| 项 | 修复前 | 修复后 |
| :--- | :--- | :--- |
| `.cds-skeleton-sweep` 独立类元素 | `position:absolute`，x=-245（移出视口） | `position:relative`，x=25 |
| `rounded-full` 头像骨架 | 被压成 4px | 9999px 保留 |
| RTL 扫光方向 | normal（左→右） | reverse（右→左） |
| `data-hold=none` 揭示完成态 | 动画无限循环 | 压至 .01ms 且隐藏扫光带 |

## 6.8 对前序章节结论的修正


### 6.8.1 修正：`--cds-h-control-nested` 24px 是错的

**[第五章 5.2](05-open-claude-ui差异审计.md) 未列出此项。** 本次确认：

| 来源 | 值 |
| :--- | :--- |
| 我们的实现 | `24px`（硬编码） |
| v2 文档（03 章 :88） | `22px`（`calc(1.375rem * scale)`）|
| **官方 vanilla** | **`calc(1.375rem * var(--cds-rem-scale,1))` = 22px** |

**v2 文档在这个值上是正确的**，我们的实现错了。这修正了 [第三章](03-架构重构与对比分析.md) 中对 v2 的整体否定——v2 的取值并非全错。

### 6.8.2 修正：`--cds-gap-xl` 应为 40px

| 来源 | 值 |
| :--- | :--- |
| 我们的实现 | `1.5rem` = 24px |
| **官方 vanilla** | **`calc(2.5rem * scale)` = 40px** |

[第五章 5.2.1](05-open-claude-ui差异审计.md) 曾记录此项（v2 说 40px，我们 24px），本次确认**官方是 40px**。

### 6.8.3 新增：`--radius-composer` 应为 14px 且带缩放

| 来源 | 值 |
| :--- | :--- |
| 我们的实现 | `20px` |
| 主样式表实测 | `calc(.75rem…)`=12px 与 `calc(.875rem…)`=14px 两值 |
| **官方 vanilla** | **`calc(0.875rem * var(--cds-rem-scale,1))` = 14px** |

**我们的 20px 是 v1 时代的遗留值**，v2 文档说降为 12px/14px 是对的。

### 6.8.4 新增：alpha / text / accent / shadow 四类系统性问题

这四类在 [第五章](05-open-claude-ui差异审计.md) 中均未涉及，因为当时只对比了主样式表的 `--cds-*`，没有官方 vanilla 作为参照。

---

## 6.9 更新后的差异优先级

在 [5.5 修复优先级总表](05-open-claude-ui差异审计.md) 基础上，新增以下项（按优先级排序）：

| 优先级 | 项 | 状态 |
| :--- | :--- | :--- |
| **P0** | `--text-primary/secondary/muted` 三个值全错 | ✅ 已修复（6.7.6 验证） |
| **P0** | `--border-accent` / `--text-accent` 用了 clay 而非 blue | ✅ 已修复（6.7.6 验证） |
| **P0** | `--shadow-popover` 混入 inset ring | ✅ 已修复 |
| **P1** | `--radius-composer` 20px → 14px | ✅ 已修复（含密度块） |
| **P1** | `--gap-xl` 24px → 40px | ✅ 已修复 |
| **P1** | `--h-control-nested` 24px → 22px | ✅ 已修复 |
| **P1** | 尺寸 token 未乘 `--cds-rem-scale` | ✅ 已修复（radius/h-control*/icon/pad-*/gap-* 全族） |
| **P1** | `--alpha-*` 改单表达式 | ✅ 已修复（暗色硬编码删除） |
| **P2** | `--fill-brand-hover` 语义反转 | ✅ 已修复（hover 向上） |
| **P2** | `--fill-secondary` 浅色用黑而非白 | ✅ 已修复（白 10%） |
| **P2** | 附件重排 View Transitions（`match-element` + `@starting-style`） | ✅ 已实现（含 `withAttachmentTransition` hook） |
| **P1** | 官方 skill 佐证写入 AGENTS.md | ✅ 已完成 |
| **P2** | Cowork surface 的 UI 还原评估 | ⬜ 待做（需先确认 UI 载体） |

---

---

## 6.10 补充盘点：3.6556.2 中此前未留意的架构与特性

本节是对整个 ASAR 的全量盘点结果，聚焦此前章节未覆盖的**应用架构**（非 CSS）内容。

### 6.10.1 ASAR 顶层结构（此前只看了 .vite）

```
app.asar
├── .vite/                  ← 已分析（build 547 JS + renderer 7 窗口）
├── compile-cache/          ← ★ V8 编译缓存预热（.jsc，arm64）
│   ├── index.js.arm64.jsc                    1,632 B
│   ├── index.chunk-BjdXj7EG.js.arm64.jsc     5,928 B
│   └── index.chunk-jPKPzV-P.js.arm64.jsc     6,873,864 B
├── node_modules/           ← 仅 4 个包（见 6.10.2）
└── resources/
    ├── artifact-libs/      ← 已分析（Mermaid 11.17.2 / Chart.js 4.5.0 / Grid.js 5.0.2）
    ├── bundled-skills/     ← ★ 内置 Agent Skills（见 6.10.3）
    ├── github-mcp/         ← ★ 完整的 GitHub MCP server 二进制（19,218,370 B）
    └── office365-mcp/      ← ★ 完整的 Office365 MCP server（含 MSAL 认证）
```

**V8 compile-cache 是启动性能优化**：三个 `.jsc` 文件是 V8 code cache，对应主入口与两个大 chunk，Electron 启动时跳过重复编译。`@electron/fuses` 与 `node --compile-cache-dir` 生态的标准做法。

### 6.10.2 运行时依赖只有 4 个包

```
node_modules/
├── @ant/claude-native      claude-native-binding.node 2,798,496 B（0.0.0）
├── @ant/claude-swift       swift_addon.node 12,693,656 B
│                          computer_use.node 1,069,048 B（1.0.0，"A demo module that exposes Swift code to Electron"）
├── node-pty                pty.node + spawn-helper（1.2.0-beta.14，optionalDependencies）
└── ws                      （^8.18.0）
```

**package.json `dependencies` 声明了 8 个包，但只有 4 个真正存在于 ASAR**：

```json
{
  "@ant/claude-for-chrome-mcp": "*",   ← 不在 ASAR
  "@ant/claude-native": "*",           ✅
  "@ant/claude-swift": "*",            ✅
  "@ant/computer-use-mcp": "*",        ← 不在 ASAR
  "@ant/imagine-server": "*",          ← 不在 ASAR
  "@loc/electron-window": "1.1.0",     ← 不在 ASAR
  "https-proxy-agent": "^7.0.6",       ← 不在 ASAR
  "ws": "^8.18.0"                      ✅
}
```

缺失的 5 个是**依赖被构建期内联**进 `.vite/build/*.js`（Vite 打包），仅原生插件保留外部形态。这与「551 个 JS 文件里搜不到 `imagine-server` 字样」一致——功能在，名字没了。

### 6.10.3 内置 Agent Skills（bundled-skills）

`resources/bundled-skills/` 包含 **6 个 `.skill` 文件**（格式为**前缀 1 字节的 zip**，即 zip 数据前多一个 ` `）加 manifest：

| Skill | 大小 | tier |
| :--- | ---: | :--- |
| `docx.skill` | 163,372 | always |
| `pdf.skill` | 21,600 | always |
| `pdf-reading.skill` | 7,997 | always |
| `pptx.skill` | 173,007 | always |
| `xlsx.skill` | 155,709 | always |
| **`frontend-design.skill`** | 8,125 | always |

manifest 结构：

```json
{ "agentSkillsRef": "1792682972",
  "skills": [ { "name": "docx", "description": "…", "tier": "always" }, … ] }
```

### 6.10.4 ★ frontend-design.skill 与 open-claude-ui 的直接关联

这是本次盘点**对 open-claude-ui 最相关**的发现。`frontend-design/SKILL.md`（9,390 字节）是 Anthropic 给 Claude 的官方前端设计指南，其「AI 生成设计校准清单」**精确描述了我们项目的技术特征**：

原文（第一点，逐字）：

```
1. a warm cream background (near #F4F1EA) with a high-contrast serif display
   and a terracotta or warm-clay accent (often near #D97757 — Anthropic's own
   Claude-interaction accent, so on a user's brief it reads as a tell);
```

**翻译**：暖奶油底（近 #F4F1EA）+ 高对比衬线标题 + 陶土色 accent（**近 #D97757——Anthropic 自己的 Claude 交互色，用在用户项目上会被认出是 AI 生成的痕迹**）。

其余四条 default 特征：近黑底+荧光绿/朱红单 accent、报纸式 hairline 布局、「SaaS 卡片套件」（同圆角+同阴影+渐变装饰）、模板化 chrome（全大写 eyebrow 标签、`A · B · C` 中点连接、`WORD — fragment` 破折号、`#0B0B0B`/`#111` 替代纯黑、等宽字体小标签、`→` 尾缀链接）。

**对 open-claude-ui 的双重含义**：

1. **作为逆向参照**：该 skill 是 Anthropic **自己写的**关于「Claude 交互色是 #D97757」的确认，与我们的 `--cds-clay: #d97757` 实测一致——这是官方文档级别的色彩佐证，可直接引用。
2. **作为还原质量的对照**：skill 的核心主张是「避免 default treatment、做有 brief 意图的取舍」。open-claude-ui 作为**还原项目**不受此约束（我们的 brief 就是精确复刻），但如果项目未来派生自定义主题，该清单就是现成的「避免 AI 味」检查表。

skill 的其它要点：两遍工作流（先 token 草案→对照 brief 自审→再写码）、「把大胆花在一处」、CSS 选择器特异性互相抵消的告诫（与 issue #25 的 `.cds-skeleton-sweep` 缺陷同类）、写作规范（CTA 用「Save changes」不用「Submit」）。

### 6.10.5 ★ 内置 Linux 虚拟机（Cowork VM）

**这是 3.6556.2 最大的未文档化特性**。证据链：

`Resources/smol-bin.arm64.img`（**24,117,248 字节**，`file` 判定为 DOS/MBR boot sector）——配合 `index.chunk-jPKPzV-P.js` 中的 VM 管理代码：

```js
m6r = "smol-bin.vhdx"                    // Hyper-V 磁盘镜像名
p6r = "efivars.fd"                       // UEFI 变量文件
// Windows 路径：process.resourcesPath + smol-bin.${arch}.vhdx
// [VM:start] memory=${_}GB … vmCpuCount …
// d6r = VMDownloadError / f6r = VMConnectionTimeoutError(guestReady, …)
// [VM:start] … vm_shutdown_failed … trigger:"app_quit"
```

**体系归属 Cowork**（`CoworkVM*` 系列导出）：

```
CoworkVMDownloadStatus / CoworkVMRunningStatus / CoworkVMHostIPv6Notice
CoworkSpaces / CoworkStorage / CoworkUserFiles / CoworkMemory
CoworkScheduledTasks / CoworkRewindRefusal / CoworkMcpUnavailableReason
CoworkDataExportStatus / CoworkFeedback / CoworkFilePreview
```

**结论**：Claude 桌面端为 Cowork（代理长任务）内置了一个**可下载/可启动的 Linux micro-VM**（macOS 用 `.img`，Windows 用 `.vhdx`，配 UEFI），在 VM 里跑隔离的 Claude Code 会话。相关 feature flag：`cowork_bypass_permissions_mode`、`cowork_auto_permission_mode`、`cowork_device_attestation_*`、`cowork_remote_device_revoked_reenroll`、`cowork_hipaa_crash_dumps`（HIPAA 合规的崩溃转储隔离）。

**对 open-claude-ui 的含义**：Cowork 是一个完整的界面 surface（与 chat/code 并列，见 `coworkSurface`/`codeSurface`/`chatSurface` 三态开关），其 UI 层尚未被我们还原。v3 的 45 个 `data-cds` 里未见 Cowork 专属组件——说明其 UI 可能走 claude.ai Web 而非本地 CSS，**此点未验证**。

### 6.10.6 内置 MCP servers

`resources/` 下捆绑了两个完整的 MCP server：

| Server | 内容 | 大小 |
| :--- | :--- | ---: |
| **github-mcp** | `github-mcp-server`（Go 编译的单一二进制） | 19,218,370 |
| **office365-mcp** | `office365-mcp-stdio.mjs` + `pdfExtractorProcess.mjs` + `pdf.worker.mjs` + MSAL 运行时（`libmsalruntime_arm64.dylib` + `msal-node-runtime.node`） | 共 ~8.7 MB |

结合 ASAR 内的 `@ant/computer-use-mcp`（内联）与 `@ant/claude-for-chrome-mcp`（内联），Claude 桌面端**自带 4 个 MCP server**。`office365-mcp` 的 MSAL 依赖解释了 OAuth 面板中「Client secret / IdP app registration」等企业配置项。

### 6.10.7 会话类型全景（路由表）

主进程的 URL 路由表揭示了完整的 surface 清单（`X("...")` 为路径段）：

```
chat（默认）          agent_session          cowork / cowork / agent / session
claude-code-desktop   ├── share / shared     ├── hub
                      ├── memory             ├── scheduled（+ remote）
                      ├── routines           ├── artifact
                      └── project / thread
cowork_sessions       cowork-artifact        scheduled-task
routines              claude-ship            cic / task / task
presence              browser-session        experiments / code / shared
verify                badges                 certificates
test / runs           test / targets         local_sessions
artifacts / latest    org / artifacts        public / library
v2 / ccr-sessions(+ws)  v2 / sessions-share  v2 / ccr-sessions-share
v1 / code / triggers    v1 / claude_code / routines
v1 / code / agent-proxy / provisioning-links
v1 / code / shared-sessions / shared-threads / debug-shares
api / organizations / cowork / scheduled_tasks
```

**3.6556.2 的会话/功能面远超 chat**：Claude Code 桌面版、Cowork、定时任务、例程（routines）、claude-ship、presence、浏览器会话、共享会话（ccr）、徽章与证书、插件市场。

### 6.10.8 现代 CSS 特性清单（3.6556.2 主样式表）

| 特性 | 出现次数 | 说明 |
| :--- | ---: | :--- |
| `@property` | **90** | v3 文档已记录 24 个 `--cds-*`，其余为 Tailwind `--tw-*` |
| `color-mix()` | 114 | 暗色混色主力 |
| `@supports` | 64 | 渐进增强探测 |
| `@starting-style` | **3** | **入场过渡初始态**（此前未记录） |
| `view-transition-name` | 3 | **附件拖拽重排的共享元素过渡** |
| `@layer` | 6 | `cds-card` 等 |
| `@container` | 1 | 仅 Tailwind 的 `.\@container` 工具类 |

**`@starting-style` + View Transitions 的实际用途**（原文）：

```css
/* 消息操作按钮的悬停/聚焦浮现 */
@starting-style {
  .cds-root .group\/message-row:hover [data-cds=MessageActions][data-reveal]… {
    opacity: 0; transform: scale(.92) translateY(4px);
  }
}

/* 附件卡片的增删重排：view-transition-name: match-element（Chromium 新特性） */
:root:active-view-transition-type(cds-attachments)
  [data-cds-composer-attachments-clip][data-cds-attachments-clipping] {
  view-transition-name: match-element;
  view-transition-class: cds-attachments-clip;
  view-transition-group: contain;
}
@supports selector(::view-transition-group-children(.x)) and (view-transition-group:contain) { … }
```

**对 open-claude-ui 的影响**：`match-element` + `view-transition-group: contain` 是 3.6556.2 附件重排动画的核心，我们完全没有实现。这是 P2 级的动效补全项。

### 6.10.9 其它零散发现

| 项 | 说明 |
| :--- | :--- |
| `claude-ios-sim` | 主进程含 **iOS 模拟器宿主**（`Claude iOS Sim.app/Contents/MacOS/claude-ios-sim`），`xcodebuild`/`xcrun`/`plutil` 工具链白名单，用于 iOS 端开发调试 |
| `claude-browser-shim.js` | 6,568 B 的 **shell + JS 混合脚本**：作为 `$BROWSER` shim 拦截 URL 打开，带 `CLAUDE_BROWSER_BRIDGE` 时走 Node 分支 |
| `ion-dist/` | claude.ai 的**网页壳资源**（`frame-shell.html` / `frame-connect.html` / `frame-manage.html`），通过自定义 `app://` 协议服务——即桌面端内嵌的 claude.ai 页面 |
| `clawdQuestEngine` | main_window 的 1.2 MB JS + 10 KB CSS，`--cq-*` 独立命名空间（`--cq-bg:#171717` 等），含 55 处 quest/XP 引用——**游戏化/任务系统**，与 CDS 完全隔离 |
| `compile-cache` | 见 6.10.1 |
| `quick-actions/document.wflow` | macOS Automator 工作流 |
| feature flags | 98 个 `cai_*`（claude.ai 内部）/`ccr_*`/`cowork_*`/`claude_ai_*` flag 名可提取，含 `cowork_bypass_permissions_mode`、`ccr_plan_mode_enabled` 等 |

### 6.10.10 对 open-claude-ui 的行动项汇总

| 优先级 | 项 | 依据 |
| :--- | :--- | :--- |
| **P1** | 引用官方 skill 对 `#D97757` 的确认作为 `--cds-clay` 的文档佐证 | 6.10.4 |
| **P2** | 实现 `@starting-style` + `view-transition-name: match-element` 的附件重排动画 | 6.10.8 |
| **P2** | Cowork surface 的 UI 还原评估（先确认其 UI 载体是本地还是 Web） | 6.10.5 |
| **P3** | 记录内置 MCP servers 与 skills 体系（文档完整性） | 6.10.3 / 6.10.6 |
| **P3** | `clawdQuestEngine` 游戏化系统的还原评估 | 6.10.9 |


---

## 6.11 基线更新：3.6556.2 → 4.29.0 增量取证

**本报告撰写期间，Claude Desktop 完成了一次大版本跳迁**。本节记录增量复核结果。

### 6.11.1 版本事实

| 项 | 报告主体（v3） | 当前实测 |
| :--- | :--- | :--- |
| 版本 | `@ant/desktop 3.6556.2` | **`@ant/desktop 4.29.0`**（Info.plist 与 package.json 双确认） |
| ASAR 根摘要 | `b2dfbbb4…d68a` | **`fea39d03…42aa`** |
| 主样式表 | `MainWindowPage-BjVtjJFx.css`（237,145 B） | `MainWindowPage-BIxm3NVN.css`（238,086 B，**+941 B**） |
| ASAR 条目 | 629 | **696**（build JS 551 → 509，条目增加来自其它目录） |
| 主入口 | `index.pre.js` 982,086 B | 1,002,540 B（**+20,454 B**） |

fuse 状态不变（`EnableNodeCliInspectArguments` 仍 Disabled）。

### 6.11.2 CSS 层面：结构几乎无变化，两处实质更新

**清单级对比（old 995 vs new 998 个选择器块）**：

| 维度 | 3.6556.2 | 4.29.0 | 变化 |
| :--- | ---: | ---: | :--- |
| `@keyframes` | 55 | **55（完全相同）** | 0 |
| `@property` | 90 | **90（完全相同）** | 0 |
| token 总数 | 1,109 | 1,109 | 新增 0、删除 0、**值变化 2** |
| `data-cds` 命名空间 | 45 | 45 | `-Heatmap` `+CellChartContainer` |

**变化 1：`Heatmap` → `CellChartContainer`**（组件更名，同为消息内嵌图表容器，替换发生在同一条规则内）。

**变化 2：`--cds-fill-primary` 系在 `[data-window-active=false]` 下新增灰色覆盖**：

```css
/* 4.29.0 新增（失焦态的 brand/primary 填充统一去色） */
[data-window-active=false] :is([data-cds=Button],[data-cds=ButtonGroup],[data-cds=SplitDropdownButton]) {
  --cds-fill-brand: var(--cds-gray-450);
  --cds-fill-brand-hover: var(--cds-gray-400);
  --cds-fill-primary: var(--cds-gray-450);
  --cds-fill-primary-hover: var(--cds-gray-400);
}
[data-window-active=false] [data-cds]:not(:where([data-cds-theme],[data-cds-theme] *)) {
  --cds-fill-accent-hover: var(--cds-role-accent-fill-hover);
}
```

3.6556.2 已有失焦去饱和的基础（`data-window-active=false` 时 `role-accent-*` 全系映射到 gray），但只覆盖了 `[data-cds=Button]` 的 `--cds-fill-brand`。4.29.0 把覆盖面扩到 **Button/ButtonGroup/SplitDropdownButton** 三类组件并补上 `fill-primary` 与 `fill-accent-hover`。

**全部我们关心的 token 复验（text 三色、accent 蓝、clay-emphasized、brand 对、radius/h-control/gap、shadow-popover、focus-shadow 蓝环、skeleton 同值、alpha 单表达式）——在 4.29.0 中逐项一致，无一回归。**

### 6.11.3 JS 层面：新增 2 个桥接 API + 字节码优化

`mainView.js` 的 `exposeInMainWorld` 调用 23 → 25，字面量 API 名 12 → **14**：

| 新增 API | 上下文证据 |
| :--- | :--- |
| **`desktopNoFlushBytecode`** | `Sp="--js-flags=--no-flush-bytecode"`；当主进程以该 flag 启动时暴露布尔值。V8 bytecode 不落盘刷新的开关探测，与 ASAR 内 `compile-cache/` 的 V8 code cache 预热配套 |
| **`desktopHomePath`** | 主进程把 `home` 路径直接暴露给渲染层（try/catch 包裹，失败时不暴露） |

其余 12 个 API 名（`buddyBle`、`claudeAppBindings`、`desktop*` 系列、`electronWindowControl`、`electronIntl`、`process`）不变。

### 6.11.4 对本报告结论的影响裁定

| 项 | 裁定 |
| :--- | :--- |
| 55 keyframes / 45→45 data-cds / 90 @property / token 值 | **全部在 4.29.0 中复验成立**（除组件更名与失焦覆盖扩展） |
| 我们的修复清单（text 三色、accent 蓝、brand 对、密度、skeleton、shadow） | **逐项与 4.29.0 一致，无需任何改动** |
| `frontend-design` skill 佐证、Cowork VM、4 个 MCP server、compile-cache | 全部仍在（bundled-skills 7 个文件同名） |
| `data-cds` 组件清单 | **需微调**：45 个名字中 `Heatmap` 应更正为 `CellChartContainer` |
| 桥接 API 名清单 | **需微调**：12 → 14 个（新增 `desktopNoFlushBytecode`、`desktopHomePath`） |
| 运行时值表（6.7.5） | 系 3.6556.2 实测；CSS token 值零变化，**结论可直接沿用**，如需严格复测可在 4.29.0 上重跑 |

### 6.11.5 open-claude-ui 需要的动作

| 优先级 | 动作 |
| :--- | :--- |
| P2 | `cds-theme.css` 增加 `[data-window-active=false]` 失焦去色块（Button/Group/SplitDropdownButton 的 fill-brand/fill-primary + 全局 fill-accent-hover） |
| P3 | 组件清单与桥接 API 清单的命名更新（`Heatmap`→`CellChartContainer`，+2 API） |
| — | 其余全部无需改动 |

### 6.11.7 深挖补充：6.11 首轮遗漏的三项

对 6.11 的增量复核做完整性回查后，补充三项：

**a) `resources/` 实际有 7 个条目，不是 4+3 的两份记录**

3.6556.2 的 `resources/` 为 4 项（artifact-libs / bundled-skills / github-mcp / office365-mcp）。4.29.0 实为 **7 项**：上述 4 项 + **`i18n/`（43 个语言 JSON，3.5 MB，947 键的 ICU 消息目录）** + **`claude-browser-shim.js`**（原磁盘文件收编进 asar）+ **`quick-actions/`**（Automator 工作流，同前收编）。同时磁盘上的 `ion-dist/` 目录变为 **`ion-dist.asar`（191 MB，4,532 条目）**——claude.ai 网页壳独立打包，内含自己的 12 语言 i18n 与模块依赖图 `scc.json`（3,925 chunks / 52,735 edges）。`i18n` 进入 app.asar 属于 4.29.0 的真实新增。

**b) 官方 CDS 文档逐字 diff 完成**

3.6556.2 的文档位于 `index.chunk-CbnfBP-3.js`，4.29.0 移至 `index.chunk-JNXX2nzx.js`（486,586 B）。全文 668 行逐字对比，实质差异仅一处：构建工具链 `yarn workspace @ant/cds-docs gen:cds-skill` → **`bun run --cwd apps/cds-docs gen:cds-skill`**（`gen:tokens` 同样 yarn→bun）。token 模型、elevation 表、motion 词表、全部 design rules **一字未改**——进一步确认我们提取的规范在 4.29.0 中继续有效。

**c) 构建产物重组**

build JS 从 551 个文件（23.0 MB）变为 **501 个（23.0 MB）**——文件数减 50 而总量不变，是 chunk 合并；最大 chunk 从 4.4 MB（`CbnfBP-3`，含 CDS 文档）变为 **6.8 MB（`C7NkbHFq`）**。入口 `index.js` 带 `SENTRY_RELEASE` id（`2609742292…`）。这类打包形态变化不影响任何取证结论，但说明「按 chunk 文件名引用证据」不可靠——后续引用证据应使用**内容特征**（如 `gen-cds-skill` 字样）而非文件名。

### 6.11.6 版本策略说明

Claude Desktop 的版本节奏明显快于本仓库（本次取证期间即经历 3.6556.2 → 4.29.0）。**v3 报告的取证方法论（REA 静态 + debugger 运行时 + 逐条复现命令）比任何一份快照更有长期价值**：版本更替时只需重跑证据索引里的命令即可刷新基线。后续版本号变化不再单独出报告，按本节格式做增量附录。

---
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
