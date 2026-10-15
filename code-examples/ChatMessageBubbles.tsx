/**
 * Claude Design System (CDS) - Message Bubbles (User & Assistant)
 * 
 * 核心规范：
 *   - 用户气泡：严格 18px 圆角 (--cds-message-bubble-radius: 18px)，浅蓝冷灰微调底色 (--cds-bg-tint-blue)
 *   - 模型回答：极简零边框透明画布哲学，自然排版流，行宽约束 max-w-2xl ~ max-w-3xl
 *   - 思考过程折叠器：无闭合边框，左侧极细陶土色引导线 (Thinking Disclosure)
 *   - 复制状态机：2.5 秒自动衰减消退 (saved-check-decay)
 */

import React, { useState } from "react";

// ============================================================================
// 1. 类型定义 (Types)
// ============================================================================

export interface AttachmentPreview {
  name: string;
  size: string;
  type?: string;
}

export interface ArtifactPreview {
  title: string;
  version: string;
  desc?: string;
  type?: string;
}

export interface UserMessageProps {
  id?: string | number;
  text: string;
  time?: string;
  attachment?: AttachmentPreview | null;
  className?: string;
}

export interface AssistantMessageProps {
  id?: string | number;
  text: string;
  time?: string;
  modelName?: string;
  thinkingTime?: string;
  thinkingSteps?: string[];
  codeSnippet?: {
    language: string;
    code: string;
  } | null;
  artifact?: ArtifactPreview | null;
  suggestedChips?: string[];
  onSelectChip?: (chipText: string) => void;
  onOpenArtifact?: (artifact: ArtifactPreview) => void;
  className?: string;
}

// ============================================================================
// 2. 用户提问气泡 (UserMessageBubble)
// ============================================================================

export function UserMessageBubble({
  text,
  time = "Just now",
  attachment,
  className = "",
}: UserMessageProps) {
  return (
    <div className={`flex flex-col items-end space-y-1.5 w-full ${className}`}>
      {/* 时间戳 */}
      {time && (
        <span className="text-[11px] font-mono text-neutral-400 select-none mr-1">
          {time}
        </span>
      )}

      {/* 随附上传的附件芯片 */}
      {attachment && (
        <div className="w-56 p-2 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-800/90 shadow-2xs flex items-center gap-2.5 mb-1 animate-fade">
          <div className="size-8 rounded-lg bg-clay/10 text-clay flex items-center justify-center font-mono text-xs font-bold shrink-0">
            {attachment.type || "DOC"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate">
              {attachment.name}
            </div>
            <div className="text-[10px] text-neutral-400 font-mono">{attachment.size}</div>
          </div>
        </div>
      )}

      {/* 用户气泡：严格 18px 圆角与柔和冷色底 */}
      <div
        className="rounded-[18px] px-4 py-2.5 text-[14.5px] leading-relaxed text-neutral-900 dark:text-neutral-100 max-w-[85%] sm:max-w-[75%] shadow-2xs break-words"
        style={{
          backgroundColor: "var(--cds-bg-tint-blue, #f0f4f8)",
          boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
          animation: "message-fade-up 0.4s cubic-bezier(0.34, 1.3, 0.64, 1)",
        }}
      >
        {text}
      </div>
    </div>
  );
}

// ============================================================================
// 3. 模型回答正文 (AssistantMessageBubble)
// ============================================================================

export function AssistantMessageBubble({
  text,
  time = "Just now",
  modelName = "Sonnet 3.7",
  thinkingTime,
  thinkingSteps,
  codeSnippet,
  artifact,
  suggestedChips,
  onSelectChip,
  onOpenArtifact,
  className = "",
}: AssistantMessageProps) {
  const [isThinkingOpen, setIsThinkingOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    if (!codeSnippet?.code) return;
    navigator.clipboard.writeText(codeSnippet.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500); // 2.5s 状态机衰减
  };

  return (
    <div
      className={`space-y-3.5 max-w-2xl w-full text-neutral-800 dark:text-neutral-200 ${className}`}
      style={{ animation: "message-fade-up 0.45s cubic-bezier(0.34, 1.3, 0.64, 1)" }}
    >
      {/* 头部：Claude Spark 图标 + 模型徽章 + 时间 */}
      <div className="flex items-center gap-2 text-xs text-neutral-400 font-medium select-none">
        <span className="size-5 rounded-md bg-clay text-white flex items-center justify-center text-[10px] shadow-2xs font-serif font-bold">
          ✦
        </span>
        <span className="font-semibold text-neutral-900 dark:text-neutral-100">Claude</span>
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-neutral-200/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
          {modelName}
        </span>
        <span>•</span>
        <span className="font-mono text-[11px]">{time}</span>
      </div>

      {/* 深度思考折叠器 (Thinking Disclosure - 极简左引导线，拒绝闭合框) */}
      {thinkingSteps && thinkingSteps.length > 0 && (
        <div className="rounded-lg transition-colors py-0.5">
          <button
            type="button"
            onClick={() => setIsThinkingOpen(!isThinkingOpen)}
            className="inline-flex items-center gap-2 py-1 px-2 -ml-2 rounded-md cursor-pointer select-none text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors"
          >
            <span className="size-1.5 rounded-full bg-clay" />
            <span className="font-medium">
              Thought for {thinkingTime || "3.2s"}
            </span>
            <span
              className={`text-[10px] text-neutral-400 transition-transform duration-200 ${
                isThinkingOpen ? "rotate-180" : ""
              }`}
            >
              ▾
            </span>
          </button>

          {/* CSS Grid 0fr -> 1fr 伸缩容器 */}
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.19,1,0.22,1)]"
            style={{ gridTemplateRows: isThinkingOpen ? "1fr" : "0fr" }}
          >
            <div className="min-h-0 overflow-hidden pl-3.5 ml-1 mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400 font-mono border-l-2 border-clay/40 dark:border-clay/30 space-y-1">
              {thinkingSteps.map((step, idx) => (
                <div
                  key={idx}
                  className={
                    step.includes("正在") || step.includes("分析") || step.includes("Parsing")
                      ? "text-clay font-medium"
                      : ""
                  }
                >
                  &gt; {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 回答正文：完全无闭合边框，自然舒展排版 */}
      <div className="text-[15px] leading-relaxed text-neutral-800 dark:text-neutral-200 break-words">
        {text}
      </div>

      {/* 代码块与 2.5s 复制衰减状态机 */}
      {codeSnippet && (
        <div className="rounded-xl overflow-hidden border border-neutral-800 bg-[#0d0d0c] text-neutral-200 font-mono text-xs shadow-sm my-2">
          <div className="flex items-center justify-between px-3.5 py-2 bg-neutral-950/80 border-b border-neutral-800 text-[11px] text-neutral-400 select-none">
            <span className="font-medium text-neutral-300">{codeSnippet.language}</span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              {copiedCode ? (
                <span className="text-emerald-400 flex items-center gap-1 font-sans font-medium">
                  ✓ Copied!
                </span>
              ) : (
                <span>Copy code</span>
              )}
            </button>
          </div>
          <pre className="p-3.5 overflow-x-auto leading-relaxed text-[13px] text-neutral-300 font-mono">
            {codeSnippet.code}
          </pre>
        </div>
      )}

      {/* Artifacts 产物展示卡片 */}
      {artifact && (
        <div className="p-3.5 rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-neutral-800/70 shadow-2xs flex items-center justify-between my-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-lg bg-clay/10 text-clay flex items-center justify-center shrink-0 font-mono text-xs font-bold">
              &lt;/&gt;
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                {artifact.title}
              </div>
              <div className="text-[11px] text-neutral-400 font-mono truncate">
                {artifact.version} {artifact.desc ? `• ${artifact.desc}` : ""}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenArtifact?.(artifact)}
            className="h-7 px-3 rounded-lg bg-clay text-white text-xs font-medium hover:bg-clay-hover shadow-2xs flex items-center gap-1.5 transition-all shrink-0 active:scale-95"
          >
            <span>Open Artifact</span>
          </button>
        </div>
      )}

      {/* 建议追问胶囊 (Suggested Chips) */}
      {suggestedChips && suggestedChips.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {suggestedChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectChip?.(chip)}
              className="px-3 py-1 rounded-full border border-neutral-200/80 dark:border-neutral-700/80 bg-neutral-50/80 dark:bg-neutral-800/60 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-xs text-neutral-700 dark:text-neutral-300 transition-colors active:scale-95"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* 底部操作工具栏 */}
      <div className="flex items-center gap-3 pt-1 text-neutral-400 select-none text-xs">
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(text)}
          className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
          title="Copy response"
        >
          Copy
        </button>
        <button
          type="button"
          className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
          title="Good response"
        >
          👍
        </button>
        <button
          type="button"
          className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
          title="Bad response"
        >
          👎
        </button>
      </div>
    </div>
  );
}
