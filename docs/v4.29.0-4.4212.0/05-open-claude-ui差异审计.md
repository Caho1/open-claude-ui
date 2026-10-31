---
title: "第五章：open-claude-ui 差异审计"
category: reverse-engineering
domain: architecture/desktop_application
version: "3.0 (3.6556.2)"
status: stable
date: 2026-10-26
author: "REA 逆向工程实验室"
evidence_root: "b2dfbbb40325d978dcb7561ad12a6f9bc199f8f46b7d3d2899af74ce8965d68a"
---

# 第五章：open-claude-ui 差异审计

> 本章把 `open-claude-ui` 仓库（`feat/issue-25-skeleton-sweep-and-rea-audit` 分支，HEAD `9dc69bc`）的 `code-examples/cds-theme.css` 与 3.6556.2 的 `MainWindowPage-BjVtjJFx.css` 做逐项对比。**每一条差异都有可执行命令。**

---

## 5.1 已对齐项

### 5.1.1 色彩阶

| 集合 | ours | client | 差异 |
| :--- | ---: | ---: | :--- |
| `--cds-gray-*` | 35 | 35 | **1**（值等价） |
| `--cds-orange-*` | 35 | 35 | **0** |

**唯一差异**：

```
--cds-gray-870: ours = #111111 | client = #111
```

`#111111` 与 `#111` 是同一个颜色，仅为书写长度不同。**无需修改**（如需严格逐字节对齐可改为 `#111`）。

**证据**：

```bash
python3 -c "
import re
ours=open('code-examples/cds-theme.css').read()
cli=open('MainWindowPage-BjVtjJFx.css').read()
def grab(s,pre):
    return {int(m.group(1)): m.group(2).strip() for m in re.finditer(r'--cds-'+pre+r'-(\d+):([^;}]+)', s)}
for pre in ['gray','orange']:
    a,b=grab(ours,pre),grab(cli,pre)
    diff=[(k,a.get(k),b.get(k)) for k in sorted(set(a)|set(b)) if a.get(k)!=b.get(k)]
    print(pre, f'ours={len(a)} cli={len(b)} diff={len(diff)}')
    for k,x,y in diff: print(f'   {pre}-{k}: ours={x} cli={y}')
"
```

### 5.1.2 品牌主色

| 令牌 | ours | client | 判定 |
| :--- | :--- | :--- | :--- |
| `--cds-clay` | `#d97757` | `#d97757` | ✅ |

### 5.1.3 骨架屏核心动效参数

| 参数 | ours（分支） | client | 判定 |
| :--- | :--- | :--- | :--- |
| `cds-skeleton-sweep` 关键帧 | `translate(-100%)` → `translate(100%)` | 同左 | ✅ |
| sweep 时长 | `2s` | `2s` | ✅ |
| sweep 缓动 | `linear` | `linear` | ✅ |
| sweep 角度 | `105deg` | `105deg` | ✅ |
| `cds-skeleton-breathe` 关键帧 | `opacity 1 → .6 → 1` | 同左 | ✅ |
| breathe 时长 | `2s` | `2s` | ✅ |
| breathe 缓动 | `ease-in-out` | `ease-in-out` | ✅ |
| 级联延时基数 | `90ms` | `90ms` | ✅ |

**证据**（keyframes 原文逐字对比）：

```css
/* client 3.6556.2 */
@keyframes cds-skeleton-sweep  { 0%{transform:translate(-100%)}to{transform:translate(100%)} }
@keyframes cds-skeleton-breathe{ 0%,to{opacity:1}50%{opacity:.6} }

/* ours (branch 9dc69bc) */
@keyframes cds-skeleton-sweep  { 0%{transform:translate(-100%)}100%{transform:translate(100%)} }
@keyframes cds-skeleton-breathe{ 0%,100%{opacity:1}50%{opacity:.6} }
```

> **这确认了 issue #25 的核心取值裁定：`2s / linear / 105deg` 是正确的地面真值。** 分支在这三点上与客户端完全一致，v2/storybook 的 `1.8s / cubic-bezier / 90deg` 是错的。

---

## 5.2 必须修正项

### 5.2.1 `--cds-clay-emphasized`（严重）

| 项 | 值 |
| :--- | :--- |
| ours | `var(--cds-clay-hover)` |
| ours 实际解析（light） | `#cc5a36` |
| ours 实际解析（dark） | `#e08264` |
| **client** | **`#c6613f`**（2 处定义：`:root` 与 `.cds-root`，值相同；0 处暗色覆盖） |

**判定**：❌ **必须改为硬编码 `#c6613f`**，且**不要**在暗色块里覆盖。

**理由**：
1. client 的 `--cds-clay-emphasized` 出现 2 次（`:root` 与 `.cds-root`），**两处值均为 `#c6613f`**，且**没有任何暗色重定义**
2. 当前 ours 的做法（`var(--cds-clay-hover)`）会在暗色下变成 `#e08264`，与 client 的 `#c6613f` 相差很大
3. `#c6613f` 与 `open-claude-ui` 自己的 `AGENTS.md` 里记录的 `--brand: #c6613f`（「Official desktop brand primary color」）一致

**修复代码**：

```css
/* 浅色 */
:root {
  --cds-clay-emphasized: #c6613f;   /* 不派生自 --cds-clay-hover */
}

/* 暗色：不要覆盖 */
/* .dark { --cds-clay-emphasized: … }  ← 删除这一行 */
```

**验证命令**：

```bash
grep -c "\--cds-clay-emphasized:" code-examples/cds-theme.css
# 修复后应为 1（只在 :root 出现一次）
grep -o "\--cds-clay-emphasized:[^;}]*" code-examples/cds-theme.css
# 应为 --cds-clay-emphasized: #c6613f
```

### 5.2.2 骨架屏暗色 token（严重）

| 令牌 | ours | client |
| :--- | :--- | :--- |
| `--cds-skeleton-base`（light） | `rgba(0, 0, 0, 0.05)` | `var(--cds-alpha-1)` = `hsl(from var(--cds-neutral-900) h s l / 5%)` |
| `--cds-skeleton-base`（dark） | `rgba(255, 255, 255, 0.06)` | `hsl(from var(--cds-neutral-900) h s l / 7.5%)` |
| `--cds-skeleton-sheen`（light） | `rgba(255, 255, 255, 0.25)` | 同 base（`hsl(… / 5%)`） |
| `--cds-skeleton-sheen`（dark） | `rgba(255, 255, 255, 0.08)` | 同 base（`hsl(… / 7.5%)`） |

**两个实质差异**：

1. **方向相反**：ours 在暗色下用**白色半透明（提亮）**，client 用**中性黑半透明（加深）**
2. **base 与 sheen 的关系**：ours 中 sheen 比 base 亮（0.25 vs 0.05 / 0.08 vs 0.06）；client 中**两者完全相同**

**修复代码**：

```css
:root {
  --cds-skeleton-base:  var(--cds-alpha-1);
  --cds-skeleton-sheen: var(--cds-alpha-1);
}

/* 暗色（三种作用域，视实现复杂度可先只做 .dark） */
.dark,
[data-mode="dark"] {
  --cds-skeleton-base:  hsl(from var(--cds-neutral-900) h s l / 7.5%);
  --cds-skeleton-sheen: hsl(from var(--cds-neutral-900) h s l / 7.5%);
}
```

> **前置依赖**：`--cds-alpha-1` 与 `--cds-neutral-900` 必须存在。ours 已有 `--cds-alpha-1`（见 5.1.1 的 gray 对齐），需确认 `--cds-neutral-900` 指向 `--cds-gray-900`。

### 5.2.3 暗色模式作用域

| 项 | ours | client |
| :--- | :--- | :--- |
| 选择器 | `.dark` | `[data-mode=dark]` + `[data-mode=system]` + `.cds-dark-scope[data-mode=dark]` |
| 系统跟随 | ❌ 无 | ✅ `[data-mode=system]` + `prefers-color-scheme` |
| 局部强制 | ❌ 无 | ✅ `.cds-dark-scope` |

**判定**：⚠️ **兼容性改动**。若要保持 `.dark` 的易用性，可**双轨支持**：

```css
.dark,
[data-mode="dark"],
.cds-dark-scope[data-mode="dark"] {
  /* 暗色令牌 */
}
```

**不建议**直接改名，会破坏现有使用方。

### 5.2.4 RTL 动画方向

| 项 | ours | client |
| :--- | :--- | :--- |
| 渐变角度翻转 | ✅ 105° → 255° | ✅ |
| **动画方向反转** | ❌ 缺失 | ✅ `animation-direction: reverse` |
| RTL 判定 | `:dir(rtl)` / `[dir="rtl"]` | `:root[dir=rtl]` **且** `:lang(<19 个语言>)` |

**实测证据**（Chrome headless，用 ours 的 CSS）：

```
LTR: transform = matrix(1,0,0,1,-220,0)
RTL: transform = matrix(1,0,0,1,-220,0)   ← 完全相同
```

**修复代码**（补 `animation-direction`）：

```css
[dir="rtl"] .cds-skeleton-sweep,
[dir="rtl"] .cds-skeleton::after,
:dir(rtl) .cds-skeleton-sweep,
:dir(rtl) .cds-skeleton::after {
  background: linear-gradient(255deg, transparent 35%, var(--cds-skeleton-sheen) 50%, transparent 65%);
  animation-direction: reverse;   /* ← 新增 */
}
```

---

## 5.3 缺失项

### 5.3.1 缺失的 44 个关键帧

```bash
comm -13 <(grep -o "@keyframes [a-zA-Z0-9_-]*" code-examples/cds-theme.css | sed 's/@keyframes //' | sort -u) \
         <(grep -o "@keyframes [a-zA-Z0-9_-]*" MainWindowPage-BjVtjJFx.css | sed 's/@keyframes //' | sort -u)
```

**完整 44 项**（字母序，`comm -13` 输出）：

```
 1  cds-attachment-out
 2  cds-chip-in
 3  cds-drop-icon-rise
 4  cds-drop-ring-in
 5  cds-editor-comment-working
 6  cds-fade-in
 7  cds-flipbook
 8  cds-grid-rows-in
 9  cds-morph-in
10  cds-page-tabs-arrive
11  cds-page-title-leaves
12  cds-pill-dip-down
13  cds-pill-dip-up
14  cds-pill-in
15  cds-pill-out
16  cds-pill-pop-down
17  cds-pill-pop-up
18  cds-pill-roll-in-down
19  cds-pill-roll-in-up
20  cds-pill-roll-out
21  cds-placeholder-reveal
22  cds-resolve-glyph
23  cds-resolve-square
24  cds-reveal-in
25  cds-reveal-out
26  cds-scroll-fade-strip-active
27  cds-scroll-fade-strip-in
28  cds-scroll-fade-strip-out
29  cds-shimmer
30  cds-shimmer-text-band
31  cds-shimmer-text-band-rtl
32  cds-shimmer-text-band-strong
33  cds-shimmer-text-band-strong-rtl
34  cds-shimmer-text-shine-rtl
35  cds-shimmer-text-shine-strong-rtl
36  cds-slide-in-end
37  cds-slide-in-start
38  cds-sticky-edge-active
39  cds-sticky-edge-end
40  cds-sticky-edge-start
41  cds-working-dot-halo
42  cds-working-dot-lands
43  cds-working-dot-veil
44  spin
```

**按系列归并**：

| 系列 | 数量 | 成员 |
| :--- | ---: | :--- |
| `cds-pill-*` | 9 | dip-down/up, in, out, pop-down/up, roll-in-down/up, roll-out |
| `cds-shimmer-*` | 7 | shimmer, text-band{,-rtl,-strong,-strong-rtl}, text-shine-rtl, text-shine-strong-rtl |
| `cds-reveal/slide/fade` | 5 | reveal-in, reveal-out, slide-in-start, slide-in-end, fade-in |
| `cds-sticky-edge-*` | 3 | active, end, start |
| `cds-scroll-fade-strip-*` | 3 | active, in, out |
| `cds-working-dot-*` | 3 | halo, lands, veil |
| `cds-resolve-*` | 2 | glyph, square |
| `cds-drop-*` | 2 | icon-rise, ring-in |
| 其它 | 10 | attachment-out, chip-in, editor-comment-working, flipbook, grid-rows-in, morph-in, page-tabs-arrive, page-title-leaves, placeholder-reveal, spin |

> 注：`cds-shimmer-text-shine` 与 `cds-shimmer-text-shine-strong` 已在 ours 中，故不在缺失列表。

**优先级建议**（基于是否被 `data-cds` 组件消费）：

| 优先级 | 关键帧 | 理由 |
| :--- | :--- | :--- |
| **P0** | `cds-placeholder-reveal` | 骨架屏 `data-hold=delayed` 必需 |
| **P1** | `cds-pill-*`（9 个） | v2 文档已声称实现，且 pill 是高频交互 |
| **P1** | `cds-shimmer*`（8 个） | 倒计时/生成中状态常用 |
| **P2** | `cds-scroll-fade-strip-*`（3 个） | 滚动渐隐的 strip 变体 |
| **P2** | `cds-sticky-edge-*`（3 个） | 吸边效果 |
| **P3** | 其余 | 按需 |

### 5.3.2 缺失的 `data-cds` 命名空间

```bash
ours=$(grep -rho 'data-cds="[A-Za-z-]*' code-examples/cds-theme.css docs/claude-components-storybook.html | sed 's/data-cds="//' | sort -u)
cli=$(grep -o "\[data-cds=[A-Za-z-]*\]" MainWindowPage-BjVtjJFx.css | sed 's/\[data-cds=//;s/\]//' | sort -u)
comm -12 <(echo "$ours") <(echo "$cli") | wc -l   # 交集 18
comm -13 <(echo "$ours") <(echo "$cli") | wc -l   # 仅客户端 27
comm -23 <(echo "$ours") <(echo "$cli") | wc -l   # 仅我方 4
```

| 集合 | 数量 |
| :--- | ---: |
| ours | 22 |
| client | 45 |
| **交集** | **18** |
| **仅客户端有（缺失）** | **27** |
| **仅我方有（客户端无）** | **4** |

**交集（18 项，已对齐）**：

```
Accordion  Aside  AskUserQuestion  AssistantMessage  Banner  Card
ChartContainer  ChatComposerQueuedMessages  CommentCard  DataTable
FileDiff  Panel  PointChartContainer  PreviewCard  Skeleton
Surface  Table  UserMessage
```

**缺失的 27 项**：

```
 1  AccordionHeader
 2  Button
 3  ButtonGroup
 4  CardLink
 5  ChatComposerChin
 6  ChatComposerDock
 7  ChatComposerEditor
 8  ChatComposerNotices
 9  DiffIndicator
10  Heatmap
11  Icon
12  MessageActions
13  MessageAttachments
14  MessageAttachmentsFile
15  MessageAttachmentsImage
16  MessageAttachmentsQuote
17  MessageAttachmentsVideo
18  ModelSelector
19  ModelSelectorEffort
20  Page
21  Prose
22  Pulse
23  SkeletonGroup
24  SplitDropdownButton
25  Toolbar
26  TurnStatus
27  TurnStatusStep
```

**我方独有的 4 项**（3.6556.2 主样式表中不存在）：

```
CodeBlock
ConfirmationDialog
ContextMenu
Toast
```

这 4 个可能是 v1/v2 时代逆向得到的命名，或 `open-claude-ui` 自行命名的组件。本文**不判定其正确性**，标注为待核实。

**优先级**：

| 优先级 | 项 | 理由 |
| :--- | :--- | :--- |
| **P0** | `SkeletonGroup` | 骨架屏双层结构必需 |
| **P1** | `Toolbar`、`Prose`、`Page` | 基础容器 |
| **P1** | `MessageAttachments` 系列（5 个） | 附件卡片体系 |
| **P2** | `ChatComposer*`（4 个） | 输入框子部件 |
| **P2** | `ModelSelector`、`ModelSelectorEffort` | 模型选择器 |
| **P3** | 其余 | 按需 |

### 5.3.3 缺失的 7 个 `@property`

```
--cds-badge-x-wght
--cds-message-actions-opacity
--cds-outset-x
--cds-outset-y
--cds-sticky-edge-active
--cds-sticky-edge-end
--cds-sticky-edge-start
```

**影响**：这些属性不可被 CSS 动画插值。若缺失，相关动效会退化为离散跳变。

---

## 5.4 Issue #25 分支的取值裁定

`issue #25` 提出的四个问题，本文逐一裁定。**证据全部来自 3.6556.2 字节。**

### 问题 1：扫光的地面真值是 `2s / linear / 105°` 还是 `1.8s / bezier / 90°`？

**裁定：`2s / linear / 105°` 正确。**

**证据**：

```css
/* 3.6556.2 原文 */
.cds-root .cds-skel-sweep-band {
  background: linear-gradient(105deg, transparent 35%, var(--cds-skeleton-sheen), transparent 65%);
  animation: cds-skeleton-sweep 2s linear var(--cds-skel-reveal-end, 0s) infinite backwards;
  position: absolute;
  inset: 0
}

@keyframes cds-skeleton-sweep { 0%{transform:translate(-100%)}to{transform:translate(100%)} }
```

三个参数（`2s`、`linear`、`105deg`）逐字命中。分支的修正**方向正确**。

### 问题 2：Wave/Lockstep 是否应进入 token 层？

**裁定：应进入，但分支的实现方式需要重写。**

**证据与理由**：

| 项 | client | 分支 | 裁定 |
| :--- | :--- | :--- | :--- |
| 存在性 | ✅ CSS 中有完整规则 | ✅ 有 | 该实现 |
| wave 的动画 | `cds-skeleton-breathe` | `cds-skeleton-sweep` | ❌ **分支用错动画** |
| lockstep 挂载 | `SkeletonGroup` 容器 | 每个 `Skeleton` 块 | ⚠️ 效果近似但语义不同 |
| 级联延时 | `reveal-end + i×90ms` | `i×90ms` | ⚠️ 缺 `reveal-end` 项 |
| `data-hold` 三态 | ✅ | ❌ 无 | ❌ **缺失关键机制** |
| 动画收尾 | `.01ms` + `display:none` | ❌ 无 | ❌ **动画永不停止** |

### 问题 3：`cds-pure.css` 的 header 承诺了 skeleton sweep 却不含实现？

**裁定：这个问题在 3.6556.2 的语境下不成立，但仍应修复。**

**证据**：

```bash
# cds-pure.css 当前只有 16 行，实质是 @import
wc -l code-examples/cds-pure.css   # → 16
cat code-examples/cds-pure.css     # → @import "./cds-theme.css";
```

`@import` 已经间接包含了 `cds-theme.css` 的全部规则。但 **header 注释里列举的「3. Pure-CSS animation utilities」与实际内容不符**——文件本身零规则。

**建议**：修正 header 注释，或把 skeleton 规则物理移入 `cds-pure.css`。

### 问题 4：CI 门禁看不到 docs/ 和孤儿关键帧？

**裁定：门禁已扩展，但存在漏报。**

**证据**（本文实测）：

门禁在判断「关键帧是否被消费」时**未剥离注释**，因此：

```css
@keyframes cds-orphan { 0%{opacity:0} 100%{opacity:1} }
/* TODO: cds-orphan 待接入 */
```

上述代码会**通过门禁**（注释里的 `cds-orphan` 被当作消费）。本文用最小复现验证：

```bash
$ node scripts/check-tokens.mjs
✓ 全部 @keyframes cds-* 均有明确消费类     ← 漏报，EXIT=0
```

**修复建议**：判断前先 `css.replace(/\/\*[\s\S]*?\*\//g, '')`。

---

## 5.5 修复优先级总表

按「影响范围 × 修复成本」排序：

| 优先级 | 项 | 影响 | 改动量 |
| :--- | :--- | :--- | :--- |
| **P0** | `.cds-skeleton-sweep` 独立类导致元素移出视口 | 示例完全不可见 | 改 1 行选择器 |
| **P0** | `--cds-clay-emphasized` 值错误 | 品牌色偏差 | 改 1 个值 |
| **P0** | 骨架屏暗色 base/sheen 方向相反 | 暗色下视觉相反 | 改 4 个值 |
| **P1** | RTL 缺 `animation-direction` | RTL 扫光方向错 | 加 1 条声明 |
| **P1** | 骨架屏 `data-hold` 机制缺失 | 动画永不停止 | 新增 ~20 行 |
| **P1** | wave 用错动画（sweep vs breathe） | 视觉错 | 改 1 行 |
| **P2** | 缺 `cds-placeholder-reveal` | `data-hold=delayed` 不可用 | 新增 1 个 keyframes |
| **P2** | 缺 9 个 `cds-pill-*` | pill 交互无 CSS 实现 | 新增 9 个 keyframes |
| **P2** | `.cds-skeleton` 的 `border-radius` 覆盖 Tailwind | 头像等圆角失效 | 用 `:where()` 降权 |
| **P3** | 缺 44 个 keyframes / 27 个 data-cds / 7 个 @property | 功能不全 | 按需 |
| **P3** | CI 门禁未剥离注释 | 潜在漏报 | 加 1 行 |

---

## 本章证据索引

| 断言 | 命令 |
| :--- | :--- |
| gray 35 阶 diff=1 | python 逐阶对比 |
| orange 35 阶 diff=0 | 同上 |
| sweep 三参数一致 | keyframes + 规则原文逐字对比 |
| clay-emphasized client 2 处同值 / 0 暗色覆盖 | `grep -c` + 偏移定位 |
| 骨架屏暗色方向相反 | `hsl(from …neutral-900…)` vs `rgba(255,255,255,…)` |
| RTL transform 相同 | Chrome headless 计算样式 |
| 缺失 44/22/7 | `comm -13` 三个集合 |
| 门禁漏报 | 最小复现 CSS + 运行 `check-tokens.mjs` |
