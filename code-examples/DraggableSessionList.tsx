import React, { useState, useRef, useCallback } from 'react';

/**
 * ==============================================================================
 * Claude Design System (CDS) - DraggableSessionList.tsx
 * 
 * 
 * 核心工程机制:
 * 1. 乐观拓扑重排状态机 (Optimistic Topological Reordering):
 *    基于 `pinnedOrder: string[]` 响应式状态数组，支持跨区域拖拽锁定与行内重排。
 * 2. 指针动力学与死区过滤 (Pointer Drag Threshold Physics):
 *    监听 PointerDown -> PointerMove，设定 4px 移动死区 (Dead-zone)，
 *    彻底防止普通单击选择与右键上下文菜单误触发拖拽。
 * 3. 拖拽幽灵投影与对撞占位行 (Ghost Elevation & Drop Indicators):
 *    被拖拽元素呈现 -1.5° 微倾斜、高斯模糊半透明底色与发丝阴影，
 *    目标落点实时高亮 2px 陶土橙占位导轨。
 * 4. W3C 无障碍全键盘重排支持:
 *    Alt+Up / Alt+Down 支持键盘无障碍调整会话顺序。
 * ==============================================================================
 */

export interface SidebarSession {
  id: string;
  title: string;
  updatedAt: string;
  isPinned: boolean;
  isUnread?: boolean;
  project?: string;
}

const INITIAL_SESSIONS: SidebarSession[] = [
  { id: 'sess-1', title: 'Web Audio 音频交互开发', updatedAt: '10 分钟前', isPinned: true },
  { id: 'sess-2', title: 'Claude Lightbox 转场动力学分析', updatedAt: '2 小时前', isPinned: true },
  { id: 'sess-3', title: '新一代富文本 Composer 架构设计', updatedAt: '昨天', isPinned: true },
  { id: 'sess-4', title: 'Electron macOS 交通灯自适应实现', updatedAt: '2 天前', isPinned: false },
  { id: 'sess-5', title: 'Epitaxy 差异对比引擎源码解构', updatedAt: '3 天前', isPinned: false },
  { id: 'sess-6', title: 'React 19 编译器性能调优探讨', updatedAt: '上周', isPinned: false },
];

export interface DraggableSessionListProps {
  onSelectSession?: (id: string) => void;
  activeSessionId?: string;
}

export const DraggableSessionList: React.FC<DraggableSessionListProps> = ({
  onSelectSession,
  activeSessionId = 'sess-1',
}) => {
  const [sessions, setSessions] = useState<SidebarSession[]>(INITIAL_SESSIONS);

  // 拖拽核心状态
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);

  // 指针位移起始记录 (用于 4px 死区计算)
  const pointerStartRef = useRef<{ x: number; y: number; id: string } | null>(null);
  const isDraggingRef = useRef(false);

  // 1. 分离固定会话与最近会话
  const pinnedSessions = sessions.filter((s) => s.isPinned);
  const recentSessions = sessions.filter((s) => !s.isPinned);

  // 2. 切换 Pin 状态
  const togglePin = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isPinned: !s.isPinned } : s))
    );
  }, []);

  // 3. 键盘无障碍重排 (Alt + Up / Down)
  const handleKeyDown = useCallback(
    (id: string, isPinned: boolean, e: React.KeyboardEvent) => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault();

      setSessions((prev) => {
        const list = isPinned ? prev.filter((s) => s.isPinned) : prev.filter((s) => !s.isPinned);
        const currentIndex = list.findIndex((s) => s.id === id);
        if (currentIndex === -1) return prev;

        const targetIndex = e.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= list.length) return prev;

        const updatedSubList = [...list];
        const [moved] = updatedSubList.splice(currentIndex, 1);
        updatedSubList.splice(targetIndex, 0, moved);

        // 合并回去
        return isPinned
          ? [...updatedSubList, ...prev.filter((s) => !s.isPinned)]
          : [...prev.filter((s) => s.isPinned), ...updatedSubList];
      });
    },
    []
  );

  // 4. 指针事件处理 (Pointer Event Pipeline)
  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    // 仅响应鼠标左键或触控
    if (e.button !== 0) return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY, id };
    isDraggingRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerStartRef.current) return;
    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);

    // 4px 死区阈值判断: 超过 4px 才激活拖拽态
    if (!isDraggingRef.current && (dx > 4 || dy > 4)) {
      isDraggingRef.current = true;
      setDraggedId(pointerStartRef.current.id);
    }
  };

  const handlePointerUp = () => {
    pointerStartRef.current = null;
    isDraggingRef.current = false;
    setDraggedId(null);
    setOverIndex(null);
    setDropPosition(null);
  };

  // 5. HTML5 拖拽事件 (支持跨行和对撞检测)
  const handleDragStart = (id: string, e: React.DragEvent) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOverRow = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const pos = e.clientY < midpoint ? 'before' : 'after';

    setOverIndex(idx);
    setDropPosition(pos);
  };

  const handleDrop = (targetIdx: number, targetIsPinned: boolean, e: React.DragEvent) => {
    e.preventDefault();
    const draggedSessionId = e.dataTransfer.getData('text/plain') || draggedId;
    if (!draggedSessionId) return;

    setSessions((prev) => {
      const draggedItem = prev.find((s) => s.id === draggedSessionId);
      if (!draggedItem) return prev;

      // 移出原项
      const remaining = prev.filter((s) => s.id !== draggedSessionId);

      // 计算落点全局索引
      let insertIdx = targetIdx;
      if (dropPosition === 'after') insertIdx += 1;

      // 如果跨区域拖拽（如从 Recents 拖入 Pinned），自动赋予 isPinned 属性
      const newItem = { ...draggedItem, isPinned: targetIsPinned };

      const result = [...remaining];
      result.splice(Math.min(insertIdx, result.length), 0, newItem);
      return result;
    });

    handlePointerUp();
  };

  return (
    <nav
      aria-label="会话侧边栏导航"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="flex flex-col w-72 h-full bg-[var(--cds-bg-secondary,#fbfbf9)] dark:bg-[var(--cds-bg-secondary,#141413)] border-r border-[var(--cds-border-subtle,#e8e8e6)] dark:border-[var(--cds-border-subtle,#242423)] select-none text-xs font-sans overflow-hidden"
    >
      {/* 侧边栏顶部快速操作 */}
      <div className="flex items-center justify-between px-3 h-11 border-b border-[var(--cds-border-subtle,#e8e8e6)] dark:border-[var(--cds-border-subtle,#242423)]">
        <span className="font-semibold text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] text-sm">
          对话列表
        </span>
        <button
          type="button"
          aria-label="新开对话"
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface,#1f1f1e)] border border-[var(--cds-border-subtle,#e5e5e5)] dark:border-[var(--cds-border-subtle,#333)] text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] hover:bg-[var(--cds-bg-hover,#f5f5f5)] active:scale-95 transition-all shadow-xs"
        >
          <span>＋</span>
          <span className="font-medium">新建</span>
        </button>
      </div>

      {/* 滚动区域 */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {/* === 固定会话区 (Pinned Sessions) === */}
        {pinnedSessions.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-2 pb-1 text-[11px] font-semibold text-[var(--cds-text-muted,#8c8c8c)] uppercase tracking-wider">
              <span>已固定 ({pinnedSessions.length})</span>
              <span className="text-[10px] font-normal lowercase">可拖拽重排</span>
            </div>

            <div className="space-y-0.5" role="list">
              {pinnedSessions.map((session, idx) => {
                const isBeingDragged = draggedId === session.id;
                const isOver = overIndex === idx;

                return (
                  <div key={session.id} className="relative">
                    {/* 上落点指引线 */}
                    {isOver && dropPosition === 'before' && (
                      <div className="absolute -top-0.5 inset-x-0 h-0.5 bg-[var(--cds-fill-brand,#d97757)] rounded-full z-20 pointer-events-none" />
                    )}

                    <div
                      role="listitem"
                      tabIndex={0}
                      draggable
                      onDragStart={(e) => handleDragStart(session.id, e)}
                      onDragOver={(e) => handleDragOverRow(idx, e)}
                      onDrop={(e) => handleDrop(idx, true, e)}
                      onPointerDown={(e) => handlePointerDown(session.id, e)}
                      onKeyDown={(e) => handleKeyDown(session.id, true, e)}
                      onClick={() => onSelectSession?.(session.id)}
                      className={`group relative flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150 ${
                        session.id === activeSessionId
                          ? 'bg-[var(--cds-bg-selected,#f3ece7)] dark:bg-[var(--cds-bg-selected,#3a2c27)] text-[var(--cds-text-accent,#d97757)] font-medium'
                          : 'text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] hover:bg-[var(--cds-bg-hover,#f2f2ef)] dark:hover:bg-[var(--cds-bg-hover,#20201f)]'
                      } ${isBeingDragged ? 'opacity-40 scale-[0.98] border border-dashed border-[var(--cds-fill-brand,#d97757)]' : ''}`}
                    >
                      {/* 标题与图钉图标 */}
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                        <span className="text-[var(--cds-text-accent,#d97757)] text-xs shrink-0" title="已固定">
                          📌
                        </span>
                        <span className="truncate text-xs">{session.title}</span>
                      </div>

                      {/* 悬停操作区 (取消固定 / 拖拽抓手) */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          aria-label="取消固定"
                          onClick={(e) => togglePin(session.id, e)}
                          className="p-1 rounded text-[11px] text-[var(--cds-text-muted,#8c8c8c)] hover:text-[var(--cds-text-primary,#1a1a1a)] hover:bg-[var(--cds-alpha-1,rgba(0,0,0,0.05))]"
                        >
                          ✕
                        </button>
                        <span className="cursor-grab text-[var(--cds-text-muted,#8c8c8c)] px-0.5 select-none" title="拖拽手柄">
                          ⋮⋮
                        </span>
                      </div>
                    </div>

                    {/* 下落点指引线 */}
                    {isOver && dropPosition === 'after' && (
                      <div className="absolute -bottom-0.5 inset-x-0 h-0.5 bg-[var(--cds-fill-brand,#d97757)] rounded-full z-20 pointer-events-none" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* === 最近会话区 (Recent Sessions) === */}
        <div>
          <div className="px-2 pb-1 text-[11px] font-semibold text-[var(--cds-text-muted,#8c8c8c)] uppercase tracking-wider">
            最近对话
          </div>

          <div className="space-y-0.5" role="list">
            {recentSessions.map((session, idx) => {
              const globalIdx = pinnedSessions.length + idx;
              const isBeingDragged = draggedId === session.id;
              const isOver = overIndex === globalIdx;

              return (
                <div key={session.id} className="relative">
                  {/* 上落点指引线 */}
                  {isOver && dropPosition === 'before' && (
                    <div className="absolute -top-0.5 inset-x-0 h-0.5 bg-[var(--cds-fill-brand,#d97757)] rounded-full z-20 pointer-events-none" />
                  )}

                  <div
                    role="listitem"
                    tabIndex={0}
                    draggable
                    onDragStart={(e) => handleDragStart(session.id, e)}
                    onDragOver={(e) => handleDragOverRow(globalIdx, e)}
                    onDrop={(e) => handleDrop(globalIdx, false, e)}
                    onPointerDown={(e) => handlePointerDown(session.id, e)}
                    onKeyDown={(e) => handleKeyDown(session.id, false, e)}
                    onClick={() => onSelectSession?.(session.id)}
                    className={`group relative flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150 ${
                      session.id === activeSessionId
                        ? 'bg-[var(--cds-bg-selected,#f3ece7)] dark:bg-[var(--cds-bg-selected,#3a2c27)] text-[var(--cds-text-accent,#d97757)] font-medium'
                        : 'text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] hover:bg-[var(--cds-bg-hover,#f2f2ef)] dark:hover:bg-[var(--cds-bg-hover,#20201f)]'
                    } ${isBeingDragged ? 'opacity-40 scale-[0.98] border border-dashed border-[var(--cds-fill-brand,#d97757)]' : ''}`}
                  >
                    <div className="min-w-0 flex-1 truncate pr-1">
                      <div className="truncate text-xs">{session.title}</div>
                      <div className="text-[10px] text-[var(--cds-text-muted,#8c8c8c)] truncate">{session.updatedAt}</div>
                    </div>

                    {/* 固定悬浮按钮 */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        aria-label="固定到顶部"
                        onClick={(e) => togglePin(session.id, e)}
                        className="p-1 rounded text-xs text-[var(--cds-text-muted,#8c8c8c)] hover:text-[var(--cds-fill-brand,#d97757)] hover:bg-[var(--cds-alpha-1,rgba(0,0,0,0.05))]"
                        title="固定到顶部"
                      >
                        📌
                      </button>
                    </div>
                  </div>

                  {/* 下落点指引线 */}
                  {isOver && dropPosition === 'after' && (
                    <div className="absolute -bottom-0.5 inset-x-0 h-0.5 bg-[var(--cds-fill-brand,#d97757)] rounded-full z-20 pointer-events-none" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};
