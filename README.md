# Open Claude UI (`open-claude-ui`)

<p align="center">
  <img src="assets/images/logo.svg" width="96" height="96" alt="Open Claude UI Logo" />
</p>

<p align="center">
  <strong>基于 REA 深度拆解，高保真生产级还原 Claude 设计系统 (CDS) 与工程交互物理学。</strong>
</p>

<p align="center">
  <strong>简体中文</strong> · <a href="README-en.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/Caho1/open-claude-ui/stargazers"><img src="https://img.shields.io/github/stars/Caho1/open-claude-ui?style=flat&logo=github&color=ea580c" alt="GitHub Stars" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://github.com/morluto/rea"><img src="https://img.shields.io/badge/Reverse%20Engineered%20with-REA-ea580c?logo=github" alt="Reverse Engineered with REA" /></a>
  <a href="assets/README.md"><img src="https://img.shields.io/badge/assets-clean--room%20compliance-success" alt="Asset Compliance" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.5+-blue?logo=typescript" alt="TypeScript" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18+-61DAFB?logo=react" alt="React" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/TailwindCSS-3.4+-38B2AC?logo=tailwind-css" alt="TailwindCSS" /></a>
  <a href="https://www.framer.com/motion/"><img src="https://img.shields.io/badge/Framer_Motion-11+-0055FF?logo=framer" alt="Framer Motion" /></a>
</p>

---

## 📖 简介 (Introduction)

`open-claude-ui` 是基于对现代桌面端 AI 客户端进行深度拆解与逆向分析构建的高保真开源 UI 组件库与动效引擎。

整个逆向推导、反混淆静态分析与 ASAR 资源解构，均依托于先进的多平台逆向工程框架 **[REA (Reverse Engineer Anything)](https://github.com/morluto/rea)** 完成——通过 REA 的静态 AST 解析、闭包代码反混淆与运行时跟踪能力，穿透生产级压缩包，精准还原了底层工程物理常数与数学模型。

不同于市面上常见的盲猜或近似复刻，本项目所有组件规范、物理阻尼常数、着色器关键帧及音频管道均**严格依据真实前端架构反编译验证**提炼而成：
* **温润的人文质感 (Editorial Warmth)**：纯正陶土橙（Clay `#d97757`）、4 层微对比表面阶梯（Surface 0-3）与视网膜高分屏发丝细边补偿（Hairline Ring）；
* **严苛的交互物理学 (Interaction Physics)**：4 套生产级物理弹簧参数调校、4px 指针移动死区、CJK 输入法合成守卫、7 档渐隐非线性 Alpha 遮罩；
* **高阶视听与系统架构 (Audiovisual & Architecture)**：基于原生 Web Audio API 的零延迟合成提示音、以光标为锚点的画廊跑道平移缩放、macOS 桌面毛玻璃透明融合与 Cowork 多代理协同拓扑。

> 💡 **架构分层说明 (Architecture & Portability)**：  
> 本项目的 **令牌层 (Tokens) 与纯 CSS 表现层可脱离 React 与 Tailwind 单独使用**。无论是自研桌面 Harness（如 DSH、各类 Agent 桌面容器）、传统 Web 页面还是 Vue/Svelte 宿主，只需引入 `@import "open-claude-ui/tokens.css";` 或 `@import "open-claude-ui/pure.css";`，即可直接消费全量 183 个设计令牌、Zero-JS 原生滚动消隐遮罩（`[data-cds-scroll-fade]`）与核心动效类，详情见下文快速上手。

> ⚖️ **版权与合规声明 (DMCA & Assets Policy)**：  
> 本开源项目**不公开分发任何专有二进制资产**（包括商业字体 `.ttf` 与录音 `.mp3`）。本项目提供原生系统级字体回退栈与 Web Audio API 纯代码合成音效，完全自包含、合规安全。详情参见 [assets/README.md](assets/README.md)。

---

## 🌟 核心特性 (Key Features)

```mermaid
graph TD
    OCUI["open-claude-ui"]
    
    OCUI --> Tokens["1. 设计哲学与令牌体系<br/>(Surfaces 0-3, Clay, Hairlines, System Fonts)"]
    OCUI --> Atoms["2. 基础原子交互控件<br/>(CdsButton, SegmentedControl, StatusIndicators, Dialog)"]
    OCUI --> Stream["3. 会话流与指令引擎<br/>(Composer, IME Guard, Model Switcher, MCP Cards)"]
    OCUI --> Motion["4. 动效物理学与着色器<br/>(Spring Physics, Ambient Shimmer, Scroll Fade Masks)"]
    OCUI --> Media["5. 视听多媒体与产物交互<br/>(Synthetic Audio, Lightbox Pan/Zoom, Split Resizer, Epitaxy)"]
    OCUI --> Desktop["6. 桌面架构与协作拓扑<br/>(macOS Vibrancy, Sidebar DnD, Cowork Canvas, A11y Roving)"]
    OCUI --> Setup["7. 完整工程规范与开箱即用<br/>(Tailwind, CSS Themes, Zero-Binary Dependency)"]
```

1. **30 个生产级独立代码模块**：包含 11 个基础原子控件 + 19 个深度架构物理学模块与 React Hooks，即拷即用，零黑盒依赖。
2. **纯原生系统级排版与音效**：支持系统高保真字体回退栈，内置基于 Web Audio 振荡器的零延迟提示音合成引擎。
3. **交互式组件故事书 (Storybook Preview)**：内置单文件开箱即用的离线 Storybook，支持浏览器直接打开预览全部组件动效。
4. **七大领域分卷完整技术手册**：附带深度逆向分析开发手册 [`docs/Claude Design System (CDS).md`](docs/Claude%20Design%20System%20(CDS).md)。

---

## 📚 七大篇章逆向分析手册 (Complete Technical Manual)

整个仓库最具工业价值的核心是这本长达 3,000+ 行、31 个核心子节的深度逆向工程手册：[`docs/Claude Design System (CDS).md`](docs/Claude%20Design%20System%20(CDS).md)。

它不仅记录了所有反编译源码取证位置，还详尽解构了 Anthropic 解决当代大模型产品前端痛点的系统架构方案：

### 📖 第一篇：设计哲学与设计令牌体系
* **[1.1 设计哲学与视觉调性](docs/v1/01-设计哲学与设计令牌体系.md#11-设计哲学与视觉调性)**：温润的人文质感（Editorial Warmth）、四层低对比表面微阶梯、高帧率轻负担动效。
* **[1.2 表面体系与色彩阶梯](docs/v1/01-设计哲学与设计令牌体系.md#12-表面体系与色彩阶梯)**：Surface 0 至 3 表面明度阶梯（浅色 `#f5f5f3` 至 `#ffffff`，深色 `#0b0b0a` 至 `#20201e`）与品牌陶土橙（`#d97757`）。
* **[1.3 控件尺寸与精密圆角矩阵](docs/v1/01-设计哲学与设计令牌体系.md#13-控件尺寸与精密圆角矩阵)**：外框 Composer 20px、气泡 18px、面板 10px、按钮 6/8/10px 的精密圆角拓扑。
* **[1.4 发丝细边、微光阴影与边框防臃肿体系](docs/v1/01-设计哲学与设计令牌体系.md#14-发丝细边微光阴影与边框防臃肿体系)**：高分屏 0.5px 发丝补偿（Hairline Ring）、单闭合边框原则、双环 Popover 弥散微光投影。
* **[1.5 字体排版与图标对齐系统约束](docs/v1/01-设计哲学与设计令牌体系.md#15-字体排版与图标对齐系统约束)**：深色模式视网膜字重逆补偿算法（暗色下反向减细以防文字发胀）、行内图标 `-.125em` 光学垂直居中。
* **[1.6 基础动效令牌体系](docs/v1/01-设计哲学与设计令牌体系.md#16-基础动效令牌体系)**：物理时间常数矩阵（70ms 触觉微震、120ms 几何咬合、300ms 面板滑入）与非对称贝塞尔曲线。

### 🧩 第二篇：基础原子组件与交互控件
* **[2.1 全能按钮控件阶梯](docs/v1/02-基础原子组件与交互控件.md#21-全能按钮控件阶梯)**：4 级尺寸阶梯（XS/SM/MD/LG）、5 大变体（Primary/Secondary/Ghost/Outline/Danger）、`active:scale-[0.98]` 物理触觉。
* **[2.2 分段滑动选择胶囊](docs/v1/02-基础原子组件与交互控件.md#22-分段滑动选择胶囊)**：999px 全圆角轨道、2px 几何内边距、纯几何绝对定位与 Framer Motion `layoutId` 双模式。
* **[2.3 状态指示灯与微动效套件](docs/v1/02-基础原子组件与交互控件.md#23-状态指示灯与微动效套件)**：陶土明度呼吸指示灯（2.4s）、实时活动脉冲（1.2s）、思考三点波浪跳跃、105° 骨架屏高级倾斜扫光条。
* **[2.4 模态确认对话框](docs/v1/02-基础原子组件与交互控件.md#24-模态确认对话框)**：16px 圆角、双环 Popover 投影、高斯模糊遮罩、按键陷阱与危险/默认双变体。
* **[2.5 附件磁贴与上下文胶囊](docs/v1/02-基础原子组件与交互控件.md#25-附件磁贴与上下文胶囊)**：桌面端磁贴（128×96px）与输入框行内胶囊双模式，集成 `file-thumbnail-grow-in` 入场动画。

### 💬 第三篇：会话核心流与指令交互引擎
* **[3.1 会话气泡套件与排版规范](docs/v1/03-会话核心流与指令交互引擎.md#31-会话气泡套件与排版规范)**：User 气泡严格 18px 圆角与浅蓝微调底色，Assistant 零边框透明排版与代码块联动。
* **[3.2 思考过程折叠与时间状态机](docs/v1/03-会话核心流与指令交互引擎.md#32-思考过程折叠与时间状态机)**：CSS Grid `0fr -> 1fr` 弹性伸缩动画，生成期间传递 `onOpenChange = undefined` 强制展开互斥锁。
* **[3.3 新一代富文本输入框终端与指令交互引擎](docs/v1/03-会话核心流与指令交互引擎.md#33-新一代富文本输入框终端与指令交互引擎)**：CJK 输入法双重互锁守卫、`/` 指令与 `@` 上下文双触发符、自适应高度伸缩与 Token 预测。
* **[3.4 模型矩阵切换器与 Token 计量仪表盘](docs/v1/03-会话核心流与指令交互引擎.md#34-模型矩阵切换器与-token-计量仪表盘)**：三大模型梯队架构、Thinking 开关、Prompt Caching 四色显存成本解构与环形 SVG 仪表盘。
* **[3.5 交互式工具调用与 MCP 决策卡片](docs/v1/03-会话核心流与指令交互引擎.md#35-交互式工具调用与-mcp-决策卡片)**：严格三态授权状态机（`pending_approval` → `running` → `success` / `error`）、三阶决议动作阵列与 Payload 审查。

### ⚡ 第四篇：动效物理学、着色器与环境光影
* **[4.1 全量动效引擎与关键帧规范](docs/v1/04-动效物理学、着色器与环境光影.md#41-全量动效引擎与关键帧规范)**：4 套生产级物理弹簧参数矩阵调校及触感响应、核心 `@keyframes`。
* **[4.2 动态光效、着色器与推理氛围感](docs/v1/04-动效物理学、着色器与环境光影.md#42-动态光效着色器与推理氛围感)**：`wl-glow` 陶土暖光漫反射光场、`cds-shimmer-text-shine` 非对称贝塞尔曲线与焦散光场。
* **[4.3 滚动边缘平滑渐变遮罩系统](docs/v1/04-动效物理学、着色器与环境光影.md#43-滚动边缘平滑渐变遮罩系统)**：官方 7 档非线性 Alpha 渐变遮罩、动态滚动位置传感器（触顶/触底动态归零）。

### 🎨 第五篇：视听多媒体与产物交互物理学
* **[5.1 语音模式与 Web Audio 物理声学系统](docs/v1/05-视听多媒体与产物交互物理学.md#51-语音模式与-web-audio-物理声学系统)**：原生 Web Audio 振荡器无损合成音效、30% 舒缓音量标准、6 频段非线性 Gamma 波形柱（附官方 AudioWorklet 架构逆向解密）。
* **[5.2 多模态媒体查看器与画廊转场物理学](docs/v1/05-视听多媒体与产物交互物理学.md#52-多模态媒体查看器与画廊转场物理学)**：View Transitions 共享元素变形、以光标为锚点的无级 Pan/Zoom 仿射方程、75vw 跑道视口。
* **[5.3 双栏弹性分割与折叠物理学](docs/v1/05-视听多媒体与产物交互物理学.md#53-双栏弹性分割与折叠物理学)**：Iframe 事件防吞噬护盾、4px 移动死区、双击 50/50 吸附、边缘折叠门限与约束钳制。
* **[5.4 工件预览沙箱与隔离通信架构](docs/v1/05-视听多媒体与产物交互物理学.md#54-工件预览沙箱与隔离通信架构)**：Epitaxy 隔离容器、7 大专有 MIME 分发、用户手势门禁与虚拟包重定向。
* **[5.5 代码差异对比与多线程语法高亮系统](docs/v1/05-视听多媒体与产物交互物理学.md#55-代码差异对比与多线程语法高亮系统)**：Shadow DOM 隔离、CSS Grid 行高对齐锁定、增量流式追加管道、统一/分屏双模式。

### 🖥️ 第六篇：系统级桌面架构与协作拓扑
* **[6.1 macOS 桌面宿主深度融合与窗口材质](docs/v1/06-系统级桌面架构与协作拓扑.md#61-macos-桌面宿主深度融合与窗口材质)**：`hiddenInset` 标题栏、交通灯逆缩放几何补偿、`-webkit-app-region: drag` 安全区、macOS Vibrancy 毛玻璃。
* **[6.2 侧边栏会话拖放重排与拓扑网格](docs/v1/06-系统级桌面架构与协作拓扑.md#62-侧边栏会话拖放重排与拓扑网格)**：`pinnedOrder` 乐观拓扑重排、4px 移动死区、微倾斜幽灵投影与落点对撞占位线。
* **[6.3 多代理协作看板与 Cowork 空间拓扑](docs/v1/06-系统级桌面架构与协作拓扑.md#63-多代理协作看板与-cowork-空间拓扑)**：多 Agent 任务委派状态机、团队共享工件网格资产池、`BroadcastChannel` 跨窗口同步。
* **[6.4 流式大文本输出与滚动视口物理学](docs/v1/06-系统级桌面架构与协作拓扑.md#64-流式大文本输出与滚动视口物理学)**：150ms 冷却时间戳防抢夺、40px 底部容差图钉锁定、GPU 字符模糊消解。
* **[6.5 容器查询自适应排版与极端防挤压](docs/v1/06-系统级桌面架构与协作拓扑.md#65-容器查询自适应排版与极端防挤压)**：基于 `@container` 的 4 阶流体压缩梯队 (>=576px / <480px / <384px / <320px)，彻底杜绝单字折行。
* **[6.6 全键盘盲操网格与无障碍访问](docs/v1/06-系统级桌面架构与协作拓扑.md#66-全键盘盲操网格与无障碍访问)**：W3C WAI-ARIA 规范、Roving TabIndex 焦点漫游、方向键二维导航、RTL 镜像翻转。
* **[6.7 异常容灾、模型限流与业务状态机](docs/v1/06-系统级桌面架构与协作拓扑.md#67-异常容灾模型限流与业务状态机)**：429/503 截断指数退避重试机、全抖动注入、3 次自动熔断恢复。

### 🛠️ 第七篇：工程配置与资产代码库总览
* **[7.1 开箱即用的 Tailwind 配置与基础 CSS 代码](docs/v1/07-工程配置与资产代码库总览.md#71-开箱即用的-tailwind-配置与基础-css-代码)**：完整的全局主题样式表与 Tailwind 工程扩展。
* **[7.2 生产级工程源码清单](docs/v1/07-工程配置与资产代码库总览.md#72-生产级工程源码清单)**：全量 30 个生产级独立代码文件（11 个基础原子 + 19 个深度架构模块）。
* **[7.3 资产规范与系统级字体/音频替代方案](docs/v1/07-工程配置与资产代码库总览.md#73-资产规范与系统级字体音频替代方案)**：系统级字体回退栈与 Web Audio API 纯代码合成提示音规范。

### 🤖 第八篇：AI Agent 前端 UI 与动效开发指南
* **[8.1~8.7 Agent 角色定位、设计令牌契约与弹簧决策树](docs/v1/08-AI-Agent-前端-UI-与动效开发指南.md)**：专为 AI Agent 定制的前端 UI 与动效装配自检指南。

### 🚀 第二版：Claude Desktop 2.0 (v2.37337.1) 全量版本更新深度逆向分析
* **[v2/README.md 综述、新增特性、架构重构、底座解密与参考实现](docs/v2/README.md)**：全量划分为 6 大独立章节，深度解析 2.0 桌面端架构大跃迁。

---

## 🔬 逆向解密的 8 大硬核算法与工程物理学 (Decompiled Algorithms & Physics)

UI 组件只是外壳，**真正让 Claude 交互质感脱颖而出的是隐藏在混淆代码底部的物理学方程与数学模型**。本项目从生产环境反编译还原了以下 8 项关键算法：

### 1. 7 档渐隐非线性透明度遮罩 (7-Stop Non-Linear Fade Mask)
* **痛点**：常规双色线性滚动遮罩在视网膜高分屏上存在严重的色阶断层（Color Banding）与生硬切断感。
* **Claude 算法**：没有采用粗暴的线性双色切线，而是在羽化距离内采用 7 档非线性采样阶梯（采样位置 15% 处对应 Alpha 5.1% `#0d`、30% 处 14.9% `#26`、45% 处 30.2% `#4d`、60% 处 50.2% `#80`、75% 处 70.2% `#b3`、87% 处 85.1% `#d9`，曲线紧密贴合 $y \approx x^{1.5}$ 幂律感知感知模型），搭配触顶/触底动态归零传感器，呈现温润如沉入水雾的边缘渐隐：
```css
/* 提取自 c6a992d55-C0zTICcS.css */
mask-image: linear-gradient(to bottom,
  transparent,
  #0000000d calc(var(--cds-scroll-fade-top) * .15),
  #00000026 calc(var(--cds-scroll-fade-top) * .3),
  #0000004d calc(var(--cds-scroll-fade-top) * .45),
  #00000080 calc(var(--cds-scroll-fade-top) * .6),
  #000000b3 calc(var(--cds-scroll-fade-top) * .75),
  #000000d9 calc(var(--cds-scroll-fade-top) * .87),
  #000 var(--cds-scroll-fade-top),
  #000 calc(100% - var(--cds-scroll-fade-bottom)),
  #000000d9 calc(100% - var(--cds-scroll-fade-bottom) * .87),
  #000000b3 calc(100% - var(--cds-scroll-fade-bottom) * .75),
  #00000080 calc(100% - var(--cds-scroll-fade-bottom) * .6),
  #0000004d calc(100% - var(--cds-scroll-fade-bottom) * .45),
  #00000026 calc(100% - var(--cds-scroll-fade-bottom) * .3),
  #0000000d calc(100% - var(--cds-scroll-fade-bottom) * .15),
  transparent
);
```

### 2. 麦克风 8% 底噪门限截断与原生 Web Audio 振荡器无损合成 (Noise Floor Gating & Synthetic SFX)
* **痛点**：语音会话模式中空调等环境底噪容易导致波形持续微震抽搐；同时传统 Web 音效加载外部 MP3 有网络延迟并伴随切断爆音。
* **Claude 算法**：一是引入 8% 噪声门限过滤（`NOISE_FLOOR = 0.08`）物理截断底噪；二是基于原生 Web Audio `OscillatorNode` 进行纯代码频率调制（如 440Hz → 880Hz 上扬）与平滑指数淡入淡出（`exponentialRampToValueAtTime`），零外部音频依赖且彻底消除爆音。

### 3. CJK 输入法合成双重互锁守卫 (IME Composition Guard)
* **痛点**：中日韩用户在拼音/假名输入法候选词浮层敲击 Enter 键确认汉字时，消息被粗暴误发送。
* **Claude 算法**：构建 `!(e.nativeEvent.isComposing || e.keyCode === 229)` 双重互锁守卫，并在按键拦截状态机中接管 `Escape` 键，防止候选词关闭时意外冒泡退避整个对话窗口。

### 4. 150ms 冷却时间戳防抢夺视口图钉 (Scroll Pinning Cooldown)
* **痛点**：流式 Token 生成时，用户向上滚动查阅历史消息，会被源源不断的生成内容强制拉回底部。
* **Claude 算法**：建立 40px 底部容差图钉锁定 + 150ms 人工滚动冷却时间戳机制。用户一旦主动向上微移视口，系统立即锁定滚动权限 150ms，彻底杜绝“自动滚动抢夺屏幕”。

### 5. 以鼠标光标为物理不动点的仿射 Pan/Zoom 方程
* **痛点**：普通画廊放大图片时以视口中心为原点，导致鼠标想查看的细节区域被推离屏幕。
* **Claude 算法**：将光标指针 $(O_x, O_y)$ 视为物理世界不变不动点，解算仿射变换矩阵：
$$\text{idealTx} = O_x - (O_x - \text{prevTx}) \cdot \frac{S_{\text{target}}}{S_{\text{current}}}$$
配合 4px 手部微抖死区与视口边界溢出阻尼系数 ($y = 0.7$)。

### 6. 麦克风 6 频段非线性 Gamma 幂律能量压缩
* **痛点**：直接将分贝映射为波形高度会导致低音爆格、说话停顿时空调噪音引起持续微抖。
* **Claude 算法**：引入 8% 噪声门限过滤底噪，叠加 0.7 次幂非线性 Gamma 压缩：
$$\text{Compressed} = \min\left(1, (\max(0, E - 0.08) / 0.92)^{0.7} \times 1.5 \times W_b\right)$$
使微弱的人声细语被温和放大，高分贝爆音被自然平抑，波形动态范围极其均匀。

### 7. Shadow DOM 隔离 + CSS Grid 行高几何硬锁
* **痛点**：代码差异对比引擎在遇到长行换行（Word Wrap）时，左侧行号与右侧代码经常严重错位。
* **Claude 算法**：采用 Shadow DOM 隔离语法选择器，左右两栏在 CSS Grid 中被强制同步硬锁为相同网格行跨度：`gridRow = span ${lines}`，并使用 `feed: e.slice(m.length)` 增量向 Worker 发送 Delta，避免 $O(N^2)$ 重复语法树重排。

### 8. Iframe 事件防吞噬护盾与双击 50/50 吸附
* **痛点**：拖拽 Artifacts 双栏分割条划过内部展示 iframe 时，iframe 截获指针事件导致拖拽状态死锁卡住。
* **Claude 算法**：拖拽激活瞬间向全局注入 `data-pane-dragging="true"`，在预览容器上方强制覆盖一层透明的 `pointer-events: none` 阻断层；双击手柄瞬时触发二阶弹簧 50/50 平分居中吸附。

---

## 📂 项目结构 (Repository Structure)

```
open-claude-ui/
├── assets/                           # 资产说明与合规指引
│   ├── images/logo.svg               # 开源矢量标识
│   └── README.md                     # 资产合规与系统级回退栈说明
├── code-examples/                    # 30 个生产级独立代码文件 (开箱即用)
│   ├── ArtifactsSplitPaneResizer.tsx # 双栏弹性分割与折叠引擎
│   ├── AttachmentCard.tsx            # 附件磁贴与上下文胶囊
│   ├── cds-theme.css                 # 全局主题样式表 (CSS 自定义属性与 Keyframes)
│   ├── CdsButton.tsx                 # 4 级尺寸、5 大变体全能按钮
│   ├── ChatComposer.tsx              # 核心输入框终端
│   ├── ChatMessageBubbles.tsx        # 会话气泡套件 (User & Assistant)
│   ├── ClaudeAudioPlayer.ts          # 低延迟音频引擎 (内置 Web Audio 原生合成振荡器)
│   ├── ClaudeDesktopHeader.tsx       # macOS 沉浸式标题栏组件
│   ├── ClaudeMotionPresets.ts        # 动效引擎与二阶阻尼谐振子数学求解
│   ├── CodeBlock.tsx                 # 代码块容器与 2.5s 复制衰减状态机
│   ├── ConfirmationDialog.tsx        # 模态确认对话框
│   ├── ContainerResponsiveBar.tsx    # 自适应容器查询响应栏
│   ├── CoworkAgentCanvas.tsx         # 多智能体协同看板与拓扑空间
│   ├── createClaudeMainWindow.ts     # Electron 宿主主窗口创建工厂
│   ├── DraggableSessionList.tsx      # 侧边栏会话拖放与固定物理
│   ├── EpitaxyIframeBridge.tsx       # Artifacts 预览沙箱桥接器
│   ├── LiveMicActivityBars.tsx       # 6 频段非线性麦克风波形柱
│   ├── McpToolDecisionCard.tsx       # MCP 交互式工具调用决策卡片
│   ├── MediaLightboxViewer.tsx       # 多模态媒体查看器与画廊跑道
│   ├── ModelSwitcherWithTokenGauge.tsx # 模型矩阵选择器与 Token 仪表盘
│   ├── ReasoningAmbientGlow.tsx      # 动态光效与推理氛围感组件
│   ├── RichComposerWithMentions.tsx  # CJK 守卫、/ 与 @ 双触发符输入终端
│   ├── ScrollFadeContainer.tsx       # 7 档非线性 Alpha 渐变遮罩
│   ├── SegmentedControl.tsx          # 999px 全圆角分段选择胶囊
│   ├── StatusIndicators.tsx          # 陶土呼吸灯、运行脉冲与骨架屏扫光
│   ├── StreamingDiffViewer.tsx       # 代码差异对比与流式高亮引擎
│   ├── tailwind.config.js            # Tailwind 配置工程扩展
│   ├── ThinkingAccordion.tsx         # 思考过程状态机折叠组件
│   ├── useClaudeRovingFocus.ts       # 全键盘无障碍焦点漫游 Hook
│   ├── useClaudeScrollPinning.ts     # 流式滚动视口图钉 Hook
│   ├── useClaudeSharedElementTransition.ts # View Transitions 共享元素变形 Hook
│   └── useRateLimitBackoff.ts        # 429/503 指数退避与熔断状态机 Hook
├── docs/
│   ├── Claude Design System (CDS).md # 七大篇章 / 31 小节深度技术指导手册
│   └── claude-components-storybook.html # 交互式可视化故事书 (双击即可离线体验)
├── src/
│   └── index.ts                      # 统一对外导出的 TypeScript 库入口
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🚀 快速上手 (Quick Start)

### 1. 引入样式表与 Tokens (纯 CSS 支持)

无论是否使用 React，均可直接引入 CDS 核心样式表与 183 个设计令牌：
```css
/* 引入全局主题变量、渐变消隐遮罩与核心关键帧 */
@import "open-claude-ui/css";
/* 或者通过 tokens 别名引入 */
@import "open-claude-ui/tokens";
```

若使用 Tailwind CSS，在 `tailwind.config.js` 中直接扩展主题：
```javascript
const cdsTheme = require("open-claude-ui/tailwind");

module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/open-claude-ui/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      ...cdsTheme.theme.extend
    }
  }
};
```

### 2. 使用核心组件

```tsx
import React, { useState } from 'react';
import { 
  ChatComposer, 
  CdsButton, 
  ModelSwitcherWithTokenGauge, 
  ScrollFadeContainer 
} from 'open-claude-ui';

export function App() {
  const [model, setModel] = useState<'sonnet-3.5' | 'haiku-3.5' | 'opus-3'>('sonnet-3.5');
  const [thinking, setThinking] = useState(true);

  return (
    <div className="flex h-screen w-full bg-[var(--cds-surface-1)]">
      <ScrollFadeContainer axis="vertical" fadeSize={32} className="flex-1 p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <ModelSwitcherWithTokenGauge
            currentModel={model}
            onModelChange={setModel}
            extendedThinking={thinking}
            onThinkingChange={setThinking}
            tokenBudget={{
              inputTokens: 12400,
              outputTokens: 3200,
              cacheReadTokens: 48000,
              cacheWriteTokens: 16000,
              maxContextWindow: 200000
            }}
          />
          <ChatComposer onSend={(text) => console.log('Send message:', text)} />
        </div>
      </ScrollFadeContainer>
    </div>
  );
}
```

---

## 🎨 视觉故事书预览 (Interactive Storybook)

无需启动繁重的本地服务器，只需双击打开自带的 HTML 文件即可体验全量高保真组件：
```bash
open docs/claude-components-storybook.html
```
故事书包含：
* 陶土色彩体系与暗黑模式即时切换
* 全量按钮尺寸与悬浮反馈
* 999px 全圆角滑动分段胶囊
* 二阶弹簧动效实时演示
* 附件磁贴与代码复制衰减状态机

---

## 🤖 AI Agent 协同与开发规范 (Agent Guidelines)

本项目针对现代 AI Coding Agents（如 Cursor, Windsurf, Claude Code, GitHub Copilot, Devin, Antigravity 等）深度适配了前端 UI 与动效开发指引规范：

* **全局 Agent 规范指南**：[`AGENTS.md`](AGENTS.md)（根目录自动生效，包含设计令牌、物理弹簧选型矩阵、单闭合边框原则、输入法防御守卫与质量门禁）。
* **Claude Code 专用指引**：[`CLAUDE.md`](CLAUDE.md)（针对 Anthropic 官方 CLI 工具链的指令与开发约束）。
* **IDE Agent 规则**：[`.cursorrules`](.cursorrules) 与 [`.github/copilot-instructions.md`](.github/copilot-instructions.md)。

> 💡 **给使用 AI 助手的开发者提示**：  
> 当你让 Cursor / Claude Code / Copilot 为你的产品实现前端页面或动效时，可直接向 Agent 提示：  
> *“请严格遵循本仓库中的 AGENTS.md 规范，使用 CDS 陶土设计令牌与 ClaudeMotionPresets 弹簧预设构建当前组件。”*

---

## 🙏 致谢与逆向支持 (Acknowledgements)

* 特别鸣谢开源逆向框架 **[REA (Reverse Engineer Anything)](https://github.com/morluto/rea)** 为本项目提供的 AST 解密、Electron 运行时分析与工程常数反编译工具链支持。
* 致敬 Anthropic 设计与前端团队打造的人文级交互系统与工程细节，启发了本开源复现研究。

---

## 📜 许可证 (License)

本项目基于 [MIT License](LICENSE) 开源发布。所有反编译研究成果与代码复现仅供学习、研究与工程交流使用。

---

## 📈 Star History

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=Caho1/open-claude-ui&type=Date)](https://star-history.com/#Caho1/open-claude-ui&Date)

</div>
