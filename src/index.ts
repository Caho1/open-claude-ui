/**
 * Open Claude UI (open-claude-ui)
 * React components and interaction utilities for the Claude Design System (CDS).
 * High-fidelity components, physics-based motion presets, and architectural hooks.
 */

// 1. Foundational Atoms & Controls
export * from '../code-examples/CdsButton';
export * from '../code-examples/SegmentedControl';
export * from '../code-examples/StatusIndicators';
export * from '../code-examples/ConfirmationDialog';
export * from '../code-examples/AttachmentCard';

// 2. Chat Stream & Composer Engine
export * from '../code-examples/ChatComposer';
export * from '../code-examples/ChatMessageBubbles';
export * from '../code-examples/ThinkingAccordion';
export * from '../code-examples/RichComposerWithMentions';
export * from '../code-examples/ModelSwitcherWithTokenGauge';
export * from '../code-examples/McpToolDecisionCard';

// 3. Motion Physics, Shaders & Shading
export * from '../code-examples/ClaudeMotionPresets';
export * from '../code-examples/ReasoningAmbientGlow';
export * from '../code-examples/ScrollFadeContainer';

// 4. Audiovisual & Artifacts Experience
export * from '../code-examples/ClaudeAudioPlayer';
export * from '../code-examples/LiveMicActivityBars';
export * from '../code-examples/MediaLightboxViewer';
export * from '../code-examples/useClaudeSharedElementTransition';
export * from '../code-examples/ArtifactsSplitPaneResizer';
export * from '../code-examples/EpitaxyIframeBridge';
export * from '../code-examples/StreamingDiffViewer';
export * from '../code-examples/CodeBlock';

// 5. Desktop Host Architecture & Multi-Agent Topology
export * from '../code-examples/createClaudeMainWindow';
export * from '../code-examples/ClaudeDesktopHeader';
export * from '../code-examples/DraggableSessionList';
export * from '../code-examples/CoworkAgentCanvas';
export * from '../code-examples/useClaudeScrollPinning';
export * from '../code-examples/ContainerResponsiveBar';
export * from '../code-examples/useClaudeRovingFocus';
export * from '../code-examples/useRateLimitBackoff';
