# Claude Desktop 5.11492.5 · CDS 与 Artifact 运行时（合并阅读版）

> 本文件由本卷 15 篇按功能点顺序合并生成，供离线全文档阅读；分篇导航见 [README.md](README.md)。

> 载体：`app.asar` 88,833,670 B / SHA-256 `2c515441d5d0504a96ac3e49bcc4c1244085c0e76ad23ae58ddd8f736100479e`；`ion-dist.asar` 208,001,845 B / SHA-256 `1d55d633d14aede748af3cb22c244f4ddc2f795d9b1153b175b993ae5d46aa1b`。Electron `45.2.1`。

---

---

---
title: 版本边界与三层架构
part: 1
category: 架构
domain: 宿主与运行时
---

<p align="center"><a href="README.md">📚 本卷索引</a> · <b>第一篇</b> · <a href="02-CDS设计令牌总谱.md">第二篇 →</a></p>

# 第一篇：版本边界与三层架构

> **技术领域与英文指代**：Electron 宿主分层（host layering）、ASAR 载体（archive carrier）、渲染层窗口（renderer window）、artifact 运行时（frame runtime）、契约协商（contract negotiation）、上下文桥（contextBridge）、IPC 命名空间（IPC namespace）。

本篇回答一个问题：**5.11492.5 的代码到底装在哪几层里，哪一层负责 UI，哪一层负责"壳"**。所有结论来自对安装包字节的静态观测，不包含运行时行为推断。

---

## 1.1 载体身份与构建戳

| 事实 | 观测值 | 证据 |
| :--- | :--- | :--- |
| 短版本号 | `5.11492.5` | `Contents/Info.plist` `CFBundleShortVersionString` |
| 构建版本号 | `5.11492.5` | `Contents/Info.plist` `CFBundleVersion` |
| 包名 / 版本 | `@ant/desktop` / `5.11492.5` | `app.asar:package.json` |
| Electron | `45.2.1` | `Contents/Frameworks/Electron Framework.framework/Versions/A/Resources/Info.plist` `CFBundleShortVersionString` |
| 主进程入口 | `.vite/build/index.pre.js` | `app.asar:package.json` `main` |
| 构建提交 | `1403e2cf44abfb23809c8ae11238d5e9704a41c2` | `app.asar:.vite/build/mainWindow.js@88439` |
| 构建时间 | `2026-11-13T20:47:10.000Z` | 同上 |
| 构建类型 | `prod` | 同上 |
| `app.asar` | 88,833,670 B · SHA-256 `2c515441d5d0504a96ac3e49bcc4c1244085c0e76ad23ae58ddd8f736100479e` | `Contents/Resources/app.asar` |
| `ion-dist.asar` | 208,001,845 B · SHA-256 `1d55d633d14aede748af3cb22c244f4ddc2f795d9b1153b175b993ae5d46aa1b` | `Contents/Resources/ion-dist.asar` |

> **工程含义**：`app.asar` 从 4.x 的"全部前端 + 主进程"退化为"主进程 + 壳 + 少量本地窗口"，UI 主体重新迁回 `ion-dist.asar`（4.x 卷记录的 `ion-dist.asar` 是 `6adff0069a86b0d10…`，本版已换为 `1d55d633…`）。这是**打包边界变化**，不是功能回退。

---

## 1.2 三层载体：app.asar / ion-dist.asar / unpacked

```
Claude.app/Contents/Resources/
├── app.asar                88.8 MB  主进程、preload、本地窗口、frame 运行时、类型包
├── ion-dist.asar          208.0 MB  渲染层 UI（assets/v1 5255 个文件）
└── app.asar.unpacked/              原生扩展（不进归档，需签名）
    ├── node_modules/@ant/claude-native/claude-native-binding.node
    ├── node_modules/@ant/claude-swift/build/Release/…
    └── node_modules/node-pty/…
```

| 层 | 目录 | 体积 | 职责（观测） |
| :--- | :--- | ---: | :--- |
| 主进程 | `app.asar:.vite/build/`（643 个文件） | 44 MB | 窗口工厂、IPC、协议、权限、computer-use、frame 宿主 |
| 本地渲染窗口 | `app.asar:.vite/renderer/{main_window,about_window,buddy_window,config_template_window,file_viewer,find_in_page,local_exec_consent,quick_window}` | 13 MB | 8 个独立窗口目录，每个自带 `index.html` + assets（整包共 34 处 `BrowserWindow`/`WebContentsView` 构造，见第七篇） |
| Artifact 运行时 | `app.asar:resources/frame/{runtime,shell,types}` | 28 MB | 契约表、shell broker、`design` / `slides` 类型 |
| UI 主体 | `ion-dist.asar:assets/v1/` | 159 MB | 聊天、侧边栏、预览、标注、浏览器面板等全部产品 UI |
| 静态壳页 | `ion-dist.asar:{index,client-shell-v1,frame-shell,frame-connect,frame-manage}.html` | — | 5 个顶层 HTML 入口 |

> **注意**：`app.asar.unpacked` 中 `claude-native-binding.node` 的 SHA-256 与归档内声明的完整性摘要不一致（REA 首次分析即报 `artifact_integrity_mismatch`，`declared 2470d4df…` vs `calculated 5e5392da…`）。这是 macOS 签名后改写 unpacked 二进制的常见现象，**不是**篡改结论；本卷所有静态分析均在 `integrity_policy=record-and-continue` 下完成，并把该二进制标记为"未信任观测字节"。

---

## 1.3 渲染层形态：8 个 .vite 窗口 vs 5255 个 v1 资产

`app.asar:.vite/renderer/` 下的 8 个窗口各自是一个 Vite 构建产物，例如 `main_window`：

| 文件 | 字节 | 说明 |
| :--- | ---: | :--- |
| `index.html` | 11,683 | **加载失败 UI + 启动占位**，注释原文：`this is the html for the app's load-error UI. everything else gets loaded from claude.ai` |
| `assets/main-NIq6uDPG.js` | 85,792 | 窗口引导脚本（含 Sentry release id） |
| `assets/MainWindowPage-A0l7zsr7.js` | 10,940 | 页面壳 |
| `assets/MainWindowPage-lhEHjHfd.css` | 251,161 | **CDS 令牌与组件契约样式表**（本篇后续所有样式证据的宿主） |
| `assets/AnthropicSans-*.woff2` / `AnthropicSerif-*.woff2` | 6 个 | 品牌字体（web 格式，随包分发） |

`ion-dist.asar` 侧则是单页应用资产目录：

```
ion-dist.asar/
├── index.html                    产品主页面
├── client-shell-v1.html
├── frame-shell.html  frame-connect.html  frame-manage.html
└── assets/
    ├── v1/          5255 个文件（159 MB；chunk 以 9 位内容 ID 命名，如 c427176b2-BQn2Bm7I.css）
    ├── *.worker-*.js  10 个 Worker（highlight / pierre / model / wordDocument / rum / idleWave…）
    └── completionGzipWorker-*.js
```

**可复用的版本对齐规律**：`assets/v1/<9位chunkId>-<内容hash>.js` 中**chunkId 稳定、内容 hash 变化**。例如 4.16336.0 记录的 `c427176b2-DuM09fKk.js` 在本版为 `c427176b2-BQn2Bm7I.css`（同一 chunk 身份，产物类型与哈希都变了）。跨版本 diff 时应以 chunkId 为锚点，不要以 hash 为锚点。

---

## 1.4 frame 运行时：runtime / shell / types

`app.asar:resources/frame/` 是 5.x 新增的一层，**不在 4.x 的 ion-dist 叙事里**：

| 子目录 | 内容 | 规模 |
| :--- | :--- | :--- |
| `runtime/_runtime/` | `kernel.CF1pi-lX.js`、`kernel-0.1.x.BEhpa8TP.js`、`_worker`、`_transforms`、`_use`、`_translate`、`_comments`、`_top_level` + 11 个 woff2 | 运行时内核 |
| `runtime/contracts/<ver>/index.json` | 每个契约版本的 capability / change 清单 | **129 个版本**：`0.1.0` → `0.2.96` |
| `runtime/runtime.hash.json` | 内核与 capability 文件 → `sha32` 映射 | 22 个条目 |
| `shell/` | `frame-shell-broker.js`（608,595 B）、`frame-shell-chrome-stub.js`、20 个 chunk、`fonts/` | 壳进程 |
| `types/design/` | `index.html`、`SKILL.md`、`artifact-type/{app.js 5.1 MB, app.css 538 KB, dc-runtime.js 189 KB, capture.js, fast-edit-worker.js}` | Design 画布类型（7.9 MB） |
| `types/slides/` | 同构，含 `read-worker.js`、`capture.css` | Slides 类型（7.2 MB） |

`runtime.hash.json` 的结构直接说明了加载协议：

```json
{"kernels":{"kernel":{"file":"kernel.CF1pi-lX.js","sha32":"1e7443f60d6d94c7e52bdca4618ca359"},
            "kernel-0.1.x":{"file":"kernel-0.1.x.BEhpa8TP.js","sha32":"87335c1ff64e6d8dce9736ec1b3471d7"}},
 "manifestFile":"manifest.10ae6c9474227def.json",
 "capabilities":{"artifact":"artifact.BrWEr2aK.js","assets":"assets.DG69nuOE.js","comments":"comments.DuepbrNZ.js",
                 "db":"db.CCPy_cYa.js","desktop":"desktop.CXuIZ5Ts.js","dictation":"dictation.C9bJoIZV.js",
                 "downloads":"downloads.WsdFaoeg.js","embed":"embed.DL8CVLpf.js","endpoints":"endpoints.Cgd32w2P.js",
                 "files":"files.BWjhUR2a.js","mcp":"mcp.RT0IhfK0.js","network":"network.B5UA9Su4.js",
                 "paste":"paste.BXT-6GsY.js","permissions":"permissions.YN66judO.js","reads":"reads.Ch7Jwxh7.js",
                 "room":"room.DcZfm17Q.js","sample":"sample.DwGzO02I.js","tts":"tts.DT7xqCtz.js",
                 "user":"user.DWCNmu2k.js","self":"artifact.BrWEr2aK.js"}}
```

> **观测**：capability 是**按需加载的独立 JS 模块**（每个 capability 一个文件），`self` 复用 `artifact` 的产物。这解释了为什么 `design` 的 manifest 可以只声明自己用到的 10 个 capability —— 未声明的模块根本不会被下发。
>
> **内核选择规则（已查清）**：`app.asar:.vite/build/frame-local-worker/frameLocalWorker.js` 里 `ka(e,t)` 的写法是 `let n = t && e["kernel-0.1.x"] ? e["kernel-0.1.x"] : e.kernel`，而 `t` 来自 `Tr(contract)`：
>
> ```js
> function Tr(e){ return e===void 0 || !Re(e) || e===Ve ? !1 : ze(e,Sr) < 0 }
> ```
>
> 即：**契约版本存在、合法、不是当前版本、且早于阈值 `Sr` → 用 `kernel-0.1.x`；否则用 `kernel`**。所以双内核不是“两套并存随便选”，而是**按 artifact 的契约版本降级**：老契约跑 0.1.x 内核，新契约跑当前内核。同一逻辑在拼接 HTML 时还会写入 `kernelFile` 字段供后续校验。

---

## 1.5 主进程 IPC 命名空间

`app.asar:.vite/build/*.js` 中通过 `contextBridge.exposeInMainWorld` 暴露的命名空间（按出现次数）：

| 命名空间 | 出现次数 | 代表通道 |
| :--- | ---: | :--- |
| `claude.internal.ui` | 53 | `MainWindowTitleBar_$_titleBarReady` / `requestReloadMainView` / `requestRestartApp` / `requestOrganizationSignIn` / `requestMainMenuPopup` / `firstPaintPresented` / `showLoadError` / `hideLoadError`；`QuickWindow_$_requestDismiss` / `requestSkooch`；`ConfigTemplateExport` |
| `claude.internal.computerUse` | 34 | computer-use 教学 / 录制窗口 |
| `claude.internal.findInPage` | 5 | 查找条 |
| `claude.internal.localExecConsent` | 5 | 本地执行授权 |
| `claude.internal.sableOtter` | 4 | 内部实验开关 |

另有两个直接挂到 `window` 的桥：

| 全局名 | 内容 |
| :--- | :--- |
| `process` | `{arch, platform, type, versions}` + `version`（来自构建戳 `appVersion`）+ `env` |
| `desktopBootPlaceholder` | 启动占位配置 `{enabled, reportFirstPaint?, frame{sidebarWidth, collapsed, narrowViewportMaxWidth, zoomFactor, shapes[]}, colors{page,sidebar,seam}}` |

> `MainWindowTitleBar` 的通道名带 `_$_` 分隔符。**完整形态见第七篇**：`$eipc_message$_<transport-uuid>_$_<namespace>_$_<Interface>_$_<method>`，本版共 102 个通道 / 19 个接口 / 95 个方法，其中 2 个 transport uuid（`d063083e…` 覆盖 `claude.*`、`fcb91d11…` 覆盖 `electron_window`），另有 7 个非生成式遗留通道。4.x 卷记录的"通道名没有 uuid 前缀"在本版已不成立，跨版本复刻时不能直接照抄。

---

## 1.6 证据索引（本篇）

| ID | 类型 | 位置 | 支撑结论 |
| :--- | :--- | :--- | :--- |
| E1-1 | 观测 | `Contents/Info.plist` `CFBundleShortVersionString` | 版本 5.11492.5 |
| E1-2 | 观测 | `app.asar:package.json` | 包名、main 入口、依赖 |
| E1-3 | 观测 | `app.asar:.vite/build/mainWindow.js@88439` | 构建戳（commit / 时间 / prod） |
| E1-4 | 观测 | `app.asar:.vite/renderer/main_window/index.html@1` | 加载失败 UI 注释 |
| E1-5 | 观测 | `app.asar:.vite/renderer/main_window/assets/MainWindowPage-lhEHjHfd.css` | 251,161 B 样式表 |
| E1-6 | 观测 | `ion-dist.asar:assets/v1/` 目录计数 | 5255 个文件 / 159 MB |
| E1-7 | 观测 | `app.asar:resources/frame/runtime/runtime.hash.json` | 内核与 capability 映射 |
| E1-8 | 观测 | `app.asar:resources/frame/runtime/contracts/` 目录计数 | 129 个契约版本 |
| E1-9 | 观测 | `app.asar:.vite/build/*.js` 字符串统计 | IPC 命名空间与通道名 |
| E1-10 | 观测 | REA `analyze_javascript_application` 错误载荷 | unpacked 完整性摘要不一致 |
| E1-11 | 观测 | `app.asar:.vite/build/frame-local-worker/frameLocalWorker.js`（`ka()` / `Tr()`） | 双内核按契约版本降级 |

<p align="center"><a href="README.md">📚 本卷索引</a> · <b>第一篇</b> · <a href="02-CDS设计令牌总谱.md">第二篇 →</a></p>



---

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

## 2.1 `--cds-theme-api` 与令牌分层

> **官方口径（见第十一篇）**：CDS 的层模型是**六层**——原始阶 / 主题别名 / 高度 / 用途 / 密度 / 动效，且「组件只读第 4 层与第 5 层」。本篇按**产物里的声明位置**归纳为四块（原始阶 / 角色 / 语义 / 组件），便于逐字节定位；两者的对应关系与更正见 11.2 与 11.5。

基础色板块（`MainWindowPage-lhEHjHfd.css@147224`，373 条声明）的第一行即：

```css
--cds-theme-api: 1;
```

这是**令牌 API 的版本号**。它把 4.x 时代"约定俗成的变量集合"升级为可协商的契约：宿主可以用它判断当前样式表是否提供某代令牌语义。

产物侧的四块结构（观测到的声明位置与职责）：

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

> ⚠️ **官方更正（11.2）**：`--cds-role-*` 是**内部接线**，不属于令牌词汇，官方原文要求 `never reference them`。下表用于理解产物结构，**对外只应使用** `--fill-*` / `--bg-*` / `--border-*` / `--text-*` / `--on-*` 五件套。

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



---

---
title: 作用域与组件属性契约
part: 3
category: 组件契约
domain: 视觉系统
---

<p align="center"><a href="02-CDS设计令牌总谱.md">← 第二篇</a> · <a href="README.md">📚 本卷索引</a> · <a href="04-动效令牌与弹簧线性化.md">第四篇 →</a></p>

# 第三篇：作用域与组件属性契约

> **技术领域与英文指代**：作用域开关（scope switch）、数据属性选择器（data-attribute selector）、组件自反属性（component self-reflection attribute）、令牌重定向（token redirection）、局部密度继承（local density inheritance）、窗口失焦降饱和（window-inactive desaturation）、注册自定义属性（`@property` registration）。

5.x 的样式层不再靠 class 名约定组件身份，而是靠 **DOM 属性 + 令牌重定向**。本篇列出全部开关与 48 个组件属性，并给出可直接抄写的契约片段。

---

## 3.1 六个 `data-*` 作用域开关

| 开关 | 取值（观测） | 影响的令牌 | 声明位置 |
| :--- | :--- | :--- | :--- |
| `data-mode` | `light` / `dark` / `system` | 149 条颜色语义 | 根节点（`<html>`），见 `index.html@548` |
| `data-density` | `comfortable`（另有默认 base 档） | 40 条几何 + 105 条排版 + 77 条组件尺寸 | 根节点 |
| `data-size` | `xs` / `sm` / `lg`（无值 = md 默认） | 38 条/档，重定向到 `--*--xs` 等后缀族 | 任意子树 |
| `data-step` | `1` … `5` | **19 条/档**（radius / h-control / icon / 5 档 pad / 字号 / 行高）+ 3 条按钮专项 | 任意子树（骨架行组实测） |
| `data-font` | `system`（另有品牌字体档） | 字体栈 | 根节点 |
| `data-window-active` | `false` | 角色层 accent 全部降级为灰 | 根节点 |

启动 HTML 上的静态戳（原文）：

```html
<html class="cds-root" data-mode="system" data-density="comfortable" data-platform="desktop">
```

注释说明了三个"故意不写"的项：

> `Deliberately no data-font, no CDS text color class, and no inline font size: those change the document's inherited font and color. Add them only when this window's styles are CDS-based.`

即：**主窗口只声明作用域，不声明排版** —— 排版留给产品层（claude.ai）。

### `data-size` 的重定向机制

```css
.cds-root [data-size=xs]{--cds-radius:var(--cds-radius--xs);--cds-h-control:var(--cds-h-control--xs);
  --cds-icon:var(--cds-icon--xs);--cds-pad-sm:var(--cds-pad-sm--xs); … }
```

`--cds-radius--xs` 这类**双连字符后缀族**是"尺寸档位表"：每个几何令牌有 `--xs/--sm/--lg` 三个预生成值，`data-size` 只做指针切换。复刻时若用 `data-size` 却不提供 `--*--xs` 族，样式会静默回退到继承值。

### `data-step` 的五档几何阶（修正）

`[data-step="1"]` … `[data-step="5"]` **不是**三值微调，而是每档 **19 条**声明组成的完整几何阶梯（另有 3 条属于按钮专项）：

| step | `--cds-h-control` | `--cds-icon` | `--cds-font-size-body` | `--cds-font-size-prose` | `--cds-radius` |
| ---: | :--- | :--- | :--- | :--- | :--- |
| 1 | `calc(1.25rem * scale)` ≈ 18.8px | `calc(.75rem * scale)` ≈ 11.3px | `calc(.75rem * scale)` ≈ 11.3px | `.8125rem` = 13px | `calc(.3125rem * scale)` ≈ 4.7px |
| 2 | `1.5rem` ≈ 22.6px | `1rem` ≈ 15.1px | — | — | `.375rem` ≈ 5.6px |
| 3 | `1.75rem` ≈ 26.4px | `1rem` | — | — | `.4375rem` ≈ 6.6px |
| 4 | `2rem` ≈ 30.1px | `1.25rem` ≈ 18.8px | — | — | `.5rem` ≈ 7.5px |
| 5 | `2.5rem` ≈ 37.6px | `1.5rem` ≈ 22.6px | — | — | `.625rem` ≈ 9.4px |

每档同时改 `--cds-h-control-nested`、`--cds-pad-xs/sm/md/lg/xl`、字号与行高，是**等比缩放的一整阶**，不是单点调整。

> **写入点（已查清）**：`ion-dist.asar:assets/v1/shared-62-zErJ7r0o.js` 在**骨架屏行组**上写 `data-step:"1"`（内层是 `h-control-nested rounded-chip` 的占位块）。所以 `data-step` 的真实用途是：**让骨架行按阶降级**——越靠下的占位行用越小的阶，形成视觉上“逐行变小”的收束感，而不是列表/时间线的步数。

---

## 3.2 根作用域与暗色子域

| 选择器 | 语义 | 备注 |
| :--- | :--- | :--- |
| `.cds-root` | 令牌根作用域 | 必须挂载，否则语义令牌不解析 |
| `[data-cds-unthemed]` | 与 `:root` 同级的**无主题区** | 用于不希望被主题污染的子树 |
| `.cds-dark-scope[data-mode=dark]` | 局部暗色容器 | 149 条暗色覆盖 + 26 条组件覆盖 + 24 条局部变量 |
| `[data-window-active=false]` | 窗口失焦降饱和 | 把 `role-accent-*` 全族映射到 `gray-*` |

失焦降饱和的完整映射（`MainWindowPage-lhEHjHfd.css@143702`）：

```css
[data-window-active=false],
[data-window-active=false] .cds-root {
  --cds-role-accent-50:var(--cds-gray-50);   --cds-role-accent-100:var(--cds-gray-100);
  --cds-role-accent-250:var(--cds-gray-250); --cds-role-accent-300:var(--cds-gray-300);
  --cds-role-accent-400:var(--cds-gray-400); --cds-role-accent-450:var(--cds-gray-450);
  --cds-role-accent-600:var(--cds-gray-600); --cds-role-accent-700:var(--cds-gray-700);
  --cds-role-accent-800:var(--cds-gray-750); --cds-role-accent-850:var(--cds-gray-800);
  --cds-role-accent-fill:var(--cds-role-accent-450);
  --cds-role-accent-fill-hover:var(--cds-role-accent-400);
}
```

> **这是 macOS 原生的"失焦变灰"语义**，但用令牌重定向实现：不是改每个组件，而是把**角色层指针整体换成灰阶**。任何引用 `fill-accent` 的组件都会自动失去颜色，且不需要单独写失焦样式。注意 `800` 映射到 `gray-750`、`850` 映射到 `gray-800`（错位一档），是刻意的暗部压缩。

---

## 3.3 48 个 `data-cds` 组件属性清单

样式层通过 `[data-cds=Name]` 识别组件，出现次数即"该组件被专门写了多少条规则"：

| 规则数 | 组件 | 规则数 | 组件 |
| ---: | :--- | ---: | :--- |
| 43 | `MessageActions` | 4 | `SplitDropdownButton` / `Spinner` / `ShimmerText` / `DataTable` |
| 24 | `MessageAttachmentsVideo` | 3 | `ButtonGroup` / `ChatComposerChin` / `Button` |
| 23 | `MessageAttachmentsImage` / `Card` | 2 | `AccordionHeader` / `Pulse` / `ChatComposerEditor` |
| 22 | `AssistantMessage` | 1 | `TurnStatus` / `Table` / `Surface` / `PreviewCard` / `PointChartContainer` / `Panel` / `ModelSelectorEffort` / `ModelSelector` / `MessageAttachmentsQuote` / `MessageAttachmentsFile` / `FileDiff` / `DiffIndicator` / `CommentCard` / `CoachMark` / `ChatComposerNotices` / `ChartContainer` / `CellChartContainer` / `Banner` / `AskUserQuestion` / `Aside` / `Accordion` |
| 17 | `CardLink` | | |
| 13 | `MessageAttachments` | | |
| 12 | `SkeletonGroup` / `Icon` | | |
| 11 | `UserMessage` | | |
| 10 | `ChatComposerQueuedMessages` | | |
| 9 | `TurnStatusStep` | | |
| 8 | `ChatComposerDock` | | |
| 7 | `Prose` | | |
| 6 | `Toolbar` / `Page` | | |
| 5 | `Skeleton` | | |

> **与 4.x 的差异**：4.x 卷用 `data-cds` 只出现在少量组件（`Button`、`Prose`、`ShimmerText`）；5.x 已扩展到 48 个，形成一套**可枚举的组件自反层**。对复刻者而言，这意味着可以直接用属性选择器接管任意组件的视觉，无需依赖 class 名。
>
> **覆盖边界**：本仓库 `code-examples/` 的 30 个模块中，能直接对应到 `data-cds` 名的约 10 个（`Button` / `Prose` / `ShimmerText` / `UserMessage` / `AssistantMessage` / `ChatComposerEditor` / `ModelSelector` / `ModelSelectorEffort` / `FileDiff` / `Skeleton`）。其余模块在 5.x 里以别的名字存在（例如 `SegmentedControl` 只在 4 个文件里作为普通标识出现，`ThinkingBlock` 只在 1 个文件里出现，`ToolDecision` 在 18 个文件里出现），**不能**用 `data-cds=` 检索当作“组件已不存在”的依据。

---

## 3.4 单描边纪律在新版的实际取值

AGENTS.md 的"单描边"在 5.x 有了明确的实现路径：**边框令牌化 + 面板阴影内描边**。

| 手法 | 实现 | 出处 |
| :--- | :--- | :--- |
| 发丝边框 | `--cds-border: var(--cds-alpha-2)`（10% 反相） | 语义层 |
| 强调边框 | `--cds-border-strong: var(--cds-alpha-3)`（20%） | 语义层 |
| 面板"边框" | `--cds-panel-shadow: 0 0 0 1px var(--cds-border), var(--cds-shadow-sm)` | 语义层 |
| 焦点环 | `--cds-focus-shadow`（inset 1px 页面色 + 1px accent + 6px glow） | 角色层 |
| 发丝宽度 | `--cds-ring-hairline: 1px` | 语义层 |

> **官方写法是 `0.5px`**（第十一篇 11.3 的 Token rule）：`border: 0.5px solid var(--border)`。

`--cds-panel-shadow` 是"单描边"的另一条官方路径：**容器不写 border，用 `0 0 0 1px` 的 spread 阴影画描边**，这样描边与阴影同层合成，不会在圆角处出现双线。

同时 `--cds-page-bg` 在组件内部常被覆盖为 `transparent`（观测到 2 处），说明"页面底色"只属于最外层，内部面板靠 `surface-*` 自身叠色——这与 AGENTS.md 的"低对比层级"完全一致。

---

## 3.5 组件级微观契约

### MessageActions：`@property` 驱动的透明度过渡

```css
[data-cds=MessageActions][data-reveal]{
  --cds-message-actions-opacity:0;
  opacity:var(--cds-message-actions-opacity);
  scale:var(--cds-message-actions-reveal-scale);
  transform-origin:var(--cds-message-actions-reveal-origin);
  transition-property:opacity,scale;
  transition-duration:var(--cds-message-actions-reveal-out-duration);
  transition-timing-function:var(--cds-message-actions-reveal-out-ease);
  transition-delay:var(--cds-message-actions-reveal-out-delay);
}
```

> **关键点**：`transition-property:opacity,scale` 中的 `scale` 是**独立 CSS 属性**（不是 `transform:scale()`），可与 `translate` 分别过渡、分别设 `transform-origin`。本版共注册 **24 个 `@property --cds-*`**，其中 18 个属于 `--cds-scroll-fade-*` 族、1 个 `--cds-message-actions-opacity`、1 个 `--cds-badge-x-wght`、2 个 `--cds-outset-*`。

### DataTable：行级令牌重定向

```css
[data-cds=DataTable] tr[data-dimmed]{
  --cds-row-dimmed-opacity:.5;
  --cds-text-primary:var(--cds-undimmed-text-stays-secondary);
  --cds-text-secondary:var(--cds-text-disabled);
  --cds-text-muted:var(--cds-text-disabled);
}
.cds-root [data-cds=DataTable] tr[data-dimmed] :is(button,input,select,textarea,[role=button],…){
  --cds-text-primary:var(--cds-undimmed-text-primary);
  --cds-row-dimmed-opacity:1;
}
```

这是**"整行变暗但交互控件保持可读"**的标准解法：先在 `tr` 上重定向文本令牌，再把行内所有可交互元素重定向回"未变暗"的值。复刻时若只写 `opacity:.5`，行内按钮会一起变灰、失去可发现性。

### SkeletonGroup：`data-hold` 三态

| 属性 | 效果 |
| :--- | :--- |
| `data-hold`（无值） | `--cds-skel-reveal-end: calc(placeholder-reveal-delay + .15s - elapsed)`，延迟 0.5s 后开始呼吸 |
| `data-hold=none` | `reveal-end: calc(0s - elapsed)`，立即开始 |
| `data-hold=delayed` | 追加 `cds-placeholder-reveal .15s ease-out …` 入场 |
| `data-motion=lockstep` + `data-hold=none` | 全组同步呼吸（`cds-skeleton-breathe 2s ease-in-out … infinite`） |

配合 `--cds-skel-i`（0..n）与 `calc(var(--cds-skel-i) * 90ms)`，实现**每行 90ms 级联**的骨架波。

### ChatComposerChin：局部密度继承

```css
[data-cds=ChatComposerChin] [data-touch-size]{
  --cds-radius:inherit; --cds-h-control:inherit; --cds-h-control-nested:inherit; --cds-icon:inherit;
  --cds-pad-xs:inherit; --cds-pad-sm:inherit; … --cds-switch-h:inherit;
  --cmp-chin-touch-grow:calc((var(--cds-h-control) - var(--cmp-chin-row-h,var(--cds-h-control))) / 2);
  min-height:var(--cmp-chin-row-h,var(--cds-h-control));
}
```

`inherit` 把父级（输入框主体）的密度"冻结"进下巴控件，再用 `--cmp-chin-touch-grow` 补偿触控热区 —— 视觉尺寸继承、可点区域外扩，这是**输入条下巴不随 `data-size` 跳变**的原因。

---

## 3.6 证据索引（本篇）

| ID | 类型 | 位置 | 支撑结论 |
| :--- | :--- | :--- | :--- |
| E3-1 | 观测 | `MainWindowPage-lhEHjHfd.css`，`[data-size=…]` 三块 | 尺寸档位重定向 |
| E3-2 | 观测 | 同上 @202735–@206721（19 条/档）+ @238155（3 条/档） | `data-step` 1–5 几何阶梯 |
| E3-10 | 观测 | `ion-dist.asar:assets/v1/shared-62-zErJ7r0o.js` | `data-step` 的写入点：骨架行组 |
| E3-3 | 观测 | 同上 @143693–@144290 | 失焦降饱和映射 |
| E3-4 | 观测 | 同上 @108078 | MessageActions 透明度过渡 |
| E3-5 | 观测 | 同上 @106855–@107130 | DataTable 行级令牌重定向 |
| E3-6 | 观测 | 同上 @119760 | SkeletonGroup `data-hold` 三态 |
| E3-7 | 观测 | 同上 @130744 | ChatComposerChin 密度继承 |
| E3-8 | 观测 | 同上，`@property` 统计 | 24 个注册自定义属性 |
| E3-9 | 观测 | `app.asar:.vite/renderer/main_window/index.html@548` | 根节点作用域戳 |

<p align="center"><a href="02-CDS设计令牌总谱.md">← 第二篇</a> · <a href="README.md">📚 本卷索引</a> · <a href="04-动效令牌与弹簧线性化.md">第四篇 →</a></p>



---

---
title: 动效令牌与弹簧线性化
part: 4
category: 动效物理
domain: 交互运动
---

<p align="center"><a href="03-作用域与组件属性契约.md">← 第三篇</a> · <a href="README.md">📚 本卷索引</a> · <a href="05-Artifact类型系统与契约协商.md">第五篇 →</a></p>

# 第四篇：动效令牌与弹簧线性化

> **技术领域与英文指代**：时间令牌（duration token）、语义曲线（semantic easing）、弹簧采样（spring sampling）、CSS `linear()` 缓动、关键帧族（keyframe family）、滚动驱动渐隐（scroll-driven fade）、降低动效（reduced motion）。

5.x 把动效从"组件里各自写 `transition`"收敛为**令牌 + 关键帧族**。本篇是静态样式表的全量观测；**未做活体逐帧录制**，凡涉及实际观感的判断都标为推断。

---

## 4.1 五档时间令牌

| 令牌 | 值 | 语义（按命名与用法推断） |
| :--- | ---: | :--- |
| `--cds-dur-fast` | `60ms` | 微反馈：hover、按压、图标切换 |
| `--cds-dur-snap` | `.12s` | 快照式位移：pill 进出、resolve 动画的半步 |
| `--cds-dur-base` | `.2s` | 默认过渡 |
| `--cds-dur-sheet` | `.3s` | 面板/抽屉展开 |
| `--cds-dur-slow` | `.45s` | 大范围布局迁移 |

> 5 档覆盖 60ms → 450ms，跨度 7.5×。`--cds-dur-snap` 与 `--cds-dur-base` 是主力，`sheet` / `slow` 只在容器级迁移出现。

---

## 4.2 三条语义曲线与 16 条实测贝塞尔

### 三条命名曲线（语义层）

```css
--cds-ease-out: cubic-bezier(.165, .84, .44, 1);      /* 主出场：快起慢收 */
--cds-ease-snap: cubic-bezier(.32, .72, 0, 1);        /* 快照：末端硬停 */
--cds-ease-overshoot: cubic-bezier(.34, 1.3, .64, 1); /* 过冲：控制点 y=1.3 */
```

`--cds-ease-overshoot` 的 `1.3` 控制点会产生约 **+8~10% 的视觉过冲**，用于 pill 入场、按钮弹性等"有生命感"的微交互；`--cds-ease-snap` 的 `0` 控制点让曲线在末端几乎垂直收口，用于"啪一下到位"的位移。

### 全量贝塞尔清单（样式表内出现次数）

| 曲线 | 次数 | 用途归类 |
| :--- | ---: | :--- |
| `cubic-bezier(.215,.61,.355,1)` | 6 | 标准 ease（Material 同款） |
| `cubic-bezier(.45,0,.55,1)` | 5 | 对称 ease-in-out |
| `cubic-bezier(.714,.121,.211,.888)` | 4 | 长尾减速 |
| `cubic-bezier(0.165,0.85,0.45,1)` | 2 | 主出场变体 |
| `cubic-bezier(.165,.84,.44,1)` | 2 | `--cds-ease-out` 同值 |
| `cubic-bezier(.34,1.3,.64,1)` | 1 | `--cds-ease-overshoot` |
| `cubic-bezier(.32,.72,0,1)` | 1 | `--cds-ease-snap` |
| `cubic-bezier(.2,0,0,1)` | 1 | 强减速 |
| `cubic-bezier(.4,0,.2,1)` / `(.4, 0, .2, 1)` | 2 | 标准 Material |
| `cubic-bezier(.22,1,.36,1)` | 1 | 强调出场 |
| `cubic-bezier(.65,0,.35,1)` | 1 | 对称 |
| `cubic-bezier(.55,.055,.675,.19)` | 1 | ease-in |
| `cubic-bezier(.4,0,.6,1)` | 1 | 对称 |
| `cubic-bezier(0,0,.2,1)` | 1 | `--cds-ease-out` 的另一写法 |

> **复刻建议**：只实现三条命名曲线即可覆盖 90% 场景；其余 13 条是历史遗留与第三方组件的曲线，不应作为"CDS 规范"照抄。

---

## 4.3 `--cds-btn-spring`：CSS `linear()` 弹簧采样

这是 5.x 最具工程价值的新增令牌：

```css
--cds-btn-spring: linear(0, .2459, .6526, .9468, 1.0764, 1.0915, 1.0585, 1.0219,
                         .9993, .9914, .9921, .9957, .9988, 1.0004, 1);
```

### 逐点解读

| 索引 | 值 | 含义 |
| ---: | ---: | :--- |
| 0 | 0 | 起点 |
| 1–3 | .2459 / .6526 / .9468 | 加速段（0→95% 只用了 4 个采样点） |
| 4 | **1.0764** | 首次越过 1（+7.6%） |
| 5 | **1.0915** | **峰值过冲 +9.15%** |
| 6–8 | 1.0585 / 1.0219 / .9993 | 回落 |
| 9 | **.9914** | 反向欠冲 −0.86% |
| 10–13 | .9921 / .9957 / .9988 / 1.0004 | 二次微振 |
| 14 | 1 | 收敛 |

**阻尼比反解**（把峰值过冲 `+9.15%` 代入二阶系统 `exp(-πζ/√(1-ζ²)) = 0.0915`）：

```
ζ ≈ 0.594
```

这与 4.x 文档中 `SPRING_BOUNCY`（`stiffness 600 / damping 30 / mass 1`，ζ=0.612，过冲 +8.8%）**高度接近但不相等**。差异来自采样离散化：`linear()` 的 15 个点是对连续弹簧的**分段线性逼近**，峰值会被采样点位置放大或缩小。

> **观测 vs 推断**：采样点数值是观测；`ζ ≈ 0.594` 是从过冲量反解的**推断**；"它就是 `SPRING_BOUNCY` 的 CSS 化"是**推断**（两者过冲差 0.35 个百分点，不能视为同一常量）。
>
> **为什么重要**：这意味 5.x 的按钮弹性**不需要 JS 运行时**。4.x 用 Framer Motion 弹簧驱动按钮，5.x 用一条 `linear()` 曲线 + `animation` 就能得到近似效果，且可被 `prefers-reduced-motion` 与 `[data-reduce-motion]` 统一拦截。

---

## 4.4 56 个关键帧的分类学

| 族 | 关键帧 | 数量 | 触发面 |
| :--- | :--- | ---: | :--- |
| pill 胶囊 | `cds-pill-in` / `-out` / `-pop-up` / `-pop-down` / `-dip-up` / `-dip-down` / `-roll-in-up` / `-roll-in-down` / `-roll-out` | 9 | 模型选择、工具胶囊、下拉 |
| shimmer 微光 | `cds-shimmer` / `cds-shimmer-text-band{,-rtl,-strong,-strong-rtl}` / `cds-shimmer-text-shine{,-rtl,-strong,-strong-rtl}` | 9 | 生成中文字、加载标题 |
| scroll-fade 渐隐 | `cds-scroll-fade-{top,bottom,left,right}` / `-x-active` / `-y-active` / `-strip-{in,out,active}` | 9 | 滚动容器边缘遮罩 |
| skeleton 骨架 | `cds-skeleton-sweep` / `cds-skeleton-breathe` / `cds-placeholder-reveal` / `cds-grid-rows-in` | 4 | 占位、首屏 |
| resolve 解析 | `cds-resolve-glyph` / `cds-resolve-square` | 2 | 工具调用结果落定 |
| drop 拖放 | `cds-drop-icon-rise` / `cds-drop-ring-in` | 2 | 文件拖入 |
| working-dot | `cds-working-dot-veil` / `-lands` / `-halo` | 3 | 思考中三点 |
| sticky-edge | `cds-sticky-edge-{start,end,active}` | 3 | 粘性表头边缘 |
| 进场/退场 | `cds-fade-in` / `cds-reveal-in` / `cds-reveal-out` / `cds-morph-in` / `cds-chip-in` / `cds-attachment-out` / `cds-slide-in-{start,end}` | 8 | 通用 |
| 页面级 | `cds-page-tabs-arrive` / `cds-page-title-leaves` / `cds-flipbook` / `cds-progress-sweep` / `cds-dot-pulse` / `cds-editor-comment-working` | 6 | 页面切换、进度、评论 |
| 第三方 | `spin` | 1 | Tailwind spinner |

> 合计 **56** 个 `@keyframes`（含 `spin`）。所有 CDS 族前缀统一为 `cds-`，可据此判断"这是 CDS 自带动效"还是"业务自写"。

### 组合式动画（观测）

```css
animation: cds-pill-pop-up calc(var(--cds-dur-base) * .4) var(--cds-ease-out),
           cds-pill-pop-down calc(var(--cds-dur-base) * .6) var(--cds-ease-overshoot)
             calc(var(--cds-dur-base) * .4);
animation: cds-pill-in var(--cds-dur-snap) var(--cds-ease-overshoot),
           cds-fade-in var(--cds-dur-snap) var(--cds-ease-out);
animation: cds-pill-dip-down calc((var(--cds-dur-snap) + 40ms) / 2) var(--cds-ease-out),
           cds-pill-dip-up   calc((var(--cds-dur-snap) + 40ms) / 2) var(--cds-ease-out)
             calc((var(--cds-dur-snap) + 40ms) / 2);
```

> **观测结论**：pill 的"弹"不是一条曲线完成的，而是**上下两半拼接**：前半段用 `ease-out` 起势、后半段用 `ease-overshoot` 收口，两段共享 `--cds-dur-base` 的 40%/60% 切分。复刻时若用单条 `ease-overshoot`，观感会"整体弹一下"而不是"先抬后压"。

---

## 4.5 滚动渐隐关键帧族

4.x 文档记录的是 7 档非线性 `mask-image`。5.x 改为**滚动驱动 + 注册属性**：

```css
@property --cds-scroll-fade-top    { syntax: '<number>'; inherits: false; initial-value: 0; }
@property --cds-scroll-fade-bottom { … }
@property --cds-scroll-fade-left / -right / -size / -strip-raw / -x-active / -y-active …
```

共 18 个 `--cds-scroll-fade-*` 注册属性，配合：

| 关键帧 | 作用 |
| :--- | :--- |
| `cds-scroll-fade-top` / `-bottom` | 纵向两端淡出量动画 |
| `cds-scroll-fade-left` / `-right` | 横向 |
| `cds-scroll-fade-x-active` / `-y-active` | 轴激活态（有溢出才启用遮罩） |
| `cds-scroll-fade-strip-in` / `-out` / `-active` | 滚动条/边缘条带 |

> **与 AGENTS.md 的关系**：AGENTS.md §2 已注明"3.6556.2 客户端用 `@property` + `animation-timeline: scroll()`，无硬编码多档 mask；7 档 mask 仅作无滚动驱动引擎的静态回退"。本版**延续该实现**并把它扩到四边 + 条带。因此 7 档 mask 仍只应作为 fallback，不应作为主路径。

---

## 4.6 降级与 reduced-motion

本版有**两条**降级通道：

1. **系统级**：`@media (prefers-reduced-motion: no-preference)` 包裹所有 `motion-safe:*` 工具类。
2. **应用级**：同一批规则再叠一层 `:not(:where([data-reduce-motion=true], [data-reduce-motion=true] *))`。

```css
@media (prefers-reduced-motion:no-preference){
  .motion-safe\:animate-\[cds-placeholder-reveal_150ms_ease-out\]
    :not(:where([data-reduce-motion=true],[data-reduce-motion=true] *)){ … }
}
```

> **工程含义**：`data-reduce-motion` 是**宿主可控的运行时开关**（不依赖 OS 设置）。复刻时必须同时支持两者，否则在"系统未开降低动效、但用户在本应用里关闭动效"的场景下会漏降级。

---

## 4.7 5.x 弹簧全量清单（22 组）

对 `ion-dist.asar:assets/v1` 全量正则提取 `stiffness/damping/mass`，剔除 framer-motion vendor 自带默认值（`100/10`、`500/25`）后，客户端共有 **22 组**独立弹簧配置（2.42304.2 时代记录为 14 组）。

| 配置 | 命中 | 首个出现位置 | 上下文信号（观测） |
| :--- | ---: | :--- | :--- |
| `320/30` | 4 | `caa5bd1d0` | `initial:{opacity:0,x:32}` → 表单/列表横向滑入 |
| `300/35/mass 1` | 3 | `c4167c038` | `hidden→show translateY 32→0` → 交错列表入场 |
| `300/30` | 2 | `c4a1e6da6` | `p/2` 居中量 → 滑动指示器 |
| `600/30` | 1 | `shared-8` | `micStream` / `isMuted` → **麦克风与语音条** |
| `400/40` | 1 | `c71dee58b` | 宽高比钳制（`w/h`）→ 媒体尺寸过渡 |
| `100/30` | 1 | `cf8e2003d` | 百分比进度（`pct`）→ 进度条 |
| `260/32` | 1 | `c85d5a1f8` | 问答示例（question/answer）→ 表单展开 |
| `1200/70/mass 1` | 1 | `ca2ef848d` | `fromY/toY/velocity` → 手势驱动的回弹 |
| `950/55/mass .85` | 1 | `cddbfc1b6` | `data-emphasized` 文本 span → 强调弹动 |
| `300/20/mass .5` · `150/15/mass .8` · `200/25/mass .5` | 各 1 | `c4a1e6da6` | 同一模块三连 → 轮播/拖拽子系统 |
| `500/46` | 1 | `c9543da06` | `children.slice` 重排 → 拖拽排序落位 |
| `500/50` | 1 | `ce28369f9` | 随机 `rotateZ ±360` + `delay` → 庆祝粒子 |
| `500/30/mass .7` | 1 | `c04e7453f` | `flex-wrap` chips → 胶囊布局 |
| `320/28` | 1 | `c427176b2` | `e.top-t.top` 排序 → **拖拽释放回弹** |
| `1200/80/mass .1` | 1 | `cc705195d` | 同文件常量 `320 / 480 / 384` → **file_viewer 面板宽度** |
| `300/22` | 1 | `c0447db9a` | `swingIn` + `rotate -90/0` → 手柄摆动 |
| `260/16` | 1 | `c0447db9a` | `rotate:-90` + `exit scale:.6` → **捕获选择手柄** |
| `420/28` | 1 | `c0447db9a` | `drag` + `dragElastic:.05` + `scale .25→1` → **捕获浮层** |

> **四套预设的调用点在本版未变**：`600/30` 仍是麦克风、`320/28` 仍是拖拽回弹、`420/28` 仍是捕获浮层、`1200/80/0.1` 仍是 `file_viewer` 面板宽度（同文件还带着 `320 / 480 / 384` 三个宽度常量）。AGENTS.md §2 的调用点表对 5.11492.5 **仍然成立**。
>
> **新增的是"外围"弹簧**：22 组里只有 6 组属于 AGENTS.md 记录的规范集，其余 16 组是业务侧自建（表单、进度、庆祝、轮播、chips）。复刻时不应把它们当 CDS 规范照抄。

## 4.8 证据索引（本篇）

| ID | 类型 | 位置 | 支撑结论 |
| :--- | :--- | :--- | :--- |
| E4-1 | 观测 | `MainWindowPage-lhEHjHfd.css`，语义层 dur/ease 声明 | 5 档时间 + 3 条曲线 |
| E4-2 | 观测 | 同上，`--cds-btn-spring` 定义 | `linear()` 15 采样点 |
| E4-3 | 观测 | 同上，`@keyframes` 全量统计 | 56 个关键帧 |
| E4-4 | 观测 | 同上，`animation:` 组合声明 | pill 两段拼接 |
| E4-5 | 观测 | 同上，`@property --cds-scroll-fade-*` ×18 | 滚动渐隐实现 |
| E4-6 | 观测 | 同上，`prefers-reduced-motion` + `[data-reduce-motion]` | 双通道降级 |
| E4-7 | 推断 | 由 E4-2 峰值 1.0915 反解 | ζ ≈ 0.594 |
| E4-8 | 观测 | `ion-dist.asar:assets/v1/*.js` 全量 `stiffness/damping/mass` 提取 | 22 组弹簧及其上下文信号 |

<p align="center"><a href="03-作用域与组件属性契约.md">← 第三篇</a> · <a href="README.md">📚 本卷索引</a> · <a href="05-Artifact类型系统与契约协商.md">第五篇 →</a></p>



---

---
title: Artifact 类型系统与契约协商
part: 5
category: 运行时
domain: Artifact 平台
---

<p align="center"><a href="04-动效令牌与弹簧线性化.md">← 第四篇</a> · <a href="README.md">📚 本卷索引</a> · <a href="06-设计系统技能与复刻工程.md">第六篇 →</a></p>

# 第五篇：Artifact 类型系统与契约协商

> **技术领域与英文指代**：artifact 运行时（frame runtime）、契约版本（contract version）、能力声明（capability）、前进式协商（forward negotiation）、画布索引（canvas index）、画板（artboard）、设计系统安装（design-system install）、内核（kernel）。

5.x 新增了一整套**本地 artifact 运行时**：`design`（画布）与 `slides`（演示）两种产物类型，各自带一个沙箱化的编辑器、一份 SKILL.md 和一份能力清单。本篇记录其契约模型与文件格式。

---

## 5.1 frame 契约：129 个版本的前进式协商

`app.asar:resources/frame/runtime/contracts/` 下每个版本一个 `index.json`：

| 事实 | 观测值 |
| :--- | :--- |
| 版本总数 | **129** |
| 版本区间 | `0.1.0` → `0.2.96` |
| 最新版 capability 数 | **26** |
| 最新版 change 数 | **93** |
| 最新版 inertChanges 数 | **65** |
| 顶层键 | `capabilities`、`changes`、`claude`、`core`、`inertChanges` |

```json
{
  "capabilities": ["artifact","assets","camera","comments","db","desktop","dictation","downloads",
                   "embed","endpoints","files","geolocation","mcp","microphone","motion","network",
                   "paste","permissions","reads","room","sample","screenshare","self","speech","tts","user"],
  "changes": ["artifact","artifact-files","artifact-publish-preconditions", …],
  "claude": true,
  "core": {"permissions": …},
  "inertChanges": ["artifact-edit-anchors","artifact-edit-script-style-text-docs", …]
}
```

> **`inertChanges` 是这套设计的精髓**：契约版本必须单调前进（版本号只能加不能减），但有些变更**尚未生效**。于是用 `inertChanges` 声明"这条 change 已在表里但暂不生效"——客户端可以安全地按最新版本号协商，服务端按 inert 列表决定是否真的启用。这是**能力开关与版本号解耦**的标准做法。

### capability 的引入时间线（首见版本）

| 版本 | 新增 capability |
| :--- | :--- |
| 0.1.0 | `mcp` |
| 0.1.5 | `self` |
| 0.1.7 | `downloads` |
| 0.1.11 | `permissions` |
| 0.1.14 | `user` |
| 0.1.16 | `db` |
| 0.1.18 | `comments` |
| 0.1.20 | `sample` |
| 0.1.23 | `assets` |
| 0.1.28 | `room` |
| 0.2.0 | `artifact` |
| 0.2.5 | `embed` |
| 0.2.21 | `network` |
| 0.2.30 | `notifications` |
| 0.2.36 | `endpoints` |
| 0.2.54 | `files` |
| 0.2.59 | `camera` / `geolocation` / `microphone` / `motion` / `screenshare` / `speech`（**同版六连发**） |
| 0.2.68 | `reads` |
| 0.2.70 | `dictation` |
| 0.2.81 | `paste` |
| 0.2.84 | `tts` |
| 0.2.90 | `desktop` |

> **注意 `notifications` 的消失**：`0.2.30` 引入、最新版 26 个 capability 中**不含** `notifications`，且 `changes` 里有 `notifications-removed`。这是唯一一个被移除的 capability，说明契约允许"能力退场"，退场通过 change 记录而非改版本号。

---

## 5.2 26 个 capability 与 93 条 change

按功能分组（依据名称与 `design`/`slides` manifest 的实际使用）：

| 组 | capability | 说明 |
| :--- | :--- | :--- |
| 产物 | `artifact` `assets` `files` `downloads` `embed` `sample` | 产物读写、资源、导出、嵌入、示例数据 |
| 数据 | `db` `reads` `endpoints` | 本地数据库（带规则）、读取、自定义端点 |
| 协作 | `comments` `room` `user` `permissions` | 评论锚点、实时房间、用户资料、权限 |
| 设备 | `camera` `microphone` `screenshare` `geolocation` `speech` `dictation` `tts` `motion` | 媒体与传感器 |
| 平台 | `mcp` `network` `paste` `desktop` `self` | MCP 服务器、网络、粘贴、桌面集成、自引用 |

### capability 的实现清单（补检）

契约里声明 26 个 capability，但 `resources/frame/runtime/_runtime/` 只随包 **20 个模块**（`runtime.hash.json` 的 `capabilities` 键）。逐个模块提取 `mount()` / `wrap()` 后得到真实 API：

| capability | 模块大小 | 暴露的方法 |
| :--- | ---: | :--- |
| `artifact` / `self` | 122,745 B | edit, metadata, publish, search, sync |
| `comments` | 28,043 B | anchorFor, canSendToClaude, create, customAnchors, delete, openComposer, reply, resolve, sendToClaude, ui |
| `sample` | 24,188 B | json, limits, sample |
| `room` | 20,237 B | emit, followControls, join, leave, presence |
| `db` | 13,304 B | delete, get, query |
| `embed` | 10,703 B | list |
| `reads` | 10,412 B | get, query |
| `mcp` | 8,570 B | callTool, describeTool, invalidate, listTools, server |
| `user` | 7,477 B | avatarUrl, can, canEdit, email, id, isOwner, me, name, profiles, search |
| `files` | 6,823 B | asSampleTools, download, list, read |
| `endpoints` | 6,688 B | fetch, openapi |
| `permissions` | 5,859 B | manage, request, state |
| `tts` | 5,556 B | add, languages, pause, resume, setRate, speak, stop, voices |
| `assets` | 4,907 B | delete, list, upload |
| `dictation` | 3,846 B | start, stop |
| `downloads` | 3,459 B | save |
| `paste` | 2,677 B | read |
| `desktop` | 896 B | 仅事件监听（无方法） |
| `network` | 323 B | origins |

**未随包模块的 6 个**：`camera`、`geolocation`、`microphone`、`motion`、`screenshare`、`speech`（均在 `0.2.59` 引入）。它们在契约里是 capability，但 `_runtime` 里没有对应文件——**推断**由桌面壳（`app.asar` 主进程 / `swift_addon`）实现，artifact 侧只拿到代理对象。

> 所有 capability 都用同一套骨架：`e.pipe("<cap>")` 建管道 → `e.mount("<cap>", { method: pipe.wrap("method", impl) })`。所以"方法表"就是 `wrap()` 的第一个参数，可静态枚举。

`design` 只声明 10 个：`downloads` `artifact` `comments` `room` `db` `assets` `user` `sample` `paste` `flags`；
`slides` 在此基础上多一个 `mcp`（绑定 `Google Drive` 的 `create_file` / `gdrive_upload`）。

---

## 5.3 design / slides 类型清单

`app.asar:resources/frame/types/design.artifact.json`（slides 同构）：

| 字段 | design | slides |
| :--- | :--- | :--- |
| `key` | `design` | `slides` |
| `title` / `description` | Design / "Design canvas for websites, landing pages, screens, UI mockups, wireframes, posters…" | Slides / "Presentation decks: 16:9 slides to present, page through and download." |
| `contract` | `0.2.47` | `0.2.47` |
| `favicon` | 🎨 | 📽️ |
| `icon` / `tint` | `Palette` / `violet` | `Slides` / `yellow` |
| `capabilities.db.rules` | `[{path:"", write:"admin"}]` | `[{path:"", write:"admin"}, {path:"notes", read:"admin", write:"admin"}]` |
| `artifact.prod.slug` | `bcd2878f-a88d-4094-a616-8e39d8a5fd8a` | `3e9dc3d6-8a10-4143-ac0b-5af4f2b03a61` |

**feature flags（逐类型）**：

| design | slides |
| :--- | :--- |
| `appifact_bottom_toolbar` | `appifact_bottom_toolbar` |
| `appifact_creation_sequence` | `appifact_creation_sequence` |
| `appifact_extra_export_formats` | `appifact_extra_export_formats` |
| `appifact_icon_set` | `appifact_icon_set` |
| `design_artboards_at_address` | `slides_phone_remote` |
| `design_cross_canvas_paste_confirm` | `slides_send_to_google_slides` |
| `design_fast_edit` | `slides_source_decks` |
| `design_fast_edit_sample` | `slides_theme_tab` |
| `design_theme_tab` | `tidal_glowing_ember` |
| `tidal_glowing_ember` | |

> `tidal_glowing_ember` 在两个类型里都出现，且与功能无关——**推断**为跨类型的实验分组名（代号式 flag），而非某个具体 UI 开关。

---

## 5.4 canvas.json v3 与 `.dc.html` 画板

`design/SKILL.md` 给出了完整的索引契约（原文节选 + 结构化）：

```json
{"v":3,
 "createdOnFiles":{"v":1,"at":"2026-09-14T18:20:00Z"},
 "title":"Spring Menu Poster",
 "launch":{"view":"canvas"},
 "pages":[],
 "boards":{"Main.dc.html":{"x":0,"y":0,"w":880,"h":560}},
 "order":["Main.dc.html"],
 "notes":{},
 "designSystems":[]}
```

| 键 | 约束 |
| :--- | :--- |
| `v` | 固定 `3` |
| `title` | 必填，画布名（不允许 "Design"/"Untitled"） |
| `boards` | 每块画板一条，键为 `project/` 下的 `.dc.html` 路径；`w`/`h` ∈ 40–8000；同行间距 80px、行间 120px |
| `order` | 与 `boards` 同键集，从后到前；首块必须命名 `Main.dc.html` |
| `pages` | ≤40，id 匹配 `[A-Za-z0-9_-]{1,40}` |
| `notes` | <1000 条；`kind:"title1"` 是"多画板标题"，普通便签用 `w` + `size` |
| `launch` | `{"view":"canvas"}` 或 `{"view":"focused","file":"Main.dc.html"}` |
| `designSystems` | 只有"安装设计系统"这一步会写 |

**写盘纪律**（原文）：`Write only under project/`；单次调用上限 **16 MB**；单画布上限 **512 个文件 / 256 MB**。

**沙箱边界**：`project/ds/` 之外的所有 `.dc.html` 都会被渲染，包括 `<dc-import>` 进来的；`project/ds/` 内的文件只有"安装设计系统"能写。

> **技术意义**：这是"**文件即产物**"的模型 —— 画布不是数据库，而是一个受约束的目录 + 一个 JSON 索引。`.dc.html` 是带自定义元素（`<dc-import>`、`$preview`、`<helmet>`）的 HTML 方言，由 `dc-runtime.js`（188,749 B，内嵌 React 18 production 构建）解释。

---

## 5.5 设计系统目录与 `project/ds`

`design` 类型的第四步是**强制**的：

> `4. Using a design system? INSTALL it: a MUST. Without project/ds/<folder>/tokens.json AND its designSystems record the Theme menu shows bare hexes.`

| 规则 | 内容 |
| :--- | :--- |
| 目录名 | `[a-z0-9][a-z0-9_-]{0,63}`，由 namespace 规整而来；不符合则整页跳过 |
| 必要文件 | `project/ds/<folder>/tokens.json` |
| 索引记录 | `designSystems` 追加 `{title, namespace, artifact, version, copiedAt}` |
| 来源 | 必须是**被授予的地址**（instructions / 用户 / `list`），不得从系统或索引里读 |
| 复制失败 | 用文件工具（**不是 shell**）把读到的 `tokens.json` 存到该路径，作为文件发送 |
| 主题菜单 | 缺 tokens.json 或缺记录 → 只显示裸十六进制色值，不显示主题 |

> **对 CDS 复刻的启示**：`tokens.json` 是设计系统**唯一被识别的入口**。任何"设计系统"若只给 CSS 变量、不给 tokens.json，在这个运行时里会被降级为"裸色板"。

---

## 5.6 证据索引（本篇）

| ID | 类型 | 位置 | 支撑结论 |
| :--- | :--- | :--- | :--- |
| E5-1 | 观测 | `app.asar:resources/frame/runtime/contracts/*/index.json` | 129 版本、26 capability、93 change、65 inert |
| E5-2 | 观测 | `contracts/0.2.96/index.json` | 最新 capability / change 全表 |
| E5-3 | 观测 | 逐版本 `capabilities` 差集 | capability 首见时间线 |
| E5-4 | 观测 | `resources/frame/types/design.artifact.json` | design manifest 全字段 |
| E5-5 | 观测 | `resources/frame/types/slides.artifact.json` | slides manifest 全字段 |
| E5-6 | 观测 | `resources/frame/types/design/SKILL.md` | canvas.json v3、写盘纪律、限额 |
| E5-7 | 观测 | `resources/frame/types/design/artifact-type/dc-runtime.js@1` | React 18 production 许可头 |
| E5-8 | 观测 | `resources/frame/runtime/runtime.hash.json` | capability → 模块文件映射（20 个） |
| E5-9 | 观测 | `resources/frame/runtime/_runtime/*.js` 的 `mount()`/`wrap()` | 19 个模块的 API 方法表 |

<p align="center"><a href="04-动效令牌与弹簧线性化.md">← 第四篇</a> · <a href="README.md">📚 本卷索引</a> · <a href="06-设计系统技能与复刻工程.md">第六篇 →</a></p>



---

---
title: 设计系统技能与复刻工程
part: 6
category: 工程复刻
domain: 工程实践
---

<p align="center"><a href="05-Artifact类型系统与契约协商.md">← 第五篇</a> · <a href="README.md">📚 本卷索引</a></p>

# 第六篇：设计系统技能与复刻工程

> **技术领域与英文指代**：设计系统草案（design-system draft）、令牌契约（token contract）、主题集（theme set）、对比度门槛（contrast threshold）、品牌佐证（brand evidence）、启动占位（boot placeholder）、首帧上报（first-paint report）、复刻矩阵（reproduction matrix）。

本篇把 5.x 的两条"设计系统官方口径"与一条"启动体验协议"合起来，最后给出与 4.16336.0 的差异表和复刻清单。

---

## 6.1 `draft-design-system`：tokens.json 契约

`app.asar:resources/bundled-skills/draft-design-system.skill`（52,619 B，含 `SKILL.md` 10,903 B、`design-system-guide.md` 14,645 B、样例 `samples/seazar/tokens.json` 11,291 B）是**官方给出的设计系统文件规范**。它定义的 `tokens.json` 形状，与第 5 篇的 `project/ds/<folder>/tokens.json` 是同一份契约。

### 顶层结构

```json
{ "version": 1,
  "color": {
    "themes": [ {"id":"light","name":"Light"}, {"id":"dark","name":"Dark"} ],
    "tokens": [
      {"name":"surface-100","value":{"light":"#fbf7f1","dark":"#1d1a17"},"usage":"Page background."},
      {"name":"ink","value":{"light":"#2b2118","dark":"#f3ece3"},"usage":"Text on surface-100."} ] },
  "type": {
    "fonts": [ {"family":"Acme Sans","file":"fonts/AcmeSans-Regular.woff2","weight":"400"} ],
    "families": { "sans":"\"Acme Sans\", system-ui, sans-serif" },
    "groups": [ {"name":"Text","family":"sans","styles":[
      {"name":"body","fontSize":"15px","lineHeight":"22px","fontWeight":400} ]} ] },
  "spacing": { "tokens": [ {"name":"space-4","value":"16px","usage":"Card padding."} ] },
  "radius":  { "tokens": [ {"name":"radius-md","value":"8px","usage":"Buttons, cards."} ] } }
```

### 六条硬规则（原文归纳）

| # | 规则 | 后果 |
| ---: | :--- | :--- |
| 1 | 除 `type` 外，每个家族都是 `{"tokens":[{"name","value","usage"}]}` **列表** | 写成 DTCG 的 name→value **映射**会"家族显示为空，且用户第一次编辑时条目全部丢失" |
| 2 | 名称 `[A-Za-z0-9][A-Za-z0-9_.-]{0,63}`，不带 `--` 前缀 | `bg-100` ✅ / `--bg-100` ❌ |
| 3 | 名称跨家族**全局唯一**（`type` 除外） | 重名条目被丢弃 |
| 4 | 颜色值只接受 hex / `rgb()` / `hsl()` / `oklch()` 等**无嵌套函数**写法，或 `"{other-token}"` 别名 | `var()`、`color-mix()`、命名色（`red`/`transparent`/`currentColor`）**全部丢弃** |
| 5 | 缺某主题值的令牌**继承第一个主题** | 主主题必须放第一位 |
| 6 | 长度 `px|rem|em|%` 或纯数字（=px）；`lineHeight` 可无单位；`fontWeight` 数字或 `"300 800"` | — |

可选家族（同 `{tokens:[…]}` 形状）：`shadow`（按主题给 box-shadow 字符串）以及任意其他键（`opacity`、`zIndex`…）。**明确不含 motion 令牌**（原文：`No motion tokens.`）。

### 编译产物

`tokens.json` 会被编译成 `tokens.css`：`--surface-100`、`--space-4`、`--font-sans`、一个 `.body` 类、以及 `@font-face`。组件包 `bundle.css` 与预览页都应消费这些自定义属性。

> **与 CDS 的关系**：CDS 的 934/1080 个令牌是**运行时内部实现**；`tokens.json` 是**对外交付格式**。两者不是同一层：CDS 令牌有 `calc()`/`hsl(from …)`/`var()` 链，而 `tokens.json` **明确拒绝** `var()` 与 `color-mix()`。复刻时若要"导出成可被 Claude 识别为设计系统"，必须把 CDS 令牌**求值成具体值**再导出。

---

## 6.2 三主题与对比度硬约束

样例 `samples/seazar/tokens.json` 定义了三个主题：

| id | name | 定位 |
| :--- | :--- | :--- |
| `light` | Light | 主主题（必须第一位，缺失值继承它） |
| `dark` | Dark | 暗色 |
| `high-contrast` | High contrast | 高对比 |

`border` 令牌的 `usage` 原文写死了门槛：

> `Input and control outlines and the rules that divide regions — at least 3:1 against surface and surface-raised in every theme (4.5:1 in the High contrast theme).`

以及高对比主题的实现原则：

> `Cards, menus and the sheet a dialog sits on; in the High contrast theme it is told from surface by a border, not by shade.`

> **工程含义**：这套设计系统**不靠阴影/明度分层做高对比**，而是**加边框**。这与 CDS 的"低对比表面 + 发丝边框"是同一哲学的两个极端：CDS 用 10% 反相 alpha 做发丝，高对比主题把同一条边提到 4.5:1。

---

## 6.3 `frontend-design` 与品牌色佐证

`app.asar:resources/bundled-skills/frontend-design.skill`（8,125 B，`SKILL.md` 9,390 B）在"要避免的套路"一节里点名了陶土色：

> `a warm cream background (near #F4F1EA) with a high-contrast serif display and a terracotta or warm-clay accent (often near #D97757 — Anthropic's own Claude-interaction accent, so on a user's brief it reads as a tell)`

**这是目前最直接的官方措辞**：`#D97757` 被描述为 "Anthropic's own Claude-interaction accent"，同时提醒"在用户 brief 里出现它会被读成套路"。这与 AGENTS.md §1 引用的 3.6556.2 版 `frontend-design` 措辞一致，**5.11492.5 未改动该段**。

`design` 类型的 SKILL.md 另给了一套"品牌化 Anthropic 工作"的配色（原文）：

> `Branded Anthropic work: Ivory #FAF9F5, Slate #141413, Clay #D97757, serif display over sans body`

| 角色 | 官方值 | 本仓库令牌 | 关系 |
| :--- | :--- | :--- | :--- |
| 品牌强调（发起的动作） | `#D97757` Clay | `--cds-clay: #d97757` | **完全一致** |
| 品牌主色（按钮填充） | `#C6613F`（`clay-emphasized`） | `--brand: #c6613f` | **完全一致** |
| 画布 Ivory | `#FAF9F5` | `--cds-surface-0` = `#f9f9f7`（产品值） | 近似但不同（品牌 21 阶 vs CDS 35 阶，见第九篇 9.4） |
| 墨色 Slate | `#141413` | `--cds-text-primary` = `#0b0b0b`（产品值） | 近似但不同 |

> **结论**：CDS 运行时的 `#f9f9f7` / `#0b0b0b` 与品牌物料的 `#FAF9F5` / `#141413` 是**两套近似但不同的值**。做产品 UI 用 CDS 值，做品牌物料用 Ivory/Slate 值，不可互换。完整品牌色板（含 21 阶暖灰与棱镜色）、品牌字号阶梯与 `.dc.html` 产物格式见**第九篇**。

---

## 6.4 启动占位协议（boot placeholder）

这是 5.x 新增的**首帧体验**：在 `claude.ai` 尚未加载时，主窗口先画一个"侧栏骨架"，形状与真实侧栏一致，避免白屏闪烁。

### 协议链路

```
主进程 ──argv 开关──▶ preload ──contextBridge──▶ 渲染层内联脚本
--desktop-boot-placeholder=<JSON>   window.desktopBootPlaceholder   <script>…</script>（head + body 两阶段）
```

| 环节 | 实现 | 证据 |
| :--- | :--- | :--- |
| 开关名 | `--desktop-boot-placeholder=` | `mainWindow.js` 常量 `ac` |
| 解析 | `JSON.parse(argv.slice(27))`（前缀长度 27） | 同上 `sc()` |
| 校验 | `enabled === true`；`frame.sidebarWidth/collapsed/narrowViewportMaxWidth/zoomFactor` 必填；`shapes` 每项 `top/left/width/height/radius` ∈ [0,10000]，**最多 160 个** | 同上 `cc()` / `lc()` |
| 颜色 | `colors.{page,sidebar,seam}` 各 `{red,green,blue,alpha}`，`alpha` ∈ [0,1] | 同上 `uc()` |
| 阶段 | `phase === "head"` 建属性、`phase === "body"` 画形状 | `index.html@656` |
| 折叠 | `width / scale <= narrowViewportMaxWidth` → `data-boot-placeholder-frame="collapsed"` | 同上 |
| 缩放 | `scale = frame.zoomFactor / shellZoomFactor`，写入 `--boot-placeholder-scale` | 同上 |
| 首帧 | `reportFirstPaint === true` 时挂 `PerformanceObserver('first-paint')`，回调 `MainWindowTitleBar.firstPaintPresented()` 并移除 `data-boot-placeholder-ground` | `mainWindow.js` |

### 占位层的配色（回退常量）

```css
html[data-boot-placeholder] body {
  background-color: #fcfcfb;
  --boot-placeholder-sidebar: color-mix(in srgb, #f9f9f7 50%, #fcfcfb);
  --boot-placeholder-seam: rgba(11, 11, 11, 0.1);
  --boot-placeholder-row: rgba(11, 11, 11, 0.05);
}
@media (prefers-color-scheme: dark) { /* #151515 / color-mix(…, black) / 白 10% / 白 7.5% */ }
```

> **数值对齐**：`#fcfcfb` = `gray-10`、`#f9f9f7` = `gray-20`、`rgba(11,11,11,.1)` = `alpha-2`、`rgba(11,11,11,.05)` = `alpha-1`、暗色 `#151515` = `gray-850`、白 7.5% = 暗色 `skeleton-base`。**占位层不是随手画的灰块，而是把 CDS 令牌求值成常量后硬编码**——因为此时样式表可能还没加载。

### 与 CDS 骨架屏的关系

| 维度 | 启动占位（boot placeholder） | 骨架屏（SkeletonGroup） |
| :--- | :--- | :--- |
| 时机 | 首帧之前（HTML 内联脚本） | 应用已加载、数据未到 |
| 依赖 | 零依赖（内联 + 硬编码色） | 完整 CDS 样式表 |
| 形状来源 | 主进程下发 `shapes[]`（≤160） | DOM 结构 + `--cds-skel-i` 级联 |
| 动画 | 无（静态块） | `cds-skeleton-breathe` 2s 无限循环 |

> **复刻建议**：若只做 Web 复刻，可跳过占位层；若要复刻桌面端"秒开"观感，必须实现"形状由宿主下发 + 内联脚本绘制"这条链路，否则无法在 JS 主包加载前画出骨架。

---

## 6.5 与 4.16336.0 的差异表

| 维度 | 4.16336.0（上一卷） | 5.11492.5（本卷） | 影响 |
| :--- | :--- | :--- | :--- |
| Electron | 44.9.3 | **45.2.1** | 主进程 API 基线 |
| `app.asar` | 含前端主体 | **仅主进程 + 壳 + frame** | 打包边界重划 |
| `ion-dist.asar` | `6adff0069a86b0d10…` | `1d55d633d14aede7…`（208 MB） | 需重新对齐 |
| CDS 令牌 | 279 个（仓库收录） | **934**（主窗口）/ **1080**（全量） | 覆盖缺口 |
| 令牌 API | 无版本号 | **`--cds-theme-api: 1`** | 可协商 |
| 主题作用域 | `data-mode` 为主 | `data-mode` + `data-density` + `data-size` + `data-step` + `data-font` + `data-window-active` | 主题矩阵 |
| 组件自反 | 少量 `data-cds` | **48 个** | 可枚举接管 |
| 输入框圆角 | `20px` | `calc(.75rem * scale)` ≈ **11.3px**（comfortable 13.2px） | 视觉明显变化 |
| 动效 | Framer Motion 常量为主 | **CSS 令牌 + `linear()` 弹簧 + 56 关键帧** | 去 JS 化 |
| 滚动渐隐 | `@property` + scroll() | 同左，扩到四边 + 条带（18 个属性） | 增强 |
| Artifact 运行时 | 无 | **frame + 129 契约 + design/slides** | 全新层 |
| 设计系统格式 | 无 | **tokens.json v1 + 三主题** | 对外交付 |
| 首帧体验 | 无 | **boot placeholder 协议** | 新协议 |
| Electron fuses | 未记录 | **9 条，6/7 硬化**（`--inspect` / `NODE_OPTIONS` / `RunAsNode` 均关闭） | 4.x 的 9229 活体方法不可复现 |
| source map | 未记录 | **631 个声明，0 个存在** | 无法回溯原始源码 |
| 宿主面 | 按字符串推断 | **779 文件 / 34 窗口 / 102 IPC 通道 / 65 桥接口**（第七篇） | 可枚举 |
| 侧边浏览器 | 本卷主题 | **仍在**：`launch.json` 4 文件 / `preview_start` 10 文件 / `annotation` 185 / `Sketch` 9 / `__reactFiber$` 2（第八篇已复检） | 新增自动验证 + share proof |
| 启动占位 | 无 | **可自校准**：`swap_*` 遥测上报骨架与真实布局的偏差 | 闭环校准 |

> **诚实边界**：`docs/v4.16336.0/` 的 5.1–5.11（选择状态机、高亮层、组件名反射、XML 序列化、胶囊与详情卡、拖拽上传）在本版**未被推翻，也未逐条复验**。第八篇只确认了它们依赖的机制（Launch / Fiber / annotation / `data-cds`）仍在位，并记录了新增的自动验证回路。

---

## 6.6 复刻清单与质量门禁

### 令牌层

- [x] 引入 `--cds-theme-api: 1`，声明令牌 API 版本。
- [x] 原始阶 9 族 × 35 级 + `neutral-*` 反相别名。
- [x] `alpha-*` 用 `hsl(from var(--cds-neutral-900) …)` 实现"一次声明、双模反相"。
- [x] 语义层明/暗/system **三写**，暗色只覆盖 149 条。
- [x] 角色层 6 族 + `on-*` 按底色分流（不是统一白色）。
- [x] 几何令牌全部乘 `--cds-rem-scale`，`prose` 除外。

### 作用域层

- [x] `data-mode` / `data-density` / `data-size` / `data-step` / `data-font` / `data-window-active`。
- [x] `data-size` 依赖 `--*--xs/--sm/--lg` 后缀族（缺族会静默回退）。
- [x] `data-window-active=false` 把 `role-accent-*` 整体映射到 `gray-*`（含 800→750、850→800 的错位）。

### 动效层

- [x] 5 档 `--cds-dur-*` + 3 条 `--cds-ease-*`。
- [x] `--cds-btn-spring` 用 `linear()` 采样（15 点、峰值 1.0915）。
- [x] pill 动画按 40%/60% 两段拼接，而不是单条曲线。
- [x] `@property` 注册需要过渡的数值属性（否则 `transition-property:--x` 无效）。
- [x] 双通道降级：`prefers-reduced-motion` + `[data-reduce-motion=true]`。

### 质量门禁

```bash
npm run typecheck     # tsc --noEmit
npm run check:tokens  # 文档中每个 `--cds-*` 必须在 cds-theme.css 有定义
npm run build         # tsc -p tsconfig.build.json
```

`check:tokens` 还会断言 `cds-theme.css` 内每个 `@keyframes cds-*` 都有消费类 —— 新增关键帧必须同时给出使用它的选择器，否则门禁失败。

---

## 6.7 证据索引（本篇）

| ID | 类型 | 位置 | 支撑结论 |
| :--- | :--- | :--- | :--- |
| E6-1 | 观测 | `app.asar:resources/bundled-skills/draft-design-system.skill` → `design-system-guide.md@131-180` | tokens.json 形状与六条规则 |
| E6-2 | 观测 | 同上 `samples/seazar/tokens.json@1` | 三主题、border 3:1/4.5:1 |
| E6-3 | 观测 | `resources/bundled-skills/frontend-design.skill` → `SKILL.md@39` | `#D97757` 官方措辞 |
| E6-4 | 观测 | `resources/frame/types/design/SKILL.md@125` | Ivory `#FAF9F5` / Slate `#141413` / Clay `#D97757` |
| E6-5 | 观测 | `app.asar:.vite/build/mainWindow.js`（`ac` / `sc()` / `cc()` / `lc()`） | 占位协议解析与上限 |
| E6-6 | 观测 | `app.asar:.vite/renderer/main_window/index.html@656` | 两阶段内联脚本 |
| E6-7 | 观测 | 同上 `<style>` 块 2（2,652 B） | 占位层回退配色 |
| E6-8 | 观测 | 本卷 01–05 篇全部证据项 | 差异表 |
| E6-9 | 未知 | `ion-dist.asar:assets/v1/` 全量检索 | 侧边浏览器在 5.x 未复检 |

<p align="center"><a href="05-Artifact类型系统与契约协商.md">← 第五篇</a> · <a href="README.md">📚 本卷索引</a></p>



---

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

> **补检（通道名是字面量还是拼的）**：`app.asar:.vite/build` 里只有 **4 条 `claude.*`** 与 **7 条 `electron_window.*`** 通道以完整字面量出现，其余是"前缀 + `_$_` + 命名空间 + `_$_` + 接口 + `_$_` + 方法"的拼接结果；因此图谱把它们记为动态。而 **`ion-dist.asar` 里 `$eipc_message$` 命中为 0**——渲染层从不自己拼通道名，而是先走 `claude-page:host-tools-port` / `artifact-shell:transport-port` 拿 MessagePort，再由 preload 侧完成通道映射。
>
> **发送方校验**：`WindowManager` 的每个 handler 先过 `B(e)`——`e.senderFrame?.parent === null && allowed(url)`，即**只接受顶层 frame 且 URL 在白名单内**；事件类型还要命中固定枚举（含 `restored` / `enterFullscreen` / `leaveFullscreen` / `boundsChanged` / `userCloseRequested` / `displayChanged` / `ready` / `shown` / `hidden`）。

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
| E7-10 | 观测 | `app.asar:.vite/build/index.chunk-DMZztuEy.js`（`B()` / 事件枚举） | 发送方校验与事件白名单 |
| E7-11 | 观测 | `ion-dist.asar:assets/v1` 检索 `$eipc_message$` = 0 | 渲染层走 MessagePort，不拼通道 |

<p align="center"><a href="06-设计系统技能与复刻工程.md">← 第六篇</a> · <a href="README.md">📚 本卷索引</a></p>



---

---
title: 预览面板、元素选择与占位校准（5.x 复检）
part: 8
category: 功能复检
domain: 浏览器与预览
---

<p align="center"><a href="07-窗口、IPC与上下文桥全量清单.md">← 第七篇</a> · <a href="README.md">📚 本卷索引</a></p>

# 第八篇：预览面板、元素选择与占位校准（5.x 复检）

> **技术领域与英文指代**：预览面板（preview pane）、开发服务器清单（launch manifest）、元素选择器（element selector）、React Fiber 反射（fiber reflection）、标注（annotation）、首帧占位校准（placeholder swap calibration）、遥测字段（telemetry field）、分块身份（chunk identity）。

上一篇把宿主面钉死了；本篇回答上一卷遗留的问题：**4.x 的侧边浏览器 / 预览面板 / 元素选择在 5.x 还在不在、变了什么**。方法是对 `ion-dist.asar` 跑一次整包图谱，再按行为特征做定点取证。

---

## 8.1 复检方法

| 项 | 值 |
| :--- | :--- |
| 目标 | `ion-dist.asar`，208,001,845 B，SHA-256 `1d55d633…6aa1b`（图谱记录为 `97fb4267…`，见下方说明） |
| 工具 | Craft Anything `js_app_map`（Deep 模式） |
| 证据 | `ev_a9611d2402bf4980a2f1592ca73e4652648cd794d52982f54db5d4b1e85be75b` |
| 源文件 | **5,749** |
| 图谱结论 | **0 IPC 通道 / 0 窗口 / 233 端点 / 74 路由** |

> **为什么 0 IPC / 0 窗口**：`ion-dist.asar` 是**纯 Web 应用**，没有 `ipcMain` / `BrowserWindow`。它的宿主能力全部来自 preload 注入的全局对象（第七篇的 65 个 `contextBridge` 暴露）。这正好印证了第一篇的三层分工：**主进程在 `app.asar`，产品 UI 在 `ion-dist.asar`，两者只靠桥与端口通信**。
>
> **哈希差异说明**：`js_app_map` 对同一文件记录 `97fb4267…`，`shasum -a 256` 得 `1d55d633…`。差异原因是工具读取的是归档**成员视图**（解包后内容摘要），不是外层 `.asar` 容器字节。两者不矛盾，引用时必须写明是哪一种。

---

## 8.2 预览面板仍然存在（Launch 服务未退场）

按行为特征检索 5,749 个资产，命中如下：

| 特征串 | 命中文件数 | 含义 |
| :--- | ---: | :--- |
| `.claude/launch.json` | 4 | 开发服务器清单仍在 |
| `previewServerId` | 14 | 预览服务器实例标识 |
| `preview_start` | 10 | 启动工具名（模型可调用） |
| `previewPane` | 3 | 面板开关状态 |
| `localhost:` | 12 | 本地服务器地址处理 |
| `Open in browser` | 3 | 外开动作 |

`launch.json` 的读写链路在 5.x 仍是"**检测 → 写清单 → 启动**"三段：

```
"Detect this project's dev servers, write them to .claude/launch.json, then call preview_start."
"Start this project's dev server from .claude/launch.json."
```

错误文案也保留了清单语义：`"Couldn't start {name}. Check that .claude/launch.json has a usable entry for it."`、`"A server with this name already exists in .claude/launch.json."`。

### 新增：自动验证与"share proof"

5.x 引入了一条 4.x 没有的回路（原文，两处设置项）：

> `Claude will automatically start the preview server, verify changes, and share proof before completing its response.`
> `Claude will no longer automatically verify code changes using the preview. You can still ask Claude to verify manually.`
> 两项均注明：`This setting is saved in .claude/launch.json for this project.`

| 变化 | 4.x | 5.x |
| :--- | :--- | :--- |
| 预览启动 | 用户/模型按需 | **可在回复完成前自动启动** |
| 验证 | 无内建回路 | **verify changes + share proof** |
| 开关持久化 | — | 写进项目 `.claude/launch.json` |

> **推断（未验证）**："share proof" 指向把预览截图/状态作为回复证据的一部分；本卷未取得该 UI 的实现代码，只观测到文案与设置项。

---

## 8.3 元素选择仍然存在（Fiber 反射未删）

| 特征串 | 命中 | 说明 |
| :--- | ---: | :--- |
| `Select an element` | 1 | 选择模式的入口文案 |
| `Add to chat` | 4 | 标注/选中后注入对话 |
| `annotation` | 185 | 标注链路仍在 |
| `Sketch` | 9 | 手绘工具条仍在 |
| `elementContext` | 8 | 上下文注入载荷 |
| `__reactFiber$` | 2 | **React Fiber 反射仍在** |
| `vlq` | 3 | sourcemap VLQ 解码仍在 |

React Fiber 的读取方式与 4.x 一致（在元素自有属性里找 `__reactFiber$<random>` 键）：

```js
let a = Object.keys(t).find(e => e.startsWith("__reactFiber$"));
if (a === void 0) return "undetermined";
if (!Object.hasOwn(i, a)) return kS(i);
```

> **这是"同一机制、不同用途"的证据**：5.x 里这段代码不再用于组件名展示，而用于**元素归类**（见 8.4）。机制没退场，调用点变了。

---

## 8.4 首帧占位校准：`swap_*` 遥测

5.x 的启动占位（第六篇 6.4）不只是"画个骨架"，它还有一套**回填校准**：真实 DOM 出现后，测量骨架与真实布局的偏差并上报。

### 测量项（`shared-33-CTzZG30c.js`）

| 内部字段 | 遥测字段 | 含义 |
| :--- | :--- | :--- |
| `textOriginDeltaXPx` / `…Y` | `swap_text_origin_delta_x_px` / `…_y` | 输入框文字原点偏移 |
| `textColumnDeltaWidthPx` | `swap_text_column_delta_width_px` | 文字列宽偏移 |
| `cardDeltaXPx` / `…Y` / `…Width` / `…Height` | `swap_card_delta_*` | 卡片位置与尺寸偏移 |
| `wordmarkDeltaXPx` / `…Y` | `swap_wordmark_delta_*` | 品牌字标偏移 |
| `wordmarkSettledKind` | `swap_wordmark_settled_kind` | `serif_text` 或 `brand_svg` |
| `greetingDeltaYPx` | `swap_greeting_delta_y_px` | 问候语纵向偏移 |
| `noticeAboveCardOffsetPx` | `swap_notice_above_card_offset_px` | 卡片上方通知的间距 |
| `topmostElementAboveCard` | `swap_topmost_element_above_card` | 卡片上方最上层元素分类 |
| `sidebarChromePresented` / `…Settled` | `sidebar_chrome_*` | 侧栏外壳是否已呈现 / 已稳定 |
| `prepaintViewportWidthPx` / `…Height` | `prepaint_viewport_*` | 绘制前视口尺寸 |
| `rootFontSizePx` | `root_font_size_px` | 根字号 |
| `scrollCarry.columnPx` / `inputPx` | `swap_*_scroll_carried_px` | 切换时携带的滚动量 |

> **工程意义**：这是"**先猜、再量、后修正**"的闭环。占位层的形状由主进程下发（≤160 个矩形），偏差由渲染层测量并上报，下一次构建就能把 `shapes[]` 调准。比单纯"静态骨架"高一个量级。

### 元素分类器（`FS`）

`topmostElementAboveCard` 的取值来自一个**有序匹配表**：

| 选择器 | 分类值 |
| :--- | :--- |
| `[data-testid="chorus-host-refusal-card"]` | `host_refusal_card` |
| `[data-…korean…]` | `korean_notice_strip` |
| `[data-cds="ChatComposerNotices"]` | `notices_region` |
| `[data-cds-dock-promotion]` | `promotion_slot` |
| `[data-cds-dock-item]` + 祖先 `[data-testid="notice-region-slot-shift"]` | `band_slot_docked_card` |
| `[data-cds-dock-item]` | `composer_docked_card` |
| 向下找到的 React 元素 | `app_element` |
| 无 Fiber 属性 | `non_react_div` / `_span` / `_section` / `_aside` / `_iframe` / `_font` / `_custom_element` / `_other` |
| 超预算 / 找不到 | `undetermined` / `none` |

**预算常量**（可复刻的硬参数）：

| 常量 | 值 | 用途 |
| :--- | ---: | :--- |
| `AS` | **32** | 单次遍历最多检查的元素数 |
| `jS` | **8** | `offsetFrom` 向上回溯的最大层数 |
| `yS` | **120** | 侧栏判定为 `classic`（而非 `none`）的最小宽度 px |

> **`data-cds` 在这里被当作稳定契约使用**：分类器直接匹配 `[data-cds="ChatComposerNotices"]`。这反证了第三篇的结论——`data-cds` 不是调试装饰，而是**跨层协议**。

---

## 8.5 方法论陷阱（本次复检踩到的）

| 陷阱 | 现象 | 结论 |
| :--- | :--- | :--- |
| `_debugOwner` 误判 | 在 2.29 MB 的 `c0c1c41fc-…js` 里命中 `_debugOwner`，看似 React Fiber | 实为 **Monaco 编辑器的引用计数类**（`s4` / `c4`），与 Fiber 无关。真正的 Fiber 反射在 `shared-33-…js`，靠 `__reactFiber$` 前缀匹配 |
| 哈希不可跨层比较 | `js_app_map` 记 `97fb4267…`，`shasum` 得 `1d55d633…` | 前者是成员视图摘要，后者是容器字节；引用时标明口径 |
| chunk id 稳定、hash 变化 | 4.x `c0447db9a-KKfDTbDr.js` → 5.x `c0447db9a-DafcpV70.js` | 跨版本 diff 用 9 位 chunk id 对齐 |
| 图标名冒充设备预设 | `iPhone` / `iPad` 命中 23 个文件 | 实际是图标集（`iPadHomeButton`、`iPhone11`），**不能**据此声称存在视口预设表 |

---

## 8.6 复检结论

| 问题 | 结论 | 置信度 |
| :--- | :--- | :--- |
| 侧边浏览器 / 预览面板是否还在 | **在**（launch.json / preview_start / previewServerId / previewPane） | 观测 |
| 是否新增行为 | **是**：自动启动 + verify changes + share proof，开关写入 `launch.json` | 观测（文案） |
| 元素选择是否还在 | **在**，且**扩到移动模拟器**（`<mobile-simulator-selected-element …>`，见第十篇 10.3） | 观测 |
| 组件名反射是否还用于 UI 展示 | **未知**：Fiber 读取仍在，但当前调用点是占位校准的分类器 | 未知 |
| 视口预设表 | **不存在**：设备概念实为**导出设备框** `deviceFrame`（Padding / Corners / Shadow / Background / Aspect ratio），`iPhone`/`iPad` 命中全是图标名 | 已澄清（见第十篇 10.4） |

> **与 4.x 卷的关系**：`docs/v4.16336.0/` 的 5.1–5.11（选择状态机、高亮层、组件名反射、XML 序列化、胶囊与详情卡、拖拽上传）在本版**未被推翻**，但也**未被逐条复验**。本卷只确认了它们所依赖的机制（Launch、Fiber、annotation、data-cds）仍在位。

---

## 8.7 证据索引（本篇）

| ID | 类型 | 位置 | 支撑结论 |
| :--- | :--- | :--- | :--- |
| E8-1 | 推导 | `ev_a9611d24…` `js_app_map`（ion-dist） | 5749 文件 / 0 IPC / 233 端点 / 74 路由 |
| E8-2 | 观测 | `ion-dist.asar:assets/v1/c325ea79a-BydY1bcv.js` | `.claude/launch.json` 读写、`preview_start` 文案 |
| E8-3 | 观测 | `ion-dist.asar:assets/v1/cf580efe9-C7hrKz8i.js` | 自动验证 / share proof 设置项、清单错误文案 |
| E8-4 | 观测 | `ion-dist.asar:assets/v1/shared-33-CTzZG30c.js`（`FS` / `IS`） | Fiber 反射、元素分类器、预算常量 32/8/120 |
| E8-5 | 观测 | `ion-dist.asar:assets/v1/shared-4-D3_Pnwrg.js` | `swap_*` 遥测字段全表 |
| E8-6 | 观测 | `ion-dist.asar:assets/v1/c0c1c41fc-BaD-ejGO.js` | `_debugOwner` 实为 Monaco，非 Fiber |
| E8-7 | 观测 | 全量特征串检索（`Select an element` 1 / `Add to chat` 4 / `annotation` 185 / `Sketch` 9 / `vlq` 3） | 元素选择与标注链路仍在 |

<p align="center"><a href="07-窗口、IPC与上下文桥全量清单.md">← 第七篇</a> · <a href="README.md">📚 本卷索引</a></p>



---

---
title: 官方品牌规范与画布产物契约
part: 9
category: 品牌与产物
domain: 品牌系统
---

<p align="center"><a href="08-预览面板、元素选择与占位校准.md">← 第八篇</a> · <a href="README.md">📚 本卷索引</a></p>

# 第九篇：官方品牌规范与画布产物契约

> **技术领域与英文指代**：品牌色板（brand palette）、暖灰阶梯（warm grayscale）、字号阶梯（type scale）、可变字重（variable weight）、设计系统安装（design-system install）、画布产物格式（artboard format）、语法卡（syntax card）、运行时 pin（runtime pin）。

前八篇讲的是**产品 UI**（CDS）。本篇讲的是随包分发的**品牌物料规范**与**画布产物格式**——它们和 CDS 是两套并行、且**数值不同**的系统。这部分内容此前完全没被记录过，属于本次补检的主要收获。

---

## 9.1 官方品牌色板

来源：`app.asar:resources/frame/types/design/artifact-type/reference/brand-colors.md`（2,234 B），文件头注明来自设计团队的 `anthropic-design` skill `colors.css`（2025-12-11）。

### 基色（两种就够）

| 名称 | 值 | 用途 |
| :--- | :--- | :--- |
| Ivory | `#FAF9F5` | 页面 / 画板底色。**整页背景永不用纯白** |
| Slate | `#141413` | 文字、暗色表面 |

内容面（卡片、面板）用 `#FFFFFF` 压在 Ivory 上；悬停/选中用 `rgba(115,114,108,0.1)`；**结构边框永不使用彩色**：默认 `0.5px solid rgba(31,30,29,0.15)`，强调 `rgba(31,30,29,0.3)`。

### Claude 系统

| 令牌 | 值 | 说明 |
| :--- | :--- | :--- |
| Claude primary（Clay，Spark 的颜色） | `#D97757` | 强调色，Claude 表面上唯一的强调色 |
| Claude background（Ivory） | `#FAF9F5` | — |
| Claude text（Slate） | `#141413` | — |
| Claude accent（Oat） | `#E3DACC` | 弱填充、分隔线 |
| Main accent（Blue） | `#2A78D6` | **非 Claude 动作的主强调色** |

### 棱镜色（Prismatic，仅插画与构图，不进 UI 骨架）

| 强度 | 名称与值 |
| :--- | :--- |
| Strong | Fig `#C46686` · Sky `#6A9BCC` · Olive `#788C5D` · Clay `#D97757` |
| Subtle | Coral `#EBCECE` · Heather `#CBCADB` · Cactus `#BCD1CA` · Oat `#E3DACC` |

> `Heather` / `Cactus` 与 CDS 的 `--cds-heather: #cbcadb`、`--cds-cactus: #bcd1ca` **完全一致**；`Clay` `#D97757` 与 `--cds-clay` 一致。这三条是品牌与产品唯一严格对齐的颜色。

### 21 阶暖灰

| 档 | 值 | 档 | 值 |
| ---: | :--- | ---: | :--- |
| 1000 | `#000000` | 450 | `#9C9A92` |
| 950 | `#141413`（Slate） | 400 | `#B0AEA5` |
| 900 | `#1A1918` | 350 | `#C2C0B6` |
| 850 | `#1F1E1D` | 300 | `#D1CFC5` |
| 800 | `#262624` | 250 | `#DEDCD1` |
| 750 | `#30302E` | 200 | `#E8E6DC` |
| 700 | `#3D3D3A` | 150 | `#F0EEE6` |
| 650 | `#4D4C48` | 100 | `#F5F4ED` |
| 600 | `#5E5D59` | 050 | `#FAF9F5`（Ivory） |
| 550 | `#73726C` | 000 | `#FFFFFF` |
| 500 | `#87867F` | | |

> 原文强调：`These are WARM grays — never substitute cool grays`。档位是**反向**的（数字越大越深），与 CDS 的 `gray-0`→`gray-900`（数字越大越深）方向相同但档数与取值不同。

---

## 9.2 官方品牌字体与字号阶梯

来源：`…/reference/brand-typography.md`（1,534 B），同样来自 `anthropic-design` skill `typography.css`（2025-12-11）。

### 字体栈（要求逐字使用）

| 角色 | 栈 |
| :--- | :--- |
| Sans（UI 文字、标签、正文） | `'Anthropic Sans', system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` |
| Serif（展示标题、编辑语气） | `'Anthropic Serif', Georgia, 'Times New Roman', Times, serif` |
| Mono（代码） | `'Anthropic Mono', 'JetBrains Mono', 'SF Mono', Monaco, 'Courier New', monospace` |

Anthropic Sans 与 Serif 均为 **可变字重 300–800**。

### 七档字号

| 角色 | 字族 | 字号 | 字重 | 行高 |
| :--- | :--- | ---: | ---: | ---: |
| Display（hero） | Serif | 38px | 330 | 1.2 |
| Title | Serif | 28px | 500 | 1.3 |
| Heading | Serif | 24px | 500 | 1.3 |
| UI XL | Sans | 20px | 400 | 1.4 |
| Body | Sans | 16px | 400 | 1.5 |
| Small / labels | Sans | 14px | 400 | 1.4 |
| Caption | Sans | 12px | 400 | 1.35 |

**字距恒为 0**。原文：品牌感来自暖色板、留白与"衬线标题 + 无衬线正文"，不靠 tracking 技巧；标题用 Serif 的 330–500 中等字重，**永不 faux-bold**；并把 `Inter` / `Roboto` / `Arial` / `Fraunces` 列为"要避免的 AI 默认字族"（Arial/Helvetica 只允许出现在 fallback 栈里）。

---

## 9.3 CDS 产品层的真实字体栈（修正）

此前（含本仓库 AGENTS.md）把 CDS 的字体描述为"系统字体回退栈优先"。**实测不是**：语义层把 `--cds-font-sans` 覆盖成了 Anthropic 字族优先。

```css
--cds-font-sans:         var(--font-anthropic-sans, var(--cds-font-system)), var(--cds-font-system);
--cds-font-sans-display: var(--font-anthropic-sans-display, var(--cds-font-sans)), var(--cds-font-sans);
--cds-font-voice:        var(--font-anthropic-serif, ui-serif), ui-serif, Georgia, "Times New Roman", serif;
--cds-font-mono:         var(--cds-font-mono-override,) var(--font-anthropic-mono, "SF Mono"), "SF Mono", ui-monospace, Menlo, Consolas, monospace;
```

`:root` 里的 `--cds-font-system: ui-sans-serif, system-ui, …` 只是**兜底默认值**，一旦 `--font-anthropic-*` 存在就被顶到最前。

### 七个 `@font-face`（`MainWindowPage-lhEHjHfd.css`）

| 字族 | 样式 | 字重 | 文件 | `font-feature-settings` |
| :--- | :--- | :--- | :--- | :--- |
| `anthropic-sans` | normal | 300–800 | `AnthropicSansMicro-Text-Variable-yAna2Le1.woff2` | `"dlig" 0, "ss01" 1, "ss02" 1` |
| `anthropic-sans-roman-fallback` | normal | 300–800 | `AnthropicSans-Roman-Variable-DDVos-BJ.woff2` | `"dlig" 0` |
| `anthropic-sans` | italic | 300–800 | `AnthropicSans-Italic-Variable-CJtkx3-S.woff2` | `"dlig" 0` |
| `anthropic-sans-display` | normal | 300–800 | `AnthropicSansMicro-Display-Variable-Mpj_akWA.woff2` | `"dlig" 0, "ss01" 1, "ss02" 1` |
| `anthropic-sans-display` | italic | 300–800 | `AnthropicSans-Italic-Variable-CJtkx3-S.woff2` | `"dlig" 0` |
| `anthropic-serif` | normal | 300–800 | `AnthropicSerif-Roman-Variable-2VcCjn5t.woff2` | `"dlig" 0` |
| `anthropic-serif` | italic | 300–800 | `AnthropicSerif-Italic-Variable-Dcb-9NUS.woff2` | `"dlig" 0` |

> **三个可复刻细节**：
> 1. 正文与展示用**两个不同的 Micro 字体文件**（Text / Display），不是同一文件缩放。
> 2. `ss01` / `ss02` 只开在 Text 与 Display 上，斜体与 Serif 都关掉。
> 3. `dlig`（连字）全局关闭——品牌字体默认连字会破坏代码与数字排版。

### 多书写系统回退链

`--font-anthropic-sans` 在 `ui-sans-serif` 之后挂了一长串**按脚本排布**的回退：Devanagari、Bengali、Telugu、Tamil、Gujarati、Kannada、Malayalam、Thai（Thonburi / Leelawadee UI / Noto Sans Thai）、Ethiopic（Kefa / Ebrima / Noto Sans Ethiopic / Abyssinica SIL）。这是"同一套 UI 覆盖南亚与东南亚文字"的工程实现，不能简化成 `sans-serif`。

---

## 9.4 两套暖灰的对照

| 维度 | 品牌（brand-colors） | CDS 产品（`--cds-gray-*`） |
| :--- | :--- | :--- |
| 档数 | **21** | **35** |
| 最深 | `950 #141413` | `900 #0b0b0b` |
| 最浅 | `000 #FFFFFF` | `0 #fff` |
| 页面底色 | `050 #FAF9F5` | `20 #f9f9f7` |
| 中间调 | `500 #87867F` | `400 #898781` |
| 暗面 | `850 #1F1E1D` | `850 #151515` |
| 边框 | `rgba(31,30,29,.15)` / `.3` | `hsl(from neutral-900 … / 10% / 20%)` |

> **结论**：两者**不能互相换算**。品牌物料用 Ivory/Slate 21 阶；产品 UI 用 CDS 35 阶 + 反相别名。本仓库的 `--cds-gray-*` 是产品值，**不是**品牌值——AGENTS.md 里"#FAF9F5 未收录"的说法需要按此理解，不是缺失而是分层。

---

## 9.5 设计系统在画布上的安装契约

来源：`…/reference/design-system-components.md`（12,348 B）。它是第五篇 `project/ds/<folder>` 的**权威细节**：

| 规则 | 内容 |
| :--- | :--- |
| 生效条件 | `project/ds/<folder>/` 下的文件 **且** `canvas.json` 的 `designSystems` 记录**同时存在**，编辑器的色板/文字样式/组件才可用 |
| 上限 | **4 个**设计系统 |
| 冲突 | 同 `namespace` 指向另一 `artifact` id 或另一宿主 → **停下并告知用户**，由用户决定换名或保留哪个 |
| 复制范围 | 文件按系统内路径落到 `project/ds/<folder>/`；必须连带复制它引用的图片、样式、字体、数据文件 |
| 必需文件 | `project/tokens.json`（色板与文字菜单读它）；README 点名时还需 `tokens.css` |
| React | 画板已内置 React 18，系统自带的 React 副本**不会**被采用 |
| 拒绝路径 | 含 `\`、`%`、`:`、`;` 或 `..` 的路径 → **什么都不装**，并说明它指向什么 |
| 发送方式 | 一次 Artifact 调用带齐；只有"系统按 id 保存的文件"或"工具无法作为文件发送的字体/图片"才走 upload |

> **与第六篇的关系**：6.1 的 `tokens.json` 是**数据契约**，本节是**安装契约**。两者缺一，画布上就只剩裸十六进制色值。

---

## 9.6 `.dc.html` 语法卡

来源：`…/reference/format.md`（11,295 B）。画板是"一个自包含 HTML 文件"，由编辑器与 `dc-runtime.js` 解释。

| 语法 | 规则 |
| :--- | :--- |
| 结构 | `<x-dc>` 根 + `<helmet>`（仅字体 `<link>`、`@font-face`、`body{margin:0}`）+ 模板 |
| 洞 | `{{ path }}` **只做点路径查值**（`{{ user.name }}`、`{{ $index }}`、`{{ true }}`）；表达式 `{{ a + b }}`、`{{ fn() }}` **静默失败** |
| 属性 | `x="literal"` → 字符串；`x="{{ path }}"` → 原始值（数字/函数/ref）；`x="a {{p}} b"` → 插值字符串；`class`/`for` 自动映射 `className`/`htmlFor` |
| 事件 | 支持，JSX 驼峰：`onClick="{{ pick }}"`，`pick` 来自 `renderVals()` |
| 分支 | `<sc-if value="{{ cond }}" hint-placeholder-val="{{ true }}">` |
| 循环 | `<sc-for list="{{ items }}" as="item" hint-placeholder-count="3">`，作用域内可用 `{{ item.x }}`、`{{ $index }}` |
| 跳转 | `<a href="Cart.dc.html">` 在 Play 模式切画板；`/sub/Cart.dc.html` 从画布根算；`#id` 画板内滚动；`https://` 开新标签 |
| 状态 | 每个画板**各自持有** `state`；跨屏共享状态必须做成**同一画板** + 多个 `<sc-if>` |
| 逻辑类 | 纯 classic JS（无 TS、无 import/export），必须 `class Component extends DCLogic`；有 `props` / `state` / `setState` / `forceUpdate` / 生命周期，**没有** `render()` |
| 可调参数 | `<script type="text/x-dc" data-dc-script>` 上的 `data-props`：`editor` ∈ text/color/int/float/range/boolean/enum/null，`default` 只种编辑器值，需在 `renderVals()` 里 `this.props.x ?? …` 兜底 |
| 预览尺寸 | `$preview: {"width","height"}`；PAGE 用画板 `w`×`h` |

> **设计含义**：模板里不做计算，一切派生值在 `renderVals()` 里算好再暴露。这是"逻辑与模板分离"的硬约束，也让流式渲染（`hint-*` 占位）成为可能。

---

## 9.7 画布产物规格

| 文档 | 覆盖 | 关键点 |
| :--- | :--- | :--- |
| `print.md`（5,827 B） | 海报 / 传单 / 手册 / PDF | 以 **96 px/in** 的 CSS px 为单位；固定页 vs 流式文档（`print:"flow"` 由 PDF 分页）；`paper` 支持 `letter` / `a4` |
| `diagrams.md`（9,638 B） | 流程图 / 组织图 / 泳道 / 时序图 / 时间线 | 连线锚在"相对边的三分之一"处；有明确的数值规范章节 |
| `view-state.md`（8,779 B） | 观看者视角 | 消息可能带 `<artifact-view-context artifact="…">` JSON（该观看者的实时 room 在场信息）；"这张/这两张/左边那个"必须据此解析，**不能猜**；没有该块时要反问 |
| `craft.md`（16,105 B） | 设计方法论 | 品牌化 Anthropic 工作用 Ivory/Slate/Clay + 衬线标题；Claude Spark 每面只出现一次，不旋转、不变形、不做 lockup；Logo 深底浅字/浅底深字，保持留白与原始比例；两个标记**按序出现，永不合成** |
| `questions.md`（4,419 B） | 建画布前要问的问题 | — |
| `make-from-this.md`（2,014 B） | 从画布再产出别的东西 | — |

> `craft.md` 还写了一条对复刻很重要的判断：**好的 hi-fi 设计植根于既有上下文**（代码库、品牌资产、产品截图、已附设计系统），"从零凭空造整个产品"是最后手段；没有图标/组件时**画占位**，不要画一个糟糕的真东西。

---

## 9.8 frame 的三个 UI 窗口与运行时 pin

`ion-dist.asar` 根目录有 5 个 HTML 入口，其中三个属于 frame 运行时：

| 文件 | `<title>` | 作用 |
| :--- | :--- | :--- |
| `frame-shell.html`（32,089 B） | **Artifact** | 承载单个 artifact（含内联 probe 与 `frame-runtime-pin`） |
| `frame-connect.html`（1,635 B） | **Connect** | 连接握手 |
| `frame-manage.html`（1,632 B） | **Share** | 分享 / 管理 |
| `index.html`（52,618 B） | — | 产品主页面 |
| `client-shell-v1.html`（2,529 B） | — | **锁定壳**：CSP `default-src 'none'`，仅 `script-src 'unsafe-inline' blob:`，`connect/img/style/font/media/frame/worker/object/form/base` 全 `none`，`webrtc 'block'` |

**构建元数据**（三个 frame 页一致）：

```html
<meta name="build-timestamp" content="1794603257">   <!-- ≈ 2026-11-13 -->
<meta name="build-git-hash" content="local">
<meta name="frame-runtime-pin" content="manifest.d7fc1ed70d427533.json">
```

> ⚠️ **已观测到的不一致**：`frame-shell.html` 钉住的 `manifest.d7fc1ed70d427533.json` 在包内**不存在**；实际随包的是 `resources/frame/runtime/_runtime/manifest.10ae6c9474227def.json`。可能是运行时由宿主另行提供，也可能是构建残留。本卷**无法判定**属于哪一种，列为未解项。

---

## 9.9 随包库与构建杂项

### artifact 运行时随包库（`resources/artifact-libs/`，3.7 MB）

| 文件 | 用途 |
| :--- | :--- |
| `npm_chart.js@4.5.0_dist_chart.umd.js` | Chart.js 4.5.0（UMD） |
| `npm_gridjs@5.0.2_dist_gridjs.umd.js` + `…theme_mermaid.min.css` | Grid.js 5.0.2 表格 |
| `npm_mermaid@11.17.2_dist_mermaid.min.js` | Mermaid 11.17.2 图表 |

> 这三者以 `npm_<pkg>@<ver>_dist_…` 命名，说明 artifact 运行时给生成物提供**离线可用的图表/表格/流程图**能力，不需要联网。

### 构建与完整性

| 项 | 观测 | 说明 |
| :--- | :--- | :--- |
| `app.asar:compile-cache/` | 3 个 `.jsc`（`index.js.arm64.jsc`、`index.chunk-xV3fJhc7.js.arm64.jsc`、`index.chunk-B2zFLoEJ.js.arm64.jsc`） | **V8 字节码缓存**，按 arm64 预编译主进程 chunk；对应 preload 暴露的 `desktopNoFlushBytecode` |
| `ion-dist.asar:scc.json` | `chunks:4780, edges:69841, multiChunkSccs:0, sccs:[]` | 构建期强连通分量分析：**4780 个 chunk、69,841 条边、零跨 chunk 环** |
| `ion-dist.asar:custom-3p-gated-imports.json` | `buildId:"spa-dev"`，`imports.cai_vast_rain` 含 `secret` / `hash` / 8 个 preload 文件 | 第三方"门控导入"机制：按构建 id 注入一组 preload；**含密钥，本卷不复制其值** |
| `resources/quick-actions/document.wflow` + `Info.plist` | macOS Automator 工作流（`AMDocumentVersion`） | 系统级"快速操作"集成面 |

---

## 9.10 证据索引（本篇）

| ID | 类型 | 位置 | 支撑结论 |
| :--- | :--- | :--- | :--- |
| E9-1 | 观测 | `app.asar:resources/frame/types/design/artifact-type/reference/brand-colors.md` | 品牌色板、21 阶暖灰、边框规则 |
| E9-2 | 观测 | `…/reference/brand-typography.md` | 三套字体栈、七档字号、反 AI 默认字族 |
| E9-3 | 观测 | `MainWindowPage-lhEHjHfd.css` 语义层 `--cds-font-*` | Anthropic 字族优先（修正 6.x 说法） |
| E9-4 | 观测 | 同上，7 个 `@font-face` | 可变字重 300–800、`ss01/ss02`、`dlig 0` |
| E9-5 | 观测 | `…/reference/design-system-components.md` | 安装契约：4 个上限、冲突停手、拒绝路径 |
| E9-6 | 观测 | `…/reference/format.md` | `.dc.html` 语法卡全表 |
| E9-7 | 观测 | `…/reference/{print,diagrams,view-state,craft}.md` | 96 px/in、连线三分点、view-context、品牌使用规则 |
| E9-8 | 观测 | `ion-dist.asar:{frame-shell,frame-connect,frame-manage,client-shell-v1}.html` | 三个 frame 窗口 + 锁定壳 CSP |
| E9-9 | 观测 | `ion-dist.asar:frame-shell.html` 的 `frame-runtime-pin` vs `resources/frame/runtime/_runtime/manifest.10ae6c9474227def.json` | pin 指向的清单不在包内（未解） |
| E9-10 | 观测 | `app.asar:resources/artifact-libs/` | Chart.js 4.5.0 / Grid.js 5.0.2 / Mermaid 11.17.2 |
| E9-11 | 观测 | `app.asar:compile-cache/`、`ion-dist.asar:scc.json`、`custom-3p-gated-imports.json` | V8 字节码缓存、SCC 统计、门控导入 |

<p align="center"><a href="08-预览面板、元素选择与占位校准.md">← 第八篇</a> · <a href="README.md">📚 本卷索引</a></p>



---

---
title: 移动模拟器、元素上下文与托管策略
part: 10
category: 新功能面
domain: 设备与策略
---

<p align="center"><a href="09-官方品牌规范与画布产物契约.md">← 第九篇</a> · <a href="README.md">📚 本卷索引</a></p>

# 第十篇：移动模拟器、元素上下文与托管策略

> **技术领域与英文指代**：移动模拟器（mobile simulator / emulator）、元素上下文（element context）、载荷（payload）、截图框（device frame）、托管策略（managed settings）、企业策略归一化（policy normalisation）、平台选择（platform select）。

这一篇记录三处 5.x 新增、且 4.x 卷完全没有覆盖的功能面：**移动模拟器集成**、**元素上下文载荷的完整字段**、**托管策略键表**。它们都不属于 CDS 视觉层，但都会影响复刻时的边界判断。

---

## 10.1 元素上下文载荷：五个字段

`ion-dist.asar` 里保留着元素选择工具的**能力说明原文**：

> `Sends Claude a screenshot plus the element's HTML, styles, selector and any React component details.`

即注入载荷 = **截图 + HTML + 计算样式 + 选择器 + React 组件细节**（五项）。这与 4.x 卷 5.3–5.5 的结构一致，但多了一个显式的"React 组件细节"表述。

### 组合器侧的实体模型

元素上下文在输入框里是**一等实体**，与图片、附件、上传、片段、标注、issue、agent 并列：

```js
{ images, fileAttachments, uploads, snippets, annotations, elementContexts,
  agent, issue, restoredIds, quotesAsRows, draftOnThisComputer,
  onRemoveImage, onRemoveElementContext, onClickElementContext,
  onUpdateElementContext, … }
```

| 观察 | 含义 |
| :--- | :--- |
| `elementContexts` 有增删改 + 点击三个回调 | 胶囊可点开、可编辑、可移除（不是只读 chip） |
| 过滤规则 `kv()`：全部为 `kind:"elementContext"` 且无截图、无模拟器视图 → 返回 `[]` | 纯上下文（无截图）不渲染为 chip，避免噪音 |
| 同列表里还有 `annotations` / `issue` / `agent` | 标注、问题、子 agent 与元素上下文共用一条"引用条" |

---

## 10.2 移动模拟器：5.x 的全新设备面

### 能力声明（原文）

> `Claude can launch, tap, and screenshot to test your app, right in the iOS Simulator.`
> `Claude can use the iOS Simulator`
> `Attach a simulator so Claude can see your app`

即：**启动 App、点击、截图**三个动作，直接在 iOS 模拟器里完成。文案用 `{platform, select, android {…emulator…} other {…simulator…}}` 的 ICU 选择器，说明**同一套 UI 同时覆盖 Android emulator**。

### 界面语汇（原文命中）

| 场景 | 文案 |
| :--- | :--- |
| 添加设备 | `Add simulator…` / `Adding simulator…` / `Choose simulator` |
| 附着 | `Attach simulator` / `Attached the simulator` / `Detach the simulator` |
| 历史 | `Simulator history` / `No simulator actions yet.` |
| 动作 | `Running a simulator action` / `Simulator action` |
| 环境检查 | `Checking your simulator setup…` / `Checking for the simulator runtime…` |
| 失败 | `{deviceName} isn't available anymore. Choose another simulator.` / `Another simulator is still being added. Try again when it finishes.` / `Claude Code iOS Simulator has stopped retrying after repeated crashes.` |
| Xcode 前置 | `iOS Simulator platform not found in the selected Xcode at {path}. … or run \`xcodebuild -downloadPlatform iOS\`.` |

### 实现线索（静态）

| 线索 | 命中文件数（`app.asar:.vite/build`） | 说明 |
| :--- | ---: | :--- |
| `Simulator` | 714 次标识符 | 主进程里是主要面 |
| `CoreSimulator` | 113 | 走 Apple 的 CoreSimulator 体系 |
| `SimulatorService` | 19 | 自有服务封装 |
| `xcrun` / `simctl` | 7 / 5 | 命令行桥 |
| `adb` | 21 | Android 侧 |
| `simulatorStatusBar` / `simulatorAppAccessibilityAsserted` / `simulatorAccessibilityAutomationAsserted` | 各 2 | 状态栏与辅助功能自动化断言 |
| `simulatorDeviceConsent` | 6 | **设备级同意**（首次接入需用户授权） |

> **与原生模块的关系**：第七篇列出的 6 个 `.node` 里**没有**模拟器专用模块，所以模拟器能力大概率经 `swift_addon.node` + `xcrun simctl` / `adb` 两条外部命令通道实现。**推断**，未取得调用点。

### 渲染侧

`ion-dist.asar` 的 CDS 样式表里有模拟器屏幕的合成规则：

```css
html[data-sim-native-hole] [data-tiles-line] .tiles-shell:has([data-simulator-native-screen]) { background: 0 0 }
```

`data-simulator-native-screen` + `data-sim-native-hole` 说明：模拟器画面是**原生层透传**到 Web 层的（挖洞合成），不是 WebGL 里重绘的截图流。这解释了为什么模拟器能保持 60fps 与真实触感。

---

## 10.3 模拟器里的元素选择

`ion-dist.asar` 里存在专门的标记串：

```
<mobile-simulator-selected-element …
```

| 事实 | 含义 |
| :--- | :--- |
| 选择结果以自定义标签形式进入文本流 | 与浏览器面板的元素上下文**共用同一条注入链路** |
| 解析函数先判 `bo(e)`（浏览器上下文）再判 `includes("<mobile-simulator-selected-element ")` | 两条来源、一个载荷模型 |
| `elementContext.view.simulator` 字段存在 | 上下文里带"来自哪个模拟器视图" |

> **结论**：5.x 把"元素选择"从浏览器面板**扩展到了移动模拟器**，且复用同一套上下文实体与胶囊 UI。4.x 卷 5.1–5.11 的状态机需要按"双来源"重新理解。

---

## 10.4 截图导出框（Device frame）

第九篇的 `craft.md` 之外，还有一套**导出外观**设置（截图/导出时套设备框）：

| 控件 | 文案 | 备注 |
| :--- | :--- | :--- |
| Device frame | `Device frame` | 开关 |
| Padding | `Padding` / `{value} px` | 内边距 |
| Corners | `Corners` / `Set by the frame` | 圆角，可跟随设备框 |
| Shadow | `Shadow` + `Shadows only work with a device frame.` | **仅在有设备框时可用** |
| Background | `Background` + `Mist` / `Black` / 自定义 | 8 列色块网格（`grid-cols-8`） |
| Aspect ratio | `Aspect ratio` / `Original` | — |
| 输出 | `Save as…` / `Copy image` | — |

> **修正 4.x 的一个说法**：4.x 卷记录过"视口预设"（viewport presets）。本版全量检索里 `iPhone`/`iPad` 命中均为**图标名**（`iPadHomeButton`、`iPhone11`），真正的设备概念是这里的**导出设备框**（`deviceFrame`），而不是浏览器面板的设备工具栏。两者不能混为一谈。

---

## 10.5 托管策略键表（Managed settings）

`app.asar:.vite/build/index.chunk-xV3fJhc7.js` 里有一段**策略归一化**逻辑：把托管配置里未知/非法的键剔除，并按默认值补齐。观测到的 9 个键与默认值：

| 键 | 默认 | 含义（按命名推断） |
| :--- | :--- | :--- |
| `disableRemoteControl` | `true` | 禁用远程控制 |
| `remoteControlAtStartup` | `false` | 启动时开启远程控制 |
| `skipWorkflowUsageWarning` | `false` | 跳过 workflow 用量警告 |
| `enableWorkflows` | `false` | 启用 workflows |
| `disableAllHooks` | `true` | 禁用所有 hooks |
| `fastMode` | `false` | 快速模式 |
| `ultracode` | `false` | 内部实验开关 |
| `switchModelsOnFlag` | `false` | 按 flag 切换模型 |
| `allowMobileSimulatorToolsOutsideSandbox` | `false` | 允许模拟器工具在沙箱外运行 |

同时被归一化的还有 `permissions.defaultMode`、`permissions`（除 `defaultMode` 外的键）、`hooks`、`sandbox.enabled` / `sandbox.allowUnsandboxedCommands`。

> **安全含义**：`allowMobileSimulatorToolsOutsideSandbox` 默认 `false`，且 `disableAllHooks` 默认 `true` —— 企业默认姿态是"关 hooks、禁沙箱外模拟器工具"。复刻时若把默认值取反，会得到完全不同的安全基线。
>
> 托管配置来源（同文件）：`{plist:"MDM profile", registry:"GPO registry policy", etc_file:"/etc/claude-desktop/managed-settings.json", none:"managed configuration"}`，macOS 路径为 `/Library/Managed Preferences/com.anthropic.claudefordesktop.plist`（见第八篇 8.x 的 `routes` 命中）。

---

## 10.6 证据索引（本篇）

| ID | 类型 | 位置 | 支撑结论 |
| :--- | :--- | :--- | :--- |
| E10-1 | 观测 | `ion-dist.asar:assets/v1` 内 `"Sends Claude a screenshot plus the element's HTML, styles, selector and any React component details."` | 元素上下文五项载荷 |
| E10-2 | 观测 | `ion-dist.asar:assets/v1/cc43287c9-BZs4HiYA.js` / `c82492f2c-ClkNDsFq.js` | `elementContexts` 实体模型与回调 |
| E10-3 | 观测 | `ion-dist.asar:assets/v1/c06cf64bb-0D9YS1Ds.js` | `kv()` 过滤规则、`mobile-simulator-selected-element` |
| E10-4 | 观测 | `ion-dist.asar:assets/v1` 模拟器文案集 | launch / tap / screenshot、attach、history、Xcode 前置 |
| E10-5 | 观测 | `app.asar:.vite/build/*.js` 标识符统计 | `Simulator` 714 / `CoreSimulator` 113 / `xcrun` 7 / `adb` 21 |
| E10-6 | 观测 | `ion-dist.asar:assets/v1/c6a992d55-k2XF_vDB.css` | `data-simulator-native-screen` / `data-sim-native-hole` 合成 |
| E10-7 | 观测 | `ion-dist.asar:assets/v1/c49d37e5f-DW8-EOP_.js` | Device frame / Padding / Corners / Shadow / Background 导出框 |
| E10-8 | 观测 | `app.asar:.vite/build/index.chunk-xV3fJhc7.js` | 9 个托管策略键与默认值、配置来源表 |

<p align="center"><a href="09-官方品牌规范与画布产物契约.md">← 第九篇</a> · <a href="README.md">📚 本卷索引</a></p>



---

---
title: CDS 官方规范文档（随包 skill 全解）
part: 11
category: 官方规范
domain: 设计系统
---

<p align="center"><a href="10-移动模拟器、元素上下文与托管策略.md">← 第十篇</a> · <a href="README.md">📚 本卷索引</a></p>

# 第十一篇：CDS 官方规范文档（随包 skill 全解）

> **技术领域与英文指代**：官方规范（specification）、令牌词汇（token vocabulary）、层模型（layer model）、用途层（purpose layer）、角色（role）、背景与填充（background vs. fill）、设计原则（principles）、生成管线（generation pipeline）。

前几篇是从**产物**（CSS/JS）反推出来的模型。这一篇不一样：`ion-dist.asar` 里随包分发着一份 **CDS 官方规范文档**，是设计系统团队写给自己、也写给模型看的源文档。它直接给出了层模型、令牌词汇、角色映射与使用规则——**优先级高于任何反推**。

本篇把它完整摘录并标注与前面各篇的差异。**逐字原文见 [`appendix/CDS-tokens-vanilla.md`](appendix/CDS-tokens-vanilla.md)**（23,443 字符 / 288 行，未删节）；同批下发的上层总纲见 [`appendix/Imagine-visual-creation-suite.md`](appendix/Imagine-visual-creation-suite.md)（10,702 字符 / 92 行）。

---

## 11.1 文档来源与生成管线

文档位于 `ion-dist.asar:assets/v1/cde7c3a92-xkWT1TxN.js`，以字符串常量内嵌，开头带生成戳：

```
<!-- @generated by apps/cds-docs/scripts/gen-cds-skill.mjs from
     packages/cds/{CLAUDE.md,docs/**}. Do not edit by hand —
     edit the source docs and re-run `bun run --cwd apps/cds-docs gen:cds-skill`. -->
```

| 事实 | 值 |
| :--- | :--- |
| 标题 | `# CDS tokens — vanilla` |
| 定位 | 面向**纯 HTML/CSS/SVG**（无 React、无 Tailwind）的令牌词汇 |
| 生成源 | `packages/cds/{CLAUDE.md, docs/**}` |
| 生成器 | `apps/cds-docs/scripts/gen-cds-skill.mjs` |
| 令牌产物 | `packages/cds/tokens/`（TypeScript 真源）→ `bun run --cwd packages/cds gen:tokens` → `src/generated/tokens.css` |
| 落地文件 | `@ant/cds/tokens.vanilla.css`，声明在 `:root`，暗色覆盖在 `[data-mode="dark"]` 与 `@media (prefers-color-scheme: dark)` |

> **关键发现：存在两套词汇**。官方 vanilla 文档用的是**无前缀**名（`--text-primary`、`--surface-1`、`--border`）；产品构建产物用的是**带前缀**名（`--cds-text-primary`、`--cds-surface-0`、`--cds-border`）。两者一一对应，但**引用时必须说明用的是哪套**。本仓库此前记录的 `--cds-*` 属于产品构建口径。

---

## 11.2 层模型（官方六层）

```
1. Base palette   --{hue}-{stop}      literal hex, mode-stable
                                       (gray, red, orange, yellow, green,
                                        aqua, blue, violet, magenta)
2. Theme ramps    --neutral-N         gray-N in light, gray-(900-N) in dark
                  --alpha-N           neutral-900 @ fixed opacity
3. Elevation      --surface-{0..3}    0 = darkest, 3 = lightest, in BOTH modes
4. Purpose        --surface-{popover,panel}, --text-*, --fill-*, --on-*,
                  --border-*          role mappings ({fill|bg|border|text}-{role})
   page-bg        --page-bg           hook the host app sets to its canvas color
5. Density        --h-control*, --pad-*, --gap-*, --radius,
                  --font-size-*, --leading-*   rem lengths (px ÷ 16); remapped by [data-density]
6. Motion         --dur-*, --ease-*   durations + easing (mode/density-invariant)
```

原文一句话定了边界：

> `Components only read layer 4 (and 5 for sizing). Layers 1–3 are wiring.`

| 与第二篇的差异 | 说明 |
| :--- | :--- |
| 层数 | 第二篇写"四层"（原始阶 / 角色 / 语义 / 组件）；官方是**六层**，多出 **Elevation**（独立成层）与 **Density**、**Motion** 两个维度 |
| 组件层 | 官方没有"组件层"这一层——组件只读第 4 层与第 5 层，**不允许**自建令牌层 |
| `--page-bg` | 官方把它列为**宿主钩子**（`CdsRoot` 的 `pageBackground` prop 发射），不是普通语义令牌 |

### 1. 原始阶的准确档位

> `Nine hues share one 36-stop grid (0, 10–100 by 10, 150–800 by 50, 810–900 by 10); every hue anchors 0 = #ffffff and 900 = #0b0b0b.`

按此规则展开为 0 + 10 档 + 14 档 + 10 档 = **35 个档位**；官方称 "36-stop"。本卷在 `MainWindowPage-lhEHjHfd.css@147224` 实测为 **35 档/族**（无 `1000` 档）。

> **结论**：官方文档的 "36" 与产物的 35 不一致。**观测优先**：实际有 35 个档位。差异可能来自文档把某个别名（如 `neutral-*` 或 `clay`）计入了同一网格，本卷无法判定。

### 2. 反相别名公式

> `--neutral-N` is `gray-N` in light and `gray-(900-N)` in dark.

这解释了第二篇观察到的所有现象，并给出精确公式：

| 令牌 | 明色 | 暗色 | 验证（900 − N） |
| :--- | :--- | :--- | :--- |
| `--cds-neutral-900` | `gray-900` | `gray-0` | 900−900 = 0 ✅ |
| `--cds-neutral-600` | `gray-600` | `gray-300` | 900−600 = 300 ✅ |
| `--cds-neutral-400` | `gray-400` | `gray-500` | 900−400 = 500 ✅ |
| `--cds-neutral-0` | `gray-0` | `gray-900` | 900−0 = 900 ✅ |

> `--alpha-N` 是 `neutral-900` 在固定不透明度下的叠加——所以它**自动**随主题翻转（明色黑洗、暗色白洗），无需逐模式覆盖。

### 3. 高度层（Elevation）

| 令牌 | 明色 | 暗色 | 用途 |
| :--- | :--- | :--- | :--- |
| `--surface-0` | `gray-20` | `gray-900` | 页面 |
| `--surface-1` | `gray-10` | `gray-850` | 流内卡片 |
| `--surface-2` | `gray-0` | `gray-830` | 面板 |
| `--surface-3` | `gray-0` | `gray-800` | 浮层 |

> **序数是"绝对明度"**：0 永远最暗、3 永远最亮，两种模式都成立。`--surface-panel` / `--surface-popover` 分别是 2 / 3 的别名。
>
> **覆盖层会重定向 `--page-bg`**：`Dialog` / `Menu` / `Popover` / `Combobox` / `Toast` / `CoachMark` 与 `Surface` 会把 `--page-bg` 重新指向自己实际绘制的表面（浮层用 `surface-3`、面板用 `surface-2`），并通过 `useCdsSurface()` 把同一值交给 JS 消费者。原文明确禁止在浮层内手写 `--page-bg` 覆盖。

### 4. 用途层与角色

**角色是"属性优先"的五件套**：

| 属性 | 令牌 | 取值 |
| :--- | :--- | :--- |
| 实心填充 | `--fill-{role}` | hue-450 |
| 悬停 | `--fill-{role}-hover` | hue-400 |
| 淡底 | `--bg-{role}` | hue-100（暗色 hue-800） |
| 边框 | `--border-{role}` | hue-250（暗色 hue-700） |
| 文字 | `--text-{role}` | hue-600 |
| 反白 | `--on-{role}` | `gray-0` / `gray-900` |

| 角色 | 色相 | 特例 |
| :--- | :--- | :--- |
| `accent` | blue | 另有 `--bg-accent-muted` |
| `brand` | clay | **只有 fill**（`fill-brand{,-hover}` + `on-brand`），无 text/bg/border |
| `danger` | red | — |
| `success` | green | — |
| `warning` | yellow | fill 用 `yellow-200`、hover `yellow-250`（其余角色是 450/400） |
| `pro` | violet | — |

> ⚠️ **重要更正**：第二篇把 `--cds-role-accent-*` / `--cds-role-danger-*` 当作"公开的角色层"。官方原文明确相反：
>
> > `The five hue-backed roles reach their hue through internal aliases (--role-{role}-{stop}, plus --role-{role}-fill, --role-{role}-fill-hover and --role-{role}-on): CSS-only wiring, not part of the token vocabulary, so never reference them.`
>
> 即 `--role-*`（产品构建里是 `--cds-role-*`）是**内部接线**，不属于令牌词汇，**不应被引用**。对外只应使用 `--fill-*` / `--bg-*` / `--border-*` / `--text-*` / `--on-*`。

### 背景 vs 填充（原文判定表）

| | 背景 | 前景 | 例子 |
| :--- | :--- | :--- | :--- |
| 淡底（Tint） | `bg-{role}` | `text-{role}` | Banner、Toast |
| 实心（Solid） | `fill-{role}` | `on-{role}` | Button、Checkbox |

> 命名即配对：色相是**环境背景**时用 `bg-*`，色相**本身是控件表面**时用 `fill-*`。450 档是为 `on-*` 的 WCAG 对比度选的。

---

## 11.3 六条使用规则（原文）

| 规则 | 内容 |
| :--- | :--- |
| **Token rule** | 只用用途层令牌：`background: var(--surface-1)`、`color: var(--text-secondary)`、`border: 0.5px solid var(--border)`；**禁止**裸十六进制（暗色下不可见） |
| **Dark mode rule** | 暗色是 `:root[data-mode="dark"]`（或未显式设置时的 `prefers-color-scheme: dark`）；所有令牌自动翻转，**永不**手写暗色覆盖 |
| **Muted text rule** | 辅助文案用 `--text-secondary`；`--text-muted` 只给占位符/说明/元数据。**永不**对文字用 `opacity`——opacity 会与背景相乘并逐面漂移 |
| **Accent rule** | 每视图最多**一个** `variant="primary"` 按钮；`brand`（陶土）只用于 Claude 发起的动作（发送、生成），**不用于普通用户 CTA** |
| **Restraint rule** | 默认选更安静、更轻的选项——"太杂"是最常见的设计意见；`secondary` 是默认档 |
| **Elevation rule** | 同屏最多**两个**浮层高度（`panel` / `popover`）；出现第三层就该用 `Dialog` 而不是 popover 叠 popover；流内平铺卡片（`rounded-card bg-surface-1 shadow-card-ring`）无深度、不计数 |

> **单描边纪律的官方依据**：`border: 0.5px solid var(--border)` 里 `--border` = `alpha-2`（10% 反相）。这就是本仓库 AGENTS.md「单描边」的原始出处，**0.5px** 是官方写法，不是 1px。

---

## 11.4 四条设计原则（原文）

| 原则 | 原文要点 |
| :--- | :--- |
| **Claude-native** | cds 的设计目标是"既能被 Claude 写，也能被 Claude 用"：`CLAUDE.md` 就是系统提示，组件文档为检索而结构化，工具类命名让模型能猜到 |
| **Clay is Claude's color** | `brand`（陶土）保留给 Claude 的动作——发送、生成、Spark 标记；用户发起的主操作走中性 `accent` 蓝；其余保持灰。**把陶土压到单一角色，才让它承载语义而不是变成墙纸** |
| **Serif is Claude's voice** | Claude 的回复用衬线，周边 chrome 用无衬线；排版在读到文字之前就说明了"谁在说话"。cds 为此提供 `--font-voice`（`font-voice` 工具类） |
| **Built to be composed, not overridden** | 组件只接 `className` 做布局与行为，所有令牌都是公开 CSS 变量；系统期望你**组合**它（包裹、排列、填槽），而不是从外部改写或 fork。属性和插槽都够不到时，说明 cds 缺东西——修在 cds 里，不要绕过去 |

外加一条"克制胜于选项"：**一个视图一个强调色、一个高度阶、用 T 恤尺码而不是 0–12 的刻度**；一致性来自**减少旋钮**，不是靠审查。

---

## 11.5 本篇对前文的更正汇总

| 位置 | 原表述 | 更正 |
| :--- | :--- | :--- |
| 第二篇 2.1 | 四层令牌模型 | **六层**：原始阶 / 主题别名 / 高度 / 用途 / 密度 / 动效 |
| 第二篇 2.5 | `--cds-role-*` 是"角色层"，可引用 | 是**内部接线**，官方明确"never reference them"；对外用 `--fill-*` / `--bg-*` / `--border-*` / `--text-*` / `--on-*` |
| 第二篇 2.2 | 35 档 | 产物是 **35** 档，官方文档写 "36-stop"（差异未解，观测优先） |
| 第二篇 2.3 | `--cds-page-bg` 是普通语义令牌 | 是**宿主钩子**（`CdsRoot.pageBackground`），且会被浮层重定向 |
| 第二篇 2.6 | 角色只有 fill / fill-hover / on | 完整五件套：fill / fill-hover / bg / border / text（+ on） |
| 第三篇 3.4 | 单描边"1px" | 官方写法是 **0.5px** solid |
| 全文 | 只有 `--cds-*` 一套词汇 | 另有**无前缀** vanilla 词汇（`--text-primary` / `--surface-1` / `--border`），一一对应 |

---

## 11.6 证据索引（本篇）

| ID | 类型 | 位置 | 支撑结论 |
| :--- | :--- | :--- | :--- |
| E11-1 | 观测 | `ion-dist.asar:assets/v1/cde7c3a92-xkWT1TxN.js`，`# CDS tokens — vanilla` 文档块 | 官方规范全文（层模型、规则、原则） |
| E11-2 | 观测 | 同上，生成戳 | 生成源 `packages/cds/{CLAUDE.md,docs/**}` 与生成器 |
| E11-3 | 观测 | 同上，`## The layer model` | 六层模型与"组件只读第 4 层" |
| E11-4 | 观测 | 同上，`### 1. Base palette` | 36-stop 网格表述（与实测 35 档冲突） |
| E11-5 | 观测 | 同上，`## 2. Theme ramps` | `neutral-N = gray-(900-N)` 公式 |
| E11-6 | 观测 | 同上，`### Roles` | 五件套属性、`--role-*` 为内部接线 |
| E11-7 | 观测 | 同上，`### Background vs. fill` | bg/fill 配对表 |
| E11-8 | 观测 | 同上，`## Rules` 六条 | 令牌/暗色/弱化文字/强调/克制/高度规则 |
| E11-9 | 观测 | 同上，`## CDS principles` 四条 | clay/serif/composed/restraint |

<p align="center"><a href="10-移动模拟器、元素上下文与托管策略.md">← 第十篇</a> · <a href="README.md">📚 本卷索引</a></p>



---

---
title: 本地 MCP 工具链：visualize 服务器与 widget 运行时
part: 12
category: 本地工具
domain: 工具与运行时
---

<p align="center"><a href="11-CDS官方规范文档.md">← 第十一篇</a> · <a href="README.md">📚 本卷索引</a></p>

# 第十二篇：本地 MCP 工具链：visualize 服务器与 widget 运行时

> **技术领域与英文指代**：进程内 MCP（in-process MCP）、内存传输（`InMemoryTransport`）、服务器定义（server definition）、UI 资源（`ui://` resource）、宿主工具（host tool）、组织策略闸门（org policy gate）、本地库镜像（local library mirror）、协作编辑（share edits）、征询表单（elicitation）。

第十一篇回答"这份规范是什么"。本篇回答"**这个本地工具到底由哪些本地资源组成**"——两台 MCP 服务器、两份服务器实现、41 个可读的 widget 运行时模块、一套本地库镜像、三道隐私闸门和一道组织策略闸门。

---

## 12.1 两台进程内 MCP 服务器

`ion-dist.asar` 里只有两台在渲染进程内注册的 MCP 服务器：

| 服务器 | 工厂 | UI 资源 | 工具 |
| :--- | :--- | :--- | :--- |
| `visualize` | `getMcpVisualizeServerInstance` | `ui://imagine/show-widget.html` | `read_me`、`show_widget` |
| `mcpAppsExample` | `getMcpAppsExampleServerInstance` | `ui://mcp-apps-example/{counter,hello-world,sticky-notes}.html` | 三个演示工具（`mcp_apps_hello` / `_counter` / `_sticky_notes`），**无自带文档**，只有一段 `sendRequest({method, params})` 的最小 MCP Apps 客户端垫片 |

注册走两条互斥路径（`shared-21`）：

```js
AE(name, factory, flag, enabled)   // 本地：InMemoryTransport.createLinkedPair() → go(name, t, "renderer")
jE(name, url,  flag, enabled)      // 远程：StreamableHTTPClientTransport(new URL(url))
```

| flag | 作用 |
| :--- | :--- |
| `claudeai_mcp_apps_visualize` | 总开关 |
| `claudeai_imagine_http` | 切到远程 HTTP（用 `imagineMcpUrl`） |
| `claudeai_visualize_remote_web` | 在 web 端禁用本地注册 |

> `go(name, t, "renderer")` 把传输来源记成 `"renderer"`，所以从运行时的 MCP 列表就能看出这一台是**进程内**的。

---

## 12.2 visualize 的两份实现

同一个服务器在包里存在**两处**，职责不同：

| 位置 | 导出 | 内容 | 角色 |
| :--- | :--- | :--- | :--- |
| `ion-dist.asar:assets/v1/cde7c3a92-…js` | `getMcpVisualizeServerInstance` | 文档字符串（CDS 23,443 + Imagine 10,702 字符） | **渲染进程侧**实例，供本地 MCP 连接 |
| `app.asar:.vite/build/index.chunk-D92FUleA.js` | `getImagineServerDef` | 服务器定义 + widget HTML 模板 + 41 个运行时脚本 + 文档副本 | **主进程侧**定义，负责资源与策略 |

主进程侧的返回结构（`D92FUleA` 尾部原文）：

```js
function B(n){
  let r = () => ({ shareEdits: n === "ccd" && e.Kdt("1839876212") });
  return {
    serverName: "visualize",
    tools: k.map(e => ({ name: e.name, description: e.description, inputSchema: e.inputSchema,
                         _meta: e._meta, alwaysLoad: true,
                         maxResultSizeChars: e._meta?.["anthropic/maxResultSizeChars"] })),
    handleToolCall:      async (e,t) => z(e) ? { content:[{type:"text", text:I}], isError:true } : j(e,t,void 0,r()),
    handleReadResource:  e => z("widget resource read") ? { contents:[], unavailable: P.BlockedByPolicy } : M(e, r()),
    handleListResources: () => z("widget resource list") ? [] : N(),
    isEnabled: () => t.t()
  };
}
```

三个值得记录的细节：

1. **`alwaysLoad: true`** —— 工具定义始终加载，不参与"按需发现工具"的裁剪。
2. **`maxResultSizeChars` 逐工具声明**（200,000），不是全局设置。
3. **`shareEdits` 只在 `n === "ccd"` 时开启**，且要过 flag `1839876212`。

---

## 12.3 组织策略闸门

同一文件里有一句硬编码文案：

```js
I = "Inline visualizations are disabled by your organization's policy. Retries will fail; answer in text instead."
```

配套的闸门函数：

```js
function z(n){ return t.n() ? (R || (R = !0, log.info(`[imagine] ${n} refused — withheld by the org's Inline visualizations answer`)), !0) : !1 }
```

`z()` 覆盖**四条入口**：工具调用、资源读取、资源列表、`isEnabled`。也就是企业策略一旦关掉 "Inline visualizations"，这台服务器对模型**整台消失**，而不是逐个工具报错——并且明确告知模型"重试会失败，改用文字回答"。

> 这是本卷见到的**唯一**一处"策略关闭 + 明确降级指令"的组合写法，比单纯返回 403 对模型更友好。

---

## 12.4 widget 运行时：41 个可读的 `src/scripts` 模块

`D92FUleA` 内联了完整的 widget 运行时，且**保留了源码注释与模块边界**（未压缩）：解码后共 **9,155 行 / 302 KB**，逐模块行数与首行见[附录 D](appendix/widget-runtime-modules.md)。

| 类别 | 模块 |
| :--- | :--- |
| 宿主通信 | `host-init`、`host-display`、`host-tool-calls`、`proxy-page`、`mcp-app-helper` |
| 流式渲染 | `streaming-morph`、`animation-frames`、`conversation-durable`、`standalone-page` |
| 复制与导出 | `clipboard-copy`、`clipboard-text`、`copy-canvas`、`download-links`、`export-scrub`、`hosted-copies` |
| 尺寸适配 | `sized-by-viewport`、`frame-sized`、`wide-clip`、`wide-scroll`、`drawn-frame` |
| SVG 修正 | `svg-text-occlusion`、`svg-clip-fix`、`svg-text-edge-fix` |
| 征询表单 | `elicitation`、`elicit-steps`、`elicit-log`、`elicit-opt-out`、`elicit-design-system`、`form-submit`、`secret-fields` |
| 协作与分享 | `share-edits`、`share-edits-meta`、`menu-room`、`more-menu`、`open-link`、`open-larger` |
| 其他 | `ui-cards`、`chart-text-size`、`after-the-visual`、`widget-main` |

> **这是复刻成本最低的一块**：41 个模块的**原始 TS 文件名与注释都在**，可以直接据此还原 widget 的宿主协议，不必反推压缩名。

---

## 12.5 宿主工具与预算

widget 内部可以调用一个**宿主工具** `screenshot_widget`（模型不可见，只给 widget 用）。同文件的常量表就是它的预算：

| 常量 | 值 | 含义 |
| :--- | ---: | :--- |
| `ANSWER_WITHIN_MS` | 30,000 | 等待 widget 回答的上限 |
| `DRAWING_WAIT_MS` | 5,000 | 等首帧绘制 |
| `TOOL_WAIT_MS` | 24,000 | 等宿主工具返回 |
| `ON_SCREEN_WAIT_MS` | 1,000 | 等"已上屏"确认 |
| `MAX_LINE_CHARS` | 500 | 单行截断 |
| `MAX_PICTURE_BYTES` | 4,000,000 | 截图字节上限 |
| `PICTURE_LIMITS.mostPixels` | 8,000,000 | 像素上限 |
| `PICTURE_LIMITS.longestSide` | 7,900 | 最长边 |
| `PICTURE_LIMITS.fontsMs` | 4,000 | 等字体 |
| `PICTURE_LIMITS.patienceMs` | 14,000 | 等图片解码 |
| `TOO_SLOW` | `"The call took too long, so its result was not waited for. It may still be running."` | 超时文案 |

---

## 12.6 三道隐私闸门

截图不是无条件发生的。同文件里有三条**拒绝理由**，都直接回给模型：

| 常量 | 触发条件 | 结果 |
| :--- | :--- | :--- |
| `SECRETS_FIELD` | widget 里存在疑似密码 / PIN / 验证码 / API key / 助记词 / 卡号 / 账号的字段（按 `name`、`id`、`placeholder`、`label`、`aria-label`、`aria-labelledby` 猜测），或**无法确认是否存在** | **不截图**，进行中的也作废 |
| `QUESTION_FORM` | widget 是向用户提问的表单 | **不截图**，用户答案以消息返回 |
| `BOXES_EMPTY` | 正常截图时 | 页面上能识别的文本框**一律画成空**，只有 widget 自己别处展示的内容照原样画 |

> 这三条是"**宁可少给模型信息，也不泄露用户输入**"的明确取舍，且对"猜不准"的情况选择**保守拒绝**（`or could not look through the widget for one`）。

---

## 12.7 本地库镜像（`/libs/imagine/`）

widget 运行时把第三方库换成了**同源本地镜像**，并在失败时回退 CDN：

| 本地路径 | 对应 CDN |
| :--- | :--- |
| `/libs/imagine/tabler-icons-webfont-3.42.0/tabler-icons.min.css` | `cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.42.0/…` |
| `/libs/imagine/us-atlas-3.0.1/states-10m.json` | `cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json` |
| `/libs/imagine/world-atlas-2.0.2/countries-110m.json` | `cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json` |
| `/libs/imagine/topojson-3.0.2/topojson.min.js` · `topojson-client-3.1.0/…` | 同名 CDN 包 |
| `/libs/imagine/ui-cards-17/ui-cards.mjs` | `<ui-card>` 自定义元素 |
| `/libs/imagine/streaming-helpers-1/streaming-helpers.mjs` | 流式渲染辅助 |

写法上是"本地优先 + CDN 兜底"：

```html
<link rel="stylesheet" href="/libs/imagine/tabler-icons-webfont-3.42.0/tabler-icons.min.css"
      data-cdn-href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.42.0/dist/tabler-icons.min.css"
      media="print" onload="this.media='all'" onerror="this.dataset.failed=''">
```

地图数据还有一张显式映射表 + `fetchMapDataFromCopies()`，CDN 不可达时改用本地副本。

> **与附录 B 的呼应**：附录 B 说图标是 "Tabler **outline** webfont（5800+，already loaded）"——本地镜像就是这个 3.42.0 版本，所以确实"已经加载"，不需要网络。

---

## 12.8 文档模块（三份）

`D92FUleA` 里的文档字符串（与第十一篇同源）：

| 文档 | 长度 | 说明 |
| :--- | ---: | :--- |
| `# CDS tokens — vanilla` | 23,443 字符 | 附录 A |
| `# Imagine — Visual Creation Suite` | 10,702 字符 | 附录 B |
| `## Charts (Chart.js)` | 6,115 字符 | `chart` / `data_viz` 模块的图表指南 |

`read_me` 的返回值永远是 **`[Imagine 总纲] + 所选模块的文档**（去重后拼接），所以拉 `mockup` 会一次拿到总纲 + mockup 指南 + CDS 规范。

---

## 12.9 协作编辑与征询表单

### share-edits（把用户对 widget 的修改回传）

| 常量 | 值 | 约束 |
| :--- | ---: | :--- |
| `SHARE_DEBOUNCE_MS` | 400 | 防抖 |
| `MAX_TOTAL_CHARS` | 24,000 | 总量上限 |
| `MAX_FIELD_CHARS` | 12,000 | 单字段上限 |
| `MAX_FIELDS` | 40 | 字段数上限 |
| `MAX_NAME_CHARS` | 80 | 字段名上限 |
| 采集范围 | `text/search/email/url/tel/number` + `[contenteditable]` | 排除 `:autofill` 自动填充 |

> 只回传"用户主动编辑过的可编辑字段"，且排除浏览器自动填充——避免把凭据类的自动填充内容带回模型。

### elicit-design-system（征询表单里的设计系统选项）

| 规则 | 值 |
| :--- | :--- |
| 名称长度 | `NAME_MAX = 41` |
| 颜色数量 | 最多 4 个，且**只接受 6 位十六进制** |
| 隐藏开关 | `data-no-design-system`（写在 `documentElement` 上） |

> 注释原文：`They go into inline styles, so nothing but six hex digits passes.` —— 颜色会拼进内联样式，因此做了白名单校验。这是"用户输入直接进 DOM"的典型防注入处理。

---

## 12.10 证据索引（本篇）

| ID | 类型 | 位置 | 支撑结论 |
| :--- | :--- | :--- | :--- |
| E12-1 | 观测 | `ion-dist.asar:assets/v1` 全量 `ui://` 提取 | 仅两台服务器、4 个 UI 资源 |
| E12-2 | 观测 | `ion-dist.asar:assets/v1/shared-21-…js`（`AE` / `jE`） | 本地 `InMemoryTransport` 与远程 HTTP 两条注册路径 |
| E12-3 | 观测 | `app.asar:.vite/build/index.chunk-D92FUleA.js` 尾部 `getImagineServerDef` | 服务器定义、`alwaysLoad`、`maxResultSizeChars`、`shareEdits` 条件 |
| E12-4 | 观测 | 同上，`I` / `z()` | 组织策略闸门与降级文案 |
| E12-5 | 观测 | 同上，`// src/scripts/*.ts` ×41 | widget 运行时模块清单（保留源码边界） |
| E12-6 | 观测 | 同上，`host-tool-calls` 常量表 | `screenshot_widget` 预算与超时文案 |
| E12-7 | 观测 | 同上，`SECRETS_FIELD` / `QUESTION_FORM` / `BOXES_EMPTY` | 三道隐私闸门 |
| E12-8 | 观测 | 同上，`/libs/imagine/*` + `data-cdn-href` + `MAP_DATA` | 本地库镜像与 CDN 兜底 |
| E12-9 | 观测 | 同上，`share-edits` / `elicit-design-system` 常量 | 回传与表单的白名单约束 |

<p align="center"><a href="11-CDS官方规范文档.md">← 第十一篇</a> · <a href="README.md">📚 本卷索引</a></p>



---

---
title: 系统提示词解剖：skills、computer_use 与包管理
part: 13
category: 提示词
domain: 提示词与工具
---

<p align="center"><a href="12-本地MCP工具链.md">← 第十二篇</a> · <a href="README.md">📚 本卷索引</a></p>

# 第十三篇：系统提示词解剖：skills、computer_use 与包管理

> **技术领域与英文指代**：系统提示词分段（prompt section）、技能（skill）、技能目录（`{{skillsDir}}`）、可用技能块（`<available_skills>`）、技能调用方式（`<location>` vs `<invoke_with>`）、沙箱外壳（sandboxed Linux shell）、包管理（package management）。

附录 C 是原文，本篇是**结构解剖**：先给出 34 个段落的体量分布，再把 `<skills>`、`<computer_use>`、`<package_management>` 三段拆开，并与包内实际文件对齐。

---

## 13.1 34 个段落的体量分布

| 段落 | 行数 | 段落 | 行数 |
| :--- | ---: | :--- | ---: |
| `<artifacts>` | **72** | `<user_wellbeing>` | 16 |
| `<lists_and_bullets>` | 32 | `<web_content_restrictions>` | 16 |
| `<ask_user_question_tool>` | 21 | `<good_file_sharing_examples>` | 16 |
| `<notes_on_user_uploaded_files>` | 20 | `<suggesting_claude_actions>` | 15 |
| `<skills>` | 18 | `<high_level_computer_use_explanation>` | 15 |
| `<user_wellbeing>` / `<evenhandedness>` | 16 / 12 | `<file_handling_rules>` | 15 |
| `<additional_skills_reminder>` | 13 | `<examples>` | 15 |
| `<refusal_handling>` | 12 | `<producing_outputs>` | 14 |
| `<file_creation_advice>` | 9 | `<working_with_user_files>` | 14 |
| `<env>` | 7 | `<package_management>` | 7 |

> **体量即权重**：`<artifacts>` 一段就占了 72 行（16%），是整份提示词里最长的一节——桌面端把"产出物"当第一等公民。`<skills>` + `<additional_skills_reminder>` 合计 31 行，是第二块重投入。

---

## 13.2 `<skills>`：技能是磁盘上的文件夹

原文关键句：

> `a set of "skills" is available — these are essentially folders that contain a set of best practices…`
> `Claude's first order of business should always be to examine the skills available in Claude's <available_skills> and decide which skills, if any, are relevant…`
> `Then, Claude can and should use the Read tool to read the appropriate SKILL.md files and follow their instructions.`

三个示例（原文）把"先读后做"写成了固定动作：

| 用户请求 | 模型应立即执行 |
| :--- | :--- |
| 做一份每月孕期的 PPT | `Read {{skillsDir}}/skills/pptx/SKILL.md` |
| 读这份文档并改语法错误 | `Read {{skillsDir}}/skills/docx/SKILL.md` |
| 基于文档生成图并插进文档 | `Read …/docx/SKILL.md`，再读用户技能 `…/user/imagegen/SKILL.md` |

> **设计要点**：技能不是工具，是**文件**。模型用 `Read` 取，取到的是一段 markdown 指令，然后照做。这样技能可以随时增删、可以被用户/组织覆盖，而不需要改代码。

---

## 13.3 `<available_skills>` 是运行时拼出来的

`<skills>` 段里提到的 `<available_skills>` **不在提示词模板里**，由主进程的 `generateSkillsSystemPrompt()` 现场生成（`app.asar:.vite/build/index.chunk-Cn8V_d1p.js`）。

### 外层模板（原文，含条件分支）

```
<skills_instructions>
Skills give you specialized instructions and domain knowledge for particular kinds of tasks.
Before starting a task, check whether one of the skills in <available_skills> below covers it.

How to use a skill:
- A skill listed with a <location> is on disk: read <location>/SKILL.md (or <location> itself when it
  names a .md file) with the Read tool and follow its instructions.
- A skill listed with <invoke_with>Skill tool</invoke_with>: call the Skill tool with the skill's <name>
  exactly as listed (skill: "<name>") … skills refer to their own folders with the placeholders
  ${CLAUDE_PLUGIN_ROOT} and ${CLAUDE_SKILL_DIR}, which only the Skill tool fills in …

Important:
- Only use skills listed in <available_skills> below
- Once a skill's instructions are loaded in the current turn, follow them rather than loading the skill again
- If the user asks which skills they have, call `list_skills` to render the widget instead of writing
  skill names in text.
- If the user asks which plugins they have installed, call `list_plugins` to render the widget …
</skills_instructions>

<available_skills>
${…}
</available_skills>
```

### 两种调用方式并存

| 标记 | 调用方式 | 原因 |
| :--- | :--- | :--- |
| `<location>` | 直接用 `Read` 读文件 | 技能在磁盘上，模型可自行读取 |
| `<invoke_with>Skill tool</invoke_with>` | 必须走 `Skill` 工具（`skill: "<name>"`） | 技能内部用 `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_SKILL_DIR}` 占位，**只有 Skill 工具会填充**；自己读文件会得到空值 |

> 这是本卷见到的最容易被复刻者忽略的一条：**"读文件"和"调用技能"不是等价的**，占位符只在 Skill 工具路径下被替换。

### 装配时的六条过滤/告警（原文日志）

| 条件 | 处理 |
| :--- | :--- |
| 多个技能映射到同一个 Claude Code 名（非 `[A-Za-z0-9_-]` 都变 `-`） | 改为**各自独立名 + 路径**列出，并 `warn` |
| `r.enabled === false` 或名称不可解析 | 跳过 |
| `creatorType === "anthropic"` 且 `skillId === name` 且 `updatedAt === null` 且不在已服务列表 | 视为"内置清单残留"跳过（下次同步清理） |
| 组织未服务该技能（`E` 集合不含） | 跳过 |
| `disable-model-invocation: true`（写在 SKILL.md frontmatter） | 标记 `disableModelInvocation`，不给模型自动调用 |
| 用户不可编辑（`reservedForUser`） | 仅列名，不可覆盖 |

---

## 13.4 随包的 7 个技能

`app.asar:resources/bundled-skills/`：

| 技能 | 大小 | 备注 |
| :--- | ---: | :--- |
| `docx.skill` | 172 KB | 文档 |
| `pptx.skill` | 186 KB | 演示 |
| `xlsx.skill` | 172 KB | 表格 |
| `pdf.skill` | 25 KB | PDF 生成/填表 |
| `pdf-reading.skill` | 8 KB | PDF 读取（与上一个分工） |
| `frontend-design.skill` | 8 KB | **设计品味**（附录 A 引用的 `#D97757` 出处） |
| `draft-design-system.skill` | 53 KB | **设计系统草案**（第六篇 6.1） |

`manifest.json` 的字段决定了它们如何进入 `<available_skills>`：

```json
{ "agentSkillsRef": "1794592614",
  "skills": [ { "name": "docx", "description": "…", "tier": "always" },
              …
              { "name": "draft-design-system", "tier": "always", "needsDesignSystems": true } ] }
```

> **`needsDesignSystems: true` 是硬开关**：`be()` 在生成清单时执行 `t.skills.filter(t => !t.needsDesignSystems || Tl() !== "off")`——组织关掉设计系统，`draft-design-system` 就**不会出现在 `<available_skills>` 里**。

---

## 13.5 `<computer_use>`：文件工具 + 一个沙箱

`<high_level_computer_use_explanation>` 原文要点：

| 工具 | 说明 |
| :--- | :--- |
| `Read` / `Write` / `Edit` | 直接作用于工作目录与 workspace 文件夹；**`Read` 只读文件，不读目录**（列目录要用 Bash 的 `ls`） |
| `Bash` | 隔离的 **Ubuntu 22** 沙箱，预装 Python / Node / 常用 CLI；通过挂载访问工作目录与已连接的 workspace |

| 路径 | 含义 |
| :--- | :--- |
| `{{cwd}}` | 工作目录，**所有临时工作都放这里** |
| `{{workspaceFolder}}` | 用户的 workspace 文件夹，**会话结束后仍可访问** |

两条边界说明（原文）：

> `Prefer the file tools (Read/Write/Edit) over shell commands for file operations. The shell runs in its own sandbox and the file tools and the shell may use different paths for the same files.`
>
> `Files the shell writes outside its mounted folders stay inside the sandbox, where the user cannot open them.`

交付方式：`mcp__cowork__present_files` —— 把 docx/pptx/xlsx 直接呈现在用户选定的文件夹里。

### 反向约束：什么时候**不该**用电脑工具

`<unnecessary_computer_use_avoidance>` 给了三条否定条件：回答训练知识内的事实问题、总结对话里已有的内容、解释概念或提供信息。

`<file_creation_advice>` 给了六条触发规则（写文档→`.md`/`.html`/`.docx`；做组件→代码文件；改上传文件→改原文件；做演示→`.pptx`；任何含"save/file/document"的请求→建文件；**超过 10 行代码→建文件**）。

---

## 13.6 `<package_management>`：三行硬规则

原文全文（7 行）：

```
Package managers run inside the shell sandbox:
- npm: Works normally
- pip: ALWAYS use `--break-system-packages` flag (e.g., `pip install pandas --break-system-packages`)
- Virtual environments: Create if needed for complex Python projects
- Always verify tool availability before use
```

> **`--break-system-packages` 是沙箱专用的写法**：Ubuntu 22 的 PEP 668 会拦住系统级 pip 安装，而这个沙箱本来就是一次性的，所以直接放行。复刻这套运行时的时候，这一条必须跟着沙箱策略一起改，不能照抄到真实机器上。

---

## 13.7 技能推荐与自建技能

除 `<skills>` 之外，包里还有一组**技能生态工具**（名字出现在 `generateSkillsSystemPrompt` 与 `save_skill` 的实现里）：

| 工具 | 用途 |
| :--- | :--- |
| `list_skills` | 用户问"我有哪些技能"时，**渲染成 widget**，而不是在文字里罗列 |
| `list_plugins` | 同上，针对已安装插件 |
| `suggest_skills` | 按任务关键词推荐独立技能（"最多每次对话建议一次"） |
| `search_plugins` | 搜未安装插件里的技能，命中后再 `suggest_plugin_install` |
| `save_skill` | 让模型把新技能写盘/上传（带 `overwrite` 语义与"名称必须与 `<available_skills>` 完全一致"的约束） |

> `list_skills` / `list_plugins` 选择"渲染 widget 而不是打字"，与第十二篇的 widget 体系是同一套设计语言：**结构性信息交给可视化，文字留给解释**。

---

## 13.8 三套"规范"的分工

到这里，包里一共有三套面向模型的规范，职责不重叠：

| 规范 | 载体 | 触发方式 | 管什么 |
| :--- | :--- | :--- | :--- |
| **系统提示词**（附录 C） | 主进程 chunk | 每次请求常驻 | 行为准则、工具用法、产物规则 |
| **技能**（`resources/bundled-skills/*.skill`） | 磁盘文件夹 | 模型 `Read`/`Skill` 按需读 | 某类产物的具体做法（docx/pptx/设计系统…） |
| **CDS 规范**（附录 A/B） | `read_me` 工具结果 | 画 widget 前拉取 | 视觉令牌与用法 |

> 三者是**分层加载**：常驻的只有系统提示词；技能与 CDS 规范都在需要时才进上下文。这也是为什么附录 A 那 23 KB 可以放心随包分发——不画图就不花 token。

---

## 13.9 证据索引（本篇）

| ID | 类型 | 位置 | 支撑结论 |
| :--- | :--- | :--- | :--- |
| E13-1 | 观测 | `appendix/desktop-3p-base-prompt.md` 段落切分 | 34 段、443 行与体量分布 |
| E13-2 | 观测 | 同上 `<skills>`（276–294 行） | 技能是文件夹、先读 SKILL.md、三个示例 |
| E13-3 | 观测 | `app.asar:.vite/build/index.chunk-Cn8V_d1p.js` `generateSkillsSystemPrompt` | `<skills_instructions>` 模板、两种调用方式、六条过滤 |
| E13-4 | 观测 | 同上 `be()` 过滤 | `needsDesignSystems` 硬开关 |
| E13-5 | 观测 | `app.asar:resources/bundled-skills/{manifest.json,*.skill}` | 7 个随包技能与 tier |
| E13-6 | 观测 | 附录 C `<high_level_computer_use_explanation>` | Read/Write/Edit + Bash(Ubuntu 22)、`{{cwd}}` / `{{workspaceFolder}}` |
| E13-7 | 观测 | 附录 C `<package_management>` | npm / pip `--break-system-packages` / venv |
| E13-8 | 观测 | `app.asar:.vite/build/index.chunk-60gIKsy6.js` `save_skill` | 技能自建与覆盖语义 |

<p align="center"><a href="12-本地MCP工具链.md">← 第十二篇</a> · <a href="README.md">📚 本卷索引</a></p>



---

---
title: 工具与钩子面：提问、待办、验证与网页内容
part: 14
category: 提示词
domain: 提示词与工具
---

<p align="center"><a href="13-系统提示词解剖.md">← 第十三篇</a> · <a href="README.md">📚 本卷索引</a></p>

# 第十四篇：工具与钩子面：提问、待办、验证与网页内容

> **技术领域与英文指代**：提问工具（`AskUserQuestion`）、任务清单（`TaskCreate` / `TaskUpdate`）、工具检索（`ToolSearch`）、钩子事件（hook event）、密钥字段识别（secret field detection）、网页内容限制（web content restrictions）、引用要求（citation requirements）。

第十三篇拆了 skills 与 computer use。本篇继续拆提示词里剩下的**工具契约段**，并把它们与包里能观测到的**工具名清单、钩子事件、密钥字段表**对齐。

---

## 14.1 提问：`AskUserQuestion` 是强制前置

`<ask_user_question_tool>` 的措辞是全篇最硬的之一：

> `Claude should always use this tool before starting any real work—research, multi-step tasks, file creation, or any workflow involving multiple steps or tool calls.`

**唯一例外**：简单往返对话或快速事实问题。

给出的"欠定义请求"示例（原文）：

| 请求 | 该问什么 |
| :--- | :--- |
| "Create a presentation about X" | 受众、篇幅、语气、要点 |
| "Put together some research on Y" | 深度、形式、角度、用途 |
| "Find interesting messages in Slack" | 时间段、频道、主题、"interesting" 的定义 |
| "Summarize what's happening with Z" | 范围、深度、受众、形式 |
| "Help me prepare for my meeting" | 会议类型、"准备"指什么、交付物 |

三条附加规则：

1. **必须用工具问，不能把问题写在回复里**；
2. 用技能时，先看技能的要求，再决定问什么；
3. 不适用：用户已给出清晰要求、或本轮对话已澄清过。

---

## 14.2 待办：`TaskCreate` / `TaskUpdate` 是"几乎总是"

`<todo_list_tool>` 用全大写强调：

> `DEFAULT BEHAVIOR: Claude MUST use TaskCreate to set up a task list for virtually ALL requests that involve tool calls, and TaskUpdate to mark each task in_progress when starting it and completed as soon as it is done.`

并解释了**为什么**要"比工具描述所说的更积极使用"：

> `This is because the task list is nicely rendered as a widget to users in the desktop app.`

跳过条件只有两条：纯对话无工具调用、用户明确要求不用。

推荐顺序（原文）：`Skills / AskUserQuestion（如需澄清）→ TaskCreate → 实际工作（过程中 TaskUpdate）`。

两个易忽略的细节：

| 细节 | 原文 |
| :--- | :--- |
| 工具可能未加载 | `(if they are not loaded yet, load them via ToolSearch first)` |
| 子 agent 结束后要回写 | `after a subagent returns, Claude uses TaskUpdate to mark the tasks that the subagent's work finished` |

---

## 14.3 验证：一个专门的收尾任务

`<verification_step>`（嵌在 `<todo_list_tool>` 内，3 行）：

> `Claude should include a final verification step in the task list for virtually any non-trivial task.`

允许的验证手段（原文列举）：事实核查、程序化验算、评估来源、考虑反方论证、单元测试、**截图并查看**、生成并阅读 diff、复核断言。

高风险场景：`use a subagent (Agent tool) for verification`。

> 注意这条与第十二篇呼应：截图查看用的正是 widget 的 `screenshot_widget` 宿主工具，而它有"含密钥字段不截、提问表单不截、文本框画空"三道闸门。

---

## 14.4 工具清单：包里有两套，且不一致

在 `app.asar:.vite/build` 里能观测到两处 `new Set("A.B.C".split("."))` 形式的工具名校验表：

**表一（28 个，`index.pre.js` / `index.chunk-xV3fJhc7.js`）**

```
AskUserQuestion · Bash · BashOutput · Edit · ExitPlanMode · Glob · Grep · JavaScript ·
KillBash · MultiEdit · NotebookEdit · Read · REPL · SendUserMessage · Skill · Task ·
TaskCreate · TaskGet · TaskList · TaskStop · TaskUpdate · Tmux · TodoWrite · ToolSearch ·
WebFetch · WebSearch · Workflow · Write   (+ unknown)
```

**表二（29 个，`index.chunk-D1yJ0UIX.js`）**

```
Agent · AskUserQuestion · Bash · CronCreate · CronDelete · CronList · Edit · EnterPlanMode ·
EnterWorktree · ExitPlanMode · ExitWorktree · ListAgents · Monitor · NotebookEdit · PowerShell ·
ReportFindings · ScheduleWakeup · SendMessage · Skill · TaskCreate · TaskGet · TaskList ·
TaskStop · TaskUpdate · WebFetch · WebSearch · Workflow · Write
```

| 只在表一 | 只在表二 |
| :--- | :--- |
| `BashOutput` `Glob` `Grep` `JavaScript` `KillBash` `MultiEdit` `Read` `REPL` `SendUserMessage` `Task` `Tmux` `TodoWrite` `ToolSearch` | `Agent` `Cron*` `EnterPlanMode` `EnterWorktree` `ExitWorktree` `ListAgents` `Monitor` `PowerShell` `ReportFindings` `ScheduleWakeup` `SendMessage` |

> **推断**：表一是**桌面端 agent 会话**的工具集（有 `Read`/`Grep`/`Glob`、`Tmux`、`ToolSearch`）；表二是**另一运行时/子 agent 编排**的工具集（有 `Agent`、`Cron*`、`Worktree*`、`Monitor`、`PowerShell`）。两者共用 `AskUserQuestion` / `Skill` / `Task*` / `WebFetch` / `WebSearch` / `Workflow` / `Write`。
>
> **重要边界**：这两张表是**名字白名单**，包里**没有**它们的 `inputSchema`。工具 schema 由 agent 运行时（Claude Code / Agent SDK 一侧）提供，不在 `app.asar` 内——所以本卷无法给出 `AskUserQuestion` 的字段定义。

---

## 14.5 钩子事件：33 个

同一批 chunk 里还有一张钩子事件白名单（`Ji = new Set("…".split("."))`）：

```
PreToolUse · PostToolUse · PostToolUseFailure · PostToolBatch · Notification ·
UserPromptSubmit · UserPromptExpansion · SessionStart · SessionEnd · Stop · StopFailure ·
SubagentStart · SubagentStop · PreCompact · PostCompact · PreModelSwitch · PostModelSwitch ·
PermissionRequest · PermissionDenied · Setup · TeammateIdle · TaskCreated · TaskCompleted ·
Elicitation · ElicitationResult · ConfigChange · WorktreeCreate · WorktreeRemove ·
InstructionsLoaded · CwdChanged · FileChanged · DirectoryAdded · MessageDisplay
```

> 这张表比 4.x 卷记录的 hook 面宽得多：多了 `PostToolBatch`、`Pre/PostModelSwitch`、`Elicitation*`、`Worktree*`、`InstructionsLoaded`、`CwdChanged`、`FileChanged`、`DirectoryAdded`、`MessageDisplay`、`TeammateIdle`。

---

## 14.6 密钥字段识别：29 个关键词

`index.chunk-D76LincQ.js` 里有一张密钥字段名表：

```
TOKEN · SECRET · PASSWORD · PASSWD · PASSPHRASE · KEY · AUTH · COOKIE · PAT · DSN ·
WEBHOOK · CREDENTIAL · CREDENTIALS · CREDS · APIKEY · ACCESSKEY · SECRETKEY · ACCOUNTKEY ·
PRIVATEKEY · AUTHKEY · SSHKEY · SIGNINGKEY · MASTERKEY · DEPLOYKEY · ENCRYPTIONKEY ·
PGPASSWORD · SSHPASS
```

> 这正是第十二篇 `SECRETS_FIELD` 闸门背后的词表：widget 里出现这些名字（或 `id`/`placeholder`/`label` 命中）就不截图。**同一张表同时服务"表单密钥识别"和"截图隐私闸门"**。

---

## 14.7 网页内容限制：禁止一切绕过

`<web_content_restrictions>`（16 行）是提示词里唯一一处**显式禁止用其他工具绕过**的段落：

> `When WebFetch or WebSearch fails or reports that a domain cannot be fetched, Claude must NOT attempt to retrieve the content through alternative means.`

四条禁止（原文）：

| 禁止 | 例子 |
| :--- | :--- |
| 用 shell 抓取 | `curl`、`wget`、`lynx` |
| 用 Python 抓取 | `requests`、`urllib`、`httpx`、`aiohttp` |
| 用任何其他语言/库发 HTTP | — |
| 访问缓存/存档/镜像 | 绕过被拦内容 |

失败后只允许两步：告知用户内容不可访问；提供不依赖该内容的替代方案。

> **与浏览器面板的关系**：这条限制管的是**模型主动抓取**；用户在浏览器面板里自己打开网页是另一回事（第八篇）。两者共用同一套站点权限与组织策略，但触发路径不同。

---

## 14.8 引用要求

`<citation_requirements>`（4 行）：

> 回答基于本地文件或 MCP 工具调用（Slack、Asana、Box…）且内容**可链接**时，必须在结尾加 `Sources:` 段；格式优先用工具描述指定的，否则 `[Title](URL)`。

---

## 14.9 本篇对前文的补充

| 前文 | 本篇补充 |
| :--- | :--- |
| 第十二篇 `SECRETS_FIELD` | 给出背后的 29 个关键词表 |
| 第十三篇 `<todo_list_tool>` | 补出 `TaskCreate/TaskUpdate` 的实际工具名、`ToolSearch` 兜底、子 agent 回写 |
| 第四篇/第八篇 | 未涉及；本篇只处理提示词与工具名 |

---

## 14.10 证据索引（本篇）

| ID | 类型 | 位置 | 支撑结论 |
| :--- | :--- | :--- | :--- |
| E14-1 | 观测 | `appendix/desktop-3p-base-prompt.md` 105–146 行 | 提问/待办/验证三段原文 |
| E14-2 | 观测 | 同上 147–151 行 | 引用要求 |
| E14-3 | 观测 | 同上 170–186 行 | 网页内容四条禁止 |
| E14-4 | 观测 | `app.asar:.vite/build/index.pre.js`（`TS` Set，28 个） | 桌面端 agent 工具名表 |
| E14-5 | 观测 | `app.asar:.vite/build/index.chunk-D1yJ0UIX.js`（`O0`，29 个） | 另一运行时工具名表 |
| E14-6 | 观测 | 同上（`Ji` Set，33 个） | 钩子事件白名单 |
| E14-7 | 观测 | `app.asar:.vite/build/index.chunk-D76LincQ.js` | 29 个密钥字段关键词 |

<p align="center"><a href="13-系统提示词解剖.md">← 第十三篇</a> · <a href="README.md">📚 本卷索引</a></p>



---

---
title: 运行时本体：Agent VM、权限模型与钩子转发
part: 15
category: 运行时
domain: 宿主与运行时
---

<p align="center"><a href="14-工具与钩子面.md">← 第十四篇</a> · <a href="README.md">📚 本卷索引</a></p>

# 第十五篇：运行时本体：Agent VM、权限模型与钩子转发

> **技术领域与英文指代**：运行时载体（runtime carrier）、虚拟机（Virtualization.framework / VZ）、SDK 版本（`.sdk-version`）、会话分区（session partition）、权限处理器（permission handler）、按源分类（origin classification）、钩子转发（hook relay）。

前十四篇讲的都在 `app.asar` 与 `ion-dist.asar` 里。本篇补上**第三层**：不在安装包内、而是运行时下载到用户目录的 **agent 运行时本体**，以及它周边的 VM、权限与钩子转发。

---

## 15.1 运行时在用户目录，不在 App 包里

```
~/Library/Application Support/Claude/
├── claude-code/
│   ├── 2.1.325/<hash>/claude.app/        337 MB（macOS 版，CFBundleShortVersionString = 2.1.326）
│   └── 2.1.326/<hash>/claude.app/        337 MB
├── claude-code-vm/
│   ├── .sdk-version                      "2.1.165"
│   └── 2.1.165/claude                    244,823,688 B
└── claude-code-sessions/                 1.1 MB
```

| 载体 | 类型 | 说明 |
| :--- | :--- | :--- |
| `claude-code/<ver>/…/claude.app` | macOS App 包 | 宿主侧的 Claude Code |
| `claude-code-vm/<ver>/claude` | **ELF 64-bit ARM aarch64**（`/lib/ld-linux-aarch64.so.1`，**未 strip**） | 在 Linux VM 里跑的 agent |
| `.sdk-version` | 文本 | `2.1.165` |

> **这就是提示词里"implemented on top of Claude Code and the Claude Agent SDK"的落地**：`app.asar` 只负责**拉起与转发**，真正的 agent 逻辑在两个可下载的二进制里。所以第十四篇找不到工具 schema——它们在 `claude-code-vm/2.1.165/claude` 内部。

---

## 15.2 沙箱是一台真 VM（Virtualization.framework）

`app.asar:.vite/build/index.chunk-xV3fJhc7.js` 里有 VM 诊断代码：

```js
Z.info("[vmDiagnostics] Capturing host memory diagnostics...");
let [t,n,r] = await Promise.all([i$i(), a$i(), o$i()]),
    i = { jetsamPressureLevel: n, vzFootprintBytes: r.bytes };
```

| 线索 | 含义 |
| :--- | :--- |
| `vzFootprintBytes` | **VZ** = macOS Virtualization.framework 的内存足迹 |
| `jetsamPressureLevel` | 系统内存压力等级（jetsam） |
| 日志前缀 `[vmDiagnostics]` | 应用会周期性采集宿主机与 VM 的内存状态 |

> **与提示词的对应**：`<high_level_computer_use_explanation>` 说 Bash 在 "isolated Linux sandbox (Ubuntu 22)"。宿主侧证据表明那不是进程级沙箱，而是**一台 macOS 原生虚拟化的 Linux 虚拟机**，并配了内存压力监控。

---

## 15.3 工具 schema 在二进制里

在 `claude-code-vm/2.1.165/claude` 上做字符串检索，可以直接命中工具名与 schema 片段：

```
AskUserQuestion   39 次
TaskCreate / ToolSearch / TodoWrite   均命中
```

`AskUserQuestion` 的入参形状（从权限请求处理代码反推，原文变量）：

```js
T6.tool_name === vY                    // vY = AskUserQuestion
  && Array.isArray(T6.input?.questions)
  && u8 = N8[0]                        // 第一题
  && o8 = u8?.header || u8?.question   // 标题优先，其次题干
```

| 字段 | 观测到的用法 |
| :--- | :--- |
| `questions[]` | 数组，可多题（提示里显示 `(+N more)`） |
| `questions[i].question` | 题干 |
| `questions[i].header` | 短标题（优先用于展示） |
| `multiSelect` | 存在；**预览仅支持单选**（工具描述原文：`previews are only supported for single-select questions (not multiSelect)`） |

> **仍未完全取得**：`options` 的具体结构、`header` 的字符上限等，需要完整 schema 而非片段。本卷只记录**可观测的字段名与语义**。

---

## 15.4 权限模型：9 个会话，默认全拒

`app.asar` 里有 **9 处** `setPermissionRequestHandler` + 9 处 `setPermissionCheckHandler`，各自对应一个独立的 Electron session：

| 会话 | 策略 | 证据位置 |
| :--- | :--- | :--- |
| **MCP App（widget）** | 全部拒绝；禁下载；只允许自身加载；自定义协议 + 一次性放行表 | `index.chunk-DuW48wq0.js` |
| **文件预览** | 全部拒绝；下载仅允许「用户手势」或预览源 PDF | `index.chunk-xV3fJhc7.js` |
| **剪贴板** | 只放行 `clipboard-sanitized-write`，且要求主 frame + 守卫校验 | 同上 |
| **Artifact（严格档）** | 全部拒绝；只允许 `cowork-artifact://` | 同上 |
| **Artifact（策略档）** | 走 `q8o()` 策略（见 15.5） | 同上 |
| **Artifact（预览）** | 全部拒绝；`will-download` 直接 `preventDefault` | 同上 |
| **外部链接** | 拒绝 `openExternal` 类请求并记录被拦 scheme | 同上 |
| **OAuth 回调** | 全部拒绝，仅允许 `allowedOrigins` | `index.chunk-C_qjIyUF.js` |
| **Computer-use 覆盖层** | 全部拒绝 + `setWindowOpenHandler` 拒绝 + 禁止导航 | `index.chunk-DLKdYlrC.js` |

> **统一姿势**：`setPermissionRequestHandler((…, cb) => cb(false))` + `setPermissionCheckHandler(() => false)` + `will-download → preventDefault()`。**默认拒绝，按需白名单**。

---

## 15.5 `q8o()`：唯一会放行的策略函数

```js
function q8o(permission, url, isMainFrame, session) {
  const kind = W8o(url ?? "", session);          // 按来源把 URL 分成 content / page / shell …
  return permission === "clipboard-sanitized-write"
    ? kind === "content" || (isMainFrame && (kind === "page" || kind === "shell"))
    : permission === "fullscreen" && kind === "content" && oTo(session) === "shown" && V6(session);
}
```

| 放行的权限 | 条件 |
| :--- | :--- |
| `clipboard-sanitized-write` | 来源是 `content`，**或**主 frame 且来源是 `page`/`shell` |
| `fullscreen` | 来源是 `content` **且**视图已显示 |

**其余权限一律不通过**——包括摄像头、麦克风、地理位置、通知、剪贴板读取等。

> **与第十四篇的对照**：提示词用文字要求模型"不要用 curl/requests 绕过 WebFetch 的限制"；宿主侧则用**结构性拒绝**兜底——就算模型想用浏览器面板取内容，面板本身也只放行两个权限。**两条防线互不依赖**。

---

## 15.6 钩子：CLI 产生，桌面转发

`HookEvent` 在 `app.asar` 里只出现在**参数拼装**处：

```js
this.options.includeHookEvents && M.push("--include-hook-events")
…
O && M.push("--include-partial-messages")
this.options.sessionMirror && M.push("--session-mirror")
```

| 事实 | 含义 |
| :--- | :--- |
| 桌面把 `--include-hook-events` 传给 CLI | 钩子**由 CLI 触发** |
| 33 个事件名是 CLI 的契约 | 桌面只做白名单校验与展示 |
| `ion-dist` 里出现 `hook_event` / `hook_response` / `PreToolUse` | 渲染层负责**呈现**钩子结果 |
| `--session-mirror` | 会话镜像（与 Remote Control 相关） |

> 所以第十四篇那张 33 个事件的表，**桌面端只"认识"它们，不"实现"它们**。真正的执行点在 `claude-code-vm/…/claude`。

---

## 15.7 三层职责，终于对齐

| 层 | 载体 | 负责 |
| :--- | :--- | :--- |
| **壳**（`app.asar`） | 主进程 + preload | 窗口、IPC、session 权限、MCP 宿主、拉起 CLI、转发钩子 |
| **UI**（`ion-dist.asar`） | 渲染层 | 产品界面、widget 运行时、CDS、预览/元素选择 |
| **运行时**（用户目录） | `claude-code*.app` / `claude`(ELF) | agent 循环、工具实现、钩子执行、工具 schema |

> **这也是为什么本卷有些问题"在包里找不到答案"**：工具 schema、钩子实现、agent 循环都在第三层，而第三层是**运行时下载**的、版本独立（`2.1.326` / `2.1.165`），不随 `5.11492.5` 打包。

---

## 15.8 证据索引（本篇）

| ID | 类型 | 位置 | 支撑结论 |
| :--- | :--- | :--- | :--- |
| E15-1 | 观测 | `~/Library/Application Support/Claude/{claude-code,claude-code-vm,claude-code-sessions}` | 运行时在用户目录，含 2 个版本 + VM 版 |
| E15-2 | 观测 | `claude-code-vm/2.1.165/claude`（`file` 输出） | ELF aarch64、未 strip、244,823,688 B |
| E15-3 | 观测 | `claude-code-vm/.sdk-version` = `2.1.165` | SDK 版本独立于 app 版本 |
| E15-4 | 观测 | `app.asar:.vite/build/index.chunk-xV3fJhc7.js`（`[vmDiagnostics]` / `vzFootprintBytes`） | 沙箱是 Virtualization.framework VM |
| E15-5 | 观测 | `claude` 二进制字符串检索 | `AskUserQuestion` 39 次、`TaskCreate`/`ToolSearch`/`TodoWrite` 命中 |
| E15-6 | 观测 | 同上（权限请求处理段） | `questions[]` / `question` / `header` / `multiSelect` 语义 |
| E15-7 | 观测 | `app.asar` 9 处 `setPermissionRequestHandler` | 9 个 session 全部默认拒绝 |
| E15-8 | 观测 | 同上（`q8o()` / `W8o()`） | 只放行 clipboard-write 与 fullscreen |
| E15-9 | 观测 | 同上（`--include-hook-events` / `--session-mirror`） | 钩子由 CLI 执行，桌面转发 |
| E15-10 | 观测 | `ion-dist.asar:assets/v1`（`hook_event` / `hook_response`） | 渲染层呈现钩子结果 |

<p align="center"><a href="14-工具与钩子面.md">← 第十四篇</a> · <a href="README.md">📚 本卷索引</a></p>

