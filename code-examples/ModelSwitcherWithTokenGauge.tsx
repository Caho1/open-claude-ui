import React, { useState } from 'react';

/**
 * ==============================================================================
 * Claude Design System (CDS) - ModelSwitcherWithTokenGauge.tsx
 * 
 * 
 * 核心工程机制:
 * 1. 官方三大模型梯队架构 (Model Tier Matrix):
 *    - Claude 3.5 Sonnet: 全能主力，顶尖推理与代码生成能力
 *    - Claude 3.5 Haiku: 极致轻量与高吞吐响应
 *    - Claude 3 Opus: 超长思维链与顶级专业纵深推理
 * 2. 深度思考 (Extended Thinking) 动态开关联动:
 *    支持在 Sonnet/Opus 下切换 Thinking 思考配额 (如 16k tokens)。
 * 3. Prompt Caching 显存成本解构表:
 *    精确展示普通输入、`cache_read_input_tokens` (读缓存命中优惠)
 *    与 `cache_creation_input_tokens` (写入缓存)。
 * 4. 环形 SVG 动态容量仪表盘 (Circular Capacity Gauge):
 *    基于 `strokeDashoffset` 渲染 200k 窗口饱和度，80% 触发陶土警告色。
 * ==============================================================================
 */

export interface ModelTier {
  id: string;
  name: string;
  tagline: string;
  badge?: string;
  supportsThinking?: boolean;
  maxContext: number; // 如 200000
}

const AVAILABLE_MODELS: ModelTier[] = [
  {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet',
    tagline: '最强智能，专为复杂推理、系统架构与全栈编程打造',
    badge: '推荐',
    supportsThinking: true,
    maxContext: 200000,
  },
  {
    id: 'claude-3-5-haiku-latest',
    name: 'Claude 3.5 Haiku',
    tagline: '极速响应，专为日常对话与轻量级任务优化',
    badge: '极速',
    supportsThinking: false,
    maxContext: 200000,
  },
  {
    id: 'claude-3-opus-latest',
    name: 'Claude 3 Opus',
    tagline: '终极深度，专为复杂科学计算与多维哲学论述设计',
    supportsThinking: true,
    maxContext: 200000,
  },
];

export interface TokenMetrics {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface ModelSwitcherProps {
  currentModelId?: string;
  onSelectModel?: (model: ModelTier) => void;
  tokenMetrics?: TokenMetrics;
  className?: string;
}

export const ModelSwitcherWithTokenGauge: React.FC<ModelSwitcherProps> = ({
  currentModelId = 'claude-3-5-sonnet-latest',
  onSelectModel,
  tokenMetrics = {
    inputTokens: 14200,
    outputTokens: 3800,
    cacheReadTokens: 42000,
    cacheWriteTokens: 12000,
  },
  className = '',
}) => {
  const [selectedModelId, setSelectedModelId] = useState(currentModelId);
  const [isOpen, setIsOpen] = useState(false);
  const [thinkingEnabled, setThinkingEnabled] = useState(true);

  const activeModel = AVAILABLE_MODELS.find((m) => m.id === selectedModelId) || AVAILABLE_MODELS[0];

  // 计算上下文占用率
  const totalTokens =
    tokenMetrics.inputTokens +
    tokenMetrics.outputTokens +
    tokenMetrics.cacheReadTokens +
    tokenMetrics.cacheWriteTokens;
  const usageRatio = Math.min(1, totalTokens / activeModel.maxContext);
  const usagePercent = Math.round(usageRatio * 100);

  // SVG 环形参数
  const circleRadius = 16;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference * (1 - usageRatio);

  const handleSelect = (model: ModelTier) => {
    setSelectedModelId(model.id);
    onSelectModel?.(model);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block text-xs font-sans ${className}`}>
      {/* 触发胶囊按钮 */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface,#1f1f1e)] border border-[var(--cds-border-subtle,#e5e5e3)] dark:border-[var(--cds-border-subtle,#2e2e2c)] hover:border-[var(--cds-border-accent,#d97757)] shadow-xs transition-all select-none"
      >
        <span className="font-semibold text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)]">
          {activeModel.name}
        </span>

        {/* 微型环形进度 */}
        <div className="relative size-4 flex items-center justify-center shrink-0">
          <svg className="size-full -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              r={circleRadius}
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-[var(--cds-alpha-1,rgba(0,0,0,0.1))] dark:text-white/10"
            />
            <circle
              cx="18"
              cy="18"
              r={circleRadius}
              fill="none"
              stroke={usageRatio > 0.8 ? 'var(--cds-fill-danger,#ef4444)' : 'var(--cds-fill-brand,#d97757)'}
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
        </div>

        <span className="text-[10px] text-[var(--cds-text-muted,#8c8c8c)]">▼</span>
      </button>

      {/* 展开弹窗面板 */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-2 w-80 rounded-2xl bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface-elevated,#242423)] border border-[var(--cds-border-subtle,#e5e5e3)] dark:border-[var(--cds-border-subtle,#333331)] shadow-[0_12px_28px_-4px_rgba(0,0,0,0.15)] p-2 z-50 animate-[cds-fade-in_150ms_ease-out]"
        >
          {/* 1. 模型列表 */}
          <div className="space-y-1 pb-2 border-b border-[var(--cds-border-subtle,#e8e8e6)] dark:border-[var(--cds-border-subtle,#2a2a28)]">
            <div className="px-2 py-1 text-[10px] font-semibold text-[var(--cds-text-muted,#8c8c8c)] uppercase tracking-wider">
              选择推理模型
            </div>

            {AVAILABLE_MODELS.map((model) => {
              const isSelected = model.id === selectedModelId;
              return (
                <button
                  key={model.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(model)}
                  className={`w-full flex flex-col items-start px-2.5 py-2 rounded-xl text-left transition-colors ${
                    isSelected
                      ? 'bg-[var(--cds-bg-selected,#f8eee9)] dark:bg-[var(--cds-bg-selected,#36241e)] border border-[var(--cds-border-accent,#d97757)]/30'
                      : 'hover:bg-[var(--cds-bg-hover,#f4f4f2)] dark:hover:bg-[var(--cds-bg-hover,#2b2b2a)]'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-xs text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)]">
                      {model.name}
                    </span>
                    {model.badge && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-[var(--cds-fill-brand-subtle,#fcf0ec)] dark:bg-[var(--cds-fill-brand-subtle,#3a2018)] text-[var(--cds-text-accent,#d97757)]">
                        {model.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--cds-text-muted,#8c8c8c)] mt-0.5 leading-snug">
                    {model.tagline}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 2. 深度思考 (Extended Thinking) 开关 */}
          {activeModel.supportsThinking && (
            <div className="flex items-center justify-between px-2.5 py-2.5 border-b border-[var(--cds-border-subtle,#e8e8e6)] dark:border-[var(--cds-border-subtle,#2a2a28)]">
              <div>
                <div className="font-medium text-xs text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)]">
                  深度思考 (Thinking)
                </div>
                <div className="text-[10px] text-[var(--cds-text-muted,#8c8c8c)]">
                  展示完整的逐步推理、反思与规划链路
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={thinkingEnabled}
                onClick={() => setThinkingEnabled(!thinkingEnabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  thinkingEnabled ? 'bg-[var(--cds-fill-brand,#d97757)]' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    thinkingEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}

          {/* 3. Token 上下文与 Prompt Caching 解构仪表盘 */}
          <div className="p-2.5 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-[var(--cds-text-secondary,#666666)]">上下文窗口使用量</span>
              <span className="font-mono tabular-nums text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] font-semibold">
                {totalTokens.toLocaleString()} / {activeModel.maxContext.toLocaleString()} ({usagePercent}%)
              </span>
            </div>

            {/* 复合多段进度条 */}
            <div className="h-1.5 w-full rounded-full bg-[var(--cds-alpha-1,rgba(0,0,0,0.08))] dark:bg-white/10 overflow-hidden flex">
              <div
                style={{ width: `${(tokenMetrics.cacheReadTokens / activeModel.maxContext) * 100}%` }}
                className="bg-emerald-500"
                title={`缓存读取: ${tokenMetrics.cacheReadTokens} tok`}
              />
              <div
                style={{ width: `${(tokenMetrics.cacheWriteTokens / activeModel.maxContext) * 100}%` }}
                className="bg-blue-500"
                title={`缓存写入: ${tokenMetrics.cacheWriteTokens} tok`}
              />
              <div
                style={{ width: `${(tokenMetrics.inputTokens / activeModel.maxContext) * 100}%` }}
                className="bg-[var(--cds-fill-brand,#d97757)]"
                title={`输入 Token: ${tokenMetrics.inputTokens} tok`}
              />
              <div
                style={{ width: `${(tokenMetrics.outputTokens / activeModel.maxContext) * 100}%` }}
                className="bg-purple-500"
                title={`输出 Token: ${tokenMetrics.outputTokens} tok`}
              />
            </div>

            {/* 资费细分图例 */}
            <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px] text-[var(--cds-text-muted,#8c8c8c)]">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>缓存命中读取: {tokenMetrics.cacheReadTokens.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-blue-500" />
                <span>缓存写入: {tokenMetrics.cacheWriteTokens.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[var(--cds-fill-brand,#d97757)]" />
                <span>普通输入: {tokenMetrics.inputTokens.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-purple-500" />
                <span>模型输出: {tokenMetrics.outputTokens.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
