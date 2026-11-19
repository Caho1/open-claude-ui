---
title: 输入条 dock：一套布局仲裁系统
part: 17
category: 交互设计
domain: UI 与交互
---

<p align="center"><a href="16-六个没见过的UIUX做法.md">← 第十六篇</a> · <a href="README.md">📚 本卷索引</a></p>

# 第十七篇：输入条 dock：一套布局仲裁系统

> **技术领域与英文指代**：停靠带（dock）、遮罩态（masked）、宿主淡出（host-fade）、促销槽（promotion slot）、静态项（static）、离场态（leaving）、变更观察（MutationObserver）、可输入闸门（typeable gate）。

第十六篇只说了 dock 有六个属性。本篇把它拆开：**这其实是输入条区域的一整套布局仲裁**——谁占位、谁淡出、谁不算内容、什么时候允许输入，全部由数据属性 + 一个共享观察器决定。

---

## 17.1 七个属性（不是六个）

`ion-dist.asar:assets/v1/shared-1-DtdFVPvn.js` 里的常量定义：

```js
var __ = "data-cds-dock-card",       // 卡片型内容
    v_ = "data-cds-dock-leaving",    // 离场中（退出动画期间）
    y_ = "data-cds-dock-group",      // 组（dock 的根）
    b_ = "data-cds-dock-static",     // 静态项（不参与"有内容"判定）
    x_ = "opaque",                   // 取值，不是属性
    S_ = "data-cds-dock-masked",     // 被遮罩
    C_ = "data-cds-dock-host-fade";  // 宿主负责淡出
```

| 属性 | 语义 | 谁写 |
| :--- | :--- | :--- |
| `data-cds-dock-group` | dock 根节点 | `sZ`（Group 组件）恒定写入 |
| `data-cds-dock-item` | 一个 dock 项 | 业务侧 |
| `data-cds-dock-card` | 卡片型内容（更大、带背景） | 业务侧 |
| `data-cds-dock-static` | 静态项，**不算"有内容"** | 业务侧 |
| `data-cds-dock-masked` | 被遮罩（内容会滚到它下面） | Group 由 `masked` 推导 |
| `data-cds-dock-host-fade` | 宿主已提供淡出，本地不再画 | Group 由 `masked && !fade` 推导 |
| `data-cds-dock-leaving` | 正在离场 | 退出动画期间 |
| `data-cds-dock-promotion` | 促销槽，**不算"有内容"** | 促销组件 |

> 第十六篇漏掉的正是 `leaving` 与 `promotion`。后者尤其关键（见 17.4）。

---

## 17.2 Group 组件：`host-fade` 是推导出来的

```js
D(function (props, ref) {
  let { children, masked, fade, className, "data-testid": o } = props;
  let s = masked !== void 0 && masked;        // masked 缺省 = false
  let c = fade === void 0 || fade;            // fade 缺省 = true
  let f = s ? "" : void 0;                    // → data-cds-dock-masked
  let m = (s && !c) ? "" : void 0;            // → data-cds-dock-host-fade
  let attrs = { [y_]: "", [S_]: f, [C_]: m };
  let cls = "pointer-events-none flex w-full min-w-0 flex-col *:pointer-events-auto";
  …
});
```

两条规则值得抄：

1. **`host-fade` 不是独立开关**，而是 `masked && !fade` 的推导结果——即"我处于遮罩态，但我不自己画淡出"。这样就不可能出现"没遮罩却让宿主淡出"的矛盾组合。
2. **容器 `pointer-events-none`，子元素 `*:pointer-events-auto`**：dock 的空白区域不拦截点击，只有真实内容可点。这一条决定了"输入条上方的空白地带"不会挡住下面的滚动内容。

---

## 17.3 `masked` 的视觉：不透明底 + 40px 上渐隐

`masked` 状态下，每一项都会挂上这串类（原文）：

```
relative z-0 bg-page
before: pointer-events-none absolute inset-x-0 bottom-full -z-[1] h-10
        content-[''] page-fade-b-soft
```

| 部分 | 作用 |
| :--- | :--- |
| `bg-page` | 用页面底色盖住**滚到它下面的内容**（这是"遮罩"的字面含义） |
| `before` + `bottom-full` | 伪元素贴在**该项上方** |
| `h-10`（40px） | 渐隐带高度 |
| `page-fade-b-soft` | 页面底色的柔和向下渐隐工具类 |
| `-z-[1]` | 压在内容之下、底色之上 |

另有三个变体常量：

| 常量 | 类 | 场景 |
| :--- | :--- | :--- |
| `D_` | 完整版（底 + 渐隐） | 默认遮罩 |
| `O_` | 只有 `bg-page` | 不要渐隐（硬边） |
| `k_` | `relative z-0 bg-page` | 只做层级与底色 |
| `A_` | 只有渐隐带 | 宿主已铺底、只差过渡 |

> **这就是"内容滚到输入条下面"这个常见需求的正式解法**：不是给输入条加 `backdrop-filter`，而是**给每个 dock 项单独铺底 + 上边缘渐隐**。好处是逐项生效——某个项收起时，它那块底色也一起消失，不会留一条灰带。

---

## 17.4 "dock 有没有内容"：三条排除规则

核心判定（原文）：

```js
const ITEM_SEL = '[data-cds="ChatComposerDock"] [data-cds-dock-item],' +
                 '[data-cds="ChatComposerDock"] [data-cds-dock-card]';
const PROMO_SEL = '[data-cds-dock-promotion]';

function isHiddenInside(root, el) {          // 祖先里有 [hidden] 且属于本 dock
  let h = el.closest("[hidden]");
  return h !== null && root.contains(h);
}

function hasContent(root) {                   // 本 dock 是否有"算数"的内容
  for (let el of root.querySelectorAll(ITEM_SEL)) {
    let promo = el.closest(PROMO_SEL);
    if (!(promo !== null && root.contains(promo)) && !isHiddenInside(root, el)) return true;
  }
  return false;
}
```

三条排除规则：

| 排除 | 判据 | 为什么 |
| :--- | :--- | :--- |
| 促销槽里的项 | `el.closest('[data-cds-dock-promotion]')` 在本 dock 内 | 促销横幅是"广告位"，不该把 dock 判成"有内容"从而触发遮罩 |
| 隐藏的项 | 祖先链上有 `[hidden]` 且在本 dock 内 | `hidden` 仍占 DOM，不能靠它触发遮罩 |
| 外部促销 | 促销节点不在本 dock 内 | 只排除**自己的**促销，别把别人家的也漏掉 |

> **设计价值**：这是"**视觉上在一起，语义上分开**"的典型处理。促销横幅和 dock 项在同一个堆叠区域里，但只有后者才决定"输入条要不要进入遮罩态"。

---

## 17.5 一个共享观察器，而不是每个组件一个

```js
const OBSERVE = { childList:true, subtree:true, attributes:true, attributeFilter:["hidden"] };

function createDockObserver() {
  let subs = new Set(), root = null, obs = null, observed = null;
  const notify = () => { for (const f of subs) f() };
  const stop   = () => { obs?.disconnect(); obs = null; observed = null };
  const ensure = () => {
    if (root === null || subs.size === 0 || observed === root ||
        typeof MutationObserver > "u") return false;
    stop();
    obs = new MutationObserver(notify);
    obs.observe(root, OBSERVE);
    observed = root;
    return true;
  };
  return {
    attach(el) { root = el; ensure() && notify() },
    subscribe(fn) { subs.add(fn); ensure(); return () => { subs.delete(fn); subs.size === 0 && stop() } },
    read() { return root === null ? void 0 : hasContent(root) }
  };
}
```

| 设计点 | 为什么 |
| :--- | :--- |
| `attributeFilter: ["hidden"]` | 只监听会影响判定的那一个属性，避免整棵树的 `style`/`class` 抖动都触发重算 |
| `subtree: true` | dock 项可嵌套，必须看全子树 |
| 引用计数式 `stop()` | 最后一个订阅者退订时才断开，避免观察器泄漏 |
| `read() ?? true`（消费侧） | **没挂载 dock 时默认"有内容"**，走保守分支 |

> 这是"多个组件共享一个 DOM 观察"的标准写法：**一个 observer、一个 Set、一个 root**。比每个组件各自 `new MutationObserver` 省一个数量级。

---

## 17.6 垂直节奏：所有直接子元素统一底距

```css
:is([data-cds-dock-item],[data-cds=ChatComposerNotices],[data-cds=ChatComposerQueuedMessages],
    [data-cds-dock-group],[data-cds-dock-static],[hidden],:last-child) {
  margin-bottom: var(--cds-gap-xs);
}
```

不管子元素是项、卡片、通知区、排队消息、组、静态块，还是**隐藏节点**，一律 `gap-xs` 底距。

> 用 `:is()` 把所有"可能出现的子类型"一次列全，而不是靠 `> *`：这样即使某类节点被 `display:none`，间距规则也不会失效（避免"显隐切换导致间距跳变"）。**代价**是最后一项也多出 `gap-xs`——由父容器负边距或 `padding` 吸收。

---

## 17.7 进出场：`reveal-in/out` + `leaving`

```js
w_ = "motion-safe:animate-[cds-reveal-in_var(--cds-dur-base)_var(--cds-ease-out)_both]"
T_ = "motion-safe:animate-[cds-reveal-out_var(--cds-dur-base)_var(--cds-ease-out)_both]"
```

- 入场用 `cds-reveal-in`，出场用 `cds-reveal-out`，都是 `--cds-dur-base` + `--cds-ease-out`，且 `both` 保持首尾帧。
- 全部包在 `motion-safe:` 里 → 降低动效时**根本不注册动画**。
- `data-cds-dock-leaving` 标记"正在离场"：让"有内容"判定与视觉退场**解耦**——元素还在 DOM 里播放退场动画，但已经可以不被算作占用。

---

## 17.8 dock 只在特定路由存在

```js
const ROUTES = ["/new","/chat","/task/new","/analytics/chat","/analytics/overview",
                "/admin-settings/chat","/comparison","/cic"];
const PROJECT = /^\/(?:cowork\/|code\/|epitaxy\/)?project\/[^/]+\/?$/;
const SPACE   = /^\/space\/[^/]+\/?$/;

function showsDock(path) {
  return path === "/" || isChatRoute(path) || isCodeRoute(path) ||
         PROJECT.test(path) || SPACE.test(path) ||
         ROUTES.some(r => path === r || path.startsWith(r + "/"));
}
```

> 输入条 dock 不是全局组件：它**只在这些路由下存在**。所以"某页面没有 dock"通常是路由判断的结果，不是渲染 bug。

---

## 17.9 "能不能马上打字"：一个竞速闸门

同一文件里还有一套输入就绪判定：

```js
let inFlight = 0;                                   // 正在进入 composer 的次数
function markComposerPresent(source = "composer") {  // 由 composer 挂载时调用
  inFlight += 1;
  if (started) return;
  started = true; startedAt = performance.now();
  …
  for (let f of waiters) f(source);   // 唤醒等待者
  waiters.clear();
}

function settleAfterPaint() {                        // 等一帧再 resolve
  if (document.visibilityState === "hidden") { setTimeout(fn, 0); return }
  let t = setTimeout(fn, 1000);
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => { clearTimeout(t); setTimeout(fn, 0) });
}

function typeableOrCap(cap, timeoutMs) {             // 竞速：可输入 vs 超时
  return new Promise(resolve => {
    if (inFlight > cap) { settleAfterPaint(() => resolve("typeable")); return }
    let onReady = () => { clearTimeout(t); waiters.delete(onReady); settleAfterPaint(() => resolve("typeable")) };
    let t = setTimeout(() => { waiters.delete(onReady); resolve("cap") }, timeoutMs);
    waiters.add(onReady);
  });
}
```

| 返回 | 含义 |
| :--- | :--- |
| `"live"` | 已经是活会话，立即可输入 |
| `"typeable"` | composer 已就绪（或在阈值内就绪），可以打字 |
| `"cap"` | 超过阈值仍未就绪，**放弃等待**（不再阻塞输入） |

> **这是"输入框焦点竞速"问题的正式解法**：不是死等 composer 挂载，而是给一个上限（`cap`）。超时后仍允许输入，避免"页面看起来好了但打不了字"。`settleAfterPaint()` 保证判定发生在**一帧之后**，避免在布局尚未稳定时下结论。

---

## 17.10 复刻要点

| 要点 | 实现 |
| :--- | :--- |
| 逐项铺底而非整体模糊 | 每个 dock 项 `bg-page` + `before` 40px 渐隐 |
| 遮罩态与淡出解耦 | `masked` 与 `host-fade` 分开，后者由 `masked && !fade` 推导 |
| 促销槽不算内容 | `hasContent()` 里排除 `[data-cds-dock-promotion]` 内的项 |
| 隐藏项不算内容 | 检查祖先链上的 `[hidden]` |
| 观察器共享 | 一个 `MutationObserver` + 订阅 Set + 引用计数 |
| 间距不跳变 | `:is(所有子类型)` 统一 `margin-bottom` |
| 退场不阻塞 | `leaving` 属性把视觉退场与占用判定分开 |
| 输入竞速 | `typeable` / `cap` 竞速 + 一帧后判定 |

---

## 17.11 证据索引（本篇）

| ID | 类型 | 位置 | 支撑结论 |
| :--- | :--- | :--- | :--- |
| E17-1 | 观测 | `ion-dist.asar:assets/v1/shared-1-DtdFVPvn.js`（dock 常量块） | 七个属性、`reveal-in/out`、`page-fade-b-soft` 类串 |
| E17-2 | 观测 | 同上（`sZ` Group 组件） | `masked`/`fade` 缺省与 `host-fade` 推导、`pointer-events` 策略 |
| E17-3 | 观测 | 同上（`ZX` / `QX`） | 三条排除规则 |
| E17-4 | 观测 | 同上（`eZ` 观察器） | 共享 MutationObserver、`attributeFilter:["hidden"]`、引用计数 |
| E17-5 | 观测 | 同上（`rZ`） | `read() ?? true` 的保守默认 |
| E17-6 | 观测 | 同上（`V_` / `ROUTES` / `PROJECT` / `SPACE`） | dock 的路由白名单 |
| E17-7 | 观测 | 同上（`markComposerPresent` / `settleAfterPaint` / `typeableOrCap`） | `live` / `typeable` / `cap` 三态竞速 |
| E17-8 | 观测 | `ion-dist.asar:assets/v1/c6a992d55-k2XF_vDB.css` | 统一 `margin-bottom: var(--cds-gap-xs)` 的 `:is(...)` 选择器 |

<p align="center"><a href="16-六个没见过的UIUX做法.md">← 第十六篇</a> · <a href="README.md">📚 本卷索引</a></p>
