/**
 * 维度五：全键盘盲操网格与无障碍访问
 * 
 * 核心特性：
 * 1. ArrowUp / ArrowDown / ArrowLeft / ArrowRight 漫游
 * 2. Home / End / PageUp / PageDown 首尾定位
 * 3. RTL (dir="rtl") 左右翻转镜像机制
 * 4. Tab / Shift+Tab 单键瞬间跳出，防键盘死循环
 * 5. 动态 TabIndex: 仅当前激活项为 0，其余为 -1
 */

import { useState, useRef, useCallback } from 'react';

interface RovingFocusOptions {
  orientation?: 'horizontal' | 'vertical' | 'both';
  loop?: boolean;
  dir?: 'ltr' | 'rtl';
}

export function useClaudeRovingFocus(itemCount: number, options: RovingFocusOptions = {}) {
  const { orientation = 'vertical', loop = true, dir = 'ltr' } = options;
  const [currentFocusedIndex, setCurrentFocusedIndex] = useState(0);
  const itemsRef = useRef<(HTMLElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      // 核心规则 1：Tab 键触发立即退出漫游组，交还给全局 Tab 焦点流
      if (e.key === 'Tab') return;

      let targetIndex = -1;
      const isRtl = dir === 'rtl';

      switch (e.key) {
        case 'ArrowDown':
          if (orientation === 'vertical' || orientation === 'both') targetIndex = index + 1;
          break;
        case 'ArrowUp':
          if (orientation === 'vertical' || orientation === 'both') targetIndex = index - 1;
          break;
        case 'ArrowRight':
          if (orientation === 'horizontal' || orientation === 'both') targetIndex = isRtl ? index - 1 : index + 1;
          break;
        case 'ArrowLeft':
          if (orientation === 'horizontal' || orientation === 'both') targetIndex = isRtl ? index + 1 : index - 1;
          break;
        case 'Home':
        case 'PageUp':
          targetIndex = 0;
          break;
        case 'End':
        case 'PageDown':
          targetIndex = itemCount - 1;
          break;
        default:
          return;
      }

      if (targetIndex !== -1) {
        e.preventDefault();
        // 核心规则 2：根据 loop 决定是否回绕到第一项/最后一项
        const finalIndex = loop
          ? (targetIndex + itemCount) % itemCount
          : Math.max(0, Math.min(itemCount - 1, targetIndex));

        setCurrentFocusedIndex(finalIndex);
        // 核心规则 3：执行聚焦并避免视口跳跃
        itemsRef.current[finalIndex]?.focus({ preventScroll: true });
      }
    },
    [itemCount, orientation, loop, dir]
  );

  return {
    currentFocusedIndex,
    registerItem: (index: number) => (el: HTMLElement | null) => {
      itemsRef.current[index] = el;
    },
    getItemProps: (index: number) => ({
      // 核心规则 4：仅当前激活项保持 tabIndex = 0
      tabIndex: index === currentFocusedIndex ? 0 : -1,
      onKeyDown: (e: React.KeyboardEvent) => handleKeyDown(e, index),
      onClick: () => setCurrentFocusedIndex(index)
    })
  };
}
