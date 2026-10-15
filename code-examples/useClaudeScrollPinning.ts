/**
 * 维度一：流式大文本输出与滚动视口物理学
 * 
 * 核心特性：
 * 1. 150ms 用户输入冷却窗口 (performance.now() - lastUserInputAt > 150)
 * 2. 40px 底部容差与图钉锁定
 * 3. 35vh 底部缓冲区 (--chat-extra-space)
 * 4. behavior: "auto" 防抖非平滑瞬时对齐
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export function useClaudeScrollPinning(dependencies: any[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPinned, setIsPinned] = useState(true);
  const [showJumpControl, setShowJumpControl] = useState(false);
  const lastUserInputAt = useRef(0);
  const programmaticScroll = useRef(false);

  // 用户主动滚轮、触摸、键盘输入时立即释放锁定
  const markUserInput = useCallback(() => {
    lastUserInputAt.current = performance.now();
    setIsPinned(false);
  }, []);

  const handleScroll = useCallback(() => {
    if (programmaticScroll.current) {
      programmaticScroll.current = false;
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // 40px 底部边缘吸附容差
    const pinned = distanceFromBottom <= 40;
    setIsPinned(pinned);
    // 离开底部超过 120px 时显示“跳至最新”悬浮按钮
    setShowJumpControl(distanceFromBottom > 120);
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = containerRef.current;
    if (!el) return;
    programmaticScroll.current = true;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
    setIsPinned(true);
    setShowJumpControl(false);
  }, []);

  // 依赖项变化（Token 流式追加）时执行图钉重锚定
  useEffect(() => {
    // 150ms 冷却保护窗口：用户刚触摸/滚轮时不抢夺视口
    if (performance.now() - lastUserInputAt.current <= 150) return;
    if (isPinned) {
      scrollToBottom(false);
    }
  }, dependencies);

  return {
    containerRef,
    isPinned,
    showJumpControl,
    markUserInput,
    handleScroll,
    scrollToBottom
  };
}
