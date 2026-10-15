/**
 * Claude Design System (CDS) - Segmented Control & Pills
 * 
 * 核心规范：
 *   - 999px 极致胶囊圆角 (border-radius: 999px)
 *   - 2px 严格几何内边距 (padding: 2px)
 *   - 纯几何等分滑动指示器公式：
 *       left = calc(2px + activeIndex * (100% - 4px) / total)
 *       width = calc((100% - 4px) / total)
 *   - 容器查询防御：@container (max-width: 254px) 下未激活项隐藏文本只保留图标
 *   - 物理阻尼：120ms 瞬时咬合或 Framer Motion spring (stiffness: 500, damping: 35)
 */

import React, { useState } from "react";
import { motion } from "framer-motion";

export interface SegmentedTabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface SegmentedControlProps {
  tabs: (string | SegmentedTabItem)[];
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (value: string | number, index: number) => void;
  size?: "sm" | "md";
  className?: string;
  useFramerMotion?: boolean;
}

export function SegmentedControl({
  tabs,
  value,
  defaultValue,
  onChange,
  size = "md",
  className = "",
  useFramerMotion = true,
}: SegmentedControlProps) {
  const normalizedTabs: SegmentedTabItem[] = tabs.map((tab, idx) =>
    typeof tab === "string" ? { id: String(idx), label: tab } : tab
  );

  const [internalIndex, setInternalIndex] = useState(() => {
    if (defaultValue !== undefined) {
      const idx = normalizedTabs.findIndex((t) => t.id === defaultValue || t.label === defaultValue);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });

  const activeIndex =
    value !== undefined
      ? normalizedTabs.findIndex((t) => t.id === value || t.label === value)
      : internalIndex;

  const handleSelect = (idx: number) => {
    if (value === undefined) {
      setInternalIndex(idx);
    }
    const selectedTab = normalizedTabs[idx];
    onChange?.(selectedTab.id, idx);
  };

  const isSmall = size === "sm";

  return (
    <div
      className={`relative rounded-full select-none flex items-stretch p-[2px] transition-colors ${
        isSmall ? "h-7 text-xs" : "h-9 text-xs"
      } ${className}`}
      style={{
        backgroundColor: "var(--cds-segmented-track, rgba(0, 0, 0, 0.06))",
        containerType: "inline-size",
      }}
      role="tablist"
    >
      {/* 1. 滑动背景滑块 (两种实现：原生纯几何定位 或 Framer Motion layoutId) */}
      {!useFramerMotion ? (
        <div
          className="absolute top-[2px] bottom-[2px] rounded-full bg-white dark:bg-[#2c2c2a] pointer-events-none transition-all duration-150 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            left: `calc(2px + ${activeIndex} * (100% - 4px) / ${normalizedTabs.length})`,
            width: `calc((100% - 4px) / ${normalizedTabs.length})`,
            boxShadow:
              "inset 0 0 0 1px rgba(0,0,0,0.06), 0 1px 2px 0 rgba(0,0,0,0.08)",
          }}
        />
      ) : null}

      {/* 2. 标签项渲染 */}
      {normalizedTabs.map((tab, idx) => {
        const isActive = activeIndex === idx;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleSelect(idx)}
            className={`relative z-10 flex-1 h-full flex items-center justify-center gap-1.5 px-3 rounded-full transition-colors truncate font-[470] ${
              isActive
                ? "text-neutral-900 dark:text-white font-semibold"
                : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
            }`}
          >
            {/* Framer Motion 物理弹簧滑块 */}
            {useFramerMotion && isActive && (
              <motion.div
                layoutId="cds-segmented-active-thumb"
                className="absolute inset-0 rounded-full bg-white dark:bg-[#2c2c2a] -z-10"
                style={{
                  boxShadow:
                    "inset 0 0 0 1px rgba(0,0,0,0.06), 0 1px 3px 0 rgba(0,0,0,0.08)",
                }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 35,
                }}
              />
            )}

            {tab.icon && (
              <span className="shrink-0 flex items-center justify-center text-current">
                {tab.icon}
              </span>
            )}

            {/* 容器查询自适应文本：在宽度小于 254px 时自动收缩折叠 */}
            <span className="truncate @[max-width:254px]:hidden">
              {tab.label}
            </span>

            {tab.badge !== undefined && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-neutral-200/60 dark:bg-neutral-700 text-[10px] font-mono leading-tight">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
