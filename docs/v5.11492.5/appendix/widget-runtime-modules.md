---
title: 附录 D · widget 运行时模块索引（41 个）
part: appendix
category: 附录
domain: 工具与运行时
---

<p align="center"><a href="../README.md">📚 本卷索引</a> · <a href="../12-本地MCP工具链.md">第十二篇：本地 MCP 工具链</a></p>

# 附录 D：widget 运行时模块索引（41 个）

> **这是什么**：`visualize` widget 运行时被内联在 `app.asar:.vite/build/index.chunk-D92FUleA.js` 的一个模板字面量里，**保留了 `// src/scripts/*.ts` 模块边界与源码注释**（未压缩）。解码后共 **9,155 行 / 302 KB**。
>
> **提取口径**：定位第一个 `// src/scripts/…` 标记 → 向后找到所在模板字面量的结束反引号 → 解码 `\n` / `\'` / `\uXXXX` → 按标记切分，去掉每行两级缩进。结果与 `MODULES.json` 一致。
>
> **为什么不在仓库里放源码**：本仓库只收录**分析与索引**。完整源码已按上述口径抽取到仓库外的 `~/Desktop/claude-widget-runtime/src/scripts/`（41 个 `.js` + `00-preamble.js` + `MODULES.json`），需要时按此配方可随时重现。
>
> **版权说明**：源码著作权归 Anthropic 所有；本附录只给出模块名、行数与首行，用于定位与复刻，不构成源码再分发。

---

## D.1 模块清单（按行数降序）

| 行数 | 模块 | 首行 |
| ---: | :--- | :--- |
| 1142 | `widget-main.js` | `var hostApp4 = app;` |
| 815 | `elicitation.js` | `var shownForms = /* @__PURE__ */ new Set();` |
| 777 | `animation-frames.js` | `var BACKING_MS = 100;` |
| 730 | `chart-text-size.js` | `var chartFontSizes = /* @__PURE__ */ new WeakMap();` |
| 671 | `open-larger.js` | `var ZOOM_STEP = 1.25;` |
| 497 | `elicit-steps.js` | `var REST_MS = 500;` |
| 411 | `host-tool-calls.js` | `var SCREENSHOT = "screenshot_widget";` |
| 385 | `frame-sized.js` | `var EMPTY_MAX_HEIGHT = 8;` |
| 340 | `share-edits.js` | `var MARKED = `[${SHARE_MARK}]`;` |
| 335 | `clipboard-copy.js` | `function inkBox({` |
| 251 | `menu-room.js` | `var GAP_PX = 4;` |
| 240 | `wide-scroll.js` | `var STICK_OUT_PX = 24;` |
| 237 | `copy-canvas.js` | `var WRAPPER_OPENS = "data:image/svg+xml;charset=utf-8,%3Csvg";` |
| 225 | `more-menu.js` | `function placeMoreMenu(group2, popover) {` |
| 214 | `host-init.js` | `function applyHostTheme(theme) {` |
| 187 | `elicit-design-system.js` | `var NAME_MAX = 41;` |
| 140 | `ui-cards.js` | `var HOST_LETS_CARDS_SEND = "data-cards-send";` |
| 136 | `hosted-copies.js` | `var PAGE_BASE = document.baseURI;` |
| 132 | `export-scrub.js` | `var EXECUTABLE_SELECTOR = "script, style, iframe, frame, embed, object, base, ` |
| 131 | `streaming-morph.js` | `var HOSTED_HELPERS = "/libs/imagine/streaming-helpers-1/streaming-helpers.mjs"` |
| 117 | `mcp-app-helper.js` | `function menuRoom() {` |
| 117 | `svg-text-occlusion.js` | `function fixSvgTextOcclusion2(container3) {` |
| 97 | `svg-text-edge-fix.js` | `function fixSvgTextEdgeClip2(container3) {` |
| 89 | `download-links.js` | `var hostApp = app;` |
| 77 | `open-link.js` | `var host3 = app;` |
| 71 | `conversation-durable.js` | `var SUBMITTED_KEY_PREFIX = "elicit-submitted:";` |
| 68 | `clipboard-text.js` | `var host = app;` |
| 68 | `host-display.js` | `var display = {` |
| 67 | `svg-clip-fix.js` | `function fixSvgClipping2(container3) {` |
| 65 | `elicit-log.js` | `var ELICIT_BOXED = {` |
| 58 | `elicit-opt-out.js` | `var offered = [];` |
| 57 | `standalone-page.js` | `var shellRoot = document.documentElement;` |
| 56 | `send-prompt.js` | `var hostApp2 = app;` |
| 50 | `after-the-visual.js` | `function afterTheVisual(type, concerns, decide) {` |
| 31 | `sized-by-viewport.js` | `var CSS_VIEWPORT_UNITS = /\d\s*[dsl]?v(?:h\|min\|max)\b\|\b(?:min-\|max-)?h-(?` |
| 27 | `secret-fields.js` | `var SAYS_A_SECRET = /(pass(word\|wd\|code\|phrase\|key)\|(^\|[^a-z])(pass[^a-z` |
| 21 | `form-submit.js` | `function sparesTheVisual(form, submitter) {` |
| 14 | `drawn-frame.js` | `function namesADrawnFrame(target) {` |
| 4 | `share-edits-meta.js` | `var SHARE_EDITS_META_NAME = "share-edits";` |
| 3 | `wide-clip.js` | `var WHOLE_WIDTH = "whole-width";` |
| 2 | `proxy-page.js` | `var proxyPage = window.parent;` |

## D.2 按职责分组

| 组 | 模块 |
| :--- | :--- |
| 宿主通信 | `host-init` · `host-display` · `host-tool-calls` · `proxy-page` · `mcp-app-helper` |
| 流式与生命周期 | `streaming-morph` · `animation-frames` · `conversation-durable` · `standalone-page` · `widget-main` |
| 复制与导出 | `clipboard-copy` · `clipboard-text` · `copy-canvas` · `download-links` · `export-scrub` · `hosted-copies` |
| 尺寸与溢出 | `sized-by-viewport` · `frame-sized` · `wide-clip` · `wide-scroll` · `drawn-frame` |
| SVG 修正 | `svg-text-occlusion` · `svg-clip-fix` · `svg-text-edge-fix` |
| 征询表单 | `elicitation` · `elicit-steps` · `elicit-log` · `elicit-opt-out` · `elicit-design-system` · `form-submit` · `secret-fields` |
| 协作与菜单 | `share-edits` · `share-edits-meta` · `menu-room` · `more-menu` · `open-link` · `open-larger` |
| 其他 | `ui-cards` · `chart-text-size` · `after-the-visual` |

## D.3 复现命令

```bash
# 1) 解包
npx --yes @electron/asar extract /Applications/Claude.app/Contents/Resources/app.asar /tmp/claude-asar
# 2) 定位并解码（见本附录抬头口径），按 // src/scripts/… 标记切分
# 3) 校验：41 个模块 / 9,155 行 / 302,317 字节
```

<p align="center"><a href="../README.md">📚 本卷索引</a> · <a href="../12-本地MCP工具链.md">第十二篇</a></p>
