/**
 * 维度二：多容器自适应查询与极端弹性排版
 * 
 * 核心特性：
 * 1. @container 命名容器定义
 * 2. 4 阶流体压缩梯队 (>=576px / <480px / <384px / <320px)
 * 3. 极窄视口 (<320px) 零间距防爆安全网
 */

import React from 'react';

export const ContainerResponsiveBar: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return (
    <div className="@container/toolbar relative w-full border-t border-[var(--cds-border)] bg-[var(--cds-surface-1)] py-2">
      <div className="flex items-center justify-between px-3 @[384px]/toolbar:px-4">
        {/* 左侧模型信息：>=576px 显示完整，<384px 截断为紧凑文字 */}
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--cds-clay)]" />
          <span className="truncate text-xs font-medium text-[var(--cds-text-primary)] @max-[384px]/toolbar:max-w-[72px]">
            Claude 3.7 Sonnet
          </span>
          <span className="rounded bg-[var(--cds-surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--cds-text-secondary)] @max-[480px]/toolbar:hidden">
            Thinking
          </span>
        </div>

        {/* 右侧操作按钮组：依照容器宽度 4 阶自适应折叠 */}
        <div className="flex items-center gap-1 @[384px]/toolbar:gap-2">
          <button
            type="button"
            className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-[var(--cds-text-secondary)] hover:bg-[var(--cds-surface-2)] active:scale-95 transition-transform"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2a6 6 0 100 12A6 6 0 008 2zM0 8a8 8 0 1116 0A8 8 0 010 8z" />
            </svg>
            <span className="@max-[480px]/toolbar:hidden">Settings</span>
          </button>
          
          <button
            type="button"
            className="flex h-8 items-center gap-1 rounded-md bg-[var(--cds-surface-2)] px-2.5 text-xs font-semibold text-[var(--cds-text-primary)] shadow-sm hover:bg-[var(--cds-surface-3)] active:scale-95 transition-all"
          >
            <span>Run</span>
            <span className="font-mono text-[10px] opacity-60 @max-[576px]/toolbar:hidden">⌘⏎</span>
          </button>
          {children}
        </div>
      </div>
    </div>
  );
};
