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
