/**
 * Claude Design System (CDS) - Code Block & Copy Decay
 * 
 * 核心规范：
 *   - 外壳：严格 12px 圆角 (rounded-xl)，#0d0d0c 纯黑底色，1px 发丝边框
 *   - 头部工具栏：高度 36px，左侧语言标识行内居中 (.align-[-0.125em])
 *   - 复制状态机：点击后变为绿色勾选，静默展示 2.5 秒后平滑淡退 (saved-check-decay)
 *   - 排版：等宽字体 JetBrains Mono / SF Mono，严格等宽对齐
 */

import React, { useState } from "react";

export interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  className?: string;
}

export function CodeBlock({
  code,
  language = "typescript",
  filename,
  showLineNumbers = false,
  className = "",
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2500); // 2.5s 状态机衰减
  };

  const lines = code.trim().split("\n");

  return (
    <div
      className={`rounded-xl overflow-hidden border border-neutral-800 bg-[#0d0d0c] text-neutral-200 font-mono text-xs shadow-sm my-2 select-text ${className}`}
    >
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-neutral-950/80 border-b border-neutral-800/80 text-[11px] text-neutral-400 select-none">
        <div className="flex items-center gap-2">
          {/* 代码图标 */}
          <span
            className="text-neutral-500 font-mono text-xs"
            style={{ verticalAlign: "-0.125em" }}
          >
            &lt;/&gt;
          </span>
          <span className="font-medium text-neutral-300 lowercase">{language}</span>
          {filename && (
            <>
              <span className="text-neutral-600">•</span>
              <span className="text-neutral-400 font-mono">{filename}</span>
            </>
          )}
        </div>

        {/* 复制按钮与 2.5s 状态机指示器 */}
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-white transition-colors cursor-pointer"
          aria-label="Copy code"
        >
          {copied ? (
            <span
              className="text-emerald-400 flex items-center gap-1 font-sans font-medium"
              style={{
                animation: "saved-check-decay 0.35s cubic-bezier(.165, .84, .44, 1) 2.2s forwards",
              }}
            >
              <span>✓</span>
              <span>Copied!</span>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <span>⧉</span>
              <span>Copy code</span>
            </span>
          )}
        </button>
      </div>

      {/* 代码内容区域 */}
      <div className="p-3.5 overflow-x-auto leading-relaxed text-[13px] text-neutral-300 font-mono">
        {showLineNumbers ? (
          <table className="border-collapse w-full">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-neutral-800/20">
                  <td className="pr-4 text-right text-neutral-600 select-none font-mono text-xs w-8 tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="whitespace-pre">{line}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <pre className="whitespace-pre font-mono m-0">{code}</pre>
        )}
      </div>
    </div>
  );
}
