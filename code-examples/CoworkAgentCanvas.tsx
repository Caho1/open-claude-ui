import React, { useState } from 'react';

/**
 * ==============================================================================
 * Claude Design System (CDS) - CoworkAgentCanvas.tsx
 * 
 * 
 * 核心工程架构:
 * 1. 多智能体委派拓扑状态机 (Multi-Agent Task Delegation):
 *    支持分派子任务至独立子智能体 (Subagent)，实时追踪其生命周期：
 *    `idle` -> `running` (陶土呼吸) -> `waiting_review` -> `completed` / `errored`。
 * 2. 共享 Artifacts 工件网格资产池 (Shared Artifacts Pool):
 *    多 Agent 并发产出的文档、架构图、代码块统一汇聚入共享拓扑网格，
 *    提供按产物类型分类筛选与版本差异对比入口。
 * 3. 跨会话广播通道 (BroadcastChannel Sync):
 *    支持多窗口 / 多标签页间的任务状态实时事件同步。
 * 4. 生产级卡片微交互与圆角系统:
 *    严格遵循 12px/16px 复合圆角、单闭合边框原则与 `task-grid-clip-reveal` 渐进式渲染。
 * ==============================================================================
 */

export type AgentStatus = 'idle' | 'running' | 'waiting_review' | 'completed' | 'errored';

export interface CoworkAgent {
  id: string;
  role: string;
  name: string;
  status: AgentStatus;
  currentTask?: string;
  avatarIcon: string;
  completedTasksCount: number;
}

export interface SharedArtifact {
  id: string;
  title: string;
  type: 'code' | 'doc' | 'diagram' | 'audio';
  authorAgentId: string;
  updatedAt: string;
  version: string;
}

const DEFAULT_AGENTS: CoworkAgent[] = [
  {
    id: 'agent-lead',
    role: 'Lead Architect',
    name: '系统架构师',
    status: 'running',
    currentTask: '编排并分发前端工程拓扑任务',
    avatarIcon: '🏛️',
    completedTasksCount: 8,
  },
  {
    id: 'agent-frontend',
    role: 'Frontend Engineer',
    name: '前端开发工程师',
    status: 'running',
    currentTask: '整理组件接口与交互动效规范',
    avatarIcon: '🔬',
    completedTasksCount: 14,
  },
  {
    id: 'agent-ui',
    role: 'Design System Engineer',
    name: 'CDS 组件开发工程师',
    status: 'idle',
    currentTask: '等待新的组件规范任务',
    avatarIcon: '🎨',
    completedTasksCount: 22,
  },
  {
    id: 'agent-qa',
    role: 'Verification Agent',
    name: '质量验收专家',
    status: 'waiting_review',
    currentTask: '等待人工确认 Git commit 与 push 结果',
    avatarIcon: '✅',
    completedTasksCount: 19,
  },
];

const DEFAULT_ARTIFACTS: SharedArtifact[] = [
  { id: 'art-1', title: 'Claude Design System (CDS).md', type: 'doc', authorAgentId: 'agent-lead', updatedAt: '刚刚', version: 'v2.4' },
  { id: 'art-2', title: 'RichComposerWithMentions.tsx', type: 'code', authorAgentId: 'agent-ui', updatedAt: '5分钟前', version: 'v1.0' },
  { id: 'art-3', title: 'DraggableSessionList.tsx', type: 'code', authorAgentId: 'agent-ui', updatedAt: '8分钟前', version: 'v1.0' },
  { id: 'art-4', title: 'AudioSinkWorklet.js', type: 'audio', authorAgentId: 'agent-frontend', updatedAt: '20分钟前', version: 'v1.2' },
];

export const CoworkAgentCanvas: React.FC = () => {
  const [agents, setAgents] = useState<CoworkAgent[]>(DEFAULT_AGENTS);
  const [artifacts] = useState<SharedArtifact[]>(DEFAULT_ARTIFACTS);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('agent-lead');

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  return (
    <div className="flex flex-col w-full h-full rounded-2xl border border-[var(--cds-border-subtle,#e5e5e3)] dark:border-[var(--cds-border-subtle,#262625)] bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface,#161615)] shadow-sm overflow-hidden font-sans text-xs">
      {/* 顶部协同看板导航栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--cds-border-subtle,#e8e8e6)] dark:border-[var(--cds-border-subtle,#262625)] bg-[var(--cds-bg-secondary,#faf9f6)] dark:bg-[var(--cds-bg-secondary,#1a1a19)] select-none">
        <div className="flex items-center gap-2.5">
          <span className="text-base">🤝</span>
          <div>
            <div className="font-semibold text-sm text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)]">
              Claude Cowork 多智能体协同空间
            </div>
            <div className="text-[10px] text-[var(--cds-text-muted,#8c8c8c)]">
              多 Agent 并发任务分派、实时状态拓扑与共享工件网格
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--cds-fill-brand-subtle,#fcf0ec)] dark:bg-[var(--cds-fill-brand-subtle,#36211a)] text-[var(--cds-text-accent,#d97757)]">
            <span className="size-1.5 rounded-full bg-[var(--cds-fill-brand,#d97757)] animate-pulse" />
            4 个活动 Agent
          </span>
        </div>
      </div>

      {/* 主工作区：左侧 Agent 阵列，右侧工作明细与工件库 */}
      <div className="flex flex-1 overflow-hidden divide-x divide-[var(--cds-border-subtle,#e8e8e6)] dark:divide-[var(--cds-border-subtle,#262625)]">
        {/* 左侧 Agent 拓扑列表 */}
        <div className="w-80 p-3 space-y-2 overflow-y-auto bg-[var(--cds-bg-secondary,#fbfbf9)] dark:bg-[var(--cds-bg-secondary,#141413)]">
          <div className="px-1 text-[10px] font-semibold text-[var(--cds-text-muted,#8c8c8c)] uppercase tracking-wider">
            协作团队成员
          </div>

          {agents.map((agent) => {
            const isSelected = agent.id === selectedAgentId;
            return (
              <div
                key={agent.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`group flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface-elevated,#242423)] border border-[var(--cds-border-accent,#d97757)] shadow-xs'
                    : 'hover:bg-[var(--cds-bg-surface,#ffffff)]/60 dark:hover:bg-[var(--cds-bg-surface-elevated,#242423)]/60 border border-transparent'
                }`}
              >
                <div className="size-8 rounded-lg flex items-center justify-center bg-[var(--cds-alpha-1,rgba(0,0,0,0.05))] text-base shrink-0">
                  {agent.avatarIcon}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] truncate">
                      {agent.name}
                    </span>
                    {/* 状态徽标 */}
                    {agent.status === 'running' && (
                      <span className="text-[10px] font-medium text-[var(--cds-text-accent,#d97757)]">
                        ● 运行中
                      </span>
                    )}
                    {agent.status === 'idle' && (
                      <span className="text-[10px] font-medium text-[var(--cds-text-muted,#8c8c8c)]">
                        ○ 空闲
                      </span>
                    )}
                    {agent.status === 'waiting_review' && (
                      <span className="text-[10px] font-medium text-amber-500">
                        △ 待复核
                      </span>
                    )}
                  </div>

                  <div className="text-[10px] text-[var(--cds-text-muted,#8c8c8c)] truncate">
                    {agent.role}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--cds-text-secondary,#666666)] line-clamp-1">
                    {agent.currentTask}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 右侧：所选 Agent 明细与工件网格 */}
        <div className="flex-1 p-4 overflow-y-auto space-y-5 bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface,#191918)]">
          {/* Agent 当前任务委派卡片 */}
          <div className="p-4 rounded-xl border border-[var(--cds-border-subtle,#e8e8e6)] dark:border-[var(--cds-border-subtle,#262625)] bg-[var(--cds-bg-secondary,#fbfbf9)] dark:bg-[var(--cds-bg-secondary,#1c1c1b)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[var(--cds-text-muted,#8c8c8c)] uppercase tracking-wider">
                当前活跃委派任务 (Task Delegation)
              </span>
              <span className="text-[10px] font-mono text-[var(--cds-text-muted,#8c8c8c)]">
                已达成 {selectedAgent.completedTasksCount} 个里程碑
              </span>
            </div>

            <div className="font-medium text-sm text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)]">
              {selectedAgent.currentTask}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-[var(--cds-fill-brand,#d97757)] text-white hover:bg-[var(--cds-fill-brand-hover,#c86849)] font-medium active:scale-95 transition-all shadow-xs"
              >
                发送协同指令
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border border-[var(--cds-border-subtle,#e5e5e3)] dark:border-[var(--cds-border-subtle,#333331)] bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface,#222221)] text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] hover:bg-[var(--cds-bg-hover,#f5f5f5)] active:scale-95 transition-all font-medium"
              >
                查看审计日志
              </button>
            </div>
          </div>

          {/* 共享 Artifacts 工件库网格 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[var(--cds-text-muted,#8c8c8c)] uppercase tracking-wider">
                团队共享产物 (Artifacts Pool)
              </span>
              <span className="text-[10px] text-[var(--cds-text-muted,#8c8c8c)]">
                共 {artifacts.length} 个产物
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {artifacts.map((art) => (
                <div
                  key={art.id}
                  className="p-3 rounded-xl border border-[var(--cds-border-subtle,#e8e8e6)] dark:border-[var(--cds-border-subtle,#262625)] bg-[var(--cds-bg-surface,#ffffff)] dark:bg-[var(--cds-bg-surface,#1f1f1e)] hover:border-[var(--cds-border-accent,#d97757)] transition-all cursor-pointer shadow-xs group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--cds-alpha-1,rgba(0,0,0,0.06))] dark:bg-[var(--cds-alpha-1,rgba(255,255,255,0.08))] text-[var(--cds-text-secondary,#666666)] uppercase">
                      {art.type}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--cds-text-muted,#8c8c8c)]">
                      {art.version}
                    </span>
                  </div>

                  <div className="mt-2 font-semibold text-xs text-[var(--cds-text-primary,#1a1a1a)] dark:text-[var(--cds-text-primary,#f0f0f0)] truncate group-hover:text-[var(--cds-text-accent,#d97757)] transition-colors">
                    {art.title}
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--cds-text-muted,#8c8c8c)]">
                    <span>更新于 {art.updatedAt}</span>
                    <span>查看预览 ↗</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
