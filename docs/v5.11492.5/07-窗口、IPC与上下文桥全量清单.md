---
title: 窗口、IPC 与上下文桥全量清单
part: 7
category: 宿主架构
domain: 进程与通信
---

<p align="center"><a href="06-设计系统技能与复刻工程.md">← 第六篇</a> · <a href="README.md">📚 本卷索引</a></p>

# 第七篇：窗口、IPC 与上下文桥全量清单

> **技术领域与英文指代**：窗口工厂（window factory）、视图容器（`WebContentsView`）、网页偏好（`webPreferences`）、进程间通信（IPC）、上下文桥（`contextBridge`）、传输端口（transport port）、fuse 保险丝、源映射（source map）、端点声明（endpoint declaration）。

本篇是对 **5.11492.5 `app.asar` 的整包静态图谱**（Craft Anything `js_app_map`，779 个源文件）的解读。它取代前几篇里靠字符串计数得到的近似值，给出可枚举的窗口、通道与桥接口清单。

---

## 7.1 方法与证据边界

| 项 | 值 |
| :--- | :--- |
| 工具 | Craft Anything `js_app_map`（内置解析器，不执行任何代码） |
| 目标 | `app.asar`，88,833,670 B，SHA-256 `2c515441…0479e` |
| 证据 | `ev_01432a4f319ecf6c471397de0a4fcbd1199d2ec54e31ec9f7663d2b999cdddee` |
| 源文件 | **779** |
| 打包器 | browserify / esbuild / tsc / vite / webpack（多段产物并存） |
| 图规模 | 25,000 节点上限内，**189,621 个节点被截断** |

**工具自己声明的四条限制**（原文要点，复刻时必须知道）：

1. `1803` 个 IPC 调用点的通道名是**运行时拼出来的**，不在通道图里。
2. 静态读取看不到 `eval`、计算型 `require`、远程内容。
3. IPC 配对需要字面通道名，否则只算单侧。
4. 源映射全部缺失（见 7.6），无法回溯原始源码。

> **与 4.x 卷的差异**：4.x 的"9229 活体只读观测"在本版**不可用**（见 7.5 的 fuse 证据），因此本卷全部结论为**静态推导**，`confidence: derived`。

---

## 7.2 34 处窗口 / 视图构造

`BrowserWindow` **18** 处、`WebContentsView` **16** 处，分布在主进程约 12 个模块里。

### 载入本地渲染层的窗口

| 载入 URL | preload | 对应窗口 |
| :--- | :--- | :--- |
| `.vite/renderer/config_template_window/configTemplate.html` | `.vite/build/configTemplateWindow.js` | 配置模板 |
| `.vite/renderer/buddy_window/buddy.html` | `.vite/build/buddy.js` | Buddy 设备配对 |
| `.vite/renderer/quick_window/quick-window.html` | `.vite/build/quickWindow.js` | 快捷输入窗 |
| `.vite/renderer/about_window/about.html` | `.vite/build/aboutWindow.js` | 关于窗 |
| `.vite/renderer/local_exec_consent/localExecConsent.html` | —（无 preload） | 本地执行授权 |
| `app://localhost/setup-desktop-3p` | `.vite/build/mainView.js` | 第三方桌面接入（**自定义协议 `app://`**） |

另有 6 处 `loads: ["about:blank"]`（空白承载窗，运行时再导航），其余窗口 `loads: []`（URL 由运行时决定）。

### preload 使用分布

| preload | 次数 | 用途 |
| :--- | ---: | :--- |
| `mainView.js` | 2 | 主视图 + 第三方接入窗 |
| `configTemplateWindow.js` / `buddy.js` / `quickWindow.js` / `aboutWindow.js` / `designWindow.js` / `artifactShell.js` / `mcpAppView.js` | 各 1 | 专用窗 |

> **注意 `mainView.js` 出现两次**：主窗口与 `app://localhost/setup-desktop-3p` 共用同一套桥接口，这是"桌面内嵌第三方页面"的最小暴露面设计。

### 静态可读的 `webPreferences`（16 处）

| 键 | 值 | 出现次数 |
| :--- | :--- | ---: |
| `sandbox` | `true` | 16 |
| `contextIsolation` | `true` | 16 |
| `nodeIntegration` | `false` | 16 |
| `focusOnNavigation` | `false` | 5 |
| `disableDialogs` | `true` | 4 |
| `spellcheck` | `false` | 4 |
| `backgroundThrottling` | `false` | 3 |
| `webviewTag` | `false` | 2 |
| `nodeIntegrationInSubFrames` | `false` | 1 |
| `enablePreferredSizeMode` | `true` | 1 |
| `images` / `javascript` / `webgl` | `false` / `false` / `false` | 1（同一条） |
| `devTools` | `false` | 1 |
| `partition` | `"cu-overlay"` | 1 |

其余 18 处的 `webPreferences` 是**运行时计算**的（工具标注 `"webPreferences": "dynamic"`），静态不可读——这是本卷明确的未知项。

> **三个特殊视图值得复刻时注意**：
> 1. `images:false, javascript:false, webgl:false` 的 `WebContentsView` —— 只用于取内容/排版，不执行脚本，是最强的沙箱档；
> 2. `devTools:false` + `spellcheck:false` + `webviewTag:false` 的视图 —— 面向不可信内容；
> 3. `partition:"cu-overlay"` 的 `about:blank` 窗 —— computer-use 覆盖层使用**独立会话分区**，与主会话的 cookie/存储隔离。

---

### 本地 8 个渲染窗口的 CDS 覆盖（补检）

对 `.vite/renderer/` 下 8 个窗口目录逐个检索 `--cds-` 与 `data-cds=`：

| 窗口 | 含 `--cds-` 的文件 | `data-cds=` 出现次数 | 结论 |
| :--- | ---: | ---: | :--- |
| `main_window` | 1 | 303 | CDS 基准窗口 |
| `about_window` | 2 | 303 | 基于 CDS |
| `buddy_window` | 2 | 303 | 基于 CDS |
| `quick_window` | 2 | 303 | 基于 CDS |
| `config_template_window` | 7 | 317 | 基于 CDS（自有组件更多） |
| `find_in_page` | 7 | 317 | 基于 CDS |
| `file_viewer` | 0 | 0 | **不用 CDS**（独立样式） |
| `local_exec_consent` | 0 | 0 | **不用 CDS**（独立样式） |

> **含义**：CDS 不是“只给主窗口用的设计系统”，它是 6 个本地窗口的共用底层；只有文件查看器与本地执行授权窗例外。后两者是纯功能性小窗，复刻时不必强行套令牌。

---

## 7.3 IPC 传输协议：102 个通道、19 个接口

### 通道命名

主通道由代码生成，形如：

```
$eipc_message$_<transport-uuid>_$_<namespace>_$_<Interface>_$_<method>
```

| transport uuid | 覆盖 |
| :--- | :--- |
| `d063083e-d780-4836-89a4-59ba1b156bb8` | `claude.*` 全部业务接口（88 条） |
| `fcb91d11-972d-4fd6-b90b-72739699bff5` | `electron_window.WindowManager`（7 条） |

> **这是 `@loc/electron-window` 的生成式 IPC**：uuid 在打包时固定，用于隔离不同传输实例；`_$_` 是分隔符。前几篇把 `MainWindowTitleBar_$_titleBarReady` 当作"窗口级命名规范"是**不完整**的——完整形态还包含 uuid 与命名空间段。

### 19 个接口 / 95 个方法（全量）

| 方法数 | 命名空间 · 接口 | 方法 |
| ---: | :--- | :--- |
| 14 | `claude.buddy` · `Buddy` | cancelScan, deviceStatus, forgetDevice, install, pairDevice, pairingPrompt, pickDevice, pickFolder, preview, progress, scanDevices, setName, status, submitPin |
| 11 | `claude.internal.sableOtter` · `SableOtterHud` | button, escape, fieldChanged, levels, paste, removePill, render, resize, settings, submit, tab |
| 8 | `claude.internal.computerUse` · `CuTeach` | exit, hide, mouseEnter, mouseLeave, next, reassertHover, show, working |
| 8 | `claude.internal.computerUse` · `CuWatchRecordPill` | discard, done, micError, micState, processing, reportProcessingWidth, timeWarning, toggleMic |
| 8 | `claude.internal.ui` · `MainWindowTitleBar` | firstPaintPresented, hideLoadError, requestMainMenuPopup, requestOrganizationSignIn, requestReloadMainView, requestRestartApp, showLoadError, titleBarReady |
| 7 | `claude.coworkArtifact` · `CoworkArtifactBridge` | askClaude, callMcpTool, fileRefused, navigateHost, openExternalUrl, runScheduledTask, setEditableFocused |
| 7 | `claude.internal.findInPage` · `FindInPage` | blurInput, clearQuery, endFindSession, findInPage, focusInput, stepToMatch, stopFindInPage |
| 7 | `electron_window` · `WindowManager` | DestroyWindow, GetWindowState, RegisterWindow, UnregisterWindow, UpdateWindow, WindowAction, WindowEvent |
| 6 | `claude.internal.computerUse` · `CuWatchRecordChooser` | choose, inputDevices, micState, reportContentShortfall, setMicPreview, stopMicPreview |
| 5 | `claude.internal.ui` · `AboutWindow` | ancientJournal, getAppName, getBuildProps, getSupport, openHelp |
| 3 | `claude.hybrid` · `DesktopIntl` | getInitialLocale, localeChanged, requestLocaleChange |
| 2 | `claude.artifactShell` · `ArtifactShellTransport` | hello, setClaudeActivity |
| 2 | `claude.internal.ui` · `QuickWindow` | requestDismiss, requestSkooch |
| 2 | `claude.mcpAppView` · `McpAppViewBridge` | post, receive |
| 1 | `claude.designPdf` · `DesignPdf` | printFrameToPdf |
| 1 | `claude.internal.localExecConsent` · `LocalExecConsent` | choose |
| 1 | `claude.internal.ui` · `ConfigTemplateExport` | exportTemplates |
| 1 | `claude.pluginResources` · `PluginResources` | readResource |
| 1 | `claude.skills` · `Skills` | previewSkillFile |

### 7 个遗留（非生成式）通道

```
claude-page:host-tools-hello
claude-page:host-tools-port
claude-page:subframe-pointerdown
claude-page:subframe-exit-pointer-lock
artifact-shell:transport-port
web-store:call
electron-store-get-data
```

> **`claude-page:host-tools-port` / `artifact-shell:transport-port`** 是"端口交接"通道：渲染层先请求端口，再自行建立 MessagePort 直连，避免高频消息走 IPC 总线。这与第五篇的 artifact 运行时（`hello` / `setClaudeActivity`）是配套的两段式握手。

---

## 7.4 65 个 contextBridge 暴露

按 preload 分组（`exposed` 表，65 行）：

| preload | 暴露的全局名 |
| :--- | :--- |
| `mainView.js`（18） | `claudeAppBindings`（registerBinding / unregisterBinding / listMcpServers / connectToMcpServer / openMcpSettings）、`electronWindowControl`、`electronIntl`、`desktopBootFeatures`、`desktopManagedConfig`、`desktopEnterpriseConfig`、`desktopTelemetryConfig`、`desktopDeviceClass`、`desktopPreferredLanguages`、`desktopHomePath`、`desktopUpdateRelaunchAt`、`buddyBle`（pair / disconnect）、`desktopNoFlushBytecode`、`process`、以及 4 个解构导出 |
| `mainWindow.js` | `desktopBootPlaceholder`（+ `shellZoomFactor`）、`process`、`desktopEssentialTelemetryDisabled`、解构导出 |
| `artifactShell.js` | `claudeDesktopArtifactPane`（platform / hostcaps） |
| `claudePagePreview.js` | `claudeDesktopArtifactPane`（embedded / platform / chrome） |
| `coworkArtifact.js` | `cowork`（callMcpTool / askClaude / runScheduledTask） |
| `designWindow.js` | `omeletteDesktopPdf`（printFrameToPdf） |
| `mcpAppView.js` | `mcpAppBridge`（postMessage） |
| `buddy.js` | `buddy`（getPathForFile）、`process`、`desktopEssentialTelemetryDisabled`、解构导出 |
| `aboutWindow.js` / `configTemplateWindow.js` / `findInPage.js` / `quickWindow.js` | `process`、`desktopEssentialTelemetryDisabled`、解构导出 |
| `computerUseTeach.js` / `computerUseWatchRecord.js` / `localExecConsent.js` / `watchRecordChooser.js` | 仅解构导出（`(destructured)`） |

> **同名不同面**：`claudeDesktopArtifactPane` 在 artifact shell 里只给 `platform` / `hostcaps`，在页面预览里额外给 `embedded` / `chrome`。这是**按窗口裁剪的同一接口**，复刻时不能共用一个桥实现。

---

## 7.5 安全开关：9 条 fuse，6/7 硬化

`js_electron_fuses_show`（证据 `ev_ba0b520c…`，wire v1，偏移 `0x9a360fc`）：

| # | fuse | 状态 | 含义 |
| ---: | :--- | :--- | :--- |
| 0 | `RunAsNode` | **disabled** | `ELECTRON_RUN_AS_NODE` 被忽略，无法把 app 当 Node 跑 |
| 1 | `EnableCookieEncryption` | **enabled** | 磁盘 cookie 用系统密钥加密 |
| 2 | `EnableNodeOptionsEnvironmentVariable` | **disabled** | `NODE_OPTIONS` / `NODE_EXTRA_CA_CERTS` 被忽略 |
| 3 | `EnableNodeCliInspectArguments` | **disabled** | **`--inspect` 被忽略，主进程无法附加调试器** |
| 4 | `EnableEmbeddedAsarIntegrityValidation` | **enabled** | `app.asar` 加载前校验内嵌哈希 |
| 5 | `OnlyLoadAppFromAsar` | **enabled** | 只从 `app.asar` 加载，忽略同级 `app/` 或 `default_app.asar` |
| 6 | `LoadBrowserProcessSpecificV8Snapshot` | disabled | 主进程使用共享 V8 快照 |
| 7 | `GrantFileProtocolExtraPrivileges` | **enabled（未硬化）** | `file://` 页面获得超出普通浏览器的权限 |
| 8 | `WasmTrapHandlers` | enabled | 64 位下用信号处理器捕获 WASM 越界 |

### 方法论后果

> **4.x 卷的"9229 主进程 inspector 只读活体观测"在 5.11492.5 不可复现**：`EnableNodeCliInspectArguments` 已关闭，`--inspect` 被 Electron 忽略。任何声称"活体逐帧"的 5.x 结论都必须改用别的通道（渲染层 CDP、屏幕录制或 `js_runtime_*` 系列工具），否则只能停留在静态证据。
>
> 本卷因此**没有**活体帧数据，第 4 篇的动效结论保持"静态观测"标注。

---

## 7.6 源映射与原生模块

### 源映射

| 事实 | 值 |
| :--- | ---: |
| 声明了 `.map` 的脚本 | **631** |
| 实际存在的 `.map` | **0**（全部 `present:false`） |
| 内联 data URL 映射 | 0 |

> **结论**：5.x **不发布 source map**。`js_source_locate` 之类"从压缩位置回溯原始文件"的工具在本版无输入可用；本卷所有"chunk 内函数名"都是压缩名，不可当源码符号引用。

### 原生模块（6 个）

| 文件 | 用途 |
| :--- | :--- |
| `node_modules/@ant/claude-native/claude-native-binding.node` | 平台桥（签名后被改写，见第一篇完整性说明） |
| `node_modules/@ant/claude-swift/build/Release/computer_use.node` | computer-use 采集/注入 |
| `node_modules/@ant/claude-swift/build/Release/swift_addon.node` | macOS 原生能力 |
| `node_modules/node-pty/build/Release/pty.node` | 终端 PTY |
| `resources/office365-mcp/msal-node-runtime.node` | Office365 MCP 的 MSAL 运行时 |
| `./crypto/build/Release/sshcrypto.node` | SSH 加密（来自 `index.chunk-DkZJVh_M.js`） |

### 平台效果面（规模感）

| 类别 | 声明数 |
| :--- | ---: |
| 平台 API 调用点（`effects`） | **9,288** |
| 存储 API 调用点（`storage`） | **414**（`safeStorage.isEncryptionAvailable` / `decryptString` 等） |
| 端点声明（`endpoints`） | **1,270**（GET 337 / POST 116 / DELETE 4 / PATCH 3 / PUT 2 / 无方法 808） |
| 路由与路径（`routes`） | **37** |

端点中 `/api/frame` 出现 **67** 次，是 artifact 运行时的主 API 前缀；其余多为模板字符串（`/{e}`、`/{t}` 等），静态不可解析。

---

## 7.7 证据索引（本篇）

| ID | 类型 | 位置 | 支撑结论 |
| :--- | :--- | :--- | :--- |
| E7-1 | 观测 | `ev_e1b0b47f…` `core_target_triage` | `app.asar` 被识别为 asar（88,833,670 B） |
| E7-2 | 推导 | `ev_01432a4f…` `js_app_map` | 779 源文件 / 102 IPC / 34 窗口 / 1270 端点 / 37 路由 |
| E7-3 | 推导 | `ev_b42b9b27…`（windows 页） | 18 BrowserWindow + 16 WebContentsView、8 个 preload、静态 webPreferences 分布 |
| E7-4 | 推导 | `ev_9ab1b065…`（ipc 页） | 19 接口 / 95 方法 / 2 个 transport uuid / 7 个遗留通道 |
| E7-5 | 推导 | `ev_01432a4f…`（exposed 表 65 行） | 65 个 contextBridge 暴露与按窗口裁剪 |
| E7-6 | 观测 | `ev_ba0b520c…` `js_electron_fuses_show` | 9 条 fuse，6/7 硬化，`--inspect` 关闭 |
| E7-7 | 推导 | `ev_01432a4f…`（source_maps 表 631 行） | 无 source map 发布 |
| E7-8 | 推导 | `ev_01432a4f…`（native_modules / storage / effects / endpoints） | 6 原生模块、414 存储、9288 效果、1270 端点 |
| E7-9 | 观测 | `.vite/renderer/*/` 逐目录检索 | 6 个窗口用 CDS，2 个不用 |

<p align="center"><a href="06-设计系统技能与复刻工程.md">← 第六篇</a> · <a href="README.md">📚 本卷索引</a></p>
