/**
 * 维度六：思考过程折叠互斥锁与状态交接
 * 
 * 核心特性：
 * 1. 生成中 (isThinkingLive = true) 强制锁定展开 (open: true)
 * 2. 生成中剥夺折叠权限 (onOpenChange: undefined)，防止视口剧烈抖动
 * 3. 思考完成后交还折叠控制权
 * 4. 陶土色呼吸跳动点与毫秒耗时统计
 * 5. 一键引用复制 (Copy as quote)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ThinkingAccordionProps {
  thoughtText: string;
  isThinkingLive: boolean; // 模型是否正在流式输出思考
  elapsedMs?: number;
  onCopyQuote?: (text: string) => void;
}

export const ThinkingAccordion: React.FC<ThinkingAccordionProps> = ({
  thoughtText,
  isThinkingLive,
  elapsedMs = 0,
  onCopyQuote
}) => {
  const [userExpanded, setUserExpanded] = useState(true);
  const [didCopy, setDidCopy] = useState(false);

  // 核心互斥物理：生成中必定展开，不受用户历史偏好影响
  const isOpen = isThinkingLive || userExpanded;

  // 思考中剥夺折叠权限，完成后交还用户
  const handleToggle = () => {
    if (isThinkingLive) return;
    setUserExpanded((prev) => !prev);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`> ${thoughtText.split('\n').join('\n> ')}`);
    setDidCopy(true);
    onCopyQuote?.(thoughtText);
    setTimeout(() => setDidCopy(false), 2000);
  };

  if (!thoughtText.trim() && !isThinkingLive) return null;

  return (
    <div className="group/thinking my-2 rounded-xl border border-[var(--cds-border)] bg-[var(--cds-surface-1)] transition-colors hover:border-[var(--cds-border-strong)]">
      {/* 头部标题与操作区 */}
      <div
        onClick={handleToggle}
        className={`flex items-center justify-between px-3.5 py-2.5 select-none ${
          isThinkingLive ? 'cursor-default' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2">
          {/* 状态指示灯：思考中为陶土色呼吸脉冲点，完成后为柔和静态灰点 */}
          {isThinkingLive ? (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--cds-clay)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--cds-clay)]" />
            </span>
          ) : (
            <span className="h-2 w-2 rounded-full bg-[var(--cds-text-secondary)] opacity-50" />
          )}

          <span className="text-xs font-semibold text-[var(--cds-text-primary)]">
            {isThinkingLive ? 'Thinking…' : 'Thought process'}
          </span>

          {elapsedMs > 0 && (
            <span className="text-[11px] font-mono text-[var(--cds-text-secondary)] opacity-75">
              ({(elapsedMs / 1000).toFixed(1)}s)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 复制为引用按钮 */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-medium text-[var(--cds-text-secondary)] hover:bg-[var(--cds-surface-2)] hover:text-[var(--cds-text-primary)] transition-colors"
          >
            {didCopy ? (
              <span className="text-emerald-500">✓ Copied</span>
            ) : (
              <span>Copy as quote</span>
            )}
          </button>

          {/* 折叠箭头指示器 */}
          {!isThinkingLive && (
            <motion.svg
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="h-3.5 w-3.5 text-[var(--cds-text-secondary)]"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M4 6l4 4 4-4H4z" />
            </motion.svg>
          )}
        </div>
      </div>

      {/* 思考正文折叠区域 */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-[var(--cds-border)]"
          >
            <div className="p-3.5 text-xs leading-relaxed text-[var(--cds-text-secondary)] font-mono whitespace-pre-wrap break-words italic">
              {thoughtText}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
