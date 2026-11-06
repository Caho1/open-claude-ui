# Claude Design System (CDS) 全量技术文档库

欢迎查阅 Claude 桌面端与 CDS 设计系统的全量逆向分析与工程实现文档。

> 📐 **文档版本卷约定**（完整规则见 [`AGENTS.md` §7](../AGENTS.md#-7-documentation-versioning-convention-文档版本卷约定)）：每次 Claude Desktop 版本更新新建 `docs/v<版本号>/`，卷内**按功能点分篇**（沿用 `docs/v1/` 体例），不按取证流程编章；新卷必须在 `README.md` / `README-en.md` / `docs/README.md` / `AGENTS.md` 四处登记并把上一卷标为历史基线。

| 卷 | 适用版本 | 状态 | 体例 |
| :--- | :--- | :--- | :--- |
| **[`v4.16336.0/`](v4.16336.0/README.md)** | `@ant/desktop 4.16336.0` | **当前版本卷** | 8 篇按功能点 + 合并版 |
| [`v4.29.0-4.4212.0/`](v4.29.0-4.4212.0/README.md) | `4.29.0 → 4.4212.0`（主基线 `3.6556.2`） | 历史基线 | 7 章 + 合并版 |
| [`v2/`](v2/README.md) | `2.37337.1` | 历史快照 | 6 章 |
| [`v1/`](v1/README.md) | `1.x` | 历史快照 | 8 篇 |

---

## 🔎 [4.16336.0 专项：侧边浏览器全量技术文档库](v4.16336.0/README.md)
> **适用版本**：Claude Desktop `@ant/desktop 4.16336.0`（当前本机实测版本；上一卷 `docs/v4.29.0-4.4212.0/` 的 `4.4212.0` 是历史基线，版本沿革见卷 README）。
> **体例**：与 v1 一致，**按功能点分 8 篇**（不是按取证流程）：架构与令牌 / 导航与标签页 / 预览与开发服务器 / 权限与浏览数据 / 元素选择与上下文注入 / 标注与截图 / 动效物理学 / 宿主与工程复刻。
> **核心焦点**：Browser / Preview pane 全量功能与样式、`180ms cubic-bezier(0.16, 1, 0.3, 1)` 几何插值与节点复用 morph、React Fiber 组件名采集链路（含 VLQ sourcemap 反查）、`<Button />` 上下文胶囊、**文件拖拽上传的三套 drop overlay / badge 视觉规格 / 附件 View Transitions 动效（第五篇 5.8–5.11）**、`Launch` 服务 100+ API 契约、9229 活体只读观测与 519 帧逐帧 / 像素级验证。参考实现 `code-examples/ElementInspectHighlight.ts`。

---

## 🚀 [第二版 (v2.0)：Claude Desktop 2.0 全量架构升级与演进报告](v2/README.md)
> **适用版本**：Claude Desktop v2.37337.1（2026-10-15 最新发布）  
> **核心焦点**：多窗口独立聊天架构、输入框 12px 扁平化圆角、左侧边栏 28px 高密状态列、离线三大可视化引擎随包内联、十大并发隔离缺陷清洗与 47 项纯 CSS 合成器动效参数。

* **[第 1 章：综述与版本边界](v2/01-综述与版本边界.md)**：桌面端与 CLI 独立发布边界界定、三层演进血缘图谱与全局设计契约。
* **[第 2 章：新增特性深度逆向](v2/02-新增特性深度逆向.md)**：独立多窗口架构、离线看板资产内联、离线消息重试机制、5 阶推理算力调节器、现代 CSS 动效系统、卡片微光浮空与企业托管迁移。
* **[第 3 章：架构重构与对比分析](v2/03-架构重构与对比分析.md)**：会话侧边栏环境收敛、画布底色冷调演进、基础圆角与密度系统、模型选择用量感知、骨架屏双模、并发缺陷修复与动效纯 CSS 合成器化。
* **[第 4 章：系统底座全景解密](v2/04-系统底座全景解密.md)**：47 项纯 CSS 动效参数全景、40 大原生组件命名空间契约、5 阶时间 Token 矩阵与 3 大贝塞尔曲线。
* **[第 5 章：生产级参考实现代码](v2/05-生产级参考实现代码.md)**：`ModelSelectorEffort.tsx`、`ChatComposerChin.tsx`、`CdsMotionEngine.tsx` 独立组件代码。
* **[第 6 章：总结与升格意义](v2/06-总结与升格意义.md)**：结构规范化、动效物理化与架构安全化三大工程跃迁总结。

---

## 🏛️ [第一版 (v1.0)：Claude Design System 1.0 逆向工程与完整组件规范](v1/README.md)
> **适用版本**：Claude Desktop v1.x 经典稳定版  
> **核心焦点**：八大基础规范、30 个生产级独立组件、4 套经典物理弹簧预设、Web Audio API 纯代码合成与 AI Agent 前端开发指南。

* **[第一篇：设计哲学与设计令牌体系](v1/01-设计哲学与设计令牌体系.md)**：Surface 0-3 色彩令牌、Clay 陶土阶梯、双环弥散投影。
* **[第二篇：基础原子组件与交互控件](v1/02-基础原子组件与交互控件.md)**：CdsButton、SegmentedControl、StatusIndicators、ConfirmationDialog 等基础控件。
* **[第三篇：会话核心流与指令交互引擎](v1/03-会话核心流与指令交互引擎.md)**：ChatMessageBubbles、ThinkingAccordion、RichComposerWithMentions、ModelSwitcher 等输入终端。
* **[第四篇：动效物理学、着色器与环境光影](v1/04-动效物理学、着色器与环境光影.md)**：二阶阻尼谐振子弹簧算法、7 档非线性 Alpha 渐隐遮罩、光场着色器。
* **[第五篇：视听多媒体与产物交互物理学](v1/05-视听多媒体与产物交互物理学.md)**：Web Audio 无损和弦合成、MediaLightboxViewer、StreamingDiffViewer 等。
* **[第六篇：系统级桌面架构与协作拓扑](v1/06-系统级桌面架构与协作拓扑.md)**：macOS Vibrancy 毛玻璃、DraggableSessionList、CoworkAgentCanvas、容器查询防挤压。
* **[第七篇：工程配置与资产代码库总览](v1/07-工程配置与资产代码库总览.md)**：Tailwind 全局样式配置、30 个生产级模块源码清单与系统级资产规范。
* **[第八篇：AI Agent 前端 UI 与动效开发指南](v1/08-AI-Agent-前端-UI-与动效开发指南.md)**：AI Agent 前端设计契约、弹簧决策树与质量门禁清单。

---

## 🎨 交互式组件故事书 (Storybook)

在本地离线体验全量生产级组件的动态交互、物理弹簧阻尼与环境光影：

```bash
npm run storybook
# 或直接双击打开:
open docs/claude-components-storybook.html
```
