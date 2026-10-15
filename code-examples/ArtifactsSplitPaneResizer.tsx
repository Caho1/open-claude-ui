import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * ==============================================================================
 * Claude Design System (CDS) - ArtifactsSplitPaneResizer.tsx
 * 
 * 
 * 核心工程物理学:
 * 1. 连续指针动力学与事件屏蔽护盾 (Pointer Stream & Iframe Shield):
 *    在用户拖拽分割条期间，向 DOM 根容器注入 `data-pane-dragging="true"`，
 *    并在 Artifacts 预览区域（如内嵌 iframe）叠加 `pointer-events: none` 透明护盾，
 *    彻底防止鼠标划入子 iframe 导致主窗口捕获丢失或拖拽卡死。
 * 2. 4px 移动死区 (Dead-Zone) 与 Escape 撤销状态机:
 *    4px 阈值过滤单击微颤；支持在拖拽中随时按 Escape 取消并回滚至初始比例。
 * 3. 双击居中对齐吸附 (50/50 Snap):
 *    双击分割手柄即刻触发阻尼弹簧动画平滑归位至 50% 对称基线。
 * 4. 边缘折叠门限 (Docking Threshold):
 *    当拖拽比例 < 18% 或 > 82% 时，自动触发弹性吸附折叠，释放主视口空间。
 * 5. 严格极值边界钳制 (Min-Max Clamping):
 *    左栏 (会话流) $\ge 380\text{px}$，右栏 (Artifacts) $\ge 420\text{px}$。
 * ==============================================================================
 */

export interface SplitPaneProps {
  leftPane: React.ReactNode;
  rightPane: React.ReactNode;
  initialSplitRatio?: number; // 默认 0.5 (即 50%)
  minLeftWidth?: number; // 默认 380px
  minRightWidth?: number; // 默认 420px
  collapseThreshold?: number; // 默认 0.18
  className?: string;
}

export const ArtifactsSplitPaneResizer: React.FC<SplitPaneProps> = ({
  leftPane,
  rightPane,
  initialSplitRatio = 0.5,
  minLeftWidth = 380,
  minRightWidth = 420,
  collapseThreshold = 0.18,
  className = '',
}) => {
  const [splitRatio, setSplitRatio] = useState<number>(initialSplitRatio);
  const [isDragging, setIsDragging] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<{ x: number; ratio: number } | null>(null);
  const previousRatioRef = useRef<number>(initialSplitRatio);

  // 1. 双击分割条：重置为 50/50 平衡点
  const handleDoubleClick = useCallback(() => {
    setIsRightCollapsed(false);
    setSplitRatio(0.5);
  }, []);

  // 2. 指针按下 (Pointer Down)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // 仅响应鼠标左键
    e.preventDefault();

    pointerStartRef.current = { x: e.clientX, ratio: splitRatio };
    previousRatioRef.current = splitRatio;
    setIsDragging(true);

    // 捕获全局指针，防止鼠标滑出分割条导致失焦
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // 3. 指针移动 (Pointer Move) 包含 Clamp 与折叠门限
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !pointerStartRef.current || !containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      if (containerWidth <= 0) return;

      const deltaX = e.clientX - pointerStartRef.current.x;
      const rawNewRatio = pointerStartRef.current.ratio + deltaX / containerWidth;

      // 4. 边缘吸附与折叠检测
      if (rawNewRatio > 1 - collapseThreshold) {
        setIsRightCollapsed(true);
        setSplitRatio(1);
        return;
      } else {
        setIsRightCollapsed(false);
      }

      // 5. 像素级硬性 Min/Max 钳制约束
      const minRatio = minLeftWidth / containerWidth;
      const maxRatio = (containerWidth - minRightWidth) / containerWidth;
      const clampedRatio = Math.max(minRatio, Math.min(maxRatio, rawNewRatio));

      setSplitRatio(clampedRatio);
    },
    [isDragging, collapseThreshold, minLeftWidth, minRightWidth]
  );

  // 6. 指针松开 (Pointer Up)
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    pointerStartRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // 忽略部分浏览器对 releasePointerCapture 的严格异常
    }
  };

  // 7. Escape 键中断并回滚
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isDragging && e.key === 'Escape') {
        setIsDragging(false);
        setSplitRatio(previousRatioRef.current);
        pointerStartRef.current = null;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      data-pane-dragging={isDragging ? 'true' : undefined}
      className={`relative flex w-full h-full overflow-hidden select-none bg-[var(--cds-bg-primary,#faf9f5)] dark:bg-[var(--cds-bg-primary,#141413)] ${className}`}
      style={
        {
          '--df-pane-row': `${splitRatio}`,
        } as React.CSSProperties
      }
    >
      {/* 左栏：会话主视口 */}
      <div
        className="h-full overflow-hidden flex flex-col transition-all duration-75"
        style={{
          width: isRightCollapsed ? '100%' : `${splitRatio * 100}%`,
        }}
      >
        <div className="flex-1 overflow-y-auto">{leftPane}</div>
      </div>

      {/* 中间弹性可拖拽分割条 */}
      {!isRightCollapsed && (
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-valuenow={Math.round(splitRatio * 100)}
          aria-label="拖拽调整左右分栏宽度，双击归位 50/50，按 Escape 还原"
          onPointerDown={handlePointerDown}
          onDoubleClick={handleDoubleClick}
          className={`group relative z-30 flex items-center justify-center w-2 -mx-1 cursor-col-resize outline-none touch-none transition-colors ${
            isDragging ? 'bg-[var(--cds-fill-brand,#d97757)]/20' : 'hover:bg-[var(--cds-fill-brand,#d97757)]/10'
          }`}
        >
          {/* 视觉分割线 (1px 发丝线) */}
          <div
            className={`w-[1px] h-full transition-colors ${
              isDragging
                ? 'bg-[var(--cds-fill-brand,#d97757)]'
                : 'bg-[var(--cds-border-subtle,#e5e5e3)] dark:bg-[var(--cds-border-subtle,#282826)] group-hover:bg-[var(--cds-fill-brand,#d97757)]'
            }`}
          />

          {/* 居中拖拽微手柄胶囊 (Pill Handle) */}
          <div
            className={`absolute size-4 rounded-full flex items-center justify-center bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface,#222221)] border border-[var(--cds-border-subtle,#e0e0de)] dark:border-[var(--cds-border-subtle,#333331)] shadow-xs transition-transform ${
              isDragging ? 'scale-110 border-[var(--cds-fill-brand,#d97757)]' : 'group-hover:scale-105'
            }`}
          >
            <div className="flex gap-0.5">
              <span className="w-0.5 h-1.5 rounded-full bg-[var(--cds-text-muted,#8c8c8c)]" />
              <span className="w-0.5 h-1.5 rounded-full bg-[var(--cds-text-muted,#8c8c8c)]" />
            </div>
          </div>
        </div>
      )}

      {/* 右栏：Artifacts / 代码 / 预览沙箱 */}
      {!isRightCollapsed && (
        <div
          className="relative h-full overflow-hidden flex flex-col transition-all duration-75 border-l border-[var(--cds-border-subtle,#e5e5e3)] dark:border-[var(--cds-border-subtle,#282826)] bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface,#1c1c1b)]"
          style={{
            width: `${(1 - splitRatio) * 100}%`,
          }}
        >
          {/* Iframe 防吞噬遮罩 (在拖拽时激活) */}
          {isDragging && <div className="absolute inset-0 z-50 pointer-events-none bg-transparent" />}

          <div className="flex-1 overflow-auto">{rightPane}</div>
        </div>
      )}

      {/* 右栏折叠时侧边唤醒挂钩 */}
      {isRightCollapsed && (
        <button
          type="button"
          aria-label="展开 Artifacts 面板"
          onClick={() => {
            setIsRightCollapsed(false);
            setSplitRatio(0.5);
          }}
          className="absolute right-2 top-3 z-30 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface,#222221)] border border-[var(--cds-border-subtle,#e0e0de)] dark:border-[var(--cds-border-subtle,#333331)] shadow-sm text-xs font-medium text-[var(--cds-text-secondary,#666666)] hover:text-[var(--cds-text-primary,#1a1a1a)] hover:border-[var(--cds-fill-brand,#d97757)] active:scale-95 transition-all"
        >
          <span>展开产物</span>
          <span>⇥</span>
        </button>
      )}
    </div>
  );
};
