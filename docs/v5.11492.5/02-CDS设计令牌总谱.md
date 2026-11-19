---
title: CDS 设计令牌总谱
part: 2
category: 设计令牌
domain: 视觉系统
---

<p align="center"><a href="01-版本边界与三层架构.md">← 第一篇</a> · <a href="README.md">📚 本卷索引</a> · <a href="03-作用域与组件属性契约.md">第三篇 →</a></p>

# 第二篇：CDS 设计令牌总谱

> **技术领域与英文指代**：设计令牌（design token）、原始阶（raw ramp）、角色令牌（role token）、语义令牌（semantic token）、主题 API 版本（theme API version）、相对颜色语法（relative color syntax）、反相别名（inverting alias）、光学缩放（optical scale）。

本篇是 5.11492.5 的**令牌权威清单**。所有值来自 `app.asar:.vite/renderer/main_window/assets/MainWindowPage-lhEHjHfd.css`（251,161 B，934 个 `--cds-*` 定义）；`ion-dist.asar` 主样式表（1,903,926 B）中同名令牌取值一致，另有 146 个仅产品层使用的扩展令牌，合计 1080 个。

---

## 2.1 `--cds-theme-api` 与四层令牌模型

基础色板块（`MainWindowPage-lhEHjHfd.css@147224`，373 条声明）的第一行即：

```css
--cds-theme-api: 1;
```

这是**令牌 API 的版本号**。它把 4.x 时代"约定俗成的变量集合"升级为可协商的契约：宿主可以用它判断当前样式表是否提供某代令牌语义。

四层结构（观测到的层数与职责）：

| 层 | 作用域 | 声明数 | 例子 | 是否随主题变化 |
| :--- | :--- | ---: | :--- | :--- |
| ① 原始阶 Raw ramp | `:where(:root,:host), :where([data-cds-unthemed])` | 373 | `--cds-gray-20`、`--cds-blue-450` | 否 |
| ② 角色层 Role | 同上 | 103 | `--cds-role-accent-fill`、`--cds-role-danger-on` | 否（角色→色阶的映射固定） |
| ③ 语义层 Semantic | `.cds-root` | 355（明） / 149（暗） / 149（system） | `--cds-surface-0`、`--cds-text-primary` | 是 |
| ④ 组件层 Component | `.cds-root` / `[data-cds=…]` | 77–105 | `--cds-toolbar-strip`、`--cds-checkbox-radius` | 部分 |

> **观测**：暗色块只重写 149 个语义令牌，其余 206 个"仅明色声明"的令牌（如 `--cds-radius`、`--cds-dur-*`、`--cds-fill-brand`）**在两种模式下共享同一值**。这意味着"暗色模式不是另建一套令牌，而是只覆盖颜色相关的那一层"。

---

## 2.2 九个色相阶 × 35 级

原始阶共 9 个色相家族，每族 35 级，级名固定为 `0,10,…,100,150,…,800,810,…,890,900`：

| 家族 | 前缀 | 代表值（中间档） | 语义定位 |
| :--- | :--- | :--- | :--- |
| 暖灰 | `--cds-gray-*` | `gray-20 #f9f9f7` / `gray-400 #898781` / `gray-900 #0b0b0b` | 页面、面板、正文 |
| 红 | `--cds-red-*` | `red-450 #d03b3b` | danger |
| 橙（陶土） | `--cds-orange-*` | `orange-350 #eb6834` / `orange-450 #c25124` | 品牌暖色、强调 |
| 黄 | `--cds-yellow-*` | `yellow-200 #fab219` | warning |
| 绿 | `--cds-green-*` | `green-450 #009300` | success |
| 青 | `--cds-aqua-*` | `aqua-400 #199e70` | 辅助数据色 |
| 蓝 | `--cds-blue-*` | `blue-250 #86b6ef` / `blue-450 #2a78d6` / `blue-600 #184f95` | **accent 角色** |
| 紫 | `--cds-violet-*` | `violet-450 #7161e0` | pro 角色 |
| 品红 | `--cds-magenta-*` | `magenta-450 #c04873` | 辅助数据色 |

外加**一个反向中性阶** `--cds-neutral-0 … --cds-neutral-900`，它不是新颜色，而是"随主题翻转的 gray 别名"：

| 令牌 | 明色 | 暗色 |
| :--- | :--- | :--- |
| `--cds-neutral-900` | `var(--cds-gray-900)` = `#0b0b0b` | `var(--cds-gray-0)` = `#fff` |
| `--cds-neutral-600` | `var(--cds-gray-600)` = `#52514e` | `var(--cds-gray-300)` = `#a5a49a` |
| `--cds-neutral-400` | `var(--cds-gray-400)` = `#898781` | `var(--cds-gray-500)` = `#6d6b67` |

**这是整套系统最关键的机制**：正文色不写 `gray-900`，而写 `neutral-900`，于是同一行声明在暗色下自动变成白色。透明度阶也复用同一技巧：

```css
--cds-alpha-1: hsl(from var(--cds-neutral-900) h s l / 5%);
--cds-alpha-2: hsl(from var(--cds-neutral-900) h s l / 10%);
--cds-alpha-3: hsl(from var(--cds-neutral-900) h s l / 20%);
```

`hsl(from …)` 是 CSS 相对颜色语法：`neutral-900` 在明色是黑、暗色是白，所以 `alpha-*` 在暗色下自动变成**白色叠加**，无需第二套声明。`--cds-alpha-*` 共 10 档（0/5/10/20/35/50/60/70/85/95%）。

---

## 2.3 语义层：surface / text / fill / border

### Surface（4 级 + 2 个弹层）

| 令牌 | 明色 | 暗色 | 用途 |
| :--- | :--- | :--- | :--- |
| `--cds-surface-0` | `gray-20` `#f9f9f7` | `gray-900` `#0b0b0b` | 页面画布 |
| `--cds-surface-1` | `gray-10` `#fcfcfb` | `gray-850` `#151515` | 侧栏 / 次级卡片 |
| `--cds-surface-2` | `gray-0` `#ffffff` | `gray-830` `#1a1a19` | 输入条 / 对话框背板 |
| `--cds-surface-3` | `gray-0` `#ffffff` | `gray-800` `#20201f` | 悬浮层 / 激活态 |
| `--cds-surface-panel` | `surface-2` | 继承 | 面板容器 |
| `--cds-surface-popover` | `surface-3` | 继承 | 浮层 |
| `--cds-page-bg` | `surface-0` | 继承 | 页面根背景（多处被覆盖为 `transparent`，见 3.4） |

### Text

| 令牌 | 明色 | 暗色 |
| :--- | :--- | :--- |
| `--cds-text-primary` | `neutral-900` `#0b0b0b` | `gray-50` `#f0efec` |
| `--cds-text-secondary` | `neutral-600` `#52514e` | `gray-200` `#c3c2b7` |
| `--cds-text-muted` | `neutral-400` `#898781` | `gray-400` `#898781` |
| `--cds-text-disabled` | `alpha-4`（35% 反相） | 继承 |

> **与 4.x 文档的差异**：`--cds-text-muted` 在 4.x 被记录为"双模同值 `#898781`"，本版**仍然同值**，但机制变了 —— 明色走 `neutral-400`（灰阶下探），暗色走 `gray-400`（固定灰），因此暗色下它不再随 `neutral` 翻转，是**刻意钉死**的中性占位色。

### Fill / Border

| 令牌 | 明色 | 暗色 |
| :--- | :--- | :--- |
| `--cds-fill-brand` | `clay-emphasized` `#c6613f` | 继承（不翻转） |
| `--cds-fill-brand-hover` | `clay` `#d97757` | 继承 |
| `--cds-on-brand` | `#fff` | 继承 |
| `--cds-fill-accent` | `role-accent-fill` → `blue-450` `#2a78d6` | 继承 |
| `--cds-fill-primary` | `neutral-900` | `gray-0`（反相） |
| `--cds-fill-control` | `alpha-2` | 继承 |
| `--cds-border` | `alpha-2` | 继承 |
| `--cds-border-strong` | `alpha-3` | 继承 |
| `--cds-ring-hairline` | `1px` | 继承 |

> **品牌 vs 强调是两种角色**：`fill-brand` 永远是陶土 `#c6613f`（明暗都不变），`fill-accent` 永远是蓝色 `#2a78d6`。这印证并强化了 AGENTS.md 里"brand=陶土、accent=蓝色"的双角色纪律。

---

## 2.4 明暗双模与 system 三写

同一份 149 条语义声明被**写三遍**，选择器各不相同：

| 模式 | 选择器（原文） | 语义 |
| :--- | :--- | :--- |
| 明色 | `.cds-root`（6 个块，共 355 条） | 默认值 |
| 暗色 | `[data-mode=dark] .cds-root:not([data-mode=light]):not([data-mode=system]), .cds-root[data-mode=dark]` | 显式暗色，含祖先继承 |
| 系统 | `[data-mode=system] .cds-root:not([data-mode=light]):not([data-mode=dark]), .cds-root[data-mode=system], .cds-root:not([data-mode]):not([data-mode] *)` | 跟随 OS，未标注也走这条 |
| 暗色子域 | `.cds-dark-scope[data-mode=dark]` | 局部暗色容器（暗色页面里的亮色卡片等） |

`data-mode=system` 块不是简单复制：它把暗色值包在 `@media (prefers-color-scheme: dark)` 里（观测到同值三写 + 媒体查询包裹），因此**未设置 `data-mode` 的根节点也会跟随系统**（选择器尾部的 `:not([data-mode] *)` 保证嵌套作用域不被误伤）。

---

## 2.5 角色层：brand / accent / danger / success / warning / pro

角色层把色阶"命名成职责"，共 6 个角色族 + tooltip：

| 角色 | 绑定色阶 | fill | fill-hover | on |
| :--- | :--- | :--- | :--- | :--- |
| accent | blue | `role-accent-fill` = `blue-450` | `blue-400` | `gray-0` |
| danger | red | `red-450` | `red-400` | `gray-0` |
| success | green | `green-450` | `green-400` | `gray-900` |
| warning | yellow | `yellow-200` | `yellow-250` | `gray-900` |
| pro | violet | `violet-450` | `violet-400` | `gray-0` |
| tooltip | gray | `role-tooltip-bg` = `gray-900` | — | `gray-0` |

> **`on-*` 不是白色常量**：`success-on` 与 `warning-on` 指向 `gray-900`（黑字压在亮底上），其余指向 `gray-0`（白字压在暗底上）。复刻时若一律写 `#fff`，黄/绿底上的对比度会掉到 2:1 以下。

焦点环由角色层派生：

```css
--cds-focus-shadow: inset 0 0 0 1px var(--cds-page-bg), 0 0 0 1px var(--cds-fill-accent),
                    0 0 6px 1px var(--cds-bg-accent);
--cds-focus-shadow-danger: inset 0 0 0 1px var(--cds-page-bg), 0 0 0 1px var(--cds-fill-danger),
                    0 0 6px 1px var(--cds-bg-danger);
```

暗色下第三条 glow 改为 `hsl(from var(--cds-role-accent-600) h s l / 60%)` —— 蓝色在暗底上需要更强的辉光才可见。

---

## 2.6 几何、rem-scale 与密度乘子

所有几何令牌都乘 `--cds-rem-scale`，本版观测值为：

```css
--cds-rem-scale: calc(16 / 17);   /* ≈ 0.941176 */
```

| 令牌 | 默认（base） | `data-density=comfortable` |
| :--- | :--- | :--- |
| `--cds-radius` | `calc(.375rem * scale)` ≈ 5.6px | `calc(.5rem * scale)` ≈ 7.5px |
| `--cds-radius-composer` | `calc(.75rem * scale)` ≈ 11.3px | `calc(.875rem * scale)` ≈ 13.2px |
| `--cds-panel-radius` | `calc(.625rem * scale)` ≈ 9.4px | `calc(.75rem * scale)` ≈ 11.3px |
| `--cds-h-control` | `calc(2rem * scale)` ≈ 30.1px | 同 |
| `--cds-h-control-nested` | `calc(1.375rem * scale)` ≈ 20.7px | 同 |
| `--cds-icon` | `calc(1.25rem * scale)` ≈ 18.8px | 同 |
| `--cds-font-size-body` | `calc(.875rem * scale)` ≈ 13.2px | 同 |
| `--cds-font-size-prose` | `1rem`（**不乘 scale**） | 同 |
| `--cds-leading-prose` | `1.5rem`（**不乘 scale**） | 同 |

> **`prose` 是唯一不参与光学缩放的档位**：正文阅读区固定 16px / 24px，其余 UI 文字随 `rem-scale` 缩放。这是"阅读区稳定、控件区紧凑"的分界。
>
> **与 4.x 文档的冲突**：AGENTS.md 记录的 `--cds-radius-composer: 20px` 在 5.x **不存在**。本版是 11.3px（默认）/ 13.2px（comfortable）。`--radius-card`、`--cds-message-bubble-radius` 等 4.x 派生量在本版未观测到同名定义，属于**已被移除的中间层**。

### Z 轴

| 令牌 | 值 |
| :--- | ---: |
| `--cds-z-coachmark` | 35 |
| `--cds-z-modal` | 40 |
| `--cds-z-popover` | 50 |
| `--cds-z-tooltip` | 50 |
| `--cds-z-toast` | 60 |

### 阴影

```css
--cds-shadow-sm: 0 1px 2px 0 hsl(from var(--cds-gray-900) h s l / 6%), 0 2px 8px 0 var(--cds-shadow-color);
--cds-shadow-md: 0 2px 4px 0 hsl(from var(--cds-gray-900) h s l / 7%), 0 6px 16px 0 var(--cds-shadow-color);
--cds-shadow-lg: 0 4px 8px 0 hsl(from var(--cds-gray-900) h s l / 8%), 0 12px 28px -2px var(--cds-shadow-color);
--cds-shadow-color: hsl(from var(--cds-gray-900) h s l / 8%);   /* 暗色: #0000003d */
--cds-panel-shadow: 0 0 0 1px var(--cds-border), var(--cds-shadow-sm);
--cds-shadow-popover: 0 8px 24px #0000001f, 0 2px 6px #00000014;  /* 暗色: #00000052 / #0003 */
```

阴影是**双层**（近场 1–4px 硬边 + 远场 8–28px 弥散），且暗色下把 `shadow-color` 从 8% 提到 24%，补偿暗底上阴影不可见的问题。

---

## 2.7 证据索引（本篇）

| ID | 类型 | 位置 | 支撑结论 |
| :--- | :--- | :--- | :--- |
| E2-1 | 观测 | `MainWindowPage-lhEHjHfd.css@147224`（373 条） | `--cds-theme-api: 1`、原始阶、角色层 |
| E2-2 | 观测 | 同上 @145129（34 条） | `:root` 全局常量、`--cds-clay` `#d97757`、`--cds-ease-out` |
| E2-3 | 观测 | 同上 @158571/@161308/@167562/@173980/@179567/@181033 | 明色语义层 355 条 |
| E2-4 | 观测 | 同上 @181947 | 暗色覆盖 149 条 |
| E2-5 | 观测 | 同上 @190925 | system 覆盖 149 条 |
| E2-6 | 观测 | 同上 @207736 | `.cds-dark-scope[data-mode=dark]` 149 条 |
| E2-7 | 观测 | 同上 @200334 | comfortable 密度 40 条几何乘子 |
| E2-8 | 观测 | 同上，`--cds-alpha-*` / `--cds-neutral-*` 定义 | 反相别名 + 相对颜色语法 |
| E2-9 | 观测 | `ion-dist.asar:assets/v1/c6a992d55-k2XF_vDB.css` | 1080 个令牌、同值复核 |

<p align="center"><a href="01-版本边界与三层架构.md">← 第一篇</a> · <a href="README.md">📚 本卷索引</a> · <a href="03-作用域与组件属性契约.md">第三篇 →</a></p>
