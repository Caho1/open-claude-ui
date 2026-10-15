/**
 * Claude Design System (CDS) - File Attachment Tile & Chip
 * 
 * 核心规范：
 *   - 面板圆角：10px (--cds-panel-radius: 10px) 或 12px (rounded-xl)
 *   - 磁贴尺寸：磁贴模式 w-32 h-24 (128px × 96px) 或紧凑胶囊模式
 *   - 生长入场：file-thumbnail-grow-in (250ms cubic-bezier(.165, .84, .44, 1))
 *   - 上传呼吸脉冲：file-thumbnail-upload-pulse
 */

import React from "react";

export type FileCategory = "code" | "pdf" | "image" | "text" | "archive" | "general";

export interface AttachmentCardProps {
  id?: string | number;
  name: string;
  size: string;
  type?: string;
  category?: FileCategory;
  uploading?: boolean;
  uploadProgress?: number; // 0 - 100
  onRemove?: () => void;
  onClick?: () => void;
  layout?: "tile" | "chip"; // 磁贴模式 或 行内胶囊模式
  className?: string;
}

export function AttachmentCard({
  name,
  size,
  type = "FILE",
  category = "general",
  uploading = false,
  uploadProgress,
  onRemove,
  onClick,
  layout = "tile",
  className = "",
}: AttachmentCardProps) {
  // 根据扩展名或 category 推导色彩和图标简写
  const getCategoryConfig = () => {
    switch (category) {
      case "code":
        return { bg: "bg-clay/10", text: "text-clay", label: "</>" };
      case "pdf":
        return { bg: "bg-red-500/10", text: "text-red-500", label: "PDF" };
      case "image":
        return { bg: "bg-emerald-500/10", text: "text-emerald-500", label: "IMG" };
      case "text":
        return { bg: "bg-blue-500/10", text: "text-blue-500", label: "DOC" };
      case "archive":
        return { bg: "bg-amber-500/10", text: "text-amber-500", label: "ZIP" };
      default:
        return { bg: "bg-neutral-200/50 dark:bg-neutral-800", text: "text-neutral-500", label: type.slice(0, 3).toUpperCase() };
    }
  };

  const badge = getCategoryConfig();

  // 1. 紧凑胶囊模式 (用于输入框内部待发送列表)
  if (layout === "chip") {
    return (
      <div
        onClick={onClick}
        className={`group relative inline-flex items-center gap-2 px-2.5 py-1 rounded-[10px] bg-white dark:bg-neutral-800/90 border border-neutral-200/80 dark:border-neutral-700/80 shadow-2xs select-none transition-all ${
          uploading ? "animate-pulse opacity-75" : "hover:border-neutral-300 dark:hover:border-neutral-600"
        } ${className}`}
        style={{ animation: "file-thumbnail-grow-in 250ms cubic-bezier(.165, .84, .44, 1)" }}
      >
        <span className={`size-4 rounded ${badge.bg} ${badge.text} flex items-center justify-center font-mono text-[9px] font-bold shrink-0`}>
          {badge.label}
        </span>
        <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[120px]">
          {name}
        </span>
        <span className="text-[10px] text-neutral-400 font-mono tabular-nums">{size}</span>
        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="text-neutral-400 hover:text-red-500 size-4 rounded-full flex items-center justify-center transition-colors ml-0.5"
            aria-label="Remove attachment"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  // 2. 磁贴卡片模式 (128px × 96px 经典桌面端上传附件排版)
  return (
    <div
      onClick={onClick}
      className={`relative w-32 h-24 rounded-[10px] border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#20201e] p-2.5 shadow-2xs flex flex-col justify-between select-none group cursor-pointer transition-all duration-200 hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-xs ${
        uploading ? "animate-pulse" : ""
      } ${className}`}
      style={{ animation: "file-thumbnail-grow-in 250ms cubic-bezier(.165, .84, .44, 1)" }}
    >
      {/* 顶部：图标徽章与右上角移除按钮 */}
      <div className="flex items-start justify-between">
        <div className={`size-8 rounded-lg ${badge.bg} ${badge.text} flex items-center justify-center font-mono text-xs font-bold shadow-2xs`}>
          {badge.label}
        </div>

        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="size-5 rounded-md text-neutral-400 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Remove attachment"
          >
            ×
          </button>
        )}
      </div>

      {/* 底部：文件名与文件大小 */}
      <div className="min-w-0">
        <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">
          {name}
        </div>
        <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono mt-0.5">
          <span className="tabular-nums">{size}</span>
          <span className="uppercase">{type}</span>
        </div>
      </div>

      {/* 上传进度条 */}
      {uploading && uploadProgress !== undefined && (
        <div className="absolute inset-x-2 bottom-1 h-1 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
          <div
            className="h-full bg-clay transition-all duration-200"
            style={{ width: `${Math.min(100, Math.max(0, uploadProgress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
