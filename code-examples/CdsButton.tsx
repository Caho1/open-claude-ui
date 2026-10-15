/**
 * Claude Design System (CDS) - Button System
 * 
 * 核心准则：
 *   - 严格遵循“单闭合边框原则 (The 1-Border Rule)”：卡片内部的 Secondary 按钮严禁带边框，默认采用 Surface-2 浅底填充。
 *   - 尺寸阶梯：XS (24px, 6px圆角)、SM (28px, 8px圆角)、MD (32px, 8px圆角)、LG (40px, 12px圆角)。
 *   - 按压瞬时弹簧微缩放 (active:scale-[0.98])。
 */

import React, { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

export interface CdsButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  isLoading?: boolean;
}

const SIZE_STYLES: Record<ButtonSize, string> = {
  xs: "h-6 px-2 rounded-md text-[11.5px] gap-1",
  sm: "h-7 px-2.5 rounded-lg text-xs gap-1.5",
  md: "h-8 px-3.5 rounded-lg text-sm gap-1.5",
  lg: "h-10 px-5 rounded-xl text-[15px] gap-2 font-medium",
  icon: "size-8 rounded-lg p-0 flex items-center justify-center",
};

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  // 主操作：陶土色实色填充 + 微光投影
  primary:
    "bg-clay hover:bg-clay-hover text-white border-0 shadow-2xs font-medium active:scale-[0.98]",
  // 次级操作：严格无边框，采用 Surface-2 表面浅底填充，彻底杜绝与父容器发生套娃边框冲突
  secondary:
    "bg-[var(--cds-fill-secondary,rgba(0,0,0,0.06))] hover:bg-[var(--cds-fill-secondary-hover,rgba(0,0,0,0.1))] dark:bg-white/10 dark:hover:bg-white/15 text-neutral-800 dark:text-neutral-200 border-0 font-medium active:scale-[0.98]",
  // 幽灵操作：无背景无边框，悬停时浅灰微光
  ghost:
    "bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800/80 text-neutral-600 dark:text-neutral-300 border-0 active:scale-[0.98]",
  // 发丝细线：仅限空扁平画布展示，禁止放入已带外框的卡片中
  outline:
    "bg-transparent hover:bg-neutral-100/60 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 border border-neutral-200/90 dark:border-neutral-700/80 active:scale-[0.98]",
  // 警示破坏操作
  danger:
    "bg-red-600 hover:bg-red-700 text-white border-0 shadow-2xs font-medium active:scale-[0.98]",
};

export const CdsButton = forwardRef<HTMLButtonElement, CdsButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      icon,
      iconPosition = "left",
      isLoading = false,
      disabled = false,
      children,
      className = "",
      ...props
    },
    ref
  ) => {
    const isIconOnly = size === "icon" || (!children && !!icon);

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center font-sans transition-all duration-150 select-none outline-none focus-visible:ring-2 focus-visible:ring-clay/50 disabled:opacity-35 disabled:cursor-not-allowed disabled:pointer-events-none ${
          SIZE_STYLES[size]
        } ${VARIANT_STYLES[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
        ) : (
          icon && iconPosition === "left" && (
            <span className="shrink-0 flex items-center justify-center leading-none">
              {icon}
            </span>
          )
        )}

        {children && <span>{children}</span>}

        {!isLoading && icon && iconPosition === "right" && !isIconOnly && (
          <span className="shrink-0 flex items-center justify-center leading-none">
            {icon}
          </span>
        )}
      </button>
    );
  }
);

CdsButton.displayName = "CdsButton";
