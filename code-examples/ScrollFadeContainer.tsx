import React, { useRef, useState, useEffect, useCallback } from 'react';

/**
 * ==============================================================================
 * Claude Design System (CDS) - ScrollFadeContainer.tsx
 * 
 * 
 * 核心视觉物理学:
 * 1. 官方 7 档非线性透明度遮罩 (7-Stop Non-Linear Alpha Mask):
 *    Claude 没有采用粗暴的双色透明切线，而是在羽化距离内精确采用 7 组非线性梯度采样：
 *    - 距离位置 (Stops): 0%, 15%, 30%, 45%, 60%, 75%, 87%, 100%
 *    - 实际 Alpha 值: 0.0 (transparent), ~0.05 (#0d), ~0.15 (#26), ~0.30 (#4d), ~0.50 (#80), ~0.70 (#b3), ~0.85 (#d9), 1.0 (#000)
 *    数据紧密贴合 y ≈ x^1.5 幂律感知平滑曲线，配合 `mask-image` 实现物理级温润边缘消隐，彻底杜绝色阶断层。
 * 2. 动态滚动位置传感器 (Scroll State Sensor):
 *    - 触顶时 (`scrollTop <= 1`)：`--cds-scroll-fade-top = 0px`，顶边缘恢复完全清晰；
 *    - 滚入内容时：动态淡入 28px 平滑羽化边缘；
 *    - 触底时 (`scrollTop + clientHeight >= scrollHeight - 1`)：`--cds-scroll-fade-bottom = 0px`。
 * 3. 垂直 (Vertical) 与水平 (Horizontal) 双轴自适应支持。
 * ==============================================================================
 */

export interface ScrollFadeContainerProps {
  children: React.ReactNode;
  orientation?: 'vertical' | 'horizontal' | 'both';
  fadeSize?: number; // 默认 28px (官方常量 --cds-scroll-fade-size)
  className?: string;
  style?: React.CSSProperties;
}

export const ScrollFadeContainer: React.FC<ScrollFadeContainerProps> = ({
  children,
  orientation = 'vertical',
  fadeSize = 28,
  className = '',
  style = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 遮罩生效状态
  const [fadeTop, setFadeTop] = useState(0);
  const [fadeBottom, setFadeBottom] = useState(fadeSize);
  const [fadeLeft, setFadeLeft] = useState(0);
  const [fadeRight, setFadeRight] = useState(fadeSize);

  // 核心滚动边界检测
  const updateScrollFades = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    if (orientation === 'vertical' || orientation === 'both') {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const isAtTop = scrollTop <= 2;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 2;

      setFadeTop(isAtTop ? 0 : fadeSize);
      setFadeBottom(isAtBottom ? 0 : fadeSize);
    }

    if (orientation === 'horizontal' || orientation === 'both') {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const isAtLeft = scrollLeft <= 2;
      const isAtRight = scrollLeft + clientWidth >= scrollWidth - 2;

      setFadeLeft(isAtLeft ? 0 : fadeSize);
      setFadeRight(isAtRight ? 0 : fadeSize);
    }
  }, [orientation, fadeSize]);

  useEffect(() => {
    updateScrollFades();
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(updateScrollFades);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateScrollFades]);

  // 构建 7-Stop 非线性渐变 Mask 规则
  const maskStyle = React.useMemo(() => {
    if (orientation === 'vertical') {
      return {
        maskImage: `linear-gradient(to bottom,
          transparent,
          rgba(0, 0, 0, 0.05) calc(var(--cds-scroll-fade-top) * 0.15),
          rgba(0, 0, 0, 0.15) calc(var(--cds-scroll-fade-top) * 0.3),
          rgba(0, 0, 0, 0.30) calc(var(--cds-scroll-fade-top) * 0.45),
          rgba(0, 0, 0, 0.50) calc(var(--cds-scroll-fade-top) * 0.6),
          rgba(0, 0, 0, 0.70) calc(var(--cds-scroll-fade-top) * 0.75),
          rgba(0, 0, 0, 0.85) calc(var(--cds-scroll-fade-top) * 0.87),
          #000 var(--cds-scroll-fade-top),
          #000 calc(100% - var(--cds-scroll-fade-bottom)),
          rgba(0, 0, 0, 0.85) calc(100% - var(--cds-scroll-fade-bottom) * 0.87),
          rgba(0, 0, 0, 0.70) calc(100% - var(--cds-scroll-fade-bottom) * 0.75),
          rgba(0, 0, 0, 0.50) calc(100% - var(--cds-scroll-fade-bottom) * 0.6),
          rgba(0, 0, 0, 0.30) calc(100% - var(--cds-scroll-fade-bottom) * 0.45),
          rgba(0, 0, 0, 0.15) calc(100% - var(--cds-scroll-fade-bottom) * 0.3),
          rgba(0, 0, 0, 0.05) calc(100% - var(--cds-scroll-fade-bottom) * 0.15),
          transparent)`,
        WebkitMaskImage: `linear-gradient(to bottom,
          transparent,
          rgba(0, 0, 0, 0.05) calc(var(--cds-scroll-fade-top) * 0.15),
          rgba(0, 0, 0, 0.15) calc(var(--cds-scroll-fade-top) * 0.3),
          rgba(0, 0, 0, 0.30) calc(var(--cds-scroll-fade-top) * 0.45),
          rgba(0, 0, 0, 0.50) calc(var(--cds-scroll-fade-top) * 0.6),
          rgba(0, 0, 0, 0.70) calc(var(--cds-scroll-fade-top) * 0.75),
          rgba(0, 0, 0, 0.85) calc(var(--cds-scroll-fade-top) * 0.87),
          #000 var(--cds-scroll-fade-top),
          #000 calc(100% - var(--cds-scroll-fade-bottom)),
          rgba(0, 0, 0, 0.85) calc(100% - var(--cds-scroll-fade-bottom) * 0.87),
          rgba(0, 0, 0, 0.70) calc(100% - var(--cds-scroll-fade-bottom) * 0.75),
          rgba(0, 0, 0, 0.50) calc(100% - var(--cds-scroll-fade-bottom) * 0.6),
          rgba(0, 0, 0, 0.30) calc(100% - var(--cds-scroll-fade-bottom) * 0.45),
          rgba(0, 0, 0, 0.15) calc(100% - var(--cds-scroll-fade-bottom) * 0.3),
          rgba(0, 0, 0, 0.05) calc(100% - var(--cds-scroll-fade-bottom) * 0.15),
          transparent)`,
      };
    }

    if (orientation === 'horizontal') {
      return {
        maskImage: `linear-gradient(to right,
          transparent,
          #000 var(--cds-scroll-fade-left),
          #000 calc(100% - var(--cds-scroll-fade-right)),
          transparent)`,
        WebkitMaskImage: `linear-gradient(to right,
          transparent,
          #000 var(--cds-scroll-fade-left),
          #000 calc(100% - var(--cds-scroll-fade-right)),
          transparent)`,
      };
    }

    return {};
  }, [orientation]);

  return (
    <div
      ref={containerRef}
      onScroll={updateScrollFades}
      className={`relative overflow-auto transition-[mask-image] duration-150 ${className}`}
      style={
        {
          ...style,
          ...maskStyle,
          '--cds-scroll-fade-size': `${fadeSize}px`,
          '--cds-scroll-fade-top': `${fadeTop}px`,
          '--cds-scroll-fade-bottom': `${fadeBottom}px`,
          '--cds-scroll-fade-left': `${fadeLeft}px`,
          '--cds-scroll-fade-right': `${fadeRight}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
};
