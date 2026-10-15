/**
 * Claude Design System (CDS) - Multimodal Media Lightbox & Pan/Zoom Gallery
 * 
 * 
 * 核心规范与数学物理模型：
 *   1. 仿射平移缩放 (Affine Pan/Zoom)：
 *      - 缩放方程：c = targetScale / currentScale
 *      - 锚点偏移：newTx = clamp(pointerX - (pointerX - idealTx) * c, maxTx)
 *      - 滚轮灵敏度：Math.exp(-deltaY * 0.01) 指数平滑缩放
 *      - 手势死区过滤：Math.hypot(dx, dy) < 4px 杜绝微抖
 *   2. 共享元素变形 (Shared Element Transition)：
 *      - 基于 document.startViewTransition("chat-image-preview")
 *      - 动态计算源缩略图圆角 (--vt-image-preview-source-radius) 与目标圆角
 *      - object-fit: contain 精确内切计算 (--vt-image-preview-source-inset)
 *   3. 75vw 画廊跑道 (Gallery Runway)：
 *      - 滑动方程：translateX(calc(12.5vw - ${index * 75}vw - ${index * 32}px))
 *      - 激活项 100% 不透明度，相邻项 40% (悬停 70%)
 *      - 预加载窗口：Math.abs(index - currentIndex) <= 2
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";

// ============================================================================
// 1. 类型定义 (Types)
// ============================================================================

export interface MediaItem {
  id: string | number;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  kind?: "image" | "video";
  loading?: boolean;
  originEl?: HTMLElement | null;
}

export interface TransformState {
  scale: number;
  tx: number;
  ty: number;
  idealTx: number;
  idealTy: number;
  maxTx: number;
  maxTy: number;
}

export interface MediaLightboxViewerProps {
  items: MediaItem[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  backdrop?: "blur" | "dim";
  renderHeader?: (item: MediaItem, index: number) => React.ReactNode;
  renderAttribution?: (item: MediaItem, index: number) => React.ReactNode;
  className?: string;
}

// ============================================================================
// 2. 交互数学模型常量 (Interaction Constants)
// ============================================================================

const MIN_MAX_SCALE = 2.0;       // ae: 最小最大放大倍数
const DRAG_DEADZONE = 4.0;        // oe: 指针拖拽死区阈值 (px)
const WHEEL_SENSITIVITY = 0.01;   // se: 滚轮缩放指数因子
const SNAP_MIN_SCALE = 1.05;      // v: 缩放吸附下限
const DEFAULT_JUMP_SCALE = 1.25;  // ce: 单次跳变放大系数
const DAMPING_RATIO = 0.7;        // y: 阻尼回弹系数

const INITIAL_TRANSFORM: TransformState = {
  scale: 1,
  tx: 0,
  ty: 0,
  idealTx: 0,
  idealTy: 0,
  maxTx: 0,
  maxTy: 0,
};

// ============================================================================
// 3. 核心数学函数 (Mathematical Primitives)
// ============================================================================

/** 数值截断 Clamping */
function clamp(val: number, max: number): number {
  return Math.min(max, Math.max(-max, val));
}

/** 计算可用视口溢出量 */
function calcOverflow(size: number, viewportSize: number): number {
  const effectiveSize = Math.min(size, viewportSize * DAMPING_RATIO);
  return Math.max(0, (size + viewportSize) / 2 - effectiveSize);
}

/** 动态计算允许平移的最大边界 maxTx / maxTy */
function calcMaxTranslate(fitSize: number, viewportSize: number, scale: number): number {
  const factor = Math.min(1, Math.max(0, (scale - SNAP_MIN_SCALE) / 0.95));
  return calcOverflow(fitSize * scale, viewportSize) * factor;
}

/** 计算元素物理矩形与视口几何中心 */
interface FitRects {
  fitWidth: number;
  fitHeight: number;
  fitCenterX: number;
  fitCenterY: number;
  maxScale: number;
  viewportWidth: number;
  viewportHeight: number;
}

function getFitRects(imgEl: HTMLImageElement, viewportEl: HTMLElement | null): FitRects | null {
  if (!viewportEl) return null;
  const imgRect = imgEl.getBoundingClientRect();
  const vpRect = viewportEl.getBoundingClientRect();
  if (!vpRect || imgRect.width === 0 || imgRect.height === 0) return null;

  const naturalW = imgEl.naturalWidth || imgRect.width;
  return {
    fitWidth: imgRect.width,
    fitHeight: imgRect.height,
    fitCenterX: imgRect.left + imgRect.width / 2,
    fitCenterY: imgRect.top + imgRect.height / 2,
    maxScale: Math.max(naturalW / imgRect.width, MIN_MAX_SCALE),
    viewportWidth: vpRect.width,
    viewportHeight: vpRect.height,
  };
}

/** 以光标点 (clientX, clientY) 为物理锚点的仿射变换核心算法 */
function computeAnchorZoom(
  fit: FitRects,
  current: TransformState,
  targetScale: number,
  pointer?: { clientX: number; clientY: number } | null
): TransformState {
  const maxTx = calcMaxTranslate(fit.fitWidth, fit.viewportWidth, targetScale);
  const maxTy = calcMaxTranslate(fit.fitHeight, fit.viewportHeight, targetScale);

  const offsetX = pointer ? pointer.clientX - fit.fitCenterX : 0;
  const offsetY = pointer ? pointer.clientY - fit.fitCenterY : 0;

  const c = targetScale / current.scale;
  const idealTx = offsetX - (offsetX - current.idealTx) * c;
  const idealTy = offsetY - (offsetY - current.idealTy) * c;

  const tx = clamp(idealTx, maxTx);
  const ty = clamp(idealTy, maxTy);

  const prevMaxTx = calcMaxTranslate(fit.fitWidth, fit.viewportWidth, current.scale);
  const prevMaxTy = calcMaxTranslate(fit.fitHeight, fit.viewportHeight, current.scale);

  return {
    scale: targetScale,
    idealTx: maxTx < prevMaxTx ? tx : idealTx,
    idealTy: maxTy < prevMaxTy ? ty : idealTy,
    tx,
    ty,
    maxTx,
    maxTy,
  };
}

/** 双击智能切换放大与复原 (Toggle Double Click Zoom) */
function toggleZoomAt(
  imgEl: HTMLImageElement,
  viewportEl: HTMLElement | null,
  pointer?: { clientX: number; clientY: number } | null
): TransformState | null {
  const fit = getFitRects(imgEl, viewportEl);
  if (!fit) return null;

  const zoomed = computeAnchorZoom(fit, INITIAL_TRANSFORM, fit.maxScale, pointer);
  const totalOverX = Math.max(0, (fit.fitWidth * fit.maxScale - fit.viewportWidth) / 2);
  const totalOverY = Math.max(0, (fit.fitHeight * fit.maxScale - fit.viewportHeight) / 2);

  const tx = clamp(zoomed.tx, totalOverX);
  const ty = clamp(zoomed.ty, totalOverY);

  return {
    ...zoomed,
    tx,
    ty,
    idealTx: tx,
    idealTy: ty,
  };
}

// ============================================================================
// 4. 主组件 (MediaLightboxViewer)
// ============================================================================

export function MediaLightboxViewer({
  items,
  initialIndex = 0,
  isOpen,
  onClose,
  backdrop = "blur",
  renderHeader,
  renderAttribution,
  className = "",
}: MediaLightboxViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [transform, setTransform] = useState<TransformState | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const activeSlideRef = useRef<HTMLDivElement>(null);

  // 跟踪拖拽指针捕获
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    tx: number;
    ty: number;
  } | null>(null);
  const hasMovedRef = useRef<boolean>(false);
  const prevFocusedElRef = useRef<HTMLElement | null>(null);

  // 同步外部 initialIndex
  useEffect(() => {
    setCurrentIndex(initialIndex);
    setTransform(null);
  }, [initialIndex, isOpen]);

  // 焦点记录与页面滚动锁定
  useEffect(() => {
    if (isOpen) {
      prevFocusedElRef.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = "hidden";
      closeBtnRef.current?.focus();
    } else {
      document.body.style.overflow = "";
      prevFocusedElRef.current?.focus?.({ preventScroll: true });
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // 窗口缩放时重置变换
  useEffect(() => {
    if (!transform) return;
    const handleResize = () => setTransform(null);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [transform]);

  const currentItem = items[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === items.length - 1;
  const isZoomed = transform !== null && transform.scale > 1;

  // 切换上一张 / 下一张
  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
    setTransform(null);
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < items.length - 1 ? prev + 1 : prev));
    setTransform(null);
  }, [items.length]);

  // 键盘快捷键监听
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Home") {
        e.preventDefault();
        setCurrentIndex(0);
        setTransform(null);
      } else if (e.key === "End") {
        e.preventDefault();
        setCurrentIndex(items.length - 1);
        setTransform(null);
      }
    },
    [handlePrev, handleNext, onClose, items.length]
  );

  // 双击或单机放大/复原
  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      e.stopPropagation();
      if (hasMovedRef.current) return;

      if (transform) {
        setTransform(null);
      } else {
        const next = toggleZoomAt(e.currentTarget, viewportRef.current, {
          clientX: e.clientX,
          clientY: e.clientY,
        });
        setTransform(next);
      }
    },
    [transform]
  );

  // 指针按下 (Pointer Down) 开始平移
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLImageElement>) => {
      if (!transform || e.button !== 0 || dragRef.current) return;
      hasMovedRef.current = false;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        tx: transform.tx,
        ty: transform.ty,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [transform]
  );

  // 指针移动 (Pointer Move) 实时平移
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLImageElement>) => {
      const drag = dragRef.current;
      if (!drag || !transform || drag.pointerId !== e.pointerId) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      // 4px 死区过滤
      if (!hasMovedRef.current && Math.hypot(dx, dy) < DRAG_DEADZONE) {
        return;
      }
      hasMovedRef.current = true;

      const newTx = clamp(drag.tx + dx, transform.maxTx);
      const newTy = clamp(drag.ty + dy, transform.maxTy);

      drag.tx = newTx;
      drag.ty = newTy;

      e.currentTarget.style.transform = `translate(${newTx}px, ${newTy}px) scale(${transform.scale})`;
    },
    [transform]
  );

  // 指针释放 (Pointer Up)
  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLImageElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;

    if (hasMovedRef.current) {
      setTransform((prev) =>
        prev
          ? {
              ...prev,
              tx: drag.tx,
              ty: drag.ty,
              idealTx: drag.tx,
              idealTy: drag.ty,
            }
          : null
      );
      setTimeout(() => {
        hasMovedRef.current = false;
      }, 0);
    }
  }, []);

  // 滚轮缩放与平移 (Wheel Event)
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const activeImg = viewportRef.current?.querySelector(
        `[data-active-slide="true"] img`
      ) as HTMLImageElement | null;
      if (!activeImg) return;

      // Ctrl + 滚轮 或 触控板双指捏合
      if (e.ctrlKey) {
        e.preventDefault();
        const fit = getFitRects(activeImg, viewportRef.current);
        if (!fit) return;

        const currentT = transform || INITIAL_TRANSFORM;
        const zoomDelta = Math.exp(-e.deltaY * WHEEL_SENSITIVITY);
        const newScale = Math.min(Math.max(currentT.scale * zoomDelta, 1), fit.maxScale);

        if (newScale <= SNAP_MIN_SCALE) {
          setTransform(null);
        } else {
          const next = computeAnchorZoom(fit, currentT, newScale, {
            clientX: e.clientX,
            clientY: e.clientY,
          });
          setTransform(next);
        }
      } else if (transform && transform.scale > 1) {
        // 已放大状态下，滚轮平移
        e.preventDefault();
        setTransform((prev) => {
          if (!prev) return prev;
          const nextTx = clamp(prev.tx - e.deltaX, prev.maxTx);
          const nextTy = clamp(prev.ty - e.deltaY, prev.maxTy);
          return {
            ...prev,
            tx: nextTx,
            ty: nextTy,
            idealTx: nextTx,
            idealTy: nextTy,
          };
        });
      }
    },
    [transform]
  );

  // 绑定非被动原生 Wheel 事件
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || !isOpen) return;
    vp.addEventListener("wheel", handleWheel, { passive: false });
    return () => vp.removeEventListener("wheel", handleWheel);
  }, [isOpen, handleWheel]);

  if (!isOpen || !currentItem) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Media Preview"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={`fixed inset-0 z-50 flex flex-col overflow-hidden select-none outline-none ${
        backdrop === "blur" ? "bg-black/85 backdrop-blur-[40px]" : "bg-black/90"
      } ${className}`}
      style={{ animation: "fade-in 0.2s ease-out" }}
    >
      {/* 1. 顶部操作栏与阴影保护罩 */}
      <div
        ref={headerRef}
        className="absolute top-0 inset-x-0 h-16 px-5 flex items-center justify-between z-20 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.5) 60%, transparent 100%)",
        }}
      >
        <div className="pointer-events-auto flex items-center gap-2">
          {renderHeader?.(currentItem, currentIndex)}
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {/* 当前缩放比例标签 */}
          {isZoomed && (
            <span className="text-xs font-mono text-white/70 bg-white/10 px-2 py-0.5 rounded-full">
              {Math.round(transform.scale * 100)}%
            </span>
          )}

          {/* 关闭按钮 */}
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="size-8 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close lightbox"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 2. 75vw 画廊跑道主视口 (Runway Viewport) */}
      <div
        ref={viewportRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden cursor-default"
        onClick={() => {
          if (isZoomed) setTransform(null);
          else onClose();
        }}
      >
        <div
          className="flex h-full items-center transition-transform duration-300 ease-[cubic-bezier(0.165,0.84,0.44,1)]"
          style={{
            gap: "32px",
            transform: `translateX(calc(12.5vw - ${currentIndex * 75}vw - ${currentIndex * 32}px))`,
          }}
        >
          {items.map((item, idx) => {
            const isActive = idx === currentIndex;
            const shouldRender = Math.abs(idx - currentIndex) <= 2; // 前后 2 帧预加载
            const slideTransform = isActive && transform ? transform : null;

            return (
              <div
                key={item.id}
                ref={isActive ? activeSlideRef : undefined}
                data-active-slide={isActive ? "true" : undefined}
                className="h-full flex-shrink-0 flex items-center justify-center"
                style={{ width: "75vw" }}
                onClick={(e) => {
                  if (!isActive) {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                    setTransform(null);
                  }
                }}
              >
                {shouldRender ? (
                  item.kind === "video" ? (
                    <video
                      src={item.url}
                      controls
                      autoPlay={isActive}
                      className="max-h-[75vh] max-w-full rounded-2xl shadow-2xl object-contain bg-black"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <img
                      src={item.url}
                      alt={item.alt || "Attached Image"}
                      width={item.width}
                      height={item.height}
                      onClick={isActive ? handleImageClick : undefined}
                      onPointerDown={isActive && isZoomed ? handlePointerDown : undefined}
                      onPointerMove={isActive && isZoomed ? handlePointerMove : undefined}
                      onPointerUp={isActive && isZoomed ? handlePointerUp : undefined}
                      onPointerCancel={isActive && isZoomed ? handlePointerUp : undefined}
                      style={{
                        transform: slideTransform
                          ? `translate(${slideTransform.tx}px, ${slideTransform.ty}px) scale(${slideTransform.scale})`
                          : undefined,
                        cursor: isActive
                          ? isZoomed
                            ? "grab"
                            : "zoom-in"
                          : "pointer",
                      }}
                      className={`max-h-[75vh] max-w-full w-auto h-auto object-contain rounded-2xl select-none transition-opacity duration-300 ${
                        isActive
                          ? "opacity-100 shadow-2xl"
                          : "opacity-40 hover:opacity-75 cursor-pointer"
                      }`}
                    />
                  )
                ) : (
                  <div className="size-16 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. 底部导航与图片序号指示器 */}
      {items.length > 1 && (
        <div
          className="absolute bottom-6 inset-x-0 h-14 px-6 flex items-center justify-between z-20 pointer-events-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pointer-events-auto flex items-center">
            {renderAttribution?.(currentItem, currentIndex)}
          </div>

          <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
            <button
              type="button"
              disabled={isFirst}
              onClick={handlePrev}
              className="p-1 rounded-full text-white/80 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous image"
            >
              ‹
            </button>
            <span className="text-xs font-mono text-white/90 tabular-nums px-1.5">
              {currentIndex + 1} / {items.length}
            </span>
            <button
              type="button"
              disabled={isLast}
              onClick={handleNext}
              className="p-1 rounded-full text-white/80 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
              aria-label="Next image"
            >
              ›
            </button>
          </div>

          <div className="w-16" />
        </div>
      )}
    </div>
  );
}
