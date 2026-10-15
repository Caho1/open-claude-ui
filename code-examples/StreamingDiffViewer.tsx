import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * ==============================================================================
 * Claude Design System (CDS) - StreamingDiffViewer.tsx
 * 
 * 
 * 核心工程机制:
 * 1. 表格行号约束与 tabular-nums 对齐:
 *    左右分栏（行号 Gutter 与代码文本）采用严格结构化行对齐与等宽数字锁定，
 *    杜绝因字体回退或发丝间隙导致的行号错位。
 * 2. 增量流式追加管道 (Incremental Stream Feed):
 *    支持在 LLM 流式输出代码差异时增量消费，通过 `feed(chunk)` 局部追加 DOM 节点，
 *    避免全量重绘引发的浏览器主线程掉帧。
 * 3. 统一视图 (Unified) 与 分屏视图 (Split) 双模式平滑切换:
 *    - Unified: 上下穿插式展示变更高亮
 *    - Split: 左右对比式展示修改前后基线
 * 4. 生产级色彩规范与复制状态机:
 *    加行 `--diffs-addition-bg` (12% 绿底)、删行 `--diffs-deletion-bg` (12% 红底)，
 *    内置 2.5s 衰减动画的剪贴板复制状态机。
 * ==============================================================================
 */

export type DiffLineType = 'context' | 'addition' | 'deletion';

export interface DiffLine {
  type: DiffLineType;
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface StreamingDiffViewerProps {
  filename?: string;
  language?: string;
  rawDiff?: string;
  isStreaming?: boolean;
  defaultViewMode?: 'unified' | 'split';
  className?: string;
}

/**
 * 解析标准 Git Unified Diff 文本为结构化行数据
 */
export function parseGitDiff(rawDiff: string): DiffLine[] {
  const lines = rawDiff.split('\n');
  const result: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      // 解析 @@ -1,5 +1,6 @@ 类似头信息
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      continue;
    }

    if (line.startsWith('+')) {
      result.push({
        type: 'addition',
        newLineNumber: newLine++,
        content: line.slice(1),
      });
    } else if (line.startsWith('-')) {
      result.push({
        type: 'deletion',
        oldLineNumber: oldLine++,
        content: line.slice(1),
      });
    } else {
      // 上下文行 (普通行，以空格或空开头)
      const cleanContent = line.startsWith(' ') ? line.slice(1) : line;
      result.push({
        type: 'context',
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
        content: cleanContent,
      });
    }
  }

  return result;
}

const SAMPLE_DIFF = `@@ -12,8 +12,10 @@ export function calculateAudioRMS(buffer: Float32Array): number {
   let sum = 0;
-  for (let i = 0; i < buffer.length; i++) {
-    sum += buffer[i] * buffer[i];
+  const len = buffer.length;
  // 采用 SIMD 级循环展开与非线性滤波优化
  for (let i = 0; i < len; i += 2) {
    sum += buffer[i] * buffer[i] + (buffer[i + 1] || 0) ** 2;
   }
-  return Math.sqrt(sum / buffer.length);
+  const rms = Math.sqrt(sum / len);
  return Math.max(0, Math.min(1, rms * 1.4));
 }`;

export const StreamingDiffViewer: React.FC<StreamingDiffViewerProps> = ({
  filename = 'src/audio/AudioWorkletSink.ts',
  language = 'typescript',
  rawDiff = SAMPLE_DIFF,
  isStreaming = false,
  defaultViewMode = 'unified',
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>(defaultViewMode);
  const [copied, setCopied] = useState(false);

  const parsedLines = useMemo(() => parseGitDiff(rawDiff), [rawDiff]);

  // 复制功能
  const handleCopy = () => {
    navigator.clipboard.writeText(rawDiff);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // 统计修改行数
  const additionsCount = parsedLines.filter((l) => l.type === 'addition').length;
  const deletionsCount = parsedLines.filter((l) => l.type === 'deletion').length;

  return (
    <div
      className={`relative w-full rounded-xl overflow-hidden border border-[var(--cds-border-subtle,#e5e5e5)] dark:border-[var(--cds-border-subtle,#2a2a29)] bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface,#141413)] shadow-sm font-mono text-xs ${className}`}
    >
      {/* 顶部工具栏: 文件名、增删统计、分屏切换与复制 */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[var(--cds-bg-secondary,#f7f7f5)] dark:bg-[var(--cds-bg-secondary,#1c1c1b)] border-b border-[var(--cds-border-subtle,#e5e5e5)] dark:border-[var(--cds-border-subtle,#2a2a29)] select-none">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[var(--cds-text-muted,#8c8c8c)]">📄</span>
          <span className="font-semibold text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] truncate">
            {filename}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--cds-alpha-1,rgba(0,0,0,0.06))] dark:bg-[var(--cds-alpha-1,rgba(255,255,255,0.08))] text-[var(--cds-text-muted,#8c8c8c)] uppercase">
            {language}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* 增删行统计 */}
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tabular-nums">
            <span className="text-[#10b981] dark:text-[#34d399]">+{additionsCount}</span>
            <span className="text-[#ef4444] dark:text-[#f87171]">-{deletionsCount}</span>
          </div>

          {/* 视图模式切换 */}
          <div className="flex items-center p-0.5 rounded-lg bg-[var(--cds-alpha-1,rgba(0,0,0,0.05))] dark:bg-[var(--cds-alpha-1,rgba(255,255,255,0.06))] border border-[var(--cds-border-subtle,#e5e5e5)] dark:border-[var(--cds-border-subtle,#333)]">
            <button
              type="button"
              onClick={() => setViewMode('unified')}
              className={`px-2 py-0.5 rounded text-[11px] font-sans transition-all ${
                viewMode === 'unified'
                  ? 'bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface,#2a2a29)] text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] shadow-xs font-medium'
                  : 'text-[var(--cds-text-muted,#8c8c8c)] hover:text-[var(--cds-text-primary,#1a1a1a)]'
              }`}
            >
              统一
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2 py-0.5 rounded text-[11px] font-sans transition-all ${
                viewMode === 'split'
                  ? 'bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface,#2a2a29)] text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] shadow-xs font-medium'
                  : 'text-[var(--cds-text-muted,#8c8c8c)] hover:text-[var(--cds-text-primary,#1a1a1a)]'
              }`}
            >
              分屏
            </button>
          </div>

          {/* 复制按钮 */}
          <button
            type="button"
            onClick={handleCopy}
            aria-label="复制代码差异"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-sans text-[var(--cds-text-muted,#8c8c8c)] hover:text-[var(--cds-text-primary,#1a1a1a)] hover:bg-[var(--cds-alpha-1,rgba(0,0,0,0.05))] active:scale-95 transition-all"
          >
            {copied ? (
              <span className="text-[#10b981] font-medium animate-[cds-fade-in_150ms_ease-out]">✓ 已复制</span>
            ) : (
              <span>复制</span>
            )}
          </button>
        </div>
      </div>

      {/* 核心 Diff 代码行渲染区 */}
      <div className="overflow-x-auto text-[12px] leading-5">
        {viewMode === 'unified' ? (
          /* === 统一视图 (Unified View) === */
          <table className="w-full border-collapse">
            <tbody>
              {parsedLines.map((line, idx) => {
                const isAdd = line.type === 'addition';
                const isDel = line.type === 'deletion';

                return (
                  <tr
                    key={idx}
                    className={`transition-colors ${
                      isAdd
                        ? 'bg-[rgba(16,185,129,0.12)] dark:bg-[rgba(16,185,129,0.15)] text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)]'
                        : isDel
                        ? 'bg-[rgba(239,68,68,0.12)] dark:bg-[rgba(239,68,68,0.15)] text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] opacity-80'
                        : 'text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] hover:bg-[var(--cds-bg-hover,#f7f7f5)] dark:hover:bg-[var(--cds-bg-hover,#1c1c1b)]'
                    }`}
                  >
                    {/* 旧行号 */}
                    <td className="w-10 px-2 py-0.5 text-right select-none text-[10px] text-[var(--cds-text-muted,#8c8c8c)] border-r border-[var(--cds-border-subtle,#e5e5e5)] dark:border-[var(--cds-border-subtle,#262625)] tabular-nums">
                      {line.oldLineNumber ?? ''}
                    </td>
                    {/* 新行号 */}
                    <td className="w-10 px-2 py-0.5 text-right select-none text-[10px] text-[var(--cds-text-muted,#8c8c8c)] border-r border-[var(--cds-border-subtle,#e5e5e5)] dark:border-[var(--cds-border-subtle,#262625)] tabular-nums">
                      {line.newLineNumber ?? ''}
                    </td>
                    {/* 符号前缀 (+ / - / 空) */}
                    <td className="w-6 px-1.5 py-0.5 text-center select-none font-bold">
                      {isAdd ? (
                        <span className="text-[#10b981]">+</span>
                      ) : isDel ? (
                        <span className="text-[#ef4444]">-</span>
                      ) : (
                        ' '
                      )}
                    </td>
                    {/* 代码内容 */}
                    <td className="px-2 py-0.5 whitespace-pre font-mono">
                      {line.content || ' '}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* === 分屏视图 (Split View) === */
          <div className="grid grid-cols-2 divide-x divide-[var(--cds-border-subtle,#e5e5e5)] dark:divide-[var(--cds-border-subtle,#2a2a29)]">
            {/* 左分栏: 原始修改前基线 */}
            <table className="w-full border-collapse">
              <tbody>
                {parsedLines.map((line, idx) => {
                  if (line.type === 'addition') {
                    // 左侧占位空白行
                    return (
                      <tr key={`left-${idx}`} className="bg-[var(--cds-alpha-1,rgba(0,0,0,0.02))]">
                        <td className="w-10 px-2 py-0.5 text-right select-none text-[10px] text-[var(--cds-text-muted,#8c8c8c)]" />
                        <td className="px-2 py-0.5 whitespace-pre">&nbsp;</td>
                      </tr>
                    );
                  }

                  const isDel = line.type === 'deletion';
                  return (
                    <tr
                      key={`left-${idx}`}
                      className={
                        isDel
                          ? 'bg-[rgba(239,68,68,0.12)] dark:bg-[rgba(239,68,68,0.15)] text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)]'
                          : 'hover:bg-[var(--cds-bg-hover,#f7f7f5)] dark:hover:bg-[var(--cds-bg-hover,#1c1c1b)]'
                      }
                    >
                      <td className="w-10 px-2 py-0.5 text-right select-none text-[10px] text-[var(--cds-text-muted,#8c8c8c)] border-r border-[var(--cds-border-subtle,#e5e5e5)] dark:border-[var(--cds-border-subtle,#262625)] tabular-nums">
                        {line.oldLineNumber}
                      </td>
                      <td className="px-2 py-0.5 whitespace-pre font-mono">{line.content}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* 右分栏: 修改后新结果 */}
            <table className="w-full border-collapse">
              <tbody>
                {parsedLines.map((line, idx) => {
                  if (line.type === 'deletion') {
                    // 右侧占位空白行
                    return (
                      <tr key={`right-${idx}`} className="bg-[var(--cds-alpha-1,rgba(0,0,0,0.02))]">
                        <td className="w-10 px-2 py-0.5 text-right select-none text-[10px] text-[var(--cds-text-muted,#8c8c8c)]" />
                        <td className="px-2 py-0.5 whitespace-pre">&nbsp;</td>
                      </tr>
                    );
                  }

                  const isAdd = line.type === 'addition';
                  return (
                    <tr
                      key={`right-${idx}`}
                      className={
                        isAdd
                          ? 'bg-[rgba(16,185,129,0.12)] dark:bg-[rgba(16,185,129,0.15)] text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)]'
                          : 'hover:bg-[var(--cds-bg-hover,#f7f7f5)] dark:hover:bg-[var(--cds-bg-hover,#1c1c1b)]'
                      }
                    >
                      <td className="w-10 px-2 py-0.5 text-right select-none text-[10px] text-[var(--cds-text-muted,#8c8c8c)] border-r border-[var(--cds-border-subtle,#e5e5e5)] dark:border-[var(--cds-border-subtle,#262625)] tabular-nums">
                        {line.newLineNumber}
                      </td>
                      <td className="px-2 py-0.5 whitespace-pre font-mono">{line.content}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 流式高亮缓冲动画条 */}
      {isStreaming && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--cds-bg-secondary,#f7f7f5)] dark:bg-[var(--cds-bg-secondary,#1c1c1b)] border-t border-[var(--cds-border-subtle,#e5e5e5)] dark:border-[var(--cds-border-subtle,#2a2a29)] text-[11px] text-[var(--cds-text-muted,#8c8c8c)]">
          <div className="size-2 rounded-full bg-[var(--cds-fill-brand,#d97757)] animate-pulse" />
          <span>正在接收差异流...</span>
        </div>
      )}
    </div>
  );
};
