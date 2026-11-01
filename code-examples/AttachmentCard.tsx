/**
 * Claude Design System (CDS) - File Attachment Tile & Chip
 * 
 * 逆向溯源：依据 REA v6.5.0 对 Claude Desktop 生产环境 (shared-2-Cb74JByF.js / c6a992d55-sXiDGMFQ.css)
 * 提取的 data-cds="MessageAttachmentsFile" 与附件预览磁贴规范。
 * 
 * 核心规范：
 *   - 磁贴尺寸：严苛正方形 7.5rem (120px * scale ≈ 113px，size-[calc(7.5rem*scale)])
 *   - 面板圆角：自适应嵌套同心圆角 rounded-card (--radius-card)
 *   - 双层阴影：微近距漫射 shadow-field-drop
 *   - 文件名中间智能截断 (Mid-Truncation)：保留头部文件名与末尾扩展名，中间用省略号 (…) 折叠，避免长文件名丢失扩展名
 *   - 移除按钮：absolute -end-2 -top-2 size-5 rounded-full bg-surface-3 浮动药丸徽标
 *   - 类别大写徽章：提取扩展名大写 (如 TS, PY, PDF, CSV)
 */

import React from "react";

/**
 * 附件集合变更的 View Transition 包装 (REA v6.8.0 运行时实证 3.6556.2)。
 *
 * 官方在附件增删/重排时用 document.startViewTransition() 包裹 DOM 更新，
 * 配合 cds-theme.css 中的 view-transition-name/match-element 规则，
 * 使被增删的卡片产生共享元素动画。
 *
 * 用法：
 *   const updateAttachments = withAttachmentTransition(() => setFiles(next));
 *
 * 不支持 startViewTransition 的环境（旧浏览器）直接同步执行更新。
 */
export function withAttachmentTransition(update: () => void): void {
  if (typeof document !== "undefined" && typeof (document as any).startViewTransition === "function") {
    (document as any).startViewTransition(update);
  } else {
    update();
  }
}

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

/**
 * 智能双向中间截断算法：保留扩展名与前缀
 */
function truncateFileName(fileName: string, maxLen: number = 18): { head: string; ext: string } {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === 0) {
    if (fileName.length <= maxLen) return { head: fileName, ext: "" };
    return { head: fileName.slice(0, maxLen - 1) + "…", ext: "" };
  }
  const ext = fileName.slice(dotIndex);
  const stem = fileName.slice(0, dotIndex);
  if (fileName.length <= maxLen) return { head: stem, ext };

  const availableStemLen = Math.max(4, maxLen - ext.length - 1);
  return {
    head: stem.slice(0, availableStemLen) + "…",
    ext,
  };
}

export function AttachmentCard({
  id,
  name,
  size,
  type,
  category = "general",
  uploading = false,
  uploadProgress,
  onRemove,
  onClick,
  layout = "tile",
  className = "",
}: AttachmentCardProps) {
  // 提取扩展名大写作为官方标准徽标 (如 PDF, TS, PY)
  const inferredBadge = (type ?? name.split(".").pop() ?? "FILE").toUpperCase().slice(0, 4);

  const getCategoryConfig = () => {
    switch (category) {
      case "code":
        return { bg: "bg-clay/10", text: "text-clay" };
      case "pdf":
        return { bg: "bg-red-500/10", text: "text-red-500" };
      case "image":
        return { bg: "bg-emerald-500/10", text: "text-emerald-500" };
      case "text":
        return { bg: "bg-blue-500/10", text: "text-blue-500" };
      case "archive":
        return { bg: "bg-amber-500/10", text: "text-amber-500" };
      default:
        return { bg: "bg-neutral-200/50 dark:bg-neutral-800", text: "text-neutral-500" };
    }
  };

  const badgeStyle = getCategoryConfig();
  const truncated = truncateFileName(name, layout === "tile" ? 14 : 20);

  // 1. 紧凑行内胶囊模式 (用于输入框内部待发送列表)
  if (layout === "chip") {
    return (
      <div
        data-cds="MessageAttachmentsFile"
        data-layout="chip"
        onClick={onClick}
        className={`group/tile relative inline-flex items-center gap-2 px-2.5 py-1 rounded-[10px] bg-surface-2 border border-neutral-200/80 dark:border-neutral-700/80 shadow-field select-none transition-all ${
          uploading ? "animate-pulse opacity-75" : "hover:border-neutral-300 dark:hover:border-neutral-600"
        } ${className}`}
        style={{
          animation: "file-thumbnail-grow-in 250ms cubic-bezier(.165, .84, .44, 1)",
          ...(id != null ? { "--cds-attachment-vt-name": `attachment-${id}` } as React.CSSProperties : {}),
        }}
      >
        <span className={`px-1 py-0.5 rounded ${badgeStyle.bg} ${badgeStyle.text} font-mono text-[9px] font-bold shrink-0 tracking-wide`}>
          {inferredBadge}
        </span>
        <span className="text-xs font-normal text-primary flex items-center min-w-0">
          <span className="truncate max-w-[120px]">{truncated.head}</span>
          <span className="shrink-0">{truncated.ext}</span>
        </span>
        <span className="text-[10px] text-secondary font-mono tabular-nums">{size}</span>
        {onRemove && (
          <button
            type="button"
            data-cds-attachment-remove=""
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="text-neutral-400 hover:text-red-500 size-4 rounded-full flex items-center justify-center transition-colors ml-0.5 cursor-pointer"
            aria-label="Remove attachment"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  // 2. 经典正方形磁贴卡片模式 (size-[calc(7.5rem*scale)] 严格 120px 阶梯)
  return (
    <div
      data-cds="MessageAttachmentsFile"
      data-layout="tile"
      onClick={onClick}
      className={`group/tile relative isolate size-[calc(7.5rem*var(--cds-rem-scale,1))] shrink-0 rounded-card border border-neutral-200/90 dark:border-neutral-800 bg-surface-2 p-3 shadow-field flex flex-col justify-between select-none cursor-pointer transition-all duration-200 hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-xs outline-none focus-visible:shadow-focus ${
        uploading ? "opacity-85 pointer-events-none" : ""
      } ${className}`}
      style={{
        animation: "file-thumbnail-grow-in 250ms cubic-bezier(.165, .84, .44, 1)",
        ...(id != null ? { "--cds-attachment-vt-name": `attachment-${id}` } as React.CSSProperties : {}),
      }}
    >
      {/* 顶部徽标与文件类型 */}
      <div className="flex items-start justify-between w-full">
        <span className={`px-1.5 py-0.5 rounded ${badgeStyle.bg} ${badgeStyle.text} font-mono text-[10px] font-bold tracking-wider`}>
          {inferredBadge}
        </span>

        {/* 右上角浮动微圆形移除按钮 */}
        {onRemove && (
          <button
            type="button"
            data-cds-attachment-remove=""
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute -end-2 -top-2 z-10 inline-flex size-5 items-center justify-center rounded-full bg-surface-3 text-secondary shadow-card-ring hover:text-primary border border-neutral-200/60 dark:border-neutral-700/60 transition-transform active:scale-90 cursor-pointer"
            aria-label="Remove file"
          >
            <span className="text-xs leading-none">×</span>
          </button>
        )}
      </div>

      {/* 底部文件名与中间智能截断 */}
      <div className="space-y-0.5 min-w-0">
        <div className="text-footnote font-normal text-primary flex items-center min-w-0" title={name}>
          <span className="truncate">{truncated.head}</span>
          <span className="shrink-0">{truncated.ext}</span>
        </div>
        <p className="text-[10.5px] font-mono text-secondary tabular-nums">
          {uploading ? (uploadProgress !== undefined ? `${uploadProgress}%` : "Uploading...") : size}
        </p>
      </div>

      {/* 上传进度条底衬 */}
      {uploading && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-neutral-200 dark:bg-neutral-800 overflow-hidden rounded-b-[inherit]">
          <div
            className="h-full bg-clay transition-all duration-200"
            style={{ width: `${uploadProgress ?? 45}%` }}
          />
        </div>
      )}
    </div>
  );
}
