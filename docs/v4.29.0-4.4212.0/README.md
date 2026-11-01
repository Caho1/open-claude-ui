# Claude Desktop 4.4212.0 分析报告 · CDS 基线（3.6556.2 取证 + 4.29.0 / 4.4212.0 增量复核）

> **目标应用载体**：Anthropic 官方生产包 macOS `/Applications/Claude.app`
> **主基线**：`@ant/desktop 3.6556.2`（ASAR 摘要 `b2dfbbb40325d978dcb7561ad12a6f9bc199f8f46b7d3d2897af74ce8965d68a`，主样式表 `MainWindowPage-BjVtjJFx.css`）
> **增量复核**：`4.29.0`（ASAR `fea39d03…`）→ **`4.4212.0`**（ASAR `ce90267c…`，主样式表 `MainWindowPage-BoMeyaMm.css`，239,201 bytes）——见 [§6.11](06-全量CSS扫描与官方规范比对.md) / [§6.12](06-全量CSS扫描与官方规范比对.md)
> **逆向工具栈**：**REA (Reverse Engineer Anything) v6.8.0** + 应用内 **Main Process Debugger** 运行时实测

---

## ⚠️ 本版最重要的结论

**第二版（v2.37337.1）文档的全部基线已失效，不是补充数字的问题。**

| v2 文档的基线 | v3 实测 | 证据 |
| :--- | :--- | :--- |
| `@ant/desktop v2.37337.1` | **`@ant/desktop v3.6556.2`** | ASAR 内 `package.json`：`name=@ant/desktop version=3.6556.2 productName=Claude` |
| `MainWindowPage-BD9CWQ83.css` | **文件不存在** | ASAR 内 17 个 CSS 文件中无此名；当前主表为 `MainWindowPage-BjVtjJFx.css` |
| `index.chunk-BWk6pVUt.js` | **文件不存在** | `index.chunk-2MD7iXhg.js` 等其他 chunk 存在，此名称不在 629 个 ASAR 条目中 |
| 「40 大 `data-cds` 命名空间」 | **45 个** | `grep -o "\[data-cds=[A-Za-z-]*\]"` 去重计数 = 45 |
| 「47 项 `@keyframes cds-*`」 | **55 个**（含 `spin`） | `grep -o "@keyframes [a-zA-Z0-9_-]*" \| sort -u \| wc -l` = 55 |

**因此：**
- v2 文档已被标记为 `status: historical`，仅作历史快照保留。
- 本目录（`docs/v4.29.0-4.4212.0/`）是当前唯一有效的取证基线。
- `code-examples/` 中基于 v2 的令牌值需要按本文修正（详见 [第四章](04-系统底座全景解密.md)）。

---

## 本文的取证纪律

本文**每一条结论都附代码证据**，证据形式为以下三类之一：

1. **ASAR 条目路径 + 字节偏移**（可直接复现读取）
2. **CSS 原文片段**（从 `MainWindowPage-BjVtjJFx.css` 精确 `grep`/`extract`）
3. **JS 原文片段**（从 `.vite/build/*.js` 精确截取）

凡是 REA 无法确定、或静态分析不可解的项，**一律标注为 `unknown` 并说明原因**，不做推断性补全。

**已知的整体覆盖度限制**（来自 REA 取证包 `/tmp/claude_app_asar_evidence.json`，217.3 MB，`evidence_id: ev_77dc39e0…`）：

```
records[0].normalized_result.statistics:
  relevant_files            572
  parsed_javascript_files   546
  skipped_javascript_files    7
  parse_failures              0
  visited_ast_nodes     6621556

records[0].normalized_result.limitations: 1064 条
  其中 532 个文件被资源预算截断
```

其中 512 条的原文是：

```
<file>: Resource constraint during analyze_javascript_application:
The parent reserved its remaining result capacity for static observations;
semantic analysis of <file> was not started
```

被截断的文件**包含核心主进程文件**——这些文件的静态事实保留，但语义图未生成。本文在涉及这些文件的章节会单独标注。

---

## CDS 3.0 与 CDS 2.0 的实质差异

本节只列**有代码证据**的差异，不做风格化叙述。

| 维度 | CDS 2.0（v2.37337.1） | CDS 3.0（3.6556.2 实测） | 证据位置 |
| :--- | :--- | :--- | :--- |
| 主样式表文件名 | `MainWindowPage-BD9CWQ83.css` | `MainWindowPage-BjVtjJFx.css` | ASAR 条目列表 |
| 验证状态 | 本机无备份，**不可复核** | ✅ 本机可复现（237,153 bytes） | `stat` + `shasum` |
| `data-cds` 命名空间 | 40（文档声称） | **45** | 见 [4.2](04-系统底座全景解密.md) |
| `@keyframes cds-*` | 47（文档声称） | **55** | 见 [4.1](04-系统底座全景解密.md) |
| `@property` 注册 | 未记录 | **24 个** | 见 [4.5](04-系统底座全景解密.md) |
| `--cds-clay-emphasized` | `#cc5a36`（文档） | **`#c6613f`** | 见 [4.3](04-系统底座全景解密.md) |
| 骨架屏实现 | `.skeleton-shimmer` + `::after` | **双层 `data-cds="SkeletonGroup"` / `data-cds="Skeleton"` + `.cds-skel-sweep-band` 子元素** | 见 [3.5](03-架构重构与对比分析.md) |
| 骨架屏「hold」机制 | 未记录 | **`data-hold` 三态：无 / `none` / `delayed`** | 见 [3.5](03-架构重构与对比分析.md) |
| 减少动效 | 未记录 | `[data-reduce-motion=true]` + `@media (prefers-reduced-motion:reduce)` 双层 | 见 [3.5](03-架构重构与对比分析.md) |
| 暗色模式作用域 | `.dark` class | **`[data-mode=dark\|light\|system]` 三态 + `.cds-dark-scope`** | 见 [4.4](04-系统底座全景解密.md) |
| RTL 支持 | 105° → 255° 渐变翻转 | **`:lang(ae/ar/arc/bcc/…)` 精确语言列表 + `animation-direction:reverse`** | 见 [3.5](03-架构重构与对比分析.md) |

---

## 🧭 v4.29.0 版分章目录

- [第一章：综述与版本边界](01-综述与版本边界.md)
  - 1.1 版本边界声明（`@ant/desktop@3.6556.2`，ASAR 根摘要，进程/窗口拓扑）
  - 1.2 取证覆盖度与不可解项（532 文件语义截断、6 个结构性零值）
  - 1.3 v2 → v3 迁移影响面（哪些令牌必须改、哪些可以保留）
- [第二章：Electron 架构取证](02-Electron架构取证.md)
  - 2.0 复现方法（ASAR header 布局）
  - 2.1 主进程面（`index.pre.js`：6 个 IPC 通道、0 个 handler、0 个 fork 调用）
  - 2.2 渲染进程面（`mainView.js`：1598 次 `ipcRenderer`、12 个字面量桥接 API 名）
  - 2.3 窗口拓扑（7 个 renderer 入口 vs summary 的 5 个 BrowserWindow）
  - 2.4 完整性冲突（8 处声明摘要与实测字节不符）
- [第三章：架构重构与对比分析](03-架构重构与对比分析.md)
  - 3.1 骨架屏：双层组件结构与 sweep band 子元素
  - 3.2 骨架屏：`data-hold` 三态揭示时序机制
  - 3.3 骨架屏：双模 wave / lockstep 的真实延时公式
  - 3.4 骨架屏：RTL 语言级适配
  - 3.5 减少动效与残留动效兜底
  - 3.6 Pill 胶囊：1.32x 过冲的 9 个关键帧
  - 3.7 滚动渐隐：`@property` 驱动的纯 CSS 实现
- [第四章：系统底座全景解密](04-系统底座全景解密.md)
  - 4.1 `@keyframes cds-*` 完整 55 项清单
  - 4.2 `data-cds` 完整 45 项命名空间清单
  - 4.3 色彩体系：35 阶 gray / 35 阶 orange 全表 + clay 三值问题
  - 4.4 模式作用域：`data-mode` 三态与暗色覆盖
  - 4.5 `@property` 24 项注册清单
  - 4.6 时间与缓动 Token
  - 4.7 圆角与密度系统
- [第五章：open-claude-ui 差异审计](05-open-claude-ui差异审计.md)
  - 5.1 已对齐项（35 阶 gray/orange 全表）
  - 5.2 必须修正项（`clay-emphasized`、骨架屏暗色）
  - 5.3 缺失项（44 个 keyframes / 27 个 data-cds / 7 个 @property）
  - 5.4 Issue #25 分支的取值裁定
  - 5.5 修复优先级总表
- [第六章：全量 CSS 扫描与官方规范比对](06-全量CSS扫描与官方规范比对.md)
  - 6.1 扫描范围（17 个 CSS / 9 个唯一）
  - 6.2 44 个缺失 keyframes 全部在主样式表中
  - 6.3 `window-shared.css` 揭示 CDS 的真实分发路径
  - 6.4 提取到官方 CDS 规范文档（58,354 字符）
  - 6.5 `--cds-*` 与官方 token 的 131 项比对（90 等价 / 4 单位 / 37 真实差异）
  - 6.6 对前序章节结论的修正
  - 6.7 运行时实证（Main Process Debugger：preload 真实路径 / utility process / 双模值表 / 修复验证）
  - 6.8 对前序章节结论的修正
  - 6.9 更新后的差异优先级
  - 6.10 补充盘点：ASAR 全量架构（compile-cache / bundled-skills / 内置 MCP servers / Cowork VM / 现代 CSS 特性）
- [第七章：总结与后续工作](07-总结与后续工作.md)
  - 7.1 本次取证的确定性边界
  - 7.2 已完成的结论清单
  - 7.3 明确的未知项
  - 7.4 建议的后续工作
  - 7.5 本文的可复现性声明

---

## 复现本文所有结论的方式

本文每条证据都可用如下命令复现（需 REA 6.8.0 或纯 Node）：

```bash
# 1. 确认版本
shasum -a 256 "/Applications/Claude.app/Contents/Resources/app.asar"
# 期望：b2dfbbb40325d978dcb7561ad12a6f9bc199f8f46b7d3d2897af74ce8965d68a

# 2. 抽取主样式表（ASAR header 为纯 JSON，位于偏移 16，长度见前 16 字节的 uint32LE@12）
node scripts/extract-main-css.mjs > MainWindowPage-BjVtjJFx.css

# 3. 验证任意一条 token / keyframes 结论
grep -o "@keyframes [a-zA-Z0-9_-]*" MainWindowPage-BjVtjJFx.css | sort -u | wc -l   # 55
grep -o "\[data-cds=[A-Za-z-]*\]" MainWindowPage-BjVtjJFx.css | sort -u | wc -l     # 45
grep -o "@property --cds-[a-zA-Z0-9_-]*" MainWindowPage-BjVtjJFx.css | sort -u | wc -l  # 24
```



> 💡 **单文件检索**：如需离线全局搜索v4.29.0 版全文，参见 [v4.29.0 版单文件完整版](Claude-Desktop-4.29.0-4.4212.0-全量分析.full.md)。
