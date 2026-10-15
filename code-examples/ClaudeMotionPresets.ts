/**
 * Claude Design System (CDS) - Motion Engine & Physics Presets
 * 
 * 遵循二阶阻尼谐振子物理公式：
 *   m * x'' + c * x' + k * (x - x_target) = 0
 *   阻尼比 ζ = c / (2 * sqrt(m * k))
 */

import { type Transition, type Variants } from "framer-motion";

// ============================================================================
// 1. 经典二阶阻尼谐振子数学求解器 (Damped Harmonic Oscillator)
// ============================================================================

export interface SpringParameters {
  stiffness: number; // k: 弹性刚度 (N/m)
  damping: number;   // c: 阻尼系数 (N·s/m)
  mass: number;      // m: 物体质量 (kg)
}

/**
 * 计算给定时间 t 下的归一化位移 (0 -> 1)
 */
export function calcDampedHarmonicOscillator(
  k: number,
  c: number,
  m: number,
  t: number
): number {
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(m * k));

  if (zeta < 1) {
    // 欠阻尼状态 (Underdamped, 存在微冲超调振荡)
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return (
      1 -
      Math.exp(-zeta * w0 * t) *
        (Math.cos(wd * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t))
    );
  } else if (Math.abs(zeta - 1) < 1e-4) {
    // 临界阻尼 (Critically damped, 最快无振荡收敛)
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  } else {
    // 过阻尼状态 (Overdamped, 无超调平滑慢收敛)
    const s1 = -w0 * (zeta - Math.sqrt(zeta * zeta - 1));
    const s2 = -w0 * (zeta + Math.sqrt(zeta * zeta - 1));
    return 1 - (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s2 - s1);
  }
}

// ============================================================================
// 2. 生产级 Framer Motion 物理预设矩阵 (Spring Presets)
// ============================================================================

/**
 * 预设 1: 按钮点击、开关切换、图标按压 (Button & Small Controls)
 * 特征：高频微弹，利落归位无粘滞。超调量 +8.8% (ζ = 0.612)，0.22s 极速收敛。
 */
export const SPRING_BOUNCY: Transition = {
  type: "spring",
  stiffness: 600,
  damping: 30,
  mass: 1.0,
};

/**
 * 预设 2: 气泡上浮、卡片展开、浮层 Popover 唤起 (Card / Popover Reveal)
 * 特征：沉稳顺滑，微冲后平稳着陆。超调量 +1.8%，0.35s 收敛。
 */
export const SPRING_SNAPPY: Transition = {
  type: "spring",
  stiffness: 320,
  damping: 28,
  mass: 1.0,
};

/**
 * 预设 3: 点赞动画、复制成功勾选、新消息微提示 (Bouncy Light Feedback)
 * 特征：两周期明显跳跃感，激发积极情绪反馈。超调量 +19.4%，0.58s 收敛。
 */
export const SPRING_GENTLE: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 18,
  mass: 1.0,
};

/**
 * 预设 4: 抽屉与侧边栏手势吸附、面板分割拖拽 (High Damping Panel Drag)
 * 特征：绝对零过冲 (过阻尼 ζ = 3.65)，松手瞬间如磁吸般强力咬合。
 */
export const SPRING_HEAVY_SNAP: Transition = {
  type: "spring",
  stiffness: 1200,
  damping: 80,
  mass: 0.1,
};

// ============================================================================
// 3. 原生 CSS 贝塞尔缓动曲线常量 (CSS Easing Constants)
// ============================================================================

export const CDS_EASING = {
  /** 消息气泡与药丸胶囊微弹入场 */
  OVERSHOOT: "cubic-bezier(0.34, 1.3, 0.64, 1)",
  /** 阴影、焦点微光、高斯模糊渐变 */
  EASE_OUT_EXPO: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** 抽屉面板滑入标准减速 */
  DECEL: "cubic-bezier(0.165, 0.84, 0.44, 1)",
  /** 瞬时按压缩放 */
  SHARP_PRESS: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;

// ============================================================================
// 4. 标准 Framer Motion 动画变体 (Reusable Motion Variants)
// ============================================================================

/** 消息上浮进入变体 */
export const motionMessageFadeUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: SPRING_SNAPPY,
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.18, ease: "easeIn" },
  },
};

/** 用户提问气泡弹出变体 */
export const motionUserBubbleEnter: Variants = {
  initial: { opacity: 0, scale: 0.94, y: 8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 450,
      damping: 24,
    },
  },
};

/** 弹出菜单 / Popover 浮层 */
export const motionPopover: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 4 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: SPRING_SNAPPY,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 2,
    transition: { duration: 0.12, ease: "easeOut" },
  },
};

/** 模态对话框居中缩放进入 */
export const motionModalDialog: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 10 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 32,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 6,
    transition: { duration: 0.15, ease: "easeInOut" },
  },
};

/** 字符模糊消解流式动画 (Grapheme Blur Reveal) */
export const motionGraphemeReveal: Variants = {
  initial: { opacity: 0, filter: "blur(6px)" },
  animate: {
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 0.35, ease: "easeOut" },
  },
};
