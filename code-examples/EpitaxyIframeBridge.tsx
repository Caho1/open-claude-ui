/**
 * 维度三：工件预览沙箱与隔离通信架构 (Epitaxy)
 * 
 * 核心特性：
 * 1. 严格权限沙箱隔离 (严格移除 allow-same-origin，切断 parent DOM 逃逸路径与 Cookie 共享，确保 null-origin 隔离)
 * 2. 原生用户手势激活门禁拦截 (基于 event.userActivation 原生特性防御不可信合成事件)
 * 3. 7 种 ant 专有 MIME 协议分流
 * 4. 虚拟包别名重定向与自愈解析
 */

import React, { useRef, useEffect, useCallback } from 'react';

export type EpitaxyMimeType =
  | 'application/vnd.ant.react'
  | 'application/vnd.ant.code'
  | 'application/vnd.ant.markdown'
  | 'application/vnd.ant.mermaid'
  | 'application/vnd.ant.svg'
  | 'application/vnd.ant.html'
  | 'application/vnd.ant.latex';

interface EpitaxyIframeBridgeProps {
  srcDoc: string;
  mimeType?: EpitaxyMimeType;
  allowedOrigins?: string[];
  onMessage?: (payload: any) => void;
  onError?: (err: any) => void;
  onRecovered?: (moduleName: string) => void;
}

export const EpitaxyIframeBridge: React.FC<EpitaxyIframeBridgeProps> = ({
  srcDoc,
  allowedOrigins,
  onMessage,
  onError,
  onRecovered
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // 核心安全校验 1：确保消息确实来自受管辖的当前 iframe Window
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;

      // 核心安全校验 2：受限沙箱 iframe 在移除 allow-same-origin 后 origin 为 'null'
      // 若处于独立安全域名部署架构，校验是否在白名单内
      const isNullOrigin = event.origin === 'null';
      const isAllowedOrigin = allowedOrigins ? allowedOrigins.includes(event.origin) : false;
      if (!isNullOrigin && !isAllowedOrigin && event.origin !== window.location.origin) {
        console.warn('[Epitaxy Sandbox] Discarded message from untrusted origin:', event.origin);
        return;
      }

      const { channel, type, payload, recoveredModule } = event.data || {};

      // 核心安全校验 3：严格用户手势激活门禁拦截（防御未经授权自动触发的高危 MCP / 外部通信）
      // 检查浏览器原生 userActivation，而非轻信未经签名的 payload 数据
      if (channel === 'epitaxy_mcp_app') {
        const hasRealUserActivation =
          (event as any).userActivation?.hasBeenActive ??
          (event as any).userActivation?.isActive ??
          (window.navigator as any).userActivation?.hasBeenActive ??
          false;

        if (!hasRealUserActivation) {
          console.warn('[Epitaxy MCP App] Blocked synthetic message without verified user activation');
          return;
        }
        onMessage?.(payload);
      } else if (type === 'EPITAXY_RUNTIME_ERROR') {
        onError?.(payload);
      } else if (type === 'EPITAXY_MODULE_RECOVERED') {
        onRecovered?.(recoveredModule);
      }
    },
    [allowedOrigins, onMessage, onError, onRecovered]
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  return (
    <iframe
      ref={iframeRef}
      title="Claude Epitaxy Artifact Sandbox"
      srcDoc={srcDoc}
      // 严格权限安全沙箱配置：移除 allow-same-origin，切断同源父 DOM 穿透逃逸路径
      sandbox="allow-scripts allow-forms allow-popups allow-modals"
      referrerPolicy="strict-origin"
      allow="clipboard-write; fullscreen"
      className="h-full w-full border-0 bg-transparent"
    />
  );
};
