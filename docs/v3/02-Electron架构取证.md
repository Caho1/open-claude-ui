---
title: "第二章：Electron 架构取证"
category: reverse-engineering
domain: architecture/desktop_application
version: "3.0 (3.6556.2)"
status: stable
date: 2026-10-26
author: "REA 逆向工程实验室"
evidence_root: "b2dfbbb40325d978dcb7561ad12a6f9bc199f8f46b7d3d2897af74ce8965d68a"
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

**结论**：`preload_entrypoints = 0` **成立**，且原因是结构性的——preload 路径在运行时从 `registerPreloadScript` 的参数得到，打包后不做静态保留。

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
