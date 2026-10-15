import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

/**
 * ==============================================================================
 * Claude Design System (CDS) - RichComposerWithMentions.tsx
 * 
 * 
 * 核心工程机制:
 * 1. 严格 CJK 输入法合成守卫 (IME Composition Guard):
 *    全面监听 compositionstart / compositionend，拦截 keyCode === 229 与 isComposing，
 *    杜绝中文/日文/韩文在输入法候选词确认回车时误发送消息。
 * 2. 双触发符指令与引用建议系统 (Dual Trigger Suggestions):
 *    - '/' 触发 Slash Command (如 /help, /clear, /model, /plan, /compact)
 *    - '@' 触发上下文与文件引用 (Projects, Files, Git branches)
 * 3. 焦点漫游 (Roving Focus) 与悬浮窗坐标计算:
 *    ArrowUp / ArrowDown / Enter / Tab / Escape 闭环操作，支持高亮索引循环导航。
 * 4. 弹性高度自适应与 Token 计量预测条。
 * ==============================================================================
 */

export interface SlashCommandItem {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

export interface MentionItem {
  id: string;
  name: string;
  kind: 'file' | 'project' | 'doc' | 'branch';
  path?: string;
  badge?: string;
}

const DEFAULT_SLASH_COMMANDS: SlashCommandItem[] = [
  { id: 'help', name: 'help', description: '获取 Claude 使用帮助与快捷键指南', icon: '❓' },
  { id: 'compact', name: 'compact', description: '压缩长会话上下文以节省 Token 窗口', icon: '⚡' },
  { id: 'model', name: 'model', description: '切换推理模型 (Opus, Sonnet, Haiku)', icon: '🔄' },
  { id: 'plan', name: 'plan', description: '进入工程分步计划模式', icon: '📋' },
  { id: 'clear', name: 'clear', description: '清空当前上下文并重启对话', icon: '🗑️' },
];

const DEFAULT_MENTIONS: MentionItem[] = [
  { id: 'app-tsx', name: 'App.tsx', kind: 'file', path: 'src/App.tsx', badge: 'TSX' },
  { id: 'theme-css', name: 'cds-theme.css', kind: 'file', path: 'src/styles/cds-theme.css', badge: 'CSS' },
  { id: 'vite-config', name: 'vite.config.ts', kind: 'file', path: 'vite.config.ts', badge: 'TS' },
  { id: 'proj-cds', name: 'Claude Design System', kind: 'project', badge: 'Project' },
  { id: 'branch-main', name: 'main', kind: 'branch', badge: 'Git' },
];

export interface RichComposerProps {
  placeholder?: string;
  onSubmit?: (content: { text: string; slashCommand?: string; mentions: MentionItem[] }) => void;
  disabled?: boolean;
  maxTokens?: number;
}

export const RichComposerWithMentions: React.FC<RichComposerProps> = ({
  placeholder = '向 Claude 发送消息... (输入 / 唤起指令，输入 @ 引用上下文)',
  onSubmit,
  disabled = false,
  maxTokens = 200000,
}) => {
  const [text, setText] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [activeSlashCommand, setActiveSlashCommand] = useState<SlashCommandItem | null>(null);
  const [attachedMentions, setAttachedMentions] = useState<MentionItem[]>([]);

  // 建议浮窗状态
  const [suggestionMode, setSuggestionMode] = useState<'slash' | 'mention' | null>(null);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerContainerRef = useRef<HTMLDivElement>(null);

  // 1. 过滤建议列表
  const filteredSlashCommands = useMemo(() => {
    if (suggestionMode !== 'slash') return [];
    const q = suggestionQuery.toLowerCase();
    return DEFAULT_SLASH_COMMANDS.filter((cmd) => cmd.name.toLowerCase().includes(q));
  }, [suggestionMode, suggestionQuery]);

  const filteredMentions = useMemo(() => {
    if (suggestionMode !== 'mention') return [];
    const q = suggestionQuery.toLowerCase();
    return DEFAULT_MENTIONS.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.path && m.path.toLowerCase().includes(q))
    );
  }, [suggestionMode, suggestionQuery]);

  const activeItemsCount = suggestionMode === 'slash' ? filteredSlashCommands.length : filteredMentions.length;

  // 2. 自适应高度调整
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(Math.max(el.scrollHeight, 44), 240);
    el.style.height = `${nextHeight}px`;
  }, []);

  // 3. 实时解析光标前的触发字符 (/ 或 @)
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    adjustTextareaHeight();

    const cursor = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursor);

    // 匹配光标前的触发词
    const slashMatch = textBeforeCursor.match(/(?:^|\s)\/([a-zA-Z0-9_\-]*)$/);
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_\-./]*)$/);

    if (slashMatch && !activeSlashCommand) {
      setSuggestionMode('slash');
      setSuggestionQuery(slashMatch[1]);
      setSelectedIndex(0);
    } else if (mentionMatch) {
      setSuggestionMode('mention');
      setSuggestionQuery(mentionMatch[1]);
      setSelectedIndex(0);
    } else {
      setSuggestionMode(null);
      setSuggestionQuery('');
    }
  };

  // 4. 选择 Slash 指令
  const applySlashCommand = useCallback((cmd: SlashCommandItem) => {
    setActiveSlashCommand(cmd);
    // 从输入文本中去除触发词
    setText((prev) => {
      return prev.replace(/(?:^|\s)\/[a-zA-Z0-9_\-]*$/, '').trimStart();
    });
    setSuggestionMode(null);
    textareaRef.current?.focus();
    setTimeout(adjustTextareaHeight, 0);
  }, [adjustTextareaHeight]);

  // 5. 插入 Mention 胶囊
  const applyMention = useCallback((mention: MentionItem) => {
    setAttachedMentions((prev) => (prev.some((m) => m.id === mention.id) ? prev : [...prev, mention]));
    // 替换光标前的 @query 为普通空格
    setText((prev) => {
      return prev.replace(/(?:^|\s)@[a-zA-Z0-9_\-./]*$/, ' ');
    });
    setSuggestionMode(null);
    textareaRef.current?.focus();
    setTimeout(adjustTextareaHeight, 0);
  }, [adjustTextareaHeight]);

  // 6. 核心键盘交互状态机与 IME 守卫
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 官方 Claude 核心断言: 如果正在进行输入法合成 (CJK) 或 keyCode 为 229，绝对放行并终止响应
    if (isComposing || e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }

    // 建议弹窗开启时的方向键导航与确认
    if (suggestionMode && activeItemsCount > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % activeItemsCount);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + activeItemsCount) % activeItemsCount);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (suggestionMode === 'slash') {
          const selected = filteredSlashCommands[selectedIndex];
          if (selected) applySlashCommand(selected);
        } else if (suggestionMode === 'mention') {
          const selected = filteredMentions[selectedIndex];
          if (selected) applyMention(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setSuggestionMode(null);
        return;
      }
    }

    // 消息提交快捷键处理: Enter 提交, Shift+Enter 换行
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 7. 发送消息
  const handleSend = () => {
    if (disabled || isComposing) return;
    const trimmed = text.trim();
    if (!trimmed && !activeSlashCommand && attachedMentions.length === 0) return;

    if (onSubmit) {
      onSubmit({
        text: trimmed,
        slashCommand: activeSlashCommand?.name,
        mentions: attachedMentions,
      });
    }

    // 重置状态
    setText('');
    setActiveSlashCommand(null);
    setAttachedMentions([]);
    setSuggestionMode(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };

  // 移除 Mention 标签
  const removeMention = (id: string) => {
    setAttachedMentions((prev) => prev.filter((m) => m.id !== id));
  };

  // 估算 Token 数量 (基于 Math.ceil(rawLen * 0.7)，折合 ~1.43 字符/token，适度向上对齐中英文混合平均密度)
  const estimatedTokens = useMemo(() => {
    const rawLen = text.length;
    let tokens = Math.ceil(rawLen * 0.7);
    if (activeSlashCommand) tokens += 10;
    tokens += attachedMentions.length * 25;
    return tokens;
  }, [text, activeSlashCommand, attachedMentions]);

  return (
    <div
      ref={composerContainerRef}
      className="relative w-full rounded-2xl bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface,#1e1e1e)] border border-[var(--cds-border-subtle,#e5e5e5)] dark:border-[var(--cds-border-subtle,#2e2e2e)] shadow-[0_2px_8px_rgba(0,0,0,0.04)] focus-within:border-[var(--cds-border-accent,#d97757)] focus-within:ring-1 focus-within:ring-[var(--cds-border-accent,#d97757)] transition-all duration-200"
    >
      {/* 建议弹层 (Slash / Mention Popover) */}
      {suggestionMode && activeItemsCount > 0 && (
        <div
          role="listbox"
          className="absolute bottom-full left-0 mb-2 w-72 max-h-60 overflow-y-auto rounded-xl bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface-elevated,#262626)] border border-[var(--cds-border-subtle,#e5e5e5)] dark:border-[var(--cds-border-subtle,#333333)] shadow-[0_12px_24px_-4px_rgba(0,0,0,0.12),0_4px_8px_-2px_rgba(0,0,0,0.06)] p-1 z-50 animate-[cds-fade-in_150ms_ease-out]"
        >
          <div className="px-2 py-1 text-[11px] font-medium text-[var(--cds-text-muted,#8c8c8c)] uppercase tracking-wider">
            {suggestionMode === 'slash' ? '常用指令' : '引用上下文 / 文件'}
          </div>

          {suggestionMode === 'slash' &&
            filteredSlashCommands.map((cmd, idx) => (
              <button
                key={cmd.id}
                type="button"
                role="option"
                aria-selected={idx === selectedIndex}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                  idx === selectedIndex
                    ? 'bg-[var(--cds-bg-selected,#f3ece7)] dark:bg-[var(--cds-bg-selected,#3a2c27)] text-[var(--cds-text-accent,#d97757)]'
                    : 'text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] hover:bg-[var(--cds-bg-hover,#f5f5f5)] dark:hover:bg-[var(--cds-bg-hover,#2a2a2a)]'
                }`}
                onClick={() => applySlashCommand(cmd)}
              >
                <span className="text-sm shrink-0">{cmd.icon ?? '⚡'}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold leading-tight">/{cmd.name}</div>
                  <div className="truncate text-[11px] text-[var(--cds-text-muted,#8c8c8c)]">{cmd.description}</div>
                </div>
              </button>
            ))}

          {suggestionMode === 'mention' &&
            filteredMentions.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={idx === selectedIndex}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                  idx === selectedIndex
                    ? 'bg-[var(--cds-bg-selected,#f3ece7)] dark:bg-[var(--cds-bg-selected,#3a2c27)] text-[var(--cds-text-accent,#d97757)]'
                    : 'text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] hover:bg-[var(--cds-bg-hover,#f5f5f5)] dark:hover:bg-[var(--cds-bg-hover,#2a2a2a)]'
                }`}
                onClick={() => applyMention(item)}
              >
                <div className="min-w-0 flex-1 truncate pr-2">
                  <div className="font-medium truncate">{item.name}</div>
                  {item.path && <div className="text-[10px] text-[var(--cds-text-muted,#8c8c8c)] truncate">{item.path}</div>}
                </div>
                {item.badge && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--cds-alpha-1,rgba(0,0,0,0.05))] text-[var(--cds-text-secondary,#666666)]">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
        </div>
      )}

      {/* 顶部标签区: 已激活的 Slash Command 与 Attached Mentions */}
      {(activeSlashCommand || attachedMentions.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 px-3.5 pt-3 pb-1 border-b border-[var(--cds-border-subtle,#e5e5e5)] dark:border-[var(--cds-border-subtle,#2e2e2e)]">
          {activeSlashCommand && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--cds-fill-brand-subtle,#fbebe6)] dark:bg-[var(--cds-fill-brand-subtle,#38221b)] text-[var(--cds-text-accent,#d97757)] text-xs font-semibold">
              <span>/{activeSlashCommand.name}</span>
              <button
                type="button"
                aria-label="移除指令"
                className="hover:opacity-75 p-0.5"
                onClick={() => setActiveSlashCommand(null)}
              >
                ✕
              </button>
            </div>
          )}

          {attachedMentions.map((m) => (
            <div
              key={m.id}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--cds-alpha-1,rgba(0,0,0,0.05))] dark:bg-[var(--cds-alpha-1,rgba(255,255,255,0.08))] text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] text-xs font-medium"
            >
              <span className="text-[var(--cds-text-muted,#8c8c8c)]">@</span>
              <span className="truncate max-w-[140px]">{m.name}</span>
              <button
                type="button"
                aria-label={`移除 ${m.name}`}
                className="hover:opacity-75 text-[10px] text-[var(--cds-text-muted,#8c8c8c)]"
                onClick={() => removeMention(m.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 核心富文本输入区 */}
      <div className="relative px-3.5 pt-2.5 pb-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => {
            setIsComposing(false);
            adjustTextareaHeight();
          }}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="w-full bg-transparent text-sm leading-relaxed text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] placeholder-[var(--cds-text-muted,#8c8c8c)] resize-none outline-none border-none p-0 overflow-y-auto max-h-[240px]"
          style={{ minHeight: '44px' }}
        />
      </div>

      {/* 底部操作工具栏 */}
      <div className="flex items-center justify-between px-3 pb-2.5 pt-1 text-xs">
        <div className="flex items-center gap-2 text-[var(--cds-text-muted,#8c8c8c)]">
          {/* 上传附件按钮 */}
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-[var(--cds-bg-hover,#f5f5f5)] dark:hover:bg-[var(--cds-bg-hover,#2a2a2a)] transition-colors"
            title="添加附件或图片"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          {/* 指令说明快捷键提示 */}
          <span className="hidden sm:inline-block text-[11px] select-none">
            按 <kbd className="px-1 py-0.5 rounded border border-[var(--cds-border-subtle,#e5e5e5)] dark:border-[var(--cds-border-subtle,#333)] font-mono text-[10px]">Enter</kbd> 发送，
            <kbd className="px-1 py-0.5 rounded border border-[var(--cds-border-subtle,#e5e5e5)] dark:border-[var(--cds-border-subtle,#333)] font-mono text-[10px]">Shift+Enter</kbd> 换行
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Token 计量指示器 */}
          <div
            className={`text-[11px] font-mono tabular-nums select-none ${
              estimatedTokens > maxTokens * 0.9
                ? 'text-[var(--cds-fill-danger,#ef4444)] font-bold'
                : 'text-[var(--cds-text-muted,#8c8c8c)]'
            }`}
            title="当前消息预估消耗 Token"
          >
            ~{estimatedTokens} tok
          </div>

          {/* 发送按钮 */}
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || (!text.trim() && !activeSlashCommand && attachedMentions.length === 0)}
            aria-label="发送消息"
            className="flex items-center justify-center size-8 rounded-lg bg-[var(--cds-fill-brand,#d97757)] text-white hover:bg-[var(--cds-fill-brand-hover,#c86849)] active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all duration-150 shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
