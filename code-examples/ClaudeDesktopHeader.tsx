/**
 * 维度四：macOS 桌面深度融合与 Web 自适应顶栏
 * 
 * 核心特性：
 * 1. 74px 红绿灯物理避让占位槽 (ew = 74)
 * 2. 逆缩放补偿宽度 Math.round(74 / Math.min(zoomFactor, 1))
 * 3. macOS 全屏感知与动态 safe-area 回缩
 * 4. 45px 全局独立拖拽带与 .draggable-none 交互隔离
 */

import React, { useEffect, useState } from 'react';

interface ClaudeDesktopHeaderProps {
  title?: string;
  children?: React.ReactNode;
}

export const ClaudeDesktopHeader: React.FC<ClaudeDesktopHeaderProps> = ({
  title,
  children
}) => {
  const [isMac, setIsMac] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomFactor, setZoomFactor] = useState(1);

  useEffect(() => {
    const isDarwin = navigator.userAgent.includes('Mac');
    setIsMac(isDarwin);

    // 监听 Electron 宿主暴露的窗口状态
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      electronAPI.getFullscreen?.().then(setIsFullscreen);
      const unsubFs = electronAPI.onFullscreenChanged?.(setIsFullscreen);
      const unsubZoom = electronAPI.onZoomFactorChanged?.(setZoomFactor);
      return () => {
        unsubFs?.();
        unsubZoom?.();
      };
    }
  }, []);

  const needsTrafficLight = isMac && !isFullscreen;
  // 74px 逆缩放补偿算法
  const trafficLightSpacerWidth = needsTrafficLight
    ? Math.round(74 / Math.min(zoomFactor, 1))
    : 0;

  return (
    <>
      {/* 1. 全局绝对定位拖拽带（仅响应窗口拖动，对所有鼠标交互穿透） */}
      <div
        aria-hidden="true"
        data-cds-window-drag-strip=""
        className="fixed inset-x-0 top-0 z-40 pointer-events-none"
        style={{
          height: needsTrafficLight ? '45px' : '0px',
          WebkitAppRegion: 'drag' as any
        }}
      />

      {/* 2. 顶栏容器 */}
      <header
        className="relative z-30 flex h-[45px] w-full items-center border-b border-[var(--cds-border)] bg-[var(--cds-surface-1)] px-4 transition-[padding] duration-150 select-none"
        style={{
          WebkitAppRegion: 'drag' as any
        }}
      >
        {/* 红绿灯规避占位槽 */}
        {trafficLightSpacerWidth > 0 && (
          <div
            aria-hidden="true"
            className="shrink-0 transition-[width] duration-150"
            style={{ width: `${trafficLightSpacerWidth}px` }}
          />
        )}

        {/* 标题显示区（带拖拽属性） */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {title && (
            <span className="truncate text-caption font-medium text-[var(--cds-text-secondary)]">
              {title}
            </span>
          )}
        </div>

        {/* 交互控件区：必须严格包裹 draggable-none，防御误触拖动 */}
        <div
          className="draggable-none flex shrink-0 items-center gap-2"
          style={{ WebkitAppRegion: 'no-drag' as any }}
        >
          {children}
        </div>
      </header>
    </>
  );
};
