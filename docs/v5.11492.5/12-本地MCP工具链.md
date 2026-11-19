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
>
> **承载视图是锁死的**：`index.chunk-DuW48wq0.js` 为 MCP App 建独立 session，`setPermissionRequestHandler(cb(false))` + `setPermissionCheckHandler(() => false)` + `will-download → preventDefault()`，`webRequest.onBeforeRequest` 只放行"该视图自身的一次加载"，并注册 `claude-mcp-app` 自定义协议。详见第十五篇 15.4。

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
