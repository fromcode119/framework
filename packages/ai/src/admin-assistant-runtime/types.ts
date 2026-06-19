/**
 * Barrel for admin-assistant-runtime types.
 *
 * The declarations were split into cohesive `.types.ts` sibling files by domain
 * to stay under the file line limit; this barrel preserves every original
 * exported type name so existing importers are unaffected.
 */

export type {
  AssistantCollectionContext,
  AssistantPluginContext,
  AssistantThemeContext,
  AssistantAction,
  AssistantToolMetadata,
  AssistantToolSummary,
} from './types-context.types';

export type {
  AssistantWorkspaceMapPlugin,
  AssistantWorkspaceMapTheme,
  AssistantWorkspaceMapCollection,
  AssistantWorkspaceMapTool,
  AssistantWorkspaceMap,
} from './types-workspace.types';

export type {
  AssistantChatTrace,
  AssistantRunMode,
  AssistantSkillRiskPolicy,
  AssistantSkillDefinition,
  AssistantPlanStatus,
  AssistantPlanStep,
  AssistantPlanArtifact,
  AssistantUiHints,
} from './types-plan.types';

export type {
  AssistantSessionEntityMemory,
  AssistantSessionCheckpoint,
  AssistantActionBatch,
} from './types-session.types';

export type {
  AssistantChatResult,
  ProviderCapabilities,
  AssistantExecuteResult,
  AssistantChatInput,
  AssistantExecuteInput,
  AssistantSettingValue,
  AssistantPromptProfile,
  AssistantPromptCopy,
} from './types-result.types';

export type { AdminAssistantRuntimeOptions } from './types-options.types';
