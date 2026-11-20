---
title: 六个没见过的 UI/UX 做法
part: 16
category: 交互设计
domain: UI 与交互
---

<p align="center"><a href="15-运行时本体.md">← 第十五篇</a> · <a href="README.md">📚 本卷索引</a></p>

# 第十六篇：六个没见过的 UI/UX 做法

> **技术领域与英文指代**：滚动驱动动画（scroll-driven animation）、注册属性（`@property`）、阶梯缓动（`steps()`）、作用域级联（scoped cascade）、令牌中和（token neutralisation）、掩码态（masked state）、步骤化表单（stepped form）。

前十五篇把架构、令牌、提示词、运行时都拆完了。本篇回到 UI 本身，挑 **6 个在本仓库 30 个组件里没有对应实现**的做法，逐条给出现象、实现与复刻要点。

---

## 16.1 滚动驱动的贴边阴影：`sticky-edge`

**现象**：表头/工具栏贴住滚动容器边缘时，边缘处出现一条 1px 的"接缝线"，离开边缘就消失——不是 hover 触发，而是**滚动位置驱动**。

**实现**：三个注册属性 + 三个关键帧 + 一个乘法门控。

```css
@property --cds-sticky-edge-start  { syntax:"<number>"; inherits:true; initial-value:0 }
@property --cds-sticky-edge-end    { syntax:"<number>"; inherits:true; initial-value:0 }
@property --cds-sticky-edge-active { syntax:"<number>"; inherits:true; initial-value:0 }

@keyframes cds-sticky-edge-start { 0%{--cds-sticky-edge-start:0} to{--cds-sticky-edge-start:1} }
@keyframes cds-sticky-edge-end   { 0%{--cds-sticky-edge-end:0}   to{--cds-sticky-edge-end:1} }
@keyframes cds-sticky-edge-active{ 0%,to{--cds-sticky-edge-active:1} }

.sticky-edge-start:after {
  content:""; position:absolute; inset-block-start:0;
  width:1px; height:100%; box-sizing:content-box;
  border-block-end-width:inherit; border-block-end-style:solid;
  border-block-end-color:var(--cds-alpha-2);
  background:var(--cds-alpha-2); background-clip:padding-box;
  pointer-events:none;
  opacity: calc(var(--cds-sticky-edge-start) * var(--cds-sticky-edge-active));
}
```

滚动时间轴挂在同一个伪元素上：

```css
animation-timeline: scroll(), scroll();
animation-range: calc(100% - var(--cds-scroll-fade-size)) 100%, 0px 101%;
```

| 设计点 | 为什么 |
| :--- | :--- |
| 用 `@property` 注册 | 未注册的自定义属性是**离散**的，不能参与 `calc` 插值 |
| `opacity: calc(A * B)` | 两个进度相乘 = **逻辑与**：只有在滚动到边缘（A）且该容器确实可滚（B）时才显示 |
| 用 `:after` 而不是 `box-shadow` | 阴影会溢出容器并被 `overflow:hidden` 裁掉；1px 伪元素贴边更可控 |
| `border-block-end-width: inherit` | 复用宿主行高/边框语义，避免另写一套尺寸 |
| `background-clip: padding-box` | 保证这条线不侵占内容区 |

> **复刻要点**：不支持 `animation-timeline` 的引擎下会退化成"始终 0"（因为初始值 0），即**无接缝线**——是安全降级，不是错误。

---

## 16.2 阶梯式"翻页"动效：`flipbook`

**现象**：某些图标/指示器不是平滑移动，而是**一格一格地跳**，像翻页动画。

```css
@keyframes cds-flipbook { 0%{transform:translate(0)} to{transform:translateX(var(--cds-flipbook-span))} }

.cds-root .cds-flipbook {
  --cds-flipbook-steps: 2;
  --cds-flipbook-span: 0%;
  transform-box: view-box;
  animation-name: cds-flipbook;
  animation-timing-function: steps(var(--cds-flipbook-steps), jump-none);
  animation-iteration-count: infinite;
}
@media (prefers-reduced-motion: reduce) { .cds-root .cds-flipbook { animation: none } }
```

| 设计点 | 为什么 |
| :--- | :--- |
| `steps(n, jump-none)` | 离散跳变；`jump-none` 保证首尾都取到，不会跳过最后一帧 |
| 步数做成变量（默认 2） | 同一个类可以当"2 帧翻页"或"多帧扫动"用 |
| `transform-box: view-box` | SVG 元素的变换原点按 viewBox 算，而不是按自身包围盒——**SVG 里做位移动画必须写** |
| 双通道降级 | `prefers-reduced-motion` 与 `[data-reduce-motion=true]` 各一条 |

> 与第四篇的 `--cds-btn-spring`（`linear()` 连续采样）正好相反：一个是**连续弹簧**，一个是**离散跳帧**。同一个设计系统里两种运动语言并存，靠"对象是什么"来选：按钮是连续的，指示器是离散的。

---

## 16.3 作用域化的 hover/focus 级联：`TurnStatus`

**现象**：鼠标悬停在一整条"回合状态"上时，只有**这条状态自己的**标签变亮，里面嵌套的步骤标签不受影响；键盘聚焦也一样。

**实现**：用 `:not(:where([data-cds=TurnStatusStep] *))` 把后代排除掉。

```css
… group-hover/status:pointer-events-auto:not(:where([data-cds=TurnStatusStep] *))
… group-hover/status:text-secondary:not(:where([data-cds=TurnStatusStep] *))
… group-hover/status:opacity-100:not(:where([data-cds=TurnStatusStep] *))
:where(.group/status):has(:focus-visible) … group-has-[:focus-visible]/status:text-secondary:not(:where([data-cds=TurnStatusStep] *))
```

| 设计点 | 为什么 |
| :--- | :--- |
| `:not(:where(… *))` | `:where` 零特异性，`*` 匹配任意深度后代 → **"只作用于本层，不波及嵌套同名组件"** |
| `:has(:focus-visible)` | 键盘焦点进入组内任意元素时整组进入"激活外观"，但只对**非嵌套**部分生效 |
| 同时改 `pointer-events` / `color` / `opacity` | 悬停不是纯视觉：还会让原本 `pointer-events:none` 的操作按钮**变得可点** |

> **这是"组件可嵌套"的通用解法**：只要用 `:not(:where([data-cds=X] *))` 包一层，同名组件的嵌套就不会互相污染。比"每层加不同的 class"稳得多。

---

## 16.4 失焦时的令牌中和：`CoachMark`

**现象**：窗口失焦（`data-window-active=false`）时，强调色的引导气泡里的按钮**不再保留自己的填充色**，而是跟随父级。

```css
[data-window-active=false] [data-cds=CoachMark][data-variant=accent]
  :is([data-cds=Button],[data-cds=ButtonGroup],[data-cds=SplitDropdownButton]) {
  --cds-fill-primary: inherit;
  --cds-fill-primary-hover: inherit;
}
```

| 设计点 | 为什么 |
| :--- | :--- |
| 不是"把按钮变灰"，而是 `inherit` | 让按钮**放弃自己的颜色主张**，回到父级语境；父级已被第三篇的失焦规则降饱和 |
| 只针对 `[data-variant=accent]` | 普通气泡不受影响，避免过度处理 |
| 用 `:is()` 收三个组件 | 一处规则覆盖 Button / ButtonGroup / SplitDropdownButton |

> 这是"**两级失焦处理**"：第三篇的 `[data-window-active=false]` 把角色层整体降灰（第一级），本篇这条再让局部强调色**主动让位**（第二级）。少一级就会出现"周围都灰了，只有引导气泡里的按钮还亮着"的割裂感。

---

## 16.5 输入条 dock 的六态掩码

`[data-cds=ChatComposerDock]` 上用**属性组合**表达布局状态，而不是 class：

| 属性 | 含义 |
| :--- | :--- |
| `data-cds-dock-group` | 一组 dock 项 |
| `data-cds-dock-item` | 单个 dock 项 |
| `data-cds-dock-card` | 卡片型 dock 内容 |
| `data-cds-dock-static` | 静态项（不参与重排/动画） |
| `data-cds-dock-masked` | **被遮罩**：边缘淡出/裁切生效 |
| `data-cds-dock-host-fade` | 宿主侧淡出（与 masked 组合时关闭 `:before`） |

关键规则：

```css
.cds-root [data-cds=ChatComposerDock][data-cds-dock-masked][data-cds-dock-host-fade]
  :is([data-cds-dock-item],[data-cds-dock-card]):before { content: none }
```

> **设计意图**：当**宿主**已经在做淡出时，dock 自己的 `:before` 渐变必须让位，否则两层淡出叠加会出现"灰带"。这类"同一效果的两层实现要互斥"的判断，用属性组合表达比用 JS 开关更可靠。

---

## 16.6 提问表单：步骤化 + 跳过/提交语义

`AskUserQuestion` 的 UI 由 widget 运行时里的 `elicitation.ts`（815 行）实现，是一个**多步表单引擎**：

| 结构 | 说明 |
| :--- | :--- |
| `:root[data-steps]` | 根节点标记"当前是分步表单" |
| `.elicit-pill` + `aria-pressed` | 选项是**可切换的胶囊**，选中态用 `aria-pressed` 而不是 class |
| `[data-other]` | "其他"选项，选中时展开输入 |
| `.elicit-pager > button` | 分页器；`:enabled:not(:last-child)` 控制点击穿透 |
| `.elicit-skip` / `.elicit-submit` | 两个语义不同的出口：**跳过** vs **提交** |
| `.elicit-submitted` / `.elicit-restored` | 提交后与草稿恢复后的状态类 |
| `[data-resting]` | 静止态（流式结束后），用于关闭过渡 |
| `data-host-no-files` | 宿主不支持文件时的降级标记 |

无障碍细节（原文代码）：

- 每个 pill 维护 `aria-pressed`，切换时同步；
- 表单出现后把焦点交给 `.elicit-skip ?? .elicit-submit`；
- 选项组用 `role="group"` 语义；
- 焦点可见时用 `outline: 2px solid var(--fill-accent)` + `outline-offset: 2px`（第二篇的焦点环在表单里改成实心描边）。

> **UX 判断**：把"跳过"和"提交"做成两个不同的按钮而不是一个，是因为这两个动作对模型意味着**完全不同的语义**（"我不回答" vs "这是我的答案"）。UI 上必须可区分，不能靠文案猜测。

---

## 16.7 复刻清单

| 做法 | 最小实现 |
| :--- | :--- |
| 贴边接缝线 | 3 个 `@property` + `:after` + `opacity: calc(a*b)` + `animation-timeline: scroll()` |
| 阶梯翻页 | `@keyframes` 位移 + `steps(n, jump-none)` + `transform-box: view-box` |
| 嵌套安全的 hover | `:not(:where([data-cds=X] *))` + `:has(:focus-visible)` |
| 失焦两级处理 | 角色层降灰（全局）+ 局部 `inherit` 让位（组件） |
| 同效果互斥 | 用属性组合（`masked` + `host-fade`）而不是 JS 开关 |
| 步骤化表单 | `data-steps` 根标记 + `aria-pressed` 选项 + 双出口（skip/submit） |

---

## 16.8 证据索引（本篇）

| ID | 类型 | 位置 | 支撑结论 |
| :--- | :--- | :--- | :--- |
| E16-1 | 观测 | `ion-dist.asar:assets/v1/c6a992d55-k2XF_vDB.css`，`@property --cds-sticky-edge-*` ×3 | 贴边阴影的三属性模型 |
| E16-2 | 观测 | 同上，`.sticky-edge-start:after` / `animation-range` | 乘法门控与滚动时间轴 |
| E16-3 | 观测 | 同上，`@keyframes cds-flipbook` / `.cds-flipbook` | `steps(n, jump-none)` 与 `transform-box` |
| E16-4 | 观测 | 同上，`TurnStatusStep` 系列选择器 | `:not(:where(… *))` 作用域级联 |
| E16-5 | 观测 | 同上，`[data-window-active=false] [data-cds=CoachMark]` | 失焦令牌中和 |
| E16-6 | 观测 | 同上，`data-cds-dock-{group,item,card,static,masked,host-fade}` | dock 六态掩码 |
| E16-7 | 观测 | `~/Desktop/claude-widget-runtime/src/scripts/elicitation.js`（815 行） | 步骤化表单、`aria-pressed`、skip/submit 双出口 |

<p align="center"><a href="15-运行时本体.md">← 第十五篇</a> · <a href="README.md">📚 本卷索引</a></p>
