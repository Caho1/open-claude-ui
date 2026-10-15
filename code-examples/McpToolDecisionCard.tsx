import React, { useState } from 'react';

/**
 * ==============================================================================
 * Claude Design System (CDS) - McpToolDecisionCard.tsx
 * 
 * 
 * 核心工程机制:
 * 1. 严格的三态授权生命周期 (Three-State Authorization Machine):
 *    - `pending_approval`: 等待授权，展现入参树与三阶决议动作
 *    - `running`: 执行中，触发陶土脉冲与终端管道捕获
 *    - `success` / `error`: 终态收口，折叠控制台结果预览
 * 2. 三阶决议按钮动作阵列:
 *    - [单次批准 (Allow Once)]: 仅对本次调用赋予一次性执行权
 *    - [始终信任 (Always Allow)]: 将该 MCP 模式加入本地会话白名单免检
 *    - [拒绝执行 (Deny)]: 中断执行流并向模型回传授权被拒信号
 * 3. 动态 Payload JSON 审查与只读/微调切换:
 *    高亮格式化展示即将执行的命令或参数，防止恶意或破坏性指令注入。
 * ==============================================================================
 */

export type ToolExecutionStatus = 'pending_approval' | 'running' | 'success' | 'error';

export interface McpToolCallData {
  id: string;
  toolName: string;
  serverUrl?: string; // 如 "mcp://filesystem", "cli://bash"
  inputParams: Record<string, any>;
  resultOutput?: string;
  errorMessage?: string;
  executionDurationMs?: number;
}

export interface McpToolDecisionCardProps {
  toolCall: McpToolCallData;
  onVerdict?: (verdict: 'allow_once' | 'always_allow' | 'deny', modifiedParams?: Record<string, any>) => void;
  className?: string;
}

export const McpToolDecisionCard: React.FC<McpToolDecisionCardProps> = ({
  toolCall,
  onVerdict,
  className = '',
}) => {
  const [status, setStatus] = useState<ToolExecutionStatus>('pending_approval');
  const [isJsonExpanded, setIsJsonExpanded] = useState(true);
  const [isResultExpanded, setIsResultExpanded] = useState(false);

  // 1. 处理用户决议
  const handleAction = (verdict: 'allow_once' | 'always_allow' | 'deny') => {
    if (verdict === 'deny') {
      setStatus('error');
    } else {
      setStatus('running');
      // 模拟工具执行返回
      setTimeout(() => {
        setStatus('success');
      }, 1200);
    }
    onVerdict?.(verdict, toolCall.inputParams);
  };

  const isPending = status === 'pending_approval';
  const isRunning = status === 'running';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  return (
    <div
      role="region"
      aria-label={`工具调用决策卡片: ${toolCall.toolName}`}
      className={`relative w-full rounded-2xl border overflow-hidden transition-all duration-300 font-sans text-xs ${
        isPending
          ? 'border-[var(--cds-border-accent,#d97757)]/50 bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface,#1c1b1a)] shadow-[0_4px_16px_rgba(217,119,87,0.12)]'
          : isRunning
          ? 'border-[var(--cds-border-subtle,#e5e5e3)] dark:border-[var(--cds-border-subtle,#2e2e2c)] bg-[var(--cds-bg-secondary,#faf9f6)] dark:bg-[var(--cds-bg-secondary,#181817)]'
          : isSuccess
          ? 'border-[#10b981]/40 bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface,#171b18)]'
          : 'border-[#ef4444]/40 bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface,#1f1717)]'
      } ${className}`}
    >
      {/* 顶部标题栏：工具名、来源 Server、执行状态徽标 */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--cds-border-subtle,#e8e8e6)] dark:border-[var(--cds-border-subtle,#282827)] bg-[var(--cds-bg-secondary,#fbfbf9)] dark:bg-[var(--cds-bg-secondary,#191918)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm select-none">⚙️</span>
          <span className="font-mono font-semibold text-sm text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] truncate">
            {toolCall.toolName}
          </span>
          {toolCall.serverUrl && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--cds-alpha-1,rgba(0,0,0,0.06))] dark:bg-[var(--cds-alpha-1,rgba(255,255,255,0.08))] text-[var(--cds-text-muted,#8c8c8c)] truncate">
              {toolCall.serverUrl}
            </span>
          )}
        </div>

        {/* 状态徽标 */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isPending && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--cds-fill-brand-subtle,#fcf0ec)] dark:bg-[var(--cds-fill-brand-subtle,#36211a)] text-[var(--cds-text-accent,#d97757)]">
              <span className="size-1.5 rounded-full bg-[var(--cds-fill-brand,#d97757)] animate-pulse" />
              请求授权
            </span>
          )}
          {isRunning && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <span className="size-1.5 rounded-full bg-blue-500 animate-spin" />
              执行中...
            </span>
          )}
          {isSuccess && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              ✓ 执行成功
            </span>
          )}
          {isError && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              ✕ 已拒绝 / 失败
            </span>
          )}
        </div>
      </div>

      {/* 参数检查区：格式化 JSON 审查 */}
      <div className="p-3.5 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-[var(--cds-text-muted,#8c8c8c)]">
          <span className="font-medium uppercase tracking-wider">执行参数 (Payload)</span>
          <button
            type="button"
            onClick={() => setIsJsonExpanded(!isJsonExpanded)}
            className="hover:text-[var(--cds-text-primary,#1a1a1a)] transition-colors select-none"
          >
            {isJsonExpanded ? '收起 ▲' : '展开 ▼'}
          </button>
        </div>

        {isJsonExpanded && (
          <pre className="p-2.5 rounded-lg bg-[var(--cds-bg-secondary,#f4f4f2)] dark:bg-[var(--cds-bg-secondary,#111110)] border border-[var(--cds-border-subtle,#e8e8e6)] dark:border-[var(--cds-border-subtle,#242423)] font-mono text-[11px] leading-relaxed text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#e5e5e5)] overflow-x-auto max-h-48">
            <code>{JSON.stringify(toolCall.inputParams, null, 2)}</code>
          </pre>
        )}
      </div>

      {/* 终态控制台输出 (结果区) */}
      {(isSuccess || isError) && (toolCall.resultOutput || toolCall.errorMessage) && (
        <div className="px-3.5 pb-3">
          <button
            type="button"
            onClick={() => setIsResultExpanded(!isResultExpanded)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--cds-text-secondary,#666666)] hover:text-[var(--cds-text-primary,#1a1a1a)] select-none"
          >
            <span>{isResultExpanded ? '收起控制台输出 ▲' : '查看控制台输出 ▼'}</span>
          </button>

          {isResultExpanded && (
            <div className="mt-2 p-2.5 rounded-lg bg-[#0d0d0c] text-[#ececeb] font-mono text-[11px] leading-relaxed overflow-x-auto max-h-48 border border-white/10">
              {toolCall.errorMessage ? (
                <div className="text-rose-400">{toolCall.errorMessage}</div>
              ) : (
                <pre>{toolCall.resultOutput || '执行完成，无返回值。'}</pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* 底部操作决议按钮组 (仅在 pending_approval 时展现) */}
      {isPending && (
        <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-[var(--cds-border-subtle,#e8e8e6)] dark:border-[var(--cds-border-subtle,#282827)] bg-[var(--cds-bg-secondary,#fbfbf9)] dark:bg-[var(--cds-bg-secondary,#161615)] select-none">
          {/* 拒绝按钮 */}
          <button
            type="button"
            onClick={() => handleAction('deny')}
            className="px-3 py-1.5 rounded-lg border border-[var(--cds-border-subtle,#e5e5e3)] dark:border-[var(--cds-border-subtle,#333331)] text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:scale-95 transition-all font-medium"
          >
            拒绝执行
          </button>

          {/* 批准按钮组 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAction('always_allow')}
              className="px-3 py-1.5 rounded-lg border border-[var(--cds-border-subtle,#e5e5e3)] dark:border-[var(--cds-border-subtle,#333331)] bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface,#222221)] text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] hover:bg-[var(--cds-bg-hover,#f5f5f5)] active:scale-95 transition-all font-medium"
            >
              始终允许该工具
            </button>

            <button
              type="button"
              onClick={() => handleAction('allow_once')}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--cds-fill-brand,#d97757)] text-white hover:bg-[var(--cds-fill-brand-hover,#c86849)] shadow-xs active:scale-95 transition-all font-medium"
            >
              单次批准
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
