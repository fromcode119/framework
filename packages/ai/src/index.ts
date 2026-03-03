export * from './types';
export * from './openai';
export * from './ollama';
export * from './env';
export * from './integration-provider';
export { AdminAssistantRuntime } from './admin-assistant-runtime';
export type {
  AssistantAction as AssistantRuntimeAction,
  AssistantChatInput,
  AssistantChatResult,
  AssistantChatTrace,
  AssistantCollectionContext,
  AssistantExecuteInput,
  AssistantExecuteResult,
  AssistantPlanArtifact,
  AssistantPlanStatus,
  AssistantRunMode,
  AssistantSessionCheckpoint,
  AssistantSettingValue,
  AssistantToolSummary,
  AssistantUiHints,
  AdminAssistantRuntimeOptions,
  AssistantSkillDefinition,
} from './admin-assistant-runtime';

// API routes registration (optional - loaded dynamically if AI extension is active)
export { registerAssistantRoutes, type AssistantRoutesContext } from './api/routes';
