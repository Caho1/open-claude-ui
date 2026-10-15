/**
 * Claude Design System (CDS) - Confirmation Modal Dialog
 * 
 * 核心规范：
 *   - 弹窗外壳：严格 16px 圆角 (rounded-2xl)
 *   - 投影：真实双环 Popover 弥散投影 (--cds-shadow-popover)
 *   - 背景遮罩：高斯模糊微调 (backdrop-blur-xs bg-black/40)
 *   - 交互反馈：支持 Escape 快捷退出与点击遮罩关闭
 */

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { motionModalDialog } from "./ClaudeMotionPresets";

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  icon?: React.ReactNode;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  icon,
}: ConfirmationDialogProps) {
  // 监听 Escape 快捷键退出
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const isDanger = variant === "danger";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 高斯模糊与半透明遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
          />

          {/* 模态卡片实体：16px 圆角与双环弥散投影 */}
          <motion.div
            variants={motionModalDialog}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-[#1a1a19] p-5 border border-neutral-200/80 dark:border-neutral-800 z-10 space-y-4"
            style={{
              boxShadow:
                "var(--cds-shadow-popover, 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08), inset 0 0 0 1px rgba(0, 0, 0, 0.08))",
            }}
            role="dialog"
            aria-modal="true"
          >
            {/* 头部标题与警示图标 */}
            <div className="flex items-start gap-3.5">
              <div
                className={`size-10 rounded-full flex items-center justify-center shrink-0 ${
                  isDanger
                    ? "bg-red-500/10 text-red-600 dark:bg-red-950/50 dark:text-red-400"
                    : "bg-clay/10 text-clay"
                }`}
              >
                {icon ? (
                  icon
                ) : isDanger ? (
                  <span className="text-base font-bold">!</span>
                ) : (
                  <span className="text-base">✦</span>
                )}
              </div>
              <div className="space-y-1 min-w-0">
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {title}
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {description}
                </p>
              </div>
            </div>

            {/* 底部按钮栏：单边框原则，Cancel 为 Ghost 悬停，Confirm 为主色 */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-3.5 rounded-lg text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors border-0"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`h-8 px-4 rounded-lg text-xs font-medium text-white shadow-2xs active:scale-[0.98] transition-all border-0 ${
                  isDanger
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-clay hover:bg-clay-hover"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
