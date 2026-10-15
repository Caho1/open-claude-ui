/**
 * Claude Design System (CDS) - Status Indicators & Shimmer
 * 
 * 核心动效：
 *   - 陶土明度呼吸指示灯 (dframe-clay-breathe, 2.4s 循环)
 *   - 运行中绿色脉冲扩散 (dframe-dot-pulse, 1.2s 循环)
 *   - 思考中三点波浪跳跃 (timeline-quiet-dot, 1.9s 阶梯延迟 0s, 0.15s, 0.3s)
 *   - 骨架屏高级倾斜扫光 (cds-skeleton-sweep, 1.8s cubic-bezier(0.4, 0, 0.2, 1))
 */

import React from "react";

// ============================================================================
// 1. 陶土呼吸指示灯 (ClayBreatheDot)
// ============================================================================

export function ClayBreatheDot({
  label,
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      <span
        className="size-3 rounded-full bg-clay shadow-2xs shrink-0"
        style={{
          animation: "dframe-clay-breathe 2.4s infinite ease-in-out",
        }}
        aria-hidden="true"
      />
      {label && (
        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
          {label}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// 2. 实时活动脉冲灯 (PulseRunningDot)
// ============================================================================

export function PulseRunningDot({
  label,
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      <span className="relative flex size-2.5 shrink-0">
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
          style={{ animationDuration: "1.2s" }}
        />
        <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500" />
      </span>
      {label && (
        <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">
          {label}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// 3. 思考波浪三点跳跃 (QuietDotsWave)
// ============================================================================

export function QuietDotsWave({
  label = "Thinking...",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      <div className="inline-flex items-center gap-[4px]">
        <span
          className="size-1.5 rounded-full bg-clay"
          style={{
            animation: "timeline-quiet-dot 1.9s infinite cubic-bezier(0.4, 0, 0.2, 1)",
            animationDelay: "0s",
          }}
        />
        <span
          className="size-1.5 rounded-full bg-clay"
          style={{
            animation: "timeline-quiet-dot 1.9s infinite cubic-bezier(0.4, 0, 0.2, 1)",
            animationDelay: "0.15s",
          }}
        />
        <span
          className="size-1.5 rounded-full bg-clay"
          style={{
            animation: "timeline-quiet-dot 1.9s infinite cubic-bezier(0.4, 0, 0.2, 1)",
            animationDelay: "0.3s",
          }}
        />
      </div>
      {label && (
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {label}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// 4. 骨架屏倾斜扫光条 (SkeletonShimmer)
// ============================================================================

export function SkeletonShimmer({
  width = "100%",
  height = "1rem",
  rounded = "rounded-lg",
  className = "",
}: {
  width?: string | number;
  height?: string | number;
  rounded?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-neutral-200/60 dark:bg-neutral-800 ${rounded} ${className}`}
      style={{
        width,
        height,
      }}
    >
      <div
        className="absolute inset-0 -translate-x-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.45) 50%, transparent 100%)",
          animation: "cds-skeleton-sweep 1.8s infinite cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </div>
  );
}

// ============================================================================
// 5. 流式文本光标 (StreamingCursor)
// ============================================================================

export function StreamingCursor({
  color = "bg-clay",
  className = "",
}: {
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block w-[3px] h-[1.15em] ${color} align-middle ml-0.5 rounded-[1px] animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}
