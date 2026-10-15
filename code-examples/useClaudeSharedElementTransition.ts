/**
 * Claude Design System (CDS) - Shared Element View Transition Hook
 * 
 * 核心规范：
 *   - 规范名称：view-transition-name: chat-image-preview !important
 *   - 动态计算源缩略图圆角 (--vt-image-preview-source-radius)
 *   - 动态计算目标全屏圆角 (--vt-image-preview-target-radius)
 *   - 针对 object-fit: contain 的内切裁剪百分比 (--vt-image-preview-source-inset)
 *   - 降级机制：如果不支持 document.startViewTransition 或无 originRef，优雅降级为 crossfade 淡入淡出
 */

import { useRef, useEffect, useState, useCallback } from "react";

export interface UseSharedElementTransitionOptions {
  isOpen: boolean;
  originRef: React.RefObject<HTMLElement | null>;
  transitionName?: string;
}

export function useClaudeSharedElementTransition({
  isOpen,
  originRef,
  transitionName = "chat-image-preview",
}: UseSharedElementTransitionOptions) {
  const [isMounted, setIsMounted] = useState(isOpen);
  const targetRef = useRef<HTMLElement | null>(null);
  const isTransitioningRef = useRef<boolean>(false);

  // 提取元素的当前生效圆角
  const getElementBorderRadius = (el: HTMLElement, defaultRadius = "0.5rem"): string => {
    let curr: HTMLElement | null = el;
    for (let i = 0; curr && i < 5; i++) {
      const style = window.getComputedStyle(curr);
      if (
        (curr.tagName === "IMG" || style.overflow === "hidden" || style.overflow === "clip") &&
        style.borderRadius !== "0px" &&
        style.borderRadius !== ""
      ) {
        return style.borderRadius;
      }
      curr = curr.parentElement;
    }
    return defaultRadius;
  };

  // 针对 object-fit: contain 计算图像实际内切 inset
  const computeObjectFitInset = (imgEl: HTMLImageElement) => {
    const { naturalWidth: nw, naturalHeight: nh } = imgEl;
    if (!(nw > 0 && nh > 0)) return null;

    const style = window.getComputedStyle(imgEl);
    if (style.objectFit !== "contain" && style.objectFit !== "scale-down") return null;

    const rect = imgEl.getBoundingClientRect();
    const padL = parseFloat(style.paddingLeft) || 0;
    const padT = parseFloat(style.paddingTop) || 0;
    const padR = parseFloat(style.paddingRight) || 0;
    const padB = parseFloat(style.paddingBottom) || 0;

    const availW = rect.width - padL - padR;
    const availH = rect.height - padT - padB;
    if (availW <= 0 || availH <= 0) return null;

    let scale = Math.min(availW / nw, availH / nh);
    if (style.objectFit === "scale-down") scale = Math.min(scale, 1);

    const renderW = nw * scale;
    const renderH = nh * scale;

    const insetTop = (availH - renderH) / 2 + padT;
    const insetRight = (availW - renderW) / 2 + padR;
    const insetBottom = (availH - renderH) / 2 + padB;
    const insetLeft = (availW - renderW) / 2 + padL;

    return `${(insetTop / rect.height) * 100}% ${(insetRight / rect.width) * 100}% ${(insetBottom / rect.height) * 100}% ${(insetLeft / rect.width) * 100}%`;
  };

  const setTarget = useCallback((el: HTMLElement | null) => {
    targetRef.current = el;
  }, []);

  const getTarget = useCallback(() => {
    return targetRef.current;
  }, []);

  useEffect(() => {
    const origin = originRef.current;
    const supportsViewTransition = typeof (document as any).startViewTransition === "function";
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // 不支持 API 或开启了减弱动效，直接切换状态
    if (!supportsViewTransition || prefersReducedMotion) {
      setIsMounted(isOpen);
      return;
    }

    if (isOpen) {
      const root = document.documentElement;
      if (origin) {
        origin.style.setProperty("view-transition-name", transitionName, "important");
        const radius = getElementBorderRadius(origin, "0.5rem");
        root.style.setProperty("--vt-image-preview-source-radius", radius);

        if (origin instanceof HTMLImageElement) {
          const inset = computeObjectFitInset(origin);
          if (inset) {
            root.style.setProperty("--vt-image-preview-source-inset", inset);
          }
        }
      }

      const transition = (document as any).startViewTransition(() => {
        setIsMounted(true);
      });

      transition.ready.then(() => {
        if (origin) {
          origin.style.removeProperty("view-transition-name");
        }
        const target = targetRef.current;
        if (target) {
          target.style.setProperty("view-transition-name", transitionName, "important");
          const targetRadius = getElementBorderRadius(target, "1rem");
          root.style.setProperty("--vt-image-preview-target-radius", targetRadius);
        }
      });

      transition.finished.finally(() => {
        const target = targetRef.current;
        if (target) {
          target.style.removeProperty("view-transition-name");
        }
        root.style.removeProperty("--vt-image-preview-source-radius");
        root.style.removeProperty("--vt-image-preview-target-radius");
        root.style.removeProperty("--vt-image-preview-source-inset");
      });
    } else {
      const root = document.documentElement;
      const target = targetRef.current;
      if (target) {
        target.style.setProperty("view-transition-name", transitionName, "important");
      }

      const transition = (document as any).startViewTransition(() => {
        setIsMounted(false);
      });

      transition.ready.then(() => {
        if (target) {
          target.style.removeProperty("view-transition-name");
        }
        if (origin) {
          origin.style.setProperty("view-transition-name", transitionName, "important");
        }
      });

      transition.finished.finally(() => {
        if (origin) {
          origin.style.removeProperty("view-transition-name");
        }
      });
    }
  }, [isOpen, originRef, transitionName]);

  return {
    isMounted,
    setTarget,
    getTarget,
  };
}
