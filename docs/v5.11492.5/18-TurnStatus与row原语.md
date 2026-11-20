---
title: TurnStatus 与 row 原语：折叠、查找与实验门控
part: 18
category: 交互设计
domain: UI 与交互
---

<p align="center"><a href="17-输入条dock布局仲裁.md">← 第十七篇</a> · <a href="README.md">📚 本卷索引</a></p>

# 第十八篇：TurnStatus 与 row 原语：折叠、查找与实验门控

> **技术领域与英文指代**：回合状态（turn status）、行原语（row primitive）、折叠面板（disclosure）、`hidden="until-found"`、`beforematch` 事件、实验门控工具类（experiment-gated utility）、出血（outset）。

第十七篇是"输入条上方的空间怎么分配"。本篇是"**一次回合的状态怎么表达**"——以及它底下那套可复用的 **row 原语**，其中有一条做法在本仓库里从没出现过：**折叠内容仍可被浏览器查找命中，并自动展开**。

---

## 18.1 结构：一个可折叠的状态行

`TurnStatus` 的根：

```js
_.Root({
  "data-cds": "TurnStatus",
  "data-state": z,        // 状态
  open: Q,                // 是否展开
  onOpenChange: er,
  onFocus: Hn, onBlur: Wn,
  …
})
```

每个步骤是 `TurnStatus.Step`（内部名 `Xt`），带 `data-cds="TurnStatusStep"` 与自己的 `data-state`。

`TurnStatus` 还导出了 `Step` 与 `Phrases` 两个子件：

```js
Object.assign(TurnStatus, { Step: Xt, Phrases: Pt })
```

| 子件 | 用途 |
| :--- | :--- |
| `Step` | 单步（可展开成面板） |
| `Phrases` | 状态文案组（"正在思考…"一类轮播短语） |

---

## 18.2 row 原语：10 个 `data-cds-row-*` 属性

`TurnStatus` 的每一行不是特制组件，而是复用一套 **row 原语**（CSS 与 JS 里都出现）：

| 属性 | 作用 |
| :--- | :--- |
| `data-cds-row` | 行根 |
| `data-cds-row-level` | 缩进层级（嵌套行） |
| `data-cds-row-cut` | 截断/裁剪态 |
| `data-cds-row-mark` | 标记（CSS 里有 `order: -9999`，即**强制排到最前**） |
| `data-cds-row-media` | 行尾媒体（图标/缩略图），`order-last ms-auto h-[1lh]` |
| `data-cds-row-subject` | 主标题 |
| `data-cds-row-action` | 行内动作按钮（`disabled` 时有特殊处理） |
| `data-cds-row-navigate` | 可导航行（链接语义） |
| `data-cds-row-toggle` | 展开/收起按钮 |
| `data-cds-row-toggle-stretched` | 拉伸式热区（整行可点） |
| `data-cds-row-panel` | 折叠面板 |
| `data-cds-row-slides-transform` / `-translate` | 面板滑动的位移载体 |

> **这套原语的复用面很广**：`[data-cds-row-toggle]:focus-visible:after` 的规则是**全局**的（不在 `TurnStatus` 作用域内），说明 row 还被其他列表（会话列表、附件列表）使用。

焦点环的处理值得注意：

```css
:where(.cds-root) :where([data-cds-row-toggle]:focus-visible,
                         [data-cds-row-navigate]:focus-visible):after {
  outline-offset: -2px;
  outline: 2px solid #0000;   /* 透明描边 */
}
```

**透明描边**：让元素获得键盘焦点语义与可测的焦点矩形，但**不画可见环**——视觉焦点由外层（整行）承担，避免一行里出现两个焦点环。

---

## 18.3 状态：`data-state="busy"` 与去重键

组件里只出现一个显式状态比较：

```js
if (n.props.state === "busy") { … }
```

但它用在**生成去重键**上：

```js
function keyOf(children) {
  let t;
  for (let n of children) {
    if (!isValid(n) || n.type !== Step) continue;
    if (n.props.state === "busy") {
      let e = String(n.key);
      t = t === undefined ? e : t + "\0" + e;   // 用 \0 拼接多个 busy 步骤
    }
  }
  return t;
}
```

| 设计点 | 为什么 |
| :--- | :--- |
| 只为 `busy` 的步骤生成键 | 已完成的步骤不该影响"当前状态"的动画/文案 |
| 用 `\0` 拼接 | 避免 `"1"+"2"` 与 `"12"` 这类碰撞 |
| 返回 `undefined` 表示"没有忙碌步骤" | 调用方据此切到"空闲"分支 |

> 这是一个**用 React key 表达状态**的技巧：不额外维护状态机，而是从子节点推导"现在忙不忙、忙在哪几步"。

---

## 18.4 折叠 + 浏览器查找：`hidden="until-found"` + `beforematch`

**这是本篇最重要的做法**，本仓库此前没有对应实现。

现象：一段内容被折叠（`open === false`），但用户按 ⌘F 搜索里面的词时，浏览器**仍能找到并自动展开**。

实现分三块：

```js
// 1) 需要一个"可被查找"的容器（aria-hidden，视觉高度 0）
Cr && a("div", {
  ref: wr,
  "aria-hidden": true,
  "data-cds-findable": "",
  "data-find-omitted": "",
  className: "h-0 select-none overflow-hidden whitespace-pre-line",
  children: de,          // 折叠时不可见的正文
})

// 2) 折叠且存在可查找文本时，把它标成 until-found
Tr = () => { Cr && !open && wr.current?.setAttribute("hidden", "until-found") };

// 3) 浏览器命中时触发 beforematch → 自动展开
t.addEventListener("beforematch", () => { setSawMatch(true); setOpen(true) });
```

| 机制 | 作用 |
| :--- | :--- |
| `hidden="until-found"` | 内容对视觉隐藏，但**参与 find-in-page 与滚动锚定** |
| `beforematch` 事件 | 浏览器"即将滚到匹配处"时触发，此时展开即可让用户看到 |
| `h-0 overflow-hidden` 的可查找容器 | 不占布局，但文本可被搜索引擎与查找索引 |
| `aria-hidden` | 屏幕阅读器不重复朗读折叠内容 |

> **UX 价值**：折叠面板最常见的抱怨是"我明明记得里面有这个词，但搜不到"。这条实现让**折叠不影响可搜索性**，而且展开时机精准（命中才展开，不是搜索框一变就全展开）。

---

## 18.5 嵌套隔离与焦点跟踪

第十六篇讲过 `:not(:where([data-cds=TurnStatusStep] *))` 的嵌套隔离。这里补上**焦点**侧的实现：

```js
// 记录焦点所在元素，以及它属于哪个 Step
Rn.current = e.target;                                  // 当前焦点元素
zn.current = e.target.closest('[data-cds="TurnStatusStep"]');  // 它所属的步骤

// 失焦时：只有在焦点真正离开整组后才清空
onBlur: if (!currentTarget.contains(e.relatedTarget)) {
  if (e.relatedTarget !== null) { clear(); return }
  queueMicrotask(() => { if (!el.contains(document.activeElement)) clear() });
}
```

| 细节 | 为什么 |
| :--- | :--- |
| 同时记"元素"和"它属于哪个步骤" | 展开/高亮要以**步骤**为单位，不是以元素 |
| `relatedTarget === null` 时走 `queueMicrotask` 二次确认 | 点击非可聚焦区域会先报 `null`，此时焦点可能仍在本组内 |
| `document.activeElement === body` 视为"已离开" | 处理点击空白处的情形 |

---

## 18.6 `stacks:`：被实验开关门控的 Tailwind 变体

组件里用了一个自定义变体：

```js
tn = "stacks:ms-outset stacks:max-w-[calc(100%_+_var(--cds-outset-x))]"
```

它编译出来的选择器带着实验属性：

```css
.stacks\:inset-0:where([data-cds-fizzy-lake~=color],
                        [data-cds-fizzy-lake~=color] *):not(:where([data-cds-theme], …)) { inset: 0 }
```

| 观察 | 含义 |
| :--- | :--- |
| `data-cds-fizzy-lake~=color` | 根节点上一个**空格分隔的实验标记列表**，`~=` 表示"包含 color 这一项" |
| `~=color` 631 处、`~=type` 104 处、`~=panels` 39 处 | 三个实验组各自门控一批工具类 |
| 没有 `~=stacks` | `stacks:` 变体实际挂在 `color` 组下 |

> **工程意义**：这不是 A/B 测试的 JS 分支，而是**CSS 级的实验门控**——同一个构建里同时存在实验版与基线版的样式，靠根节点的一个属性切换，**零运行时成本**。复刻时若忽略这层 `:where(...)`，会以为这些类是"永远生效"的。

---

## 18.7 `--cds-outset-x`：行的出血量

`stacks:ms-outset` 与 `stacks:max-w-[calc(100% + var(--cds-outset-x))]` 配合，让行可以**向两侧"出血"**，与消息正文的缩进对齐：

| 变量 | 观测值 |
| :--- | :--- |
| `--cds-outset-x` | `0px` / `.25rem` / `1rem` / `calc(var(--spacing) * 2)` |
| `--cds-outset-y` | 同类（由 `@property` 注册，可参与过渡） |

另有一条针对 `TurnStatus` 的补偿规则：

```css
:where(…) > [data-cds=TurnStatus] > [data-cds-row-panel] {
  margin-inline-start: calc(var(--msg-block-inset, .5rem) - var(--msg-text-inset, .5rem));
}
```

> **含义**：状态行嵌在消息块里，而消息块与正文有两套缩进（`--msg-block-inset` / `--msg-text-inset`）。展开的面板要用两者之差做负补偿，才能和正文左缘对齐。**这类"两个缩进体系相减"的补偿，是长文档式 UI 里最容易出错的地方**。

---

## 18.8 复刻要点

| 要点 | 实现 |
| :--- | :--- |
| 折叠不影响查找 | `hidden="until-found"` + `beforematch` 自动展开 |
| 折叠文本可被索引 | `aria-hidden` + `h-0 overflow-hidden` 的可查找容器 |
| 焦点按步骤聚合 | 同时记录焦点元素与其 `closest('[data-cds=TurnStatusStep]')` |
| 失焦二次确认 | `relatedTarget === null` 时 `queueMicrotask` 复查 `activeElement` |
| 嵌套不串色 | `:not(:where([data-cds=TurnStatusStep] *))` |
| 焦点环唯一 | 行内按钮用**透明 outline**，视觉焦点交给整行 |
| 实验样式零成本 | `[data-flag~=token]` 门控的工具类 |
| 缩进对齐 | `margin-inline-start: calc(块缩进 - 正文缩进)` |

---

## 18.9 证据索引（本篇）

| ID | 类型 | 位置 | 支撑结论 |
| :--- | :--- | :--- | :--- |
| E18-1 | 观测 | `ion-dist.asar:assets/v1/c734f318c-DVbhpVUM.js`（`TurnStatus` 根 / `Step` / `Phrases`） | 组件结构与 `data-state` |
| E18-2 | 观测 | 同上（`keyOf`） | 只为 `busy` 步骤生成去重键、`\0` 拼接 |
| E18-3 | 观测 | 同上（`hidden="until-found"` / `beforematch` / `data-cds-findable`） | 折叠可查找并自动展开 |
| E18-4 | 观测 | 同上（`Rn` / `zn` / `onBlur` 逻辑） | 焦点按步骤聚合与二次确认 |
| E18-5 | 观测 | `c6a992d55-k2XF_vDB.css`，`stacks\:` 规则 | `[data-cds-fizzy-lake~=color]` 实验门控（631 处） |
| E18-6 | 观测 | 同上，`--cds-outset-x` 取值 | 行出血量 0 / .25rem / 1rem / 2×spacing |
| E18-7 | 观测 | 同上，`TurnStatus > [data-cds-row-panel]` 规则 | 两套缩进体系相减的补偿 |
| E18-8 | 观测 | 同上，`[data-cds-row-toggle]:focus-visible:after` | 透明 outline 的焦点策略 |

<p align="center"><a href="17-输入条dock布局仲裁.md">← 第十七篇</a> · <a href="README.md">📚 本卷索引</a></p>
