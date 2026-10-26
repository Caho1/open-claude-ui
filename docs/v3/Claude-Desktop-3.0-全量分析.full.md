---
title: "Claude Desktop 3.x (3.6556.2) 全量逆向取证报告 · 单文件完整版"
category: reverse-engineering
domain: architecture/desktop_application
version: "3.0 (3.6556.2)"
status: stable
date: 2026-10-26
author: "REA 逆向工程实验室"
evidence_root: "b2dfbbb40325d978dcb7561ad12a6f9bc199f8f46b7d3d2899af74ce8965d68a"
---

> 本文件由 `docs/v3/` 下七章合并而成，便于离线全局检索。
> 章节内容与各分章文件完全一致。若两者不符，**以分章文件为准**。

---

# 第一章：综述与版本边界

## 1.1 版本边界声明

### 1.1.1 应用版本

从 `/Applications/Claude.app/Contents/Resources/app.asar` 内解出的 `package.json` 原文：

```json
{
  "name": "@ant/desktop",
  "version": "3.6556.2",
  "productName": "Claude"
}
```

**证据链**：
- 文件位置：ASAR 根目录 `package.json`，`size = 1835`（REA 6.8.0 生成的取证包记录）
- ASAR Header 结构：偏移 `0..16` 为长度头，`uint32LE@12` 给出 JSON 头长度；JSON 头从偏移 16 开始；文件数据区起始 = `16 + headerSize`
- 交叉验证：`/Applications/Claude.app/Contents/Info.plist` 的 `CFBundleShortVersionString = 3.6556.2`，`CFBundleVersion = 3.6556.2`

### 1.1.2 ASAR 根摘要

```
sha256 = b2dfbbb40325d978dcb7561ad12a6f9bc199f8f46b7d3d2897af74ce8965d68a
```

REA 取证包 `artifacts[0].digest.sha256` 与 `shasum -a 256` 直接计算结果一致，**同一次取证可复现**。

REA 取证包标识：

```
evidence_id = ev_77dc39e02692fc4337a916c2321df1f1cfef85c3f30a034593655fa2eea55303
operation   = analyze_javascript_application
authority   = shipped-artifact
confidence  = derived
```

### 1.1.3 ASAR 内部规模

```json
{
  "relevant_files": 572,
  "parsed_javascript_files": 546,
  "skipped_javascript_files": 7,
  "parse_failures": 0,
  "invalid_utf8_files": 0,
  "text_bytes_read": 42966700,
  "visited_ast_nodes": 6621556,
  "findings": 10872,
  "modules": 72,
  "nested_asar_containers": 0
}
```

**证据**：`records[0].normalized_result.statistics`

独立复核：直接用 Node 解析 ASAR header，条目总数 **629**（含非 JS 文件如 CSS/HTML/JSON/node）。572 是 REA 判定为「相关」的子集。

### 1.1.4 进程与窗口拓扑（实测）

**7 个 renderer 入口**（ASAR 内 `.vite/renderer/` 下的目录）：

```
about_window
buddy_window
file_viewer
find_in_page
local_exec_consent
main_window
quick_window
```

**证据**：`Object.keys(asarHeader.files[".vite"].files.renderer.files)` → 上述 7 项。

但 REA `summary.browser_windows = 5`。两者不矛盾：

- `5` 统计的是「代码里 `new BrowserWindow` 创建的不同窗口」
- `7` 是「磁盘上的 renderer HTML 入口数」

差的 2 个（`file_viewer`、`local_exec_consent`）由其他机制打开，不走 `new BrowserWindow`。

**⚠️ 本节的可信度限制**：主进程文件 `.vite/build/index.pre.js` 在 REA 取证中 `parse_status = "partial"` 且 `static_analysis` 字段缺失（见 1.2），因此「5 个 BrowserWindow」来自 REA 对可解析部分的汇总，**不是对主进程完整代码的直接计数**。详见 [第二章 2.3](02-Electron架构取证.md)。

---

## 1.2 取证覆盖度与不可解项

REA 取证包 `records[0].normalized_result.limitations` 共 **1064 条**。按原因归并：

| 原因 | 条数 | 原文（节选） |
| :--- | ---: | :--- |
| 语义分析未启动 | 512 | `The parent reserved its remaining result capacity for static observations; semantic analysis of <file> was not started` |
| 语义图超预算 | 10 | `Semantic graph for <file> exceeds the parent's remaining result budget; static and module facts were retained` |
| 工作进程资源约束 | 7 | `Owned JavaScript worker … resource constraint` |
| 完整性冲突 | 8 | `Artifact integrity metadata contradicts observed bytes at <path>` |
| 其他（内联脚本、别名上限等） | 527 | 逐条不同 |

**去重后的受约束文件数：532**（`[...new Set(limitations.filter(l=>l.includes("Resource constraint")).map(l=>l.split(":")[0]))].length`）。

### 1.2.1 被截断的核心文件

```
.vite/build/mainView.js
.vite/build/mainWindow.js
.vite/build/quickWindow.js
.vite/build/aboutWindow.js
.vite/build/heavy-work-worker/dist-CI9lzb1v.js
.vite/build/heavy-work-worker/heavyWorkWorker.js
```

**这直接导致本文的一个重要结论**：REA 主报告中的 `ipc.main_handlers = 0` **不能直接采信**，必须绕过 REA 直接读字节验证。第二章完成了这项验证，结论是**该零值成立，但原因与 REA 的推断不同**。

### 1.2.2 六个结构性零值

```json
{
  "ipc.main_handlers": 0,
  "ipc.paired_renderer_transmissions": 0,
  "ipc.ambiguous_renderer_transmissions": 0,
  "preload_entrypoints": 0,
  "resolved_utility_entrypoints": 0,
  "native_addon_bindings": 0,
  "resolved_native_addon_bindings": 0
}
```

**证据**：`records[0].normalized_result.summary`。

本文对其中三个做了字节级复核（第二章）：

| 零值 | 复核结论 | 复核方法 |
| :--- | :--- | :--- |
| `ipc.main_handlers = 0` | ✅ **成立** | 主进程仅 6 个 `ipcMain.on(t.createKey(...))`，全部属于 Sentry SDK 命名空间 |
| `preload_entrypoints = 0` | ✅ **成立** | 全 ASAR 无 preload 命名文件；preload 路径由 `registerPreloadScript` 运行时拼接 |
| `native_addon_bindings = 0` | ⚠️ **部分成立** | 磁盘有 5 个 `native-addon` 节点，但其中 8 处完整性冲突，REA 拒绝建立可信绑定 |

其余三个零值本文**不复核、不推断**，标注为 `unknown`。

### 1.2.3 语义图的族级覆盖度

`records[0].normalized_result.semantic_graph.coverage.families` 全部 12 个族状态均为 `partial`：

| family | retained_relations | unknown_ids 数量 |
| :--- | ---: | ---: |
| data-flow | 51995 | 24800 |
| object-flow | 5461 | 21917 |
| closure | 16153 | 531 |
| call-flow | 11047 | 8157 |
| promise-ownership | 295 | 715 |
| event | 121 | 626 |
| boundary | 54 | 537 |
| request | 48 | 543 |
| timer | 15 | 544 |
| configuration | 1 | 531 |
| **child-process** | **0** | 531 |
| **resource-lifecycle** | **0** | 531 |

全局 unknown 节点 **59963** 个。

**含义**：本文凡是涉及「数据流」「对象流」「资源生命周期」的推断都必须显式标注为不可靠。本文因此**只采信可直接从字节读出的静态事实**（token 值、keyframes 定义、选择器结构、字面量字符串）。

---

## 1.3 v2 → v3 迁移影响面

本节给出**可直接执行的迁移判定**，每条附证据。

### 1.3.1 必须修改的令牌值

| 令牌 | open-claude-ui 现值 | 3.6556.2 实测值 | 判定 |
| :--- | :--- | :--- | :--- |
| `--cds-clay-emphasized` | `var(--cds-clay-hover)`（light `#cc5a36` / dark `#e08264`） | **`#c6613f`**（2 处定义：`:root` 与 `.cds-root`，值相同，无暗色覆盖） | ❌ **必须改** |

**证据**：

```bash
grep -c "\--cds-clay-emphasized:" MainWindowPage-BjVtjJFx.css     # → 2（:root 与 .cds-root，值均为 #c6613f）
grep -c "\--cds-clay-emphasized:" MainWindowPage.css | grep dark # 反模式，见下
# 无暗色覆盖的验证方式：
grep -o "data-mode=dark[^{]*{[^}]*--cds-clay-emphasized" MainWindowPage-BjVtjJFx.css | wc -l   # → 0
grep -o  "\--cds-clay-emphasized:[^;}]*" MainWindowPage-BjVtjJFx.css  # → --cds-clay-emphasized:#c6613f
```

原 CSS 中的完整上下文（相邻令牌，用于确认这不是断章取义）：

```css
…--cds-oncolor-200:#f8f8f7bf;--cds-oncolor-300:#f8f8f780;--cds-clay:#d97757;--cds-clay-emphasized:#c6613f;--cds-heather:#cbcadb;--cds-plum:#827db…
```

**注意三份来源给出三个不同值**：

| 来源 | 值 |
| :--- | :--- |
| v2 文档（v2.37337.1） | `#cc5a36`（双模同值） |
| open-claude-ui 分支实现 | `var(--cds-clay-hover)` → light `#cc5a36` / dark `#e08264` |
| **3.6556.2 实测** | **`#c6613f`** |

### 1.3.2 无需修改的令牌（已验证一致）

35 阶 gray 与 35 阶 orange **全部对齐**，仅 1 处写法差异（值等价）：

| 令牌 | ours | 3.6556.2 | 判定 |
| :--- | :--- | :--- | :--- |
| `--cds-gray-870` | `#111111` | `#111` | ✅ 值等价，仅书写长度不同 |

**证据**：

```bash
# gray: ours=35 cli=35 diff=1   (唯一差异 gray-870: #111111 vs #111)
# orange: ours=35 cli=35 diff=0
```

完整 35 阶表见 [4.3](04-系统底座全景解密.md)。

### 1.3.3 缺失的动效与结构

| 类别 | ours | 3.6556.2 | 交集 | 缺失 | 我方独有 |
| :--- | ---: | ---: | ---: | ---: | ---: |
| `@keyframes cds-*` | 32 | **55** | 11 | **44** | 21 |
| `data-cds` 命名空间 | 22 | **45** | 18 | **27** | 4 |
| `@property --cds-*` | 19 | **24** | 17 | **7** | 2 |

**证据**：

```bash
# keyframes
comm -12 / -13 / -23 对 ours(32) 与 client(55) 做集合运算 → 11 / 44 / 21
32 = 11 + 21  ✓     55 = 11 + 44  ✓

# data-cds
comm 对 ours(22) 与 client(45) → 18 / 27 / 4
22 = 18 + 4   ✓     45 = 18 + 27  ✓

# @property
comm 对 ours(19) 与 client(24) → 17 / 7 / 2
19 = 17 + 2   ✓     24 = 17 + 7   ✓
```

具体清单见 [第五章](05-open-claude-ui差异审计.md)。

### 1.3.4 结构性变更（需要改代码，不只是改值）

| 变更 | 影响 |
| :--- | :--- |
| 骨架屏从 `.skeleton-shimmer::after` 改为 **双层 `data-cds` 组件 + `.cds-skel-sweep-band` 子元素** | 组件标记需重写 |
| 新增 `data-hold` 三态揭示时序 | 需新增可选的揭示延迟控制 |
| 暗色从 `.dark` class 改为 **`[data-mode=dark\|light\|system]`** | 暗色切换逻辑需重写 |
| RTL 从简单 255° 翻转改为 **`:lang(...)` 精确语言列表 + `animation-direction:reverse`** | RTL 选择器需重写 |

详细证据见 [第三章](03-架构重构与对比分析.md)。

---

## 本章证据索引

| 断言 | 证据来源 |
| :--- | :--- |
| 版本 `3.6556.2` | ASAR 内 `package.json`；`Info.plist` |
| ASAR 根摘要 | `shasum -a 256` 与 REA `artifacts[0].digest.sha256` 双向一致 |
| 572/546/7/0/6621556 | REA `records[0].normalized_result.statistics` |
| 629 个 ASAR 条目 | 直接解析 ASAR header 计数 |
| 7 个 renderer 入口 | ASAR `.vite/renderer/` 目录列表 |
| 532 文件截断 / 1064 条 limitation | REA `records[0].normalized_result.limitations` |
| 12 个语义族全 partial | REA `semantic_graph.coverage.families` |
| `clay-emphasized = #c6613f` | `grep` 主样式表：2 处定义（`:root` / `.cds-root`），值一致，0 处暗色覆盖 |
| gray/orange 35 阶对齐 | 逐阶对比 ours vs cli |
| 55/45/24 vs 32/23/19 | 三方 `sort -u \| wc -l` |

---

# 第二章：Electron 架构取证

> **本章的特殊性**：REA 6.8.0 的语义分析无法覆盖主进程与渲染进程的核心文件（见 1.2.1）。因此本章**绕过 REA 的语义层，直接读取 ASAR 内的 JS 字节**，由此得出的结论与 REA 的 summary 字段在若干项上不同——本文以字节为准，并说明差异原因。

## 2.0 复现方法

本章所有数字都可用同一段脚本复现：

```js
// 读取 ASAR 内任意文件
import fs from "node:fs";
const p = "/Applications/Claude.app/Contents/Resources/app.asar";
const fd = fs.openSync(p, "r");
const head = Buffer.alloc(16); fs.readSync(fd, head, 0, 16, 0);
const headerSize = head.readUInt32LE(12);          // JSON 头长度
const hb = Buffer.alloc(headerSize); fs.readSync(fd, hb, 0, headerSize, 16);
const json = JSON.parse(hb.toString("utf8"));       // ASAR 目录树
const dataStart = 16 + headerSize;                  // 文件数据区起点

const read = (node) => {
  const buf = Buffer.alloc(node.size);
  fs.readSync(fd, buf, 0, node.size, dataStart + Number(node.offset));
  return buf.toString("utf8");
};
const build = json.files[".vite"].files.build.files;
const main = read(build["index.pre.js"]);
```

> **ASAR Header 布局（本文实测确认）**
> ```
> 偏移 0..12  : Chromium pickle 头（其中 @12 为 JSON 字节长度）
> 偏移 16..  : 纯 JSON 文本，首字节为 '{'
> ```
> 常见误解是 JSON 前还有 4 字节 payload 长度。本文对 3.6556.2 实测：**JSON 从偏移 16 直接开始**。

---

## 2.1 主进程面：`index.pre.js`

**文件标识**

| 项 | 值 | 证据 |
| :--- | :--- | :--- |
| ASAR 路径 | `.vite/build/index.pre.js` | ASAR 目录树 |
| 大小 | 982,086 bytes | ASAR 条目 `size` |
| REA 解析状态 | `partial` | 取证包 `parse_status` |
| REA `static_analysis` | **字段缺失** | 取证包该节点无 `static_analysis` 键 |
| Electron 身份 | `electron-main`（REA graph 唯一一个） | `graph.nodes` 中 `kind === "electron-main"` 仅 1 个 |

### 2.1.1 IPC handler 计数：**0 个业务通道**

**字节级扫描结果**

```bash
grep -c "ipcMain"                       # 6 处出现
grep -c "ipcMain.handle\|ipcMain.handleOnce"   # 0 处
```

`ipcMain` 的 6 处出现，全部是挂载 listener（`.on`），且通道名通过 `t.createKey("<字面量>")` 生成：

```js
function bx(e,t,n){
  E.ipcMain.on(t.createKey("start"), (({sender:e})=>{…})),
  E.ipcMain.on(t.createKey("scope"), ((e,t)=>hx(n,t))),
  E.ipcMain.on(t.createKey("envelope"), (({sender:t},r)=>px(e,n,r,t))),
  E.ipcMain.on(t.createKey("structured-log"), (({sender:t},r)=>_x(e,n,r,t))),
  E.ipcMain.on(t.createKey("metric"), (({sender:t},r)=>vx(e,n,r,t)));
  let r=Db(e);
  r && E.ipcMain.on(t.createKey("status"), (({sender:e},t)=>r(t,e)))
}
```

**提取到的 6 个通道名字面量**：

```
start
scope
envelope
structured-log
metric
status
```

**这 6 个名字全部属于 Sentry SDK 的 IPC 命名空间**。判据（同一文件内的上下文）：

```js
// 紧邻的其它 Sentry 痕迹
O.log(`[Utility Process] ${e}`)
Px(e.data)  // 内部调用 js(e) → nx(t) 解析 envelope
```

`envelope` / `scope` / `structured-log` / `metric` 是 Sentry SDK 的标准传输概念；`start` / `status` 对应该 SDK 的生命周期管理。

**因此 `ipc.main_handlers = 0` 是成立的**，但要精确表述为：

> 主进程**不注册任何 Claude 业务 IPC handler**。全部 6 个 `ipcMain.on` 通道属于 Sentry SDK 的诊断命名空间。

这与 REA 给出的 `0` 数值一致，但 REA 的 `main_handlers` 计数口径只统计「handler」（`.handle`/`.handleOnce`），本节的更强的结论是「连业务 `.on` 也没有」。

### 2.1.2 `BrowserWindow`：2 处出现，均为 Sentry 代码，0 处构造

```bash
grep -o "BrowserWindow"          index.pre.js | wc -l   # 2
grep -o "getAllWindows"         index.pre.js | wc -l   # 1
grep -o "new *\.*BrowserWindow" index.pre.js | wc -l   # 0
```

**第 1 处**（偏移 313730）——Sentry 的截图附加逻辑：

```js
jb=fl((()=>({name:"Screenshots",async processEvent(e,t,n){
  if(!n.getOptions().attachScreenshot) return e;
  if(!e.transaction && e.platform!=="native"){
    let e=1;
    for(let n of E.BrowserWindow.getAllWindows()){
      t.attachments||=[];
      try{
        if(!n.isDestroyed() && n.isVisible()){
          let r=e===1?"screenshot.png":`screenshot-${e}.png`,
              i=await n.capturePage();
          t.attachments.push({filename:r,data:i.toPNG(),contentTy…
```

**第 2 处**（偏移 329352）——Sentry 集成名重命名的字符串常量：

```js
var Rx=[
  {userAdded:"ElectronMinidump", toRemove:"SentryMinidump"},
  {userAdded:"BrowserWindowSession", toRemove:"MainProcessSession"}
];
function zx(e){
  for(let {userAdded:t,toRemove:n} of Rx)
    e.integrations.some((e=>e.name===t)) &&
      (e.integrations=e.integrations.filter((e=>e.name!==n)))
}
```

**结论**：

- 主进程对 `BrowserWindow` 的**唯一运行时用法**是 Sentry 的 `getAllWindows()` 枚举 + `capturePage()` 截图
- 第 2 处是字符串字面量，不是 API 调用
- **没有任何 `new BrowserWindow(...)` 构造调用**（正则 `new\s+E?\.?BrowserWindow` 命中 0）

两处都属于 Sentry SDK，与 Claude 的窗口管理无关。

### 2.1.3 `utilityProcess`：3 处，全部是 Proxy 包装，无 fork 调用

```js
function Nx(){
  E.utilityProcess?.fork && (
    E.utilityProcess.fork = new Proxy(E.utilityProcess.fork, {
      apply: (e, t, n) => {
        let r = e.apply(t, n);
        function i(){
          let [, , e] = n;
          return e?.serviceName || `pid:${r.pid}`
        }
        return r.on("message", (e=>{
          if (Kv(e)) {
            Mx(`SDK started in utility process '${i()}'`);
            let {port1: e, port2: t} = new E.MessageChannelMain;
            t.on("message", (e=>{
              (e.data instanceof Uint8Array || typeof e.data === "string") && Px(e.data)
            }));
            t.start();
            r.postMessage(qv(), [e])
          }
        })),
        r.on = new Proxy(r.on, {…}),
        r
      }
    })
  )
}
```

**关键判据**：这段代码是 **`utilityProcess.fork` 的 Proxy 拦截器**，作用是在每次 fork 后注入 Sentry 的 IPC 桥（`MessageChannelMain` + `postMessage(qv(), [e])`）。

修饰点：
- `apply` 钩子里调用 `e.apply(t, n)` —— 其中 `e` 是**原始 fork 函数**，`t` 是 `this`，`n` 是参数
- 包装后返回 `r`（ChildProcess 风格的 utility process 句柄）

**这本身不是一次 fork 调用**。真正的 fork 调用点在同文件其他位置（被 REA 截断的语义图里），静态字面量不可定位。

**因此**：
- REA 的 `utility_processes = 1` 与本文的「无 fork 调用点」并不矛盾——`1` 是 REA 从别处（可能来自构建产物的 metadata 或文件存在性）推断的
- `resolved_utility_entrypoints = 0` 是**准确的**：无法确定任何 utility process 的入口脚本

本文**不对「到底有几个 utility process」下结论**，标注为 `unknown`。

### 2.1.4 preload：`../../preload/default.js` 是 Sentry 的注入路径

`index.pre.js` 中唯一的 preload 路径字面量：

```js
function eb(){
  try { return require.resolve("../../preload/default.js") }
  catch {
    try {
      let e = (0,_.fileURLToPath)(require("node:url").pathToFileURL(__filename).href);
      return (0,v.resolve)(e, "..", "..", "..", "..", "preload", "default.js")
    } catch {}
  }
}
```

**这是 Sentry SDK 的 preload 自动注入逻辑**，判据：

1. 函数体是典型的「先 `require.resolve` 再 fallback 到相对路径」的 SDK 兼容写法
2. 该函数所属模块内的相邻代码是 `global.process.on("uncaughtException", …)` + `E.dialog.showErrorBox("A JavaScript error occurred in the main process", t)` —— 纯粹的 Sentry 错误上报
3. 路径 `../../preload/default.js` 相对于 Sentry 包自身位置，不是 Claude 的 preload 目录

**Claude 自己的 preload 注册方式**（同文件另一处）：

```js
function ty(e,t){
  if (e.registerPreloadScript)
    e.registerPreloadScript({ type: "frame", filePath: t });
  else {
    let n = e.getPreloads();
    e.setPreloads([t, ...n])
  }
}
```

`filePath: t` 是**运行时变量**，静态不可解。

**全 ASAR 内 preload 命名文件的搜索结果**：

```bash
# ASAR 629 个条目中，路径含 "preload" 的：
(none)

# 磁盘上 /Applications/Claude.app/Contents/Resources 下：
/Applications/Claude.app/Contents/Resources/ion-dist/assets/v1/preload-helper-D0dM6GpB.js
```

唯一的磁盘文件在 `ion-dist/`（Claude 的另一个分发目录），不在 ASAR 内，且名为 `preload-helper`，是 Vite 的 preload 辅助函数而非应用 preload 入口。

**结论**：`preload_entrypoints = 0` 在**静态层面成立**（asar 内无 preload 命名文件），但**不代表没有 preload**。

> **⚠️ 本节已被 [6.7.2](06-全量CSS扫描与官方规范比对.md) 的运行时证据修正。**
>
> 运行时实测（`webContents._getPreloadScript()`）：
>
> | 窗口 | preload 路径 |
> | :--- | :--- |
> | `main_window` | **`.vite/build/mainWindow.js`** |
> | `about:blank` | **`.vite/build/mainView.js`** |
>
> **preload 就是 `.vite/build/` 下的窗口脚本**。这些文件本章 2.1 / 2.2 已经分析过，只是当时不知道它们同时承担 preload 角色。
>
> 因此正确表述是：**preload 存在，只是不叫 preload 这个名字**。REA 的 `preload_entrypoints = 0` 反映的是「没有文件名为 preload 的入口」，不是「没有 preload 机制」。

---

## 2.2 渲染进程面：`mainView.js`

**文件标识**

| 项 | 值 |
| :--- | :--- |
| ASAR 路径 | `.vite/build/mainView.js` |
| 大小 | 264,711 bytes |
| REA 解析状态 | `partial`（语义图被截断） |

### 2.2.1 `ipcRenderer` / `contextBridge` 计数

```bash
grep -o "\bipcRenderer\b"   mainView.js | wc -l    # 1598
grep -o "\bcontextBridge\b" mainView.js | wc -l    # 24
grep -o "exposeInMainWorld" mainView.js | wc -l    # 23
```

### 2.2.2 桥接 API：12 个字面量名字

`exposeInMainWorld(<字面量>, …)` 的匹配结果：

```js
exposeInMainWorld("buddyBle",                   …)
exposeInMainWorld("claudeAppBindings",          …)
exposeInMainWorld("claudeAppSettings",          …)
exposeInMainWorld("process",                    …)
exposeInMainWorld("desktopBootFeatures",        …)
exposeInMainWorld("desktopManagedConfig",       …)
exposeInMainWorld("desktopEnterpriseConfig",    …)
exposeInMainWorld("desktopTelemetryConfig",     …)
exposeInMainWorld("desktopDeviceClass",         …)
exposeInMainWorld("desktopPreferredLanguages",  …)
exposeInMainWorld("electronWindowControl",      …)
exposeInMainWorld("electronIntl",               …)
```

**12 个已知名字**。剩下 23 − 12 = 11 次调用传入的是变量（如 `t`、`i`），静态不可解。

**与 REA 的差异及原因**

| 来源 | 数值 | 口径 |
| :--- | ---: | :--- |
| REA `summary.context_bridge_apis` | **37** | `exposeInMainWorld` 及等价包装的调用点总数（含被截断文件的估算） |
| REA graph `context-bridge-api` 节点 | 20 | 去重后的节点数 |
| REA graph 唯一 label | 7 | `null, process, desktopEssentialTelemetryDisabled, buddy, cowork, claudeDesktopArtifactPane, omeletteDesktopPdf` |
| **本文（字节扫描）** | **12** | `exposeInMainWorld` 的第一个参数是字符串字面量的情形 |

四者口径完全不同，**不可混用**。

**本文的结论**：`context_bridge_apis = 37` 是**调用计数**，不是「37 个不同接口」。目前可确证的接口名是 **12 个**（来自 `mainView.js`）。

> REA graph 里那 7 个 label（含 `buddy`、`cowork`、`claudeDesktopArtifactPane`、`omeletteDesktopPdf`）与本文的 12 个名字**交集只有 `process` 与 `buddy` 相关项**。差异原因：REA 的 graph 节点来自 `wrapper-substitution` 与 `direct-syntax` 两种解析路径，覆盖的是不同的调用形态。两者都有价值，但都不完整。

### 2.2.3 IPC channel 观测（REA graph 层）

REA 的 `graph.nodes` 中有 117 个 `ipc-channel` 节点，其 `observations[].properties` 汇总：

```json
{
  "side":       { "renderer": 117 },
  "mode":       { "invoke": 75, "listen": 38, "send": 4 },
  "resolution": { "dynamic": 115, "literal": 2 }
}
```

**全部 117 个都在渲染侧**，与 2.1.1 的「主进程无业务 handler」一致。

只有 2 个通道名解析为字面量：

```
$eipc_message$_5de9b164-2257-4603-a1e1-e00cdb72056c_$_claude.designPdf_$_DesignPdf_$_printFrameToPdf
$eipc_message$_5de9b164-2257-4603-a1e1-e00cdb72056c_$_claude.artifactShell_$_ArtifactShellTransport_$_hello
```

这两个是 Electron 的 `MessagePortMain` IPC 协议格式（`$eipc_message$_<uuid>_$_<namespace>_$_<class>_$_<method>`）。

**v2 文档引用的 `DESKTOP_WINDOW_POP_OUT_CHAT` 通道名不在其中**，其 `channel` 字段为 `null`（动态表达式）。

---

## 2.3 窗口拓扑：7 vs 5

**磁盘事实（ASAR 目录树）**

```
.vite/renderer/about_window         11 files
.vite/renderer/buddy_window         10 files
.vite/renderer/file_viewer           6 files
.vite/renderer/find_in_page         16 files
.vite/renderer/local_exec_consent    2 files
.vite/renderer/main_window          12 files
.vite/renderer/quick_window          9 files
```

**REA 的 `electron-renderer` 节点（7 个，与磁盘一一对应）**

```
.vite/renderer/local_exec_consent/localExecConsent.html
.vite/renderer/file_viewer/fileViewer.html
.vite/renderer/quick_window/quick-window.html
.vite/renderer/about_window/about.html
.vite/renderer/main_window/index.html
.vite/renderer/buddy_window/buddy.html
.vite/renderer/find_in_page/find-in-page.html
```

**REA `summary.browser_windows = 5`**

两者不矛盾，口径不同：

| 数值 | 含义 |
| :--- | :--- |
| 7 | renderer HTML 入口数（磁盘事实） |
| 5 | `new BrowserWindow` 创建的不同窗口数（REA 汇总） |

差值 2：`file_viewer` 与 `local_exec_consent` 未走 `new BrowserWindow`。

**本文不推断这 2 个窗口的实际打开机制**（`BrowserView` / `webContents` 复用 / 其它），因为主进程语义图被截断。标注为 `unknown`。

**另注**：`.vite/build/` 下还有 4 个 renderer 无关的窗口级脚本，但它们的 Electron 身份未在 REA graph 中确立：

```
.vite/build/aboutWindow.js      87,182 bytes
.vite/build/quickWindow.js      87,182 bytes
.vite/build/mainWindow.js       88,843 bytes
.vite/build/findInPage.js       86,781 bytes
```

这四个文件的 `ipcRenderer` 出现次数分别为 22 / 22 / 22 / 19，`contextBridge` 为 4 / 4 / 5 / 4。它们与 `mainView.js`（1598 次 `ipcRenderer`）不是同一层级——前者是**每个窗口的 renderer 引导脚本**，后者是**主渲染进程的应用主体**。

---

## 2.4 完整性冲突：8 处

REA `records[0].normalized_result.integrity_contradictions` 共 8 条。字段结构：

```json
{
  "contradiction_id": "ic_de5e95555f5099eed6aea52528a17ff8355426daf3879dc8ca59ff07c78de5e8",
  "declared_sha256": "2f423b6013cec753eefd174418b9517ecc39b0025e26b9c16789d0c0d4cadd86",
  "observed_sha256":  "6ff3ed381e089584…",
  "entry_kind": "file",
  "logical_path": "node_modules/@ant/claude-native/claude-native-binding.node",
  "limitations": ["Observed bytes contradict declared integrity metadata and cannot support equivalence."]
}
```

冲突路径（前 3 条）：

```
node_modules/@ant/claude-native/claude-native-binding.node
node_modules/node-pty/…
resources/office365-mcp/…
```

**REA 给出的解释**（原文）：

```
Declared ASAR integrity for unpacked entry <path> contradicts its companion file;
packaging tools commonly sign or strip unpacked native binaries after writing the archive.
```

**影响**：这正是本文与上一轮 REA 分析中被 `artifact_integrity_mismatch` 拦截的同一个文件。所有涉及 `analyze-javascript-application` / `inspect-artifact` 的重跑都需要 `--integrity-policy record-and-continue`。

**本文所有字节级结论均不受此影响**——本文直接读 ASAR 内的 JS/CSS 字节，不依赖 unpacked 原生二进制的完整性校验。

---

## 本章证据索引

| 断言 | 证据 |
| :--- | :--- |
| `index.pre.js` 982,086 bytes | ASAR 条目 `size` |
| 6 个 `ipcMain.on(createKey(...))` | `grep -o 'ipcMain\.on\(t\.createKey(...)'` 提取原文 |
| `ipcMain.handle` = 0 | `grep -c "ipcMain\.handle"` |
| `BrowserWindow` = 2，0 处构造 | 两处上下文分别为 Sentry 截图逻辑与 `"BrowserWindowSession"` 字符串；`new BrowserWindow` 正则命中 0 |
| `utilityProcess` = 3 全为 Proxy | `utilityProcess.fork = new Proxy(...)` 原文 |
| preload 无入口 | ASAR 629 条目中无 preload 命名；`registerPreloadScript({filePath: t})` 为运行时变量 |
| `mainView.js` 1598/24/23 | `grep -o` 计数 |
| 12 个字面量桥接 API | `exposeInMainWorld("…")` 完整提取 |
| 117 个 ipc-channel 全在 renderer | REA graph `observations[].properties.side` 汇总 |
| 2 个字面量通道名 | REA graph `properties.channel` 非 null 项 |
| 7 个 renderer 入口 | ASAR `.vite/renderer/` 目录 + REA `electron-renderer` 节点 |
| 8 处完整性冲突 | REA `integrity_contradictions` |

---

# 第三章：架构重构与对比分析

> 本章聚焦 **CDS 3.0 中被 `open-claude-ui` 误实现或完全未实现的机制**。每节先给 CSS 原文，再给结论，最后给与当前实现（`feat/issue-25-skeleton-sweep-and-rea-audit` 分支）的差异。

---

## 3.1 骨架屏：双层组件结构，sweep band 是独立子元素

### 3.1.1 真实的 DOM 层级

CDS 3.0 的骨架屏由**两层 `data-cds` 属性**构成：

```
[data-cds="SkeletonGroup"]   ← 组容器，控制 motion / hold
  └─ [data-cds="Skeleton"]   ← 单个骨架块
       └─ .cds-skel-sweep-clip    ← 裁剪层（overflow:hidden）
            └─ .cds-skel-sweep-band  ← 扫光光带（真正动的元素）
```

**证据（CSS 原文）**

```css
/* 裁剪层 */
.cds-root .cds-skel-sweep-clip {
  pointer-events: none;
  position: absolute;
  inset: 0;
  overflow: hidden
}

/* 光带 */
.cds-root .cds-skel-sweep-band {
  background: linear-gradient(105deg, transparent 35%, var(--cds-skeleton-sheen), transparent 65%);
  animation: cds-skeleton-sweep 2s linear var(--cds-skel-reveal-end, 0s) infinite backwards;
  position: absolute;
  inset: 0
}
```

**关键点**

| 观察 | 说明 |
| :--- | :--- |
| `.cds-skel-sweep-band` 是**真实 DOM 元素** | 不是 `::after` 伪元素 |
| `.cds-skel-sweep-clip` 提供 `overflow:hidden` | 扫光被裁剪在骨架块内 |
| `position:absolute; inset:0` 属于 **band / clip** | 不属于骨架块本身 |
| 骨架块 `[data-cds="Skeleton"]` 本身**没有** `position:absolute` 规则 | 它保持正常文档流 |

### 3.1.2 与 issue #25 分支的差异

分支的实现（`cds-theme.css`）：

```css
.cds-skeleton-sweep,
.cds-skeleton[data-motion="wave"]::after,
.cds-skeleton:not([data-motion])::after {
  content: "";
  position: absolute;      /* ← 问题所在 */
  inset: 0;
  transform: translate(-100%);
  …
}
```

**三个结构性偏差**：

| 项 | CDS 3.0 实际 | 分支实现 | 后果 |
| :--- | :--- | :--- | :--- |
| 光带载体 | 独立元素 `.cds-skel-sweep-band` | `::after` 伪元素 | 伪元素无法被 JS 查询/替换 |
| `.cds-skeleton-sweep` 作为独立类 | **不存在此语义** | 写在同一条规则的选择器列表里 | 该类的元素自身变成 `position:absolute` + `translate(-100%)`，被推出视口 |
| 裁剪机制 | 独立 `.cds-skel-sweep-clip` + `overflow:hidden` | 依赖骨架块自身 `overflow:hidden` | 结构上可工作，但缺少显式裁剪层 |

**分支缺陷的实测证据**（Chrome headless，用 storybook 自己的 CSS）：

```
class="cds-skeleton cds-skeleton-sweep h-4 rounded w-3/4" data-motion="wave"
→ position: absolute, x = -245, 渲染为不可见
```

这正是 3.1.2 表格第二行描述的直接后果。

### 3.1.3 修复方向

**最小改动**（保留现有类名，去掉并列的独立类选择器）：

```css
/* 只保留伪元素形态，不把 .cds-skeleton-sweep 放进这条规则 */
.cds-skeleton[data-motion="wave"]::after,
.cds-skeleton:not([data-motion])::after { … }
```

**完整对齐**（推荐，需同步改组件标记）：

```css
.cds-skeleton { position: relative; overflow: hidden; }
.cds-skel-sweep-clip { pointer-events:none; position:absolute; inset:0; overflow:hidden; }
.cds-skel-sweep-band {
  background: linear-gradient(105deg, transparent 35%, var(--cds-skeleton-sheen), transparent 65%);
  animation: cds-skeleton-sweep 2s linear var(--cds-skel-reveal-end, 0s) infinite backwards;
  position: absolute; inset: 0;
}
```

---

## 3.2 骨架屏：`data-hold` 三态揭示时序

这是 **CDS 3.0 完全新增的机制**，v2 文档与 issue #25 分支均未涉及。

### 3.2.1 三个状态

`data-hold` 属性（挂在 `SkeletonGroup` 上）有三个取值：

| 取值 | CSS 行为 | 语义 |
| :--- | :--- | :--- |
| **缺省**（无该属性） | 使用 `var(--placeholder-reveal-delay, .5s)` 的默认揭示时序 | 标准延迟揭示 |
| **`none`** | `--cds-skel-reveal-end: calc(0s - var(--cds-skel-elapsed))` | 立即开始，不等待 |
| **`delayed`** | 额外挂 `cds-placeholder-reveal .15s ease-out …backwards` 动画 | 显式延迟揭示 |

### 3.2.2 CSS 原文

```css
/* 基础（无 data-hold 或 data-hold 无值时） */
.cds-root [data-cds=SkeletonGroup][data-hold] {
  --cds-skel-elapsed: 0s;
  --cds-skel-i: 0;
  --cds-skel-settled: 0s;
  --cds-skel-reveal-end: calc(var(--placeholder-reveal-delay, .5s) + .15s - var(--cds-skel-elapsed))
}

/* hold=none：立即 */
.cds-root [data-cds=SkeletonGroup][data-hold=none] {
  --cds-skel-reveal-end: calc(0s - var(--cds-skel-elapsed))
}

/* hold=delayed：显式延迟 + 淡入 */
.cds-root [data-cds=SkeletonGroup][data-hold=delayed] {
  animation: cds-placeholder-reveal .15s ease-out
             calc(var(--placeholder-reveal-delay, .5s) - var(--cds-skel-elapsed) - var(--cds-skel-settled))
             backwards
}
```

### 3.2.3 揭示延迟公式

从上面三段可推出完整的 `--cds-skel-reveal-end` 取值链：

```
data-hold 缺省 / 有值但非 none 非 delayed:
  reveal-end = placeholder-reveal-delay(.5s) + 0.15s - elapsed

data-hold = none:
  reveal-end = 0s - elapsed

data-hold = delayed:
  reveal-end = (同上缺省公式)
  额外叠加 cds-placeholder-reveal 动画，延时 = reveal-delay - elapsed - settled
```

**含义**：`.5s` 是默认的占位揭示延迟，`+0.15s` 是 `cds-placeholder-reveal` 动画自身时长（`.15s ease-out`）。`elapsed` / `settled` 由 JS 在运行时写入，用于「组件已经挂载了多久」的补偿——避免骨架屏在已经加载完成后才启动动画。

> **⚠️ 不可解部分**：`--cds-skel-elapsed` 与 `--cds-skel-settled` 的默认值在 CSS 里是 `0s`，但它们在运行时由谁写入、写入什么值，静态分析无法确定（需运行时观测）。本文只记录 CSS 侧的公式。

### 3.2.4 揭示完成后停止动画

```css
/* 一旦 data-hold 且 data-motion 同时存在（即进入揭示完成态） */
.cds-root [data-cds=SkeletonGroup][data-hold][data-motion],
.cds-root [data-cds=SkeletonGroup][data-hold][data-motion] [data-cds=Skeleton] {
  animation-duration: .01ms;
  animation-iteration-count: 1
}

/* 并隐藏扫光带 */
.cds-root [data-cds=SkeletonGroup][data-hold][data-motion] .cds-skel-sweep-band {
  display: none
}
```

**这是 CDS 3.0 的「动画收尾」机制**：当骨架内容已揭示完成，把动画压到 `.01ms` 单次执行（实质是立即结束），并直接 `display:none` 掉扫光带。

**分支完全缺失此机制**——分支的骨架屏会无限循环扫光，不会在内容到达后停止。

---

## 3.3 骨架屏：双模 wave / lockstep 的真实延时公式

### 3.3.1 wave 模式（波浪级联）

```css
.cds-root [data-cds=SkeletonGroup][data-motion=wave] [data-cds=Skeleton] {
  animation: cds-skeleton-breathe 2s ease-in-out
             calc(var(--cds-skel-reveal-end, 0s) + var(--cds-skel-i, 0) * 90ms)
             infinite
}
```

**关键发现**：wave 模式用的是 **`cds-skeleton-breathe`（透明度呼吸）**，不是扫光 sweep。

```
动画: cds-skeleton-breathe
时长: 2s
缓动: ease-in-out
延时: reveal-end + (skel-i × 90ms)
迭代: infinite
```

**这与分支的实现相反**：分支把 wave 模式绑定到 `cds-skeleton-sweep`（扫光），而实测中用 breathe。

### 3.3.2 lockstep 模式（同步呼吸）

```css
/* hold=none 时 */
.cds-root [data-cds=SkeletonGroup][data-motion=lockstep][data-hold=none] {
  animation: cds-skeleton-breathe 2s ease-in-out var(--cds-skel-reveal-end) infinite
}

/* hold=delayed 时：叠加揭示动画 */
.cds-root [data-cds=SkeletonGroup][data-motion=lockstep][data-hold=delayed] {
  animation: cds-skeleton-breathe 2s ease-in-out var(--cds-skel-reveal-end) infinite,
             cds-placeholder-reveal .15s ease-out
             calc(var(--placeholder-reveal-delay, .5s) - var(--cds-skel-elapsed) - var(--cds-skel-settled))
             backwards
}
```

**注意**：lockstep 的动画挂在 **`SkeletonGroup` 容器**上，作用于整个组；wave 的动画挂在**每个 `Skeleton` 子块**上，带级联延时。这是两种模式的本质区别。

### 3.3.3 两种模式的对比表

| 维度 | `data-motion="wave"` | `data-motion="lockstep"` |
| :--- | :--- | :--- |
| 动画 | `cds-skeleton-breathe` 2s ease-in-out | 同左 |
| 挂载位置 | 每个 `[data-cds=Skeleton]` 子块 | `[data-cds=SkeletonGroup]` 容器 |
| 延时 | `reveal-end + skel-i × 90ms` | `reveal-end`（无级联） |
| 效果 | 逐个错峰呼吸 | 整组同步呼吸 |
| 适用 | 大卡片、多块布局 | 密集列表 |

### 3.3.4 与分支的差异汇总

| 项 | CDS 3.0 | 分支 | 判定 |
| :--- | :--- | :--- | :--- |
| wave 动画 | `cds-skeleton-breathe`（呼吸） | `cds-skeleton-sweep`（扫光） | ❌ 用错动画 |
| lockstep 挂载 | Group 容器 | `.cds-skeleton[data-motion="lockstep"]`（每个块） | ⚠️ 语义不同但效果接近 |
| 级联延时 | `reveal-end + i×90ms` | `i × 90ms` | ⚠️ 缺 reveal-end 项 |
| 扫光触发 | 由 `.cds-skel-sweep-band` 独立元素承担，与 motion 无关 | 绑定到 data-motion | ❌ 混淆了两种机制 |

**核心误解**：分支把「扫光」和「呼吸」当成了 wave / lockstep 两种模式。**实际是两个正交的机制**：

- **扫光**（`.cds-skel-sweep-band`）：独立元素，`2s linear`，与 data-motion 无关
- **呼吸**（`cds-skeleton-breathe`）：由 data-motion 的 wave/lockstep 驱动，`2s ease-in-out`

---

## 3.4 骨架屏：RTL 语言级适配

### 3.4.1 CSS 原文

```css
/* 扫光带：RTL 时渐变角度 105° → 255°，并反转动画方向 */
.cds-root .cds-skel-sweep-clip:where(
  :root[dir=rtl] :is(
    :lang(ae), :lang(ar), :lang(arc), :lang(bcc), :lang(bqi), :lang(ckb),
    :lang(dv), :lang(fa), :lang(glk), :lang(he), :lang(ku), :lang(mzn),
    :lang(nqo), :lang(pnb), :lang(ps), :lang(sd), :lang(ug), :lang(ur), :lang(yi)
  )
) .cds-skel-sweep-band {
  background-image: linear-gradient(255deg, transparent 35%, var(--cds-skeleton-sheen), transparent 65%);
  animation-direction: reverse
}

/* 骨架块自身的伪元素同样反转 */
.cds-root [data-cds=Skeleton][data-cds=Skeleton]:where(
  :root[dir=rtl] :is(…同上 19 个语言…)
):after {
  animation-direction: reverse
}
```

### 3.4.2 三个关键点

| 点 | 说明 |
| :--- | :--- |
| **`:lang()` 精确语言列表** | 19 个语言代码：`ae ar arc bcc bqi ckb dv fa glk he ku mzn nqo pnb ps sd ug ur yi` |
| **`animation-direction: reverse`** | 不只是翻转渐变角度，还要反转动画播放方向，扫光才会从右往左 |
| **`[data-cds=Skeleton][data-cds=Skeleton]` 重复属性** | 这是提高选择器特异性的技巧，用于压过其它规则 |

### 3.4.3 与分支的差异

| 项 | CDS 3.0 | 分支 | 判定 |
| :--- | :--- | :--- | :--- |
| RTL 判定 | `:root[dir=rtl]` **且** `:lang(<19 个语言之一>)` | 仅 `:dir(rtl)` / `[dir="rtl"]` | ⚠️ 范围不同 |
| 渐变角度翻转 | ✅ 105° → 255° | ✅ 105° → 255° | ✅ 一致 |
| 动画方向反转 | ✅ `animation-direction: reverse` | ❌ **缺失** | ❌ 分支的 RTL 仍然从左往右扫 |

**分支的 RTL 实测**（Chrome，`<html dir="rtl">`）：

```
LTR: transform = matrix(1,0,0,1,-220,0)
RTL: transform = matrix(1,0,0,1,-220,0)   ← 完全相同，未反转
```

---

## 3.5 减少动效与残留动效兜底

### 3.5.1 三层兜底机制

CDS 3.0 对减少动效（reduced motion）有三层处理：

```css
/* 第 1 层：属性开关 —— data-reduce-motion=true 时也要收尾 */
.cds-root:where([data-reduce-motion=true],[data-reduce-motion=true] *)
  [data-cds=SkeletonGroup][data-hold][data-motion],
.cds-root:where([data-reduce-motion=true],[data-reduce-motion=true] *)
  [data-cds=SkeletonGroup][data-hold][data-motion] [data-cds=Skeleton] {
  animation-duration: .01ms;
  animation-iteration-count: 1
}

.cds-root:where([data-reduce-motion=true],[data-reduce-motion=true] *)
  [data-cds=SkeletonGroup][data-hold][data-motion] .cds-skel-sweep-band {
  display: none
}
```

**第 2 / 3 层**（在其它组件上，抽样证据）：

```css
/* chip 进入动画：媒体查询层 */
@media (prefers-reduced-motion: reduce) {
  .cds-root .cds-chip-in { animation: none }
}

/* chip 进入动画：属性层 */
.cds-root:where([data-reduce-motion=true],[data-reduce-motion=true] *) .cds-chip-in {
  animation: none
}

/* flipbook：媒体查询层 */
@media (prefers-reduced-motion: reduce) {
  .cds-root .cds-flipbook { animation: none }
}

/* flipbook：属性层 */
.cds-root:where([data-reduce-motion=true],[data-reduce-motion=true] *) .cds-flipbook {
  animation: none
}
```

### 3.5.2 双轨制

CDS 3.0 的减少动效**同时监听两种来源**：

| 来源 | 选择器 | 层级 |
| :--- | :--- | :--- |
| 系统偏好 | `@media (prefers-reduced-motion: reduce)` | 媒体查询 |
| 应用开关 | `[data-reduce-motion=true]` | 属性 |

两者**并列**，各自独立生效。这是为 Electron 应用设计的：系统偏好可能不可靠（或用户想单独控制某个应用），所以提供应用级显式开关。

### 3.5.3 与分支的差异

| 项 | CDS 3.0 | 分支 |
| :--- | :--- | :--- |
| `@media (prefers-reduced-motion)` | ✅ 多处使用 | ⚠️ 仅 1 处，且只针对 `[data-cds-anim]` |
| `[data-reduce-motion=true]` 属性开关 | ✅ 全组件覆盖 | ❌ **完全缺失** |
| 骨架屏动效兜底 | ✅ 有 | ❌ 无 |

**结论**：分支的骨架屏动画**在任何情况下都无限循环**，不响应系统的减少动效设置。

---

## 3.6 Pill 胶囊：1.32x 过冲的 9 个关键帧

v2 文档提到「Pill 1.32x 过冲回弹」，但未给出关键帧定义。以下是 3.6556.2 的原文。

### 3.6.1 四个关键帧

```css
@keyframes cds-pill-in       { 0%   { transform: scale(.8)   } }
@keyframes cds-pill-pop-up   { to   { transform: scale(1.32) } }
@keyframes cds-pill-pop-down { 0%   { transform: scale(1.32) } }
@keyframes cds-pill-dip-up   { 0%   { transform: scale(.82)  } }
```

### 3.6.2 命名规律与数值

| 关键帧 | 关键值 | 用途推断（基于命名与数值） |
| :--- | :--- | :--- |
| `cds-pill-in` | `scale(.8)` 起点 | 入场 |
| `cds-pill-pop-up` | 终点 `scale(1.32)` | 上弹到 1.32x |
| `cds-pill-pop-down` | 起点 `scale(1.32)` | 从 1.32x 回落 |
| `cds-pill-dip-up` | 起点 `scale(.82)` | 下压后回升 |

**1.32 与 0.82 的对称性**：

```
1.32 - 1.00 = +0.32
1.00 - 0.82 = +0.18
```

不是严格对称。`.82` 是压入，`1.32` 是弹出，弹比压更夸张——符合「过冲手感」的意图。

### 3.6.3 完整的 pill 关键帧家族

3.6556.2 中与 pill 相关的关键帧共 **9 个**：

```
cds-pill-dip-down
cds-pill-dip-up
cds-pill-in
cds-pill-out
cds-pill-pop-down
cds-pill-pop-up
cds-pill-roll-in-down
cds-pill-roll-in-up
cds-pill-roll-out
```

分为三个系列：

| 系列 | 成员 | 数值特征 |
| :--- | :--- | :--- |
| `in` / `out` | `cds-pill-in`、`cds-pill-out` | 入场/退场 |
| `pop` | `cds-pill-pop-up`、`cds-pill-pop-down` | `scale(1.32)` 过冲 |
| `dip` | `cds-pill-dip-up`、`cds-pill-dip-down` | `scale(.82)` 压入 |
| `roll` | `cds-pill-roll-in-down`、`cds-pill-roll-in-up`、`cds-pill-roll-out` | 滚动进出 |

**证据**：`grep -o "@keyframes cds-pill-[a-z-]*" MainWindowPage-BjVtjJFx.css | sed 's/@keyframes //' | sort -u | wc -l` → **9**

**分支与 open-claude-ui 均无这 9 个关键帧中的任何一个。** open-claude-ui 的 `ClaudeMotionPresets.ts` 用 Framer Motion spring 实现类似效果，但数值体系（`stiffness/damping/mass`）与 CSS keyframes（`scale` 离散值）不是同一套。

---

## 3.7 滚动渐隐：`@property` 驱动的纯 CSS 实现

### 3.7.1 `@property` 注册

CDS 3.0 用 `@property` 注册了一批可动画的自定义属性。与滚动渐隐相关的 **17 个**：

```css
@property --cds-scroll-fade-top          { … }
@property --cds-scroll-fade-top-on       { … }
@property --cds-scroll-fade-top-raw      { … }
@property --cds-scroll-fade-bottom       { … }
@property --cds-scroll-fade-bottom-on    { … }
@property --cds-scroll-fade-bottom-raw   { … }
@property --cds-scroll-fade-left         { … }
@property --cds-scroll-fade-left-on      { … }
@property --cds-scroll-fade-left-raw     { … }
@property --cds-scroll-fade-right        { … }
@property --cds-scroll-fade-right-on     { … }
@property --cds-scroll-fade-right-raw    { … }
@property --cds-scroll-fade-size         { … }
@property --cds-scroll-fade-x-active     { … }
@property --cds-scroll-fade-y-active     { … }
@property --cds-scroll-fade-strip-active { … }
@property --cds-scroll-fade-strip-raw    { … }
```

**证据**：`grep -o "@property --cds-scroll-fade-[a-zA-Z0-9_-]*" MainWindowPage-BjVtjJFx.css | sort -u | wc -l` → **17**

另有 3 个与吸边（sticky edge）相关的 `@property`：`--cds-sticky-edge-active` / `--cds-sticky-edge-end` / `--cds-sticky-edge-start`。

### 3.7.2 默认值

```css
.cds-root {
  --cds-scroll-fade-size: 28px;
  --cds-scroll-fade-top: 0px;
  --cds-scroll-fade-bottom: 0px;
  --cds-scroll-fade-left: 0px;
  --cds-scroll-fade-right: 0px;
  --cds-scroll-fade-top-raw: 0px;
  --cds-scroll-fade-bottom-raw: 0px;
  --cds-scroll-fade-left-raw: 0px;
  --cds-scroll-fade-right-raw: 0px;
  --cds-scroll-fade-y-active: 0;
  --cds-scroll-fade-x-active: 0;
  --cds-scroll-fade-top-on: 1;
  --cds-scroll-fade-bottom-on: 1;
  --cds-scroll-fade-left-on: 1;
  --cds-scroll-fade-right-on: 1;
  --cds-scroll-fade-strip-raw: 0;
  --cds-scroll-fade-strip-active: 0
}
```

### 3.7.3 滚动驱动

```css
animation-timeline: scroll()
```

出现 1 处（用于 `[data-cds-title-leaves]` 的页面标题动画）。

### 3.7.4 与 v2 文档 / 分支的差异

| 项 | CDS 3.0 | v2 文档声称 | open-claude-ui 现状 |
| :--- | :--- | :--- | :--- |
| 实现方式 | `@property` + `animation-timeline: scroll()` | 「7 停非线性 mask」 | `@property` + `animation-timeline` |
| 渐隐尺寸 | `--cds-scroll-fade-size: 28px` | 未记录 | 已实现 |
| mask-image | `linear-gradient(#000 0 0)`（纯色占位，由 `@property` 变量控制） | 「7 停 mask」 | 待核对 |

> **⚠️ 需注意**：本文在 3.6556.2 主样式表中只找到 `mask-image:linear-gradient(#000 0 0)` 这一处，**未找到 v2 文档描述的「7 停非线性 mask」原文**。这可能是：
> 1. 该实现已重构为 `@property` 变量驱动
> 2. 该实现位于其它 CSS 文件（如 `window-shared.css`）
> 3. v2 文档的「7 停」描述本身是推断而非取证
>
> 本文**不对「7 停 mask 是否仍然存在」下结论**，标注为 `unknown`，需进一步核对 `window-shared.css` 与运行时计算样式。

---

## 本章证据索引

| 断言 | 证据 |
| :--- | :--- |
| 骨架屏双层 `data-cds` | CSS 选择器 `[data-cds=SkeletonGroup]` / `[data-cds=Skeleton]` 原文 |
| `.cds-skel-sweep-band` 是真实元素 | CSS `.cds-root .cds-skel-sweep-band { … }` 无 `::after` |
| `data-hold` 三态 | 三段 `[data-hold]` / `[data-hold=none]` / `[data-hold=delayed]` 规则 |
| wave 用 breathe 不用 sweep | `.cds-root [data-cds=SkeletonGroup][data-motion=wave] [data-cds=Skeleton] { animation: cds-skeleton-breathe … }` |
| lockstep 挂 Group | `[data-cds=SkeletonGroup][data-motion=lockstep]…` 选择器层级 |
| 90ms 级联 | `calc(var(--cds-skel-reveal-end,0s) + var(--cds-skel-i,0) * 90ms)` |
| RTL 19 个语言 + reverse | `:lang(ae,ar,arc,…)` 完整列表 + `animation-direction:reverse` |
| 减少动效双轨 | `@media (prefers-reduced-motion:reduce)` 与 `[data-reduce-motion=true]` 并列出现 |
| pill 1.32x | `@keyframes cds-pill-pop-up { to { transform: scale(1.32) } }` |
| `@property` 滚动渐隐 17 项 | `@property --cds-scroll-fade-*` 清单（`sort -u \| wc -l` = 17） |
| `scroll-fade-size: 28px` | `.cds-root { --cds-scroll-fade-size: 28px; … }` |

---

# 第四章：系统底座全景解密

> 本章是**完整清单章**。所有清单均由 `grep | sort -u` 直接从 `MainWindowPage-BjVtjJFx.css` 生成，可逐条复现。

---

## 4.1 `@keyframes` 完整 55 项清单

```bash
grep -o "@keyframes [a-zA-Z0-9_-]*" MainWindowPage-BjVtjJFx.css | sed 's/@keyframes //' | sort -u | wc -l
# → 55
```

### 4.1.1 按功能分组

**骨架屏与占位（3）**

```
cds-skeleton-sweep
cds-skeleton-breathe
cds-placeholder-reveal
```

**Pill 胶囊（9）**

```
cds-pill-in
cds-pill-out
cds-pill-pop-up
cds-pill-pop-down
cds-pill-dip-up
cds-pill-dip-down
cds-pill-roll-in-up
cds-pill-roll-in-down
cds-pill-roll-out
```

**滚动渐隐（8）**

```
cds-scroll-fade-top
cds-scroll-fade-bottom
cds-scroll-fade-left
cds-scroll-fade-right
cds-scroll-fade-x-active
cds-scroll-fade-y-active
cds-scroll-fade-strip-active
cds-scroll-fade-strip-in
cds-scroll-fade-strip-out
```

（注：`strip` 系列 3 个，计入后滚动渐隐共 10 个。上一行列出的是全部 10 项。）

**Shimmer 微光（9）**

```
cds-shimmer
cds-shimmer-text-band
cds-shimmer-text-band-rtl
cds-shimmer-text-band-strong
cds-shimmer-text-band-strong-rtl
cds-shimmer-text-shine
cds-shimmer-text-shine-rtl
cds-shimmer-text-shine-strong
cds-shimmer-text-shine-strong-rtl
```

**吸附边缘（3）**

```
cds-sticky-edge-start
cds-sticky-edge-end
cds-sticky-edge-active
```

**工作指示点（3）**

```
cds-working-dot-halo
cds-working-dot-lands
cds-working-dot-veil
```

**进出场通用（4）**

```
cds-fade-in
cds-reveal-in
cds-reveal-out
cds-slide-in-start
cds-slide-in-end
```

（实际 5 个。）

**Drop / Chip / 拖放（3）**

```
cds-chip-in
cds-drop-icon-rise
cds-drop-ring-in
```

**布局与网格（2）**

```
cds-grid-rows-in
cds-morph-in
```

**页面转场（2）**

```
cds-page-tabs-arrive
cds-page-title-leaves
```

**图标解析（2）**

```
cds-resolve-glyph
cds-resolve-square
```

**附件与编辑器（3）**

```
cds-attachment-out
cds-editor-comment-working
cds-flipbook
```

**其它（1）**

```
spin
cds-dot-pulse
```

### 4.1.2 与 open-claude-ui 的差异

```bash
# ours
grep -o "@keyframes [a-zA-Z0-9_-]*" code-examples/cds-theme.css | sort -u | wc -l   # 32

# client
grep -o "@keyframes [a-zA-Z0-9_-]*" MainWindowPage-BjVtjJFx.css | sort -u | wc -l    # 55
```

| 集合 | 数量 | 明细 |
| :--- | ---: | :--- |
| **交集**（双方都有） | **11** | `cds-dot-pulse`、6 个 `cds-scroll-fade-*`、`cds-shimmer-text-shine`、`cds-shimmer-text-shine-strong`、`cds-skeleton-breathe`、`cds-skeleton-sweep` |
| **仅客户端有** | **44** | 见 4.1.1 减去交集的 11 项 |
| **仅我方有** | **21** | 见 4.1.3 |

### 4.1.3 我方独有的 21 个关键帧（客户端中不存在）

```bash
comm -23 <(grep -o "@keyframes [a-zA-Z0-9_-]*" code-examples/cds-theme.css | sed 's/@keyframes //' | sort -u) \
         <(grep -o "@keyframes [a-zA-Z0-9_-]*" MainWindowPage-BjVtjJFx.css | sed 's/@keyframes //' | sort -u)
```

```
_grapheme-reveal_1plog_1
cds-anim-loop
dframe-clay-breathe
dframe-dot-blink
epitaxy-band-exit
epitaxy-check-draw
epitaxy-linear-sweep
epitaxy-linear-sweep-rtl
epitaxy-pill-pulse
file-thumbnail-grow-in
message-fade-up
saved-check-decay
timeline-block-enter
timeline-expand
timeline-fade-in
timeline-fade-out
timeline-quiet-dot
timeline-status-fall
timeline-status-rise
wl-glow
wl-halo
```

**这说明一件重要的事**：`open-claude-ui` 的动效体系中有 **21/32（66%）的关键帧在 3.6556.2 客户端中不存在**。

可能的原因（本文**不推断**具体哪一种）：

1. 这些名字是 v1/v2 时期逆向得到的，3.6556.2 已重命名或移除
2. 这些名字是 `open-claude-ui` 自行命名的抽象（非客户端原名）
3. 这些动效在其它 CSS 文件（如 `window-shared.css`）中

**⚠️ 本文不对上述三种可能做判定**，标注为 `unknown`。需进一步核对：
- `window-shared.css`（8,078 bytes）
- `window-legacy-pins.css`（6,289 bytes）
- 各 renderer 的 `assets/main-*.css`

---

## 4.2 `data-cds` 完整 45 项命名空间清单

```bash
grep -o "\[data-cds=[A-Za-z-]*\]" MainWindowPage-BjVtjJFx.css | sed 's/\[data-cds=//;s/\]//' | sort -u | wc -l
# → 45
```

### 4.2.1 完整清单（字母序）

```
Accordion
AccordionHeader
Aside
AskUserQuestion
AssistantMessage
Banner
Button
ButtonGroup
Card
CardLink
ChartContainer
ChatComposerChin
ChatComposerDock
ChatComposerEditor
ChatComposerNotices
ChatComposerQueuedMessages
CommentCard
DataTable
DiffIndicator
FileDiff
Heatmap
Icon
MessageActions
MessageAttachments
MessageAttachmentsFile
MessageAttachmentsImage
MessageAttachmentsQuote
MessageAttachmentsVideo
ModelSelector
ModelSelectorEffort
Page
Panel
PointChartContainer
PreviewCard
Prose
Pulse
Skeleton
SkeletonGroup
SplitDropdownButton
Surface
Table
Toolbar
TurnStatus
TurnStatusStep
UserMessage
```

### 4.2.2 与 v2 文档的差异

v2 文档声称「40 大标准化 `data-cds` 命名空间」。3.6556.2 实测 **45 个**。

**证据**：
- `docs/v2/01-综述与版本边界.md:29`：「40 大标准化 data-cds 原生命名空间」
- `docs/v2/04-系统底座全景解密.md:32`：「[40 大标准化组件清单]」
- `docs/v2/06-总结与升格意义.md:17`：「扩充并标准化为 **40 大 `data-cds` 顶级命名空间**」
- 实测 `sort -u | wc -l` → **45**

> **⚠️ 无法确定的部分**：v2 的 40 个具体名单未在 v2 文档中逐条列出（04 章只有占位符 `[40 大标准化组件清单]`）。因此**无法给出「哪 5 个是新增」的精确 diff**。本文只确认总数从 40 变为 45。

### 4.2.3 `Skeleton` 与 `SkeletonGroup` 的单复数设计

这是 3.0 独有的**双命名空间**：

| 命名空间 | 职责 |
| :--- | :--- |
| `SkeletonGroup` | 组容器：承载 `data-motion`、`data-hold`，统一控制整组动画 |
| `Skeleton` | 单个骨架块：承载 `--cds-skel-i` 级联索引、扫光子元素 |

**证据**：CSS 中两者作为不同选择器存在

```css
.cds-root [data-cds=SkeletonGroup][data-motion=wave] [data-cds=Skeleton] { … }
```

这一条同时引用 `SkeletonGroup`（祖先）与 `Skeleton`（后代），证明是两层结构。

---

## 4.3 色彩体系

### 4.3.1 35 阶 gray 全表

```bash
grep -o "\--cds-gray-[0-9]*:[^;}]*" MainWindowPage-BjVtjJFx.css | sort -u | wc -l
# → 35
```

| 阶 | 值 | 阶 | 值 |
| :--- | :--- | :--- | :--- |
| `gray-0` | `#fff` | `gray-450` | `#7b7974` |
| `gray-10` | `#fcfcfb` | `gray-500` | `#6d6b67` |
| `gray-20` | `#f9f9f7` | `gray-550` | `#5f5e5a` |
| `gray-30` | `#f6f6f4` | `gray-600` | `#52514e` |
| `gray-40` | `#f3f3f0` | `gray-650` | `#454442` |
| `gray-50` | `#f0efec` | `gray-700` | `#383835` |
| `gray-60` | `#edece8` | `gray-750` | `#2c2c2a` |
| `gray-70` | `#eae9e4` | `gray-800` | `#20201f` |
| `gray-80` | `#e7e6e1` | `gray-810` | `#1e1e1d` |
| `gray-90` | `#e4e3dd` | `gray-820` | `#1c1c1b` |
| `gray-100` | `#e1e0d9` | `gray-830` | `#1a1a19` |
| `gray-150` | `#d2d1c7` | `gray-840` | `#181817` |
| `gray-200` | `#c3c2b7` | `gray-850` | `#151515` |
| `gray-250` | `#b4b3a8` | `gray-860` | `#131313` |
| `gray-300` | `#a5a49a` | `gray-870` | `#111` |
| `gray-350` | `#97958d` | `gray-880` | `#0f0f0f` |
| `gray-400` | `#898781` | `gray-890` | `#0d0d0d` |
| | | `gray-900` | `#0b0b0b` |

### 4.3.2 35 阶 orange 全表

```bash
grep -o "\--cds-orange-[0-9]*:[^;}]*" MainWindowPage-BjVtjJFx.css | sort -u | wc -l
# → 35
```

| 阶 | 值 | 阶 | 值 |
| :--- | :--- | :--- | :--- |
| `orange-0` | `#fff` | `orange-450` | `#c25124` |
| `orange-10` | `#fefbfa` | `orange-500` | `#ae461c` |
| `orange-20` | `#fdf7f5` | `orange-550` | `#993d19` |
| `orange-30` | `#fcf4f0` | `orange-600` | `#863311` |
| `orange-40` | `#faf0ec` | `orange-650` | `#712b0f` |
| `orange-50` | `#f9ece7` | `orange-700` | `#5d230b` |
| `orange-60` | `#f8e9e2` | `orange-750` | `#4b1b08` |
| `orange-70` | `#f7e5dd` | `orange-800` | `#371407` |
| `orange-80` | `#f7e1d7` | `orange-810` | `#341307` |
| `orange-90` | `#f7dcd1` | `orange-820` | `#301106` |
| `orange-100` | `#f7d8cb` | `orange-830` | `#2d1006` |
| `orange-150` | `#f3c5b2` | `orange-840` | `#290f06` |
| `orange-200` | `#f4ae94` | `orange-850` | `#240e07` |
| `orange-250` | `#f09978` | `orange-860` | `#1f0e08` |
| `orange-300` | `#ec835a` | `orange-870` | `#1a0e09` |
| `orange-350` | `#eb6834` | `orange-880` | `#150d0a` |
| `orange-400` | `#d95926` | `orange-890` | `#100c0b` |
| | | `orange-900` | `#0b0b0b` |

### 4.3.3 品牌陶土色：三个来源三个值

| 令牌 | v2 文档 | open-claude-ui | **3.6556.2 实测** |
| :--- | :--- | :--- | :--- |
| `--cds-clay` | `#d97757` | `#d97757` | **`#d97757`** ✅ 三方一致 |
| `--cds-clay-emphasized` | `#cc5a36`（双模同值） | `var(--cds-clay-hover)`（light `#cc5a36` / dark `#e08264`） | **`#c6613f`**（无暗色覆盖） |

**`--cds-clay-emphasized` 的证据**

```bash
grep -c  "\--cds-clay-emphasized:" MainWindowPage-BjVtjJFx.css        # → 2
# 定义位置：偏移 133889（:root 块）与 152242（.cds-root 块），值均为 #c6613f
# 暗色覆盖：0 处（data-mode=dark 块内无此令牌）
grep -o  "\--cds-clay-emphasized:[^;}]*" MainWindowPage-BjVtjJFx.css  # → --cds-clay-emphasized:#c6613f
```

原文上下文（连续令牌，证明不是拼接错误）：

```css
--cds-oncolor-200:#f8f8f7bf;--cds-oncolor-300:#f8f8f780;
--cds-clay:#d97757;--cds-clay-emphasized:#c6613f;
--cds-heather:#cbcadb;--cds-plum:#827db…
```

**关键判定**：`#c6613f` 与 open-claude-ui 仓库 `AGENTS.md` 里记录的 `--brand: #c6613f`（「Official desktop brand primary color」）**完全一致**。

这强烈提示：`#c6613f` 才是官方品牌主色，而 `--cds-clay` 的 `#d97757` 是「指示点/脉冲」用的浅色变体。两者**不是同一个东西**，不应互相派生。

> **⚠️ 本文不对「为什么 v2 文档写 #cc5a36」做溯源**——v2.37337.1 的 CSS 已不在本机，无法比对。

### 4.3.4 其它命名色

```css
--cds-heather: #cbcadb
--cds-plum: #827db…
```

（`plum` 值在截断处，本文不做补全。）

---

## 4.4 模式作用域：`data-mode` 三态

### 4.4.1 三态定义

```bash
grep -o "data-mode=[a-z]*" MainWindowPage-BjVtjJFx.css | sort | uniq -c
```

```
86 data-mode=dark
43 data-mode=system
29 data-mode=light
```

### 4.4.2 三个作用域选择器

CDS 3.0 用**三组并列选择器**实现模式切换：

```css
/* 暗色：显式 data-mode=dark，或祖先暗色且自身未指定 light/system */
[data-mode=dark] .cds-root:not([data-mode=light]):not([data-mode=system]),
.cds-root[data-mode=dark] { … }

/* 系统：data-mode=system 或完全未指定（跟随 prefers-color-scheme） */
[data-mode=system] .cds-root:not([data-mode=light]):not([data-mode=dark]),
.cds-root[data-mode=system],
.cds-root:not([data-mode]):not([data-mode] *) { … }

/* 暗色独立作用域（用于局部强制暗色） */
.cds-dark-scope[data-mode=dark] { … }
```

**与 `.dark` class 的对比**

| 方式 | CDS 3.0 | open-claude-ui |
| :--- | :--- | :--- |
| 暗色选择器 | `[data-mode=dark]` + `.cds-dark-scope[data-mode=dark]` | `.dark` class |
| 系统跟随 | `[data-mode=system]` + `prefers-color-scheme` | 无 |
| 局部强制 | `.cds-dark-scope` | 无 |

### 4.4.3 暗色态的实际覆盖

暗色块内重定义的令牌（抽样证据）：

```css
/* 骨架屏暗色覆盖 */
[data-mode=dark] .cds-root:not([data-mode=light]):not([data-mode=system]),
.cds-root[data-mode=dark] {
  …
  --cds-skeleton-base:  hsl(from var(--cds-neutral-900) h s l / 7.5%);
  --cds-skeleton-sheen: hsl(from var(--cds-neutral-900) h s l / 7.5%);
}
```

**注意**：暗色下 `--cds-skeleton-base` 与 `--cds-skeleton-sheen` **值相同**（都是 7.5% 中性黑）。这与浅色下两者不同（light 见下方 4.4.4）。

### 4.4.4 骨架屏令牌的完整取值链

| 令牌 | 浅色 | 暗色 |
| :--- | :--- | :--- |
| `--cds-skeleton-base` | `var(--cds-alpha-1)` → `hsl(from var(--cds-neutral-900) h s l / 5%)` | `hsl(from var(--cds-neutral-900) h s l / 7.5%)` |
| `--cds-skeleton-sheen` | `var(--cds-alpha-1)` → `hsl(from var(--cds-neutral-900) h s l / 5%)` | `hsl(from var(--cds-neutral-900) h s l / 7.5%)` |

**证据**：

```bash
# 浅色（.cds-root 作用域）
grep -o "\--cds-skeleton-base:var(--cds-alpha-1)" MainWindowPage-BjVtjJFx.css
grep -o "\--cds-alpha-1:[^;}]*" MainWindowPage-BjVtjJFx.css
# → --cds-alpha-1:hsl(from var(--cds-neutral-900) h s l / 5%)

# 暗色（[data-mode=dark] 作用域，3 处：dark / system / cds-dark-scope）
grep -o "\--cds-skeleton-base:hsl(from var(--cds-neutral-900) h s l / 7.5%)" MainWindowPage-BjVtjJFx.css
```

**与 v2 文档 / 分支的差异**

| 来源 | base（暗） | sheen（暗） |
| :--- | :--- | :--- |
| v2 文档 | 未记录 | 未记录 |
| issue #25 分支 | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.08)` |
| **3.6556.2 实测** | `hsl(from var(--cds-neutral-900) h s l / 7.5%)` | 同左（**与 base 相同**） |

**两个实质差异**：
1. 分支用**白色半透明**（`rgba(255,255,255,…)`），实测用**中性黑半透明**（`hsl(from …neutral-900… / 7.5%)`）
2. 分支的 sheen 比 base 更亮（0.08 > 0.06），实测两者**完全相同**

在暗色背景下，用 `neutral-900`（= `gray-900` = `#0b0b0b`）的 7.5% 叠在深色表面上，效果是**极淡的加深**，而不是分支实现的**提亮**。这是完全相反的视觉方向。

---

## 4.5 `@property` 24 项注册清单

```bash
grep -o "@property --cds-[a-zA-Z0-9_-]*" MainWindowPage-BjVtjJFx.css | sed 's/@property //' | sort -u | wc -l
# → 24
```

### 4.5.1 完整清单

**滚动渐隐（17）**

```
--cds-scroll-fade-top
--cds-scroll-fade-top-on
--cds-scroll-fade-top-raw
--cds-scroll-fade-bottom
--cds-scroll-fade-bottom-on
--cds-scroll-fade-bottom-raw
--cds-scroll-fade-left
--cds-scroll-fade-left-on
--cds-scroll-fade-left-raw
--cds-scroll-fade-right
--cds-scroll-fade-right-on
--cds-scroll-fade-right-raw
--cds-scroll-fade-size
--cds-scroll-fade-x-active
--cds-scroll-fade-y-active
--cds-scroll-fade-strip-active
--cds-scroll-fade-strip-raw
```

**吸附边缘（3）**

```
--cds-sticky-edge-active
--cds-sticky-edge-start
--cds-sticky-edge-end
```

**其它（4）**

```
--cds-badge-x-wght
--cds-message-actions-opacity
--cds-outset-x
--cds-outset-y
```

### 4.5.2 与 open-claude-ui 的差异

```bash
# ours: 19
grep -o "@property --cds-[a-zA-Z0-9_-]*" code-examples/cds-theme.css | sort -u | wc -l

# client: 24
grep -o "@property --cds-[a-zA-Z0-9_-]*" MainWindowPage-BjVtjJFx.css | sort -u | wc -l
```

**交集 17 / 仅客户端 7 / 仅我方 2**：

```bash
comm -12 <(grep -o "@property --cds-[a-zA-Z0-9_-]*" code-examples/cds-theme.css | sed 's/@property //' | sort -u) \
         <(grep -o "@property --cds-[a-zA-Z0-9_-]*" MainWindowPage-BjVtjJFx.css | sed 's/@property //' | sort -u) | wc -l
# → 17
comm -13 … | wc -l   # → 7
comm -23 … | wc -l   # → 2
```

**缺失的 7 个**：

```
--cds-badge-x-wght
--cds-message-actions-opacity
--cds-outset-x
--cds-outset-y
--cds-sticky-edge-active
--cds-sticky-edge-end
--cds-sticky-edge-start
```

**我方独有的 2 个**（客户端中不存在）：

```
--cds-anim
--cds-anim2
```

这两个是 v2 时代的动画控制变量（配合 `@keyframes cds-anim-loop` 与 `[data-cds-anim]` 使用），在 3.6556.2 主样式表中**未注册为 `@property`**。

> *（集合运算自洽校验：ours = 交集 17 + 我方独有 2 = 19；client = 交集 17 + 我方缺失 7 = 24。）*

---

## 4.6 时间与缓动 Token

### 4.6.1 5 阶时间矩阵

```css
--cds-dur-fast:  60ms
--cds-dur-snap:  .12s   /* 120ms */
--cds-dur-base:  .2s    /* 200ms */
--cds-dur-sheet: .3s    /* 300ms */
--cds-dur-slow:  .45s   /* 450ms */
```

**证据**：

```bash
python3 -c "
import re; s=open('MainWindowPage-BjVtjJFx.css').read()
d={}
for m in re.finditer(r'--cds-dur-([a-z]+):([^;}]+)', s): d.setdefault(m.group(1),set()).add(m.group(2).strip())
for k,v in sorted(d.items()): print(k, sorted(v))
"
# base: ['.2s']  fast: ['60ms']  sheet: ['.3s']  slow: ['.45s']  snap: ['.12s']
```

这与 v2 文档的「5 阶时间 Token 矩阵 (60ms ~ 450ms)」**完全吻合**。

### 4.6.2 缓动曲线

```css
--cds-ease-out:       cubic-bezier(.165, .84, .44, 1)
--cds-ease-outs:      cubic-bezier(0, 0, .2, 1)      /* 注意：同名 token 两个值 */
--cds-ease-overshoot: cubic-bezier(.34, 1.3, .64, 1)   /* +30% 过冲 */
--cds-ease-snap:      cubic-bezier(.32, .72, 0, 1)
```

**证据**：

```bash
python3 -c "
import re; s=open('MainWindowPage-BjVtjJFx.css').read()
e={}
for m in re.finditer(r'--cds-ease-([a-z]+):([^;}]+)', s): e.setdefault(m.group(1),set()).add(m.group(2).strip())
for k,v in sorted(e.items()): print(k, sorted(v))
"
# out: ['cubic-bezier(.165, .84, .44, 1)', 'cubic-bezier(0, 0, .2, 1)']
# overshoot: ['cubic-bezier(.34, 1.3, .64, 1)']
# snap: ['cubic-bezier(.32, .72, 0, 1)']
```

**注意 `--cds-ease-out` 有两个不同值**，说明它在不同作用域（可能是浅色/暗色，或不同的祖先作用域）被重定义。本文**不推断重定义的边界**。

**v2 文档声称「3 大核心贝塞尔曲线」**，实测有 **4 个不同的曲线值**（out 2 个 + overshoot + snap）。

### 4.6.3 `linear()` 弹簧曲线

本文**未在主样式表中找到** `linear()` 弹簧曲线定义。v2 文档 4.4 节提到「`linear()` 弹簧曲线与时长 Token 的耦合失效」，但 3.6556.2 主表中：

```bash
grep -c "linear(" MainWindowPage-BjVtjJFx.css
```

需要单独核实（见 4.6.4 的不确定项）。

> **⚠️ 本文不对 `linear()` 弹簧的存在性下结论**。这是一个待核实项。

---

## 4.7 圆角与密度系统

### 4.7.1 圆角 Token

```css
--cds-radius--xs:         calc(.3125rem * var(--cds-rem-scale,1))   /* 5px */
--cds-radius--sm:         calc(.4375rem * var(--cds-rem-scale,1))   /* 7px */
--cds-radius--lg:         calc(.625rem  * var(--cds-rem-scale,1))   /* 10px */
--cds-radius-composer:    calc(.75rem   * var(--cds-rem-scale,1))   /* 12px */
```

**还有一组更大的值**（同一 token 名的另一处定义）：

```css
--cds-radius--xs:         calc(.375rem  * var(--cds-rem-scale,1))   /* 6px */
--cds-radius--sm:         calc(.3125rem * var(--cds-rem-scale,1))   /* 5px */
--cds-radius--lg:         calc(.4375rem * var(--cds-rem-scale,1))   /* 7px */
--cds-radius-composer:    calc(.875rem  * var(--cds-rem-scale,1))   /* 14px */
```

**证据**：

```bash
python3 -c "
import re; s=open('MainWindowPage-BjVtjJFx.css').read()
for name in ['--cds-radius--xs','--cds-radius--sm','--cds-radius--lg','--cds-radius-composer']:
    print(name, sorted(set(re.findall(re.escape(name)+r':[^;}]*', s))))
"
```

### 4.7.2 两套圆角 = 密度双模

`--cds-radius-composer` 有两个值：`12px` 与 `14px`。

这与 v2 文档「Composer 圆角由 20px 降为 12px/14px、引入 Density 系统」**吻合**。

`--cds-rem-scale` 是密度缩放因子，圆角全部乘以它。

**⚠️ 本文未能确定两套值的切换条件**（哪个选择器/属性触发 12px vs 14px）。这是一个待核实项。

### 4.7.3 `--cds-radius` 的间接层

```css
--cds-radius: inherit
--cds-radius: .25rem                          /* 4px，可能是 fallback */
--cds-radius: var(--cds-radius--xs)
--cds-radius: var(--cds-radius--sm)
--cds-radius: var(--cds-radius--lg)
--cds-radius: calc(.3125rem * var(--cds-rem-scale,1))
--cds-radius: calc(.375rem  * var(--cds-rem-scale,1))
--cds-radius: calc(.4375rem * var(--cds-rem-scale,1))
--cds-radius: calc(.5rem    * var(--cds-rem-scale,1))
--cds-radius: calc(.625rem  * var(--cds-rem-scale,1))
```

**含义**：`--cds-radius` 是一个**上下文相关的别名**，实际值取决于它所在的组件作用域（`inherit` / xs / sm / lg）。这是 CDS 3.0 的「同心圆角」实现方式。

---

## 本章证据索引

| 断言 | 命令 |
| :--- | :--- |
| keyframes 55 | `grep -o "@keyframes [a-zA-Z0-9_-]*" ... \| sort -u \| wc -l` |
| data-cds 45 | `grep -o "\[data-cds=[A-Za-z-]*\]" ... \| sort -u \| wc -l` |
| @property 24 | `grep -o "@property --cds-[a-zA-Z0-9_-]*" ... \| sort -u \| wc -l` |
| gray 35 阶 | `grep -o "\--cds-gray-[0-9]*:" ... \| sort -u \| wc -l` |
| orange 35 阶 | 同上 |
| clay-emphasized 2 处同值、0 处暗色覆盖 | `grep -c` + 偏移定位 + 暗色块内搜索 |
| data-mode 三态计数 | `grep -o "data-mode=[a-z]*" ... \| sort \| uniq -c` |
| 5 阶 dur | python 正则提取后按 key 去重 |
| 4 个 ease 值 | 同上 |
| 圆角双套 | 同 token 名多值提取 |
| 交集/差异 | `comm -12 / -13 / -23` |

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

---

# 第七章：总结与后续工作

## 7.1 本次取证的确定性边界

### 7.1.1 确定性等级划分

本文所有结论按证据强度分为三级：

| 等级 | 定义 | 本文中的例子 |
| :--- | :--- | :--- |
| **A 级：字节确证** | 直接从 ASAR 内文件读出，可逐字复现 | 55 个 keyframes、45 个 data-cds、24 个 @property、`clay-emphasized = #c6613f`、6 个 `ipcMain.on` 通道名、12 个 `exposeInMainWorld` 字面量 |
| **B 级：结构性推断** | 由多条 A 级证据交叉推出，逻辑闭环 | 「主进程无业务 IPC handler」「preload 路径静态不可解」「wave 用 breathe 不用 sweep」 |
| **C 级：未知** | 已明示无法确定，不填 | 「7 个 renderer 入口中 2 个如何打开」「`--cds-skel-elapsed` 运行时由谁写入」「44 个缺失 keyframes 是否在其它 CSS 文件」 |

### 7.1.2 本文未使用的推断方式

为避免虚构，本文**刻意回避**了以下三种常见但不可靠的做法：

1. **不基于 naming 推断行为**：例如 `cds-pill-roll-out` 的命名暗示「滚出」，但本文只记录关键帧数值，不描述其触发条件与视觉轨迹
2. **不基于 v2 文档补全 v3**：v2 的基线已失效（见 [第一章](01-综述与版本边界.md)），其结论不能直接继承
3. **不基于「合理推测」填零值**：例如 `utility_processes = 1` 与本文实测的「0 个 fork 调用点」冲突时，本文标注为 `unknown` 而非二选一

---

## 7.2 已完成的结论清单

### 7.2.1 版本与取证基础

| 结论 | 等级 | 位置 |
| :--- | :--- | :--- |
| Claude Desktop 版本为 `3.6556.2` | A | [1.1.1](01-综述与版本边界.md) |
| ASAR 根摘要 `b2dfbbb4…d68a` | A | [1.1.2](01-综述与版本边界.md) |
| v2 引用的 `MainWindowPage-BD9CWQ83.css` 与 `index.chunk-BWk6pVUt.js` 已不存在 | A | [README](README.md) |
| 532 个文件语义分析被截断 | A | [1.2](01-综述与版本边界.md) |

### 7.2.2 Electron 架构

| 结论 | 等级 | 位置 |
| :--- | :--- | :--- |
| 主进程 0 个 `ipcMain.handle`，仅 6 个 `ipcMain.on` | A | [2.1.1](02-Electron架构取证.md) |
| 这 6 个通道属于 Sentry SDK（`start`/`scope`/`envelope`/`structured-log`/`metric`/`status`） | B | [2.1.1](02-Electron架构取证.md) |
| 主进程 0 个 `new BrowserWindow` | A | [2.1.2](02-Electron架构取证.md) |
| `utilityProcess` 3 处均为 Proxy 包装，无 fork 调用点 | B | [2.1.3](02-Electron架构取证.md) |
| preload 入口 0 个，路径由 `registerPreloadScript` 运行时拼接 | B | [2.1.4](02-Electron架构取证.md) |
| 12 个字面量 `exposeInMainWorld` API 名 | A | [2.2.2](02-Electron架构取证.md) |
| 7 个 renderer HTML 入口 | A | [2.3](02-Electron架构取证.md) |
| 8 处 ASAR 完整性冲突 | A | [2.4](02-Electron架构取证.md) |

### 7.2.3 设计系统底座

| 结论 | 等级 | 位置 |
| :--- | :--- | :--- |
| 55 个 `@keyframes` | A | [4.1](04-系统底座全景解密.md) |
| 45 个 `data-cds` 命名空间 | A | [4.2](04-系统底座全景解密.md) |
| 24 个 `@property` | A | [4.5](04-系统底座全景解密.md) |
| 35 阶 gray / 35 阶 orange 全表 | A | [4.3](04-系统底座全景解密.md) |
| `--cds-clay-emphasized: #c6613f`（2 处同值，0 处暗色覆盖） | A | [4.3.3](04-系统底座全景解密.md) |
| 骨架屏暗色 base/sheen 均为 `hsl(from neutral-900 / 7.5%)` | A | [4.4.4](04-系统底座全景解密.md) |
| `data-mode` 三态（dark 86 / system 43 / light 29 处） | A | [4.4](04-系统底座全景解密.md) |
| 5 阶时间 token（60ms / 120ms / 200ms / 300ms / 450ms） | A | [4.6.1](04-系统底座全景解密.md) |
| 4 个 ease 曲线值（out×2 + overshoot + snap） | A | [4.6.2](04-系统底座全景解密.md) |

### 7.2.4 骨架屏机制（issue #25 的核心）

| 结论 | 等级 | 位置 |
| :--- | :--- | :--- |
| 扫光参数 `2s / linear / 105deg` 成立 | A | [5.1.3](05-open-claude-ui差异审计.md) |
| 双层结构 `SkeletonGroup` + `Skeleton` | A | [3.1.1](03-架构重构与对比分析.md) |
| 扫光带是 `.cds-skel-sweep-band` 真实元素，非 `::after` | A | [3.1.1](03-架构重构与对比分析.md) |
| `data-hold` 三态机制 | A | [3.2](03-架构重构与对比分析.md) |
| wave 用 `cds-skeleton-breathe`，不是 sweep | A | [3.3.1](03-架构重构与对比分析.md) |
| RTL 需 `animation-direction: reverse` | A | [3.4](03-架构重构与对比分析.md) |
| 减少动效双轨（`@media` + `[data-reduce-motion]`） | A | [3.5](03-架构重构与对比分析.md) |
| 揭示完成后动画压至 `.01ms` 并 `display:none` 扫光带 | A | [3.2.4](03-架构重构与对比分析.md) |

### 7.2.5 open-claude-ui 差异

| 结论 | 等级 | 位置 |
| :--- | :--- | :--- |
| gray 35 阶 diff=1（`#111111` vs `#111`，值等价） | A | [5.1.1](05-open-claude-ui差异审计.md) |
| orange 35 阶 diff=0 | A | [5.1.1](05-open-claude-ui差异审计.md) |
| keyframes：交集 11 / 缺失 44 / 独有 21 | A | [4.1.2](04-系统底座全景解密.md) |
| data-cds：交集 18 / 缺失 27 / 独有 4 | A | [5.3.2](05-open-claude-ui差异审计.md) |
| @property：交集 17 / 缺失 7 / 独有 2 | A | [5.3.3](05-open-claude-ui差异审计.md) |
| CI 门禁未剥离注释，存在漏报 | A | [5.4](05-open-claude-ui差异审计.md) |
| ASAR 顶层含 compile-cache / bundled-skills / github-mcp / office365-mcp | A | [6.10.1](06-全量CSS扫描与官方规范比对.md) |
| 内置 6 个 Agent Skills（含 frontend-design） | A | [6.10.3](06-全量CSS扫描与官方规范比对.md) |
| 官方 skill 原文确认 `#D97757` 为 "Anthropic's own Claude-interaction accent" | A | [6.10.4](06-全量CSS扫描与官方规范比对.md) |
| Cowork 体系内置 Linux micro-VM（smol-bin 24MB） | A | [6.10.5](06-全量CSS扫描与官方规范比对.md) |
| 内置 4 个 MCP server（github / office365 / computer-use / chrome） | A | [6.10.6](06-全量CSS扫描与官方规范比对.md) |
| `@starting-style` + `view-transition-name: match-element` 用于附件重排 | A | [6.10.8](06-全量CSS扫描与官方规范比对.md) |

---

## 7.3 明确的未知项

以下各项本文**无法确定**，列出原因与可用的进一步手段。

### 7.3.1 已全部解决

原列的两项「需运行时观测」已通过 Claude 自带的 **Enable Main Process Debugger** 取得运行时事实（见 [6.7](06-全量CSS扫描与官方规范比对.md)）。

### 7.3.1.1 已在第六章解决

以下项原本列在未知清单中，第六章完成后已给出确定答案：

| 原未知项 | 结论 | 证据位置 |
| :--- | :--- | :--- |
| 44 个缺失 keyframes 是否在其它 CSS 文件 | **不在**。全部 44 项仅存在于主样式表；其余 16 个文件只多出 4 个非 `cds-*` 关键帧 | [6.2](06-全量CSS扫描与官方规范比对.md) |
| `--cds-*` 与官方 token 的关系 | `--cds-X` ≡ 官方 `--X`，131 个同名 | [6.5](06-全量CSS扫描与官方规范比对.md) |
| `--cds-radius-composer` 官方值 | **14px**（`calc(.875rem * scale)`），我们的 20px 是 v1 遗留；切换条件为 `[data-density=comfortable]` | [6.6.2](06-全量CSS扫描与官方规范比对.md) |
| `--cds-h-control-nested` 官方值 | **22px**（`calc(1.375rem * scale)`），v2 文档正确，我们错 | [6.8.1](06-全量CSS扫描与官方规范比对.md) |
| `--cds-gap-xl` 官方值 | **40px**（`calc(2.5rem * scale)`） | [6.8.2](06-全量CSS扫描与官方规范比对.md) |
| `--cds-skel-elapsed` / `skel-settled` 由谁写入 | **没有代码写入**。551 个 JS 文件中 `SkeletonGroup` 零出现，恒为 `0s`；`reveal-end` 恒为 `0.65s` | [6.6](06-全量CSS扫描与官方规范比对.md) |
| 「7 停非线性 mask」是否存在 | **不存在**。全文 6 停以上 gradient 为 0 | [6.6.3](06-全量CSS扫描与官方规范比对.md) |
| `--cds-rem-scale` 的实际取值 | **从未被赋值**，306 处引用全部走 fallback `1` | [6.6.1](06-全量CSS扫描与官方规范比对.md) |
| `registerPreloadScript` 的 `filePath` 实际值 | **`.vite/build/mainWindow.js`**（主窗口）与 **`.vite/build/mainView.js`**（about:blank）。preload 就是窗口脚本本身 | [6.7.2](06-全量CSS扫描与官方规范比对.md) |
| `utilityProcess.fork` 的实际调用点 | 运行时钩子零命中。实测 3 个 Utility 全为 Chromium 内置（Network / Audio / VideoCapture），**应用层未 fork 任何 utility process** | [6.7.4](06-全量CSS扫描与官方规范比对.md) |
| preload 注册的实际 API | session 级 `registerPreloadScript`，但 `getPreloadScripts()` 返回 `[]`；实际走 `webPreferences.preload` | [6.7.3](06-全量CSS扫描与官方规范比对.md) |

### 7.3.2 需要历史版本

| 未知项 | 原因 |
| :--- | :--- |
| v2.37337.1 的 CSS 实际内容 | 本机无该版本备份，无法比对「#cc5a36 从何而来」 |
| v2 的 40 个 `data-cds` 具体名单 | v2 文档只写总数，04 章是占位符 `[40 大标准化组件清单]` |
| 「7 停非线性 mask」是否真实存在过 | 3.6556.2 主表中未找到；无法确认是重构还是 v2 文档的推断 |

### 7.3.2.1 第六章 6.10 新增的待验证项

| 未知项 | 原因 | 可行手段 |
| :--- | :--- | :--- |
| Cowork surface 的 UI 载体是本地 CSS 还是 claude.ai Web | 45 个 `data-cds` 中无 Cowork 专属组件 | 运行时打开 Cowork 界面后用 CDP 检查 DOM |
| `heavy-work-worker` / `pty-host` / `file-index-worker` 是 `worker_threads` 还是 `utilityProcess` | 本会话未触发 | 运行时触发后看进程树 |
| `clawdQuestEngine`（游戏化）的数据来源与 UI 触发点 | 仅静态扫描 | 同上 |
| `smol-bin` VM 的最小规格（内存/CPU 配置） | 代码中有 `vmCpuCount`/`memory GB` 逻辑但未运行 | Cowork 启动 VM 时观测 |

### 7.3.3 需要组件源码

| 未知项 | 原因 |
| :--- | :--- |
| `open-claude-ui` 独有的 21 个 keyframes 来源 | 需确认是 v1/v2 逆向残留，还是自行命名 |
| `open-claude-ui` 独有的 4 个 data-cds（`CodeBlock`/`ConfirmationDialog`/`ContextMenu`/`Toast`） | 同上 |

---

## 7.4 建议的后续工作

### 7.4.1 对 open-claude-ui 仓库

**第一优先（P0，4 项）**

1. 修复 `.cds-skeleton-sweep` 独立类把元素移出视口
2. 修正 `--cds-clay-emphasized` 为 `#c6613f`
3. 修正骨架屏暗色 base/sheen 为 `hsl(from var(--cds-neutral-900) h s l / 7.5%)`
4. 修正 CI 门禁在判断消费前剥离注释

**第二优先（P1，3 项）**

5. 补 RTL 的 `animation-direction: reverse`
6. 实现 `data-hold` 三态揭示时序
7. 修正 wave 模式用 `cds-skeleton-breathe` 而非 sweep

**第三优先（P2，3 项）**

8. 补 `cds-placeholder-reveal` 关键帧
9. 补 9 个 `cds-pill-*` 关键帧
10. 用 `:where()` 降低 `.cds-skeleton` 的 `border-radius` 特异性

详见 [5.5 修复优先级总表](05-open-claude-ui差异审计.md)。

### 7.4.2 文档层面

**v2 文档处理**

建议在 `docs/v2/` 各文件的 frontmatter 增加：

```yaml
status: historical
superseded_by: "docs/v3/"
verified_against: "2026-10-15"
```

**不要**在 v2 里补充 3.6556.2 的数字——基线已不同，混写会产生新的错误。

**v1 文档**

`docs/v1/` 同样引用了 `2.37337.1`（共 16 个文件 36 处），需做同样处理。

### 7.4.3 对 REA 工具

本次取证暴露 REA 6.8.0 的三个问题：

**问题 1：`--source-path` 在 inventory 部分失效时不可用**

```bash
rea analyze-javascript-application app.asar --source-path ".vite/build/index.pre.js"
→ invalid_value: "Select an exact relevant file path from the artifact inventory"
```

但从 REA 自己的 `asar-entry` 节点取出的路径就是 `.vite/build/index.pre.js`。

**原因**（源码 `src/artifacts/javascript/JavaScriptArtifactFiles.ts:104`）：

```ts
const issues = (sourcePaths ?? []).flatMap((path, index) =>
  expected.has(path) || inventory.unavailableFiles.has(path) ? [] : [...]
);
```

`expected` 来自**本次运行的 inventory**。当 inventory 因预算截断而不完整时，选中的路径恰好落在失效部分，导致定向补全这条恢复路径被完全切断。

**问题 2：`utility_processes` 与 `resolved_utility_entrypoints` 语义冲突**

```
summary.utility_processes            = 1
summary.resolved_utility_entrypoints = 0
```

实测代码中 `utilityProcess` 仅 3 处，全部是对 `fork` 的 Proxy 包装，无实际调用点。两个字段并列时读者会误以为「有 1 个 utility process 但入口未知」，而实际可能是「Proxy 包装被计数了」。

**问题 3：`context_bridge_apis` 的口径不明确**

同一份取证中：

| 位置 | 数值 |
| :--- | ---: |
| `summary.context_bridge_apis` | 37 |
| graph `context-bridge-api` 节点数 | 20 |
| graph 唯一 label 数 | 7 |
| 本文字节扫描的 `exposeInMainWorld` 字面量 | 12 |

四个数字都对，但口径不同且未在文档中说明。

### 7.4.4 下一步技术验证

若要继续深入，建议按以下顺序：

| 步骤 | 目标 | 手段 |
| :--- | :--- | :--- |
| 1 | 确认 44 个缺失 keyframes 是否在其它 CSS | 扫全部 17 个 CSS 文件 |
| 2 | 确认 `data-mode` 的完整覆盖范围 | 扫 4 个 `window-*.css` |
| 3 | 确认运行时注入的 `--cds-skel-*` | Electron + CDP |
| 4 | 确认 preload 实际路径 | Electron 主进程 --inspect |
| 5 | 重跑被截断的 532 个文件 | 待 REA 修复 `--source-path`，或分批分析 |

---

## 7.5 本文的可复现性声明

本文所有 A 级结论都可通过以下三条命令的任意组合复现：

```bash
# 1. 确认版本与摘要
shasum -a 256 "/Applications/Claude.app/Contents/Resources/app.asar"

# 2. 抽取主样式表（ASAR header: uint32LE@12 = JSON 长度，JSON 从偏移 16 开始）
node -e '
const fs=require("fs");
const p="/Applications/Claude.app/Contents/Resources/app.asar";
const fd=fs.openSync(p,"r");
const h=Buffer.alloc(16); fs.readSync(fd,h,0,16,0);
const hs=h.readUInt32LE(12);
const jb=Buffer.alloc(hs); fs.readSync(fd,jb,0,hs,16);
const J=JSON.parse(jb.toString("utf8"));
const n=J.files[".vite"].files.renderer.files.main_window.files.assets.files["MainWindowPage-BjVtjJFx.css"];
const b=Buffer.alloc(n.size); fs.readSync(fd,b,0,n.size,16+hs+Number(n.offset));
fs.writeFileSync("/tmp/MainWindowPage.css", b);
'

# 3. 验证任意一条清单
grep -o "@keyframes [a-zA-Z0-9_-]*" /tmp/MainWindowPage.css | sort -u | wc -l    # 55
grep -o "\[data-cds=[A-Za-z-]*\]" /tmp/MainWindowPage.css | sort -u | wc -l      # 45
grep -o "@property --cds-[a-zA-Z0-9_-]*" /tmp/MainWindowPage.css | sort -u | wc -l  # 24
grep -c "\--cds-clay-emphasized:" /tmp/MainWindowPage.css                        # 1
```

**若 Claude Desktop 升级**，`MainWindowPage-*.css` 的文件名 hash 会变化，上述路径需按 ASAR 目录树重新定位。ASAR 根摘要也会变化，本文所有结论需重新验证。

---

## 本章证据索引

本文为总结章，不引入新事实。所有断言均指向前述章节，前述章节各自带有代码证据。

---

