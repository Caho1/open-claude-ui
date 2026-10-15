/**
 * 维度六：异常容灾、模型限流与业务状态机
 * 
 * 核心特性：
 * 1. 429 / 503 截断指数退避带 Jitter 抖动: min(max(base, 5000) * 2^(n-1) * (1 ± J), 600000)
 * 2. 连续自动重试 3 次上限保护 (防止雪崩)
 * 3. 动态剩余秒数倒计时
 * 4. 倒计时归零时自动重试通知
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const MIN_DELAY_MS = 5000;    // 5秒基准
const MAX_DELAY_MS = 600000;  // 10分钟封顶上限

interface BackoffState {
  isWaiting: boolean;
  retryAtMs: number | null;
  secondsRemaining: number;
  waitsInARow: number;
  canManualRetry: boolean;
}

export function useRateLimitBackoff(onAutoRetry: () => void) {
  const [state, setState] = useState<BackoffState>({
    isWaiting: false,
    retryAtMs: null,
    secondsRemaining: 0,
    waitsInARow: 0,
    canManualRetry: false
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerBackoff = useCallback((retryAfterHeaderSeconds?: number) => {
    setState((prev) => {
      const nextAttempt = prev.waitsInARow + 1;
      // 允许最多 3 次自动重试，第 4 次触发时停止自动重试，强制要求用户点击手动重试
      if (nextAttempt > 3) {
        return {
          isWaiting: true,
          retryAtMs: null,
          secondsRemaining: 0,
          waitsInARow: nextAttempt,
          canManualRetry: true
        };
      }

      const baseDelay = retryAfterHeaderSeconds ? retryAfterHeaderSeconds * 1000 : MIN_DELAY_MS;
      // Full Jitter 抖动注入 (±15% 随机抖动避免羊群效应)
      const jitter = 0.85 + Math.random() * 0.3;
      // 指数退避增长核心公式
      const computedDelay = Math.min(
        Math.max(baseDelay, MIN_DELAY_MS) * Math.pow(2, nextAttempt - 1) * jitter,
        MAX_DELAY_MS
      );
      const retryAtMs = Date.now() + computedDelay;

      return {
        isWaiting: true,
        retryAtMs,
        secondsRemaining: Math.ceil(computedDelay / 1000),
        waitsInARow: nextAttempt,
        canManualRetry: false
      };
    });
  }, []);

  useEffect(() => {
    if (!state.isWaiting || !state.retryAtMs) return;

    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((state.retryAtMs! - Date.now()) / 1000));
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        setState((prev) => ({ ...prev, isWaiting: false, retryAtMs: null, secondsRemaining: 0 }));
        onAutoRetry();
      } else {
        setState((prev) => ({ ...prev, secondsRemaining: remaining }));
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.isWaiting, state.retryAtMs, onAutoRetry]);

  const resetBackoff = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setState({
      isWaiting: false,
      retryAtMs: null,
      secondsRemaining: 0,
      waitsInARow: 0,
      canManualRetry: false
    });
  }, []);

  return {
    ...state,
    triggerBackoff,
    resetBackoff
  };
}
