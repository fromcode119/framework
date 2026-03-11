export * from './types.types';
export * from './types.interfaces';
export * from './gateways/openai';
export * from './gateways/ollama';
export * from './gateways/anthropic';
export * from './gateways/gemini';
export * from './gateways/integration-provider';
export { AdminAssistantRuntime } from './admin-assistant-runtime';
export { AdminAssistantRuntimeEngine } from './admin-assistant-runtime-engine';
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
  AssistantActionBatch,
  ProviderCapabilities,
  AdminAssistantRuntimeOptions,
  AssistantSkillDefinition,
} from './admin-assistant-runtime/types';

// API routes registration (optional - loaded dynamically if AI extension is active)
export { AssistantRouter } from './api/routes';
export type { AssistantRoutesContext } from './api/routes.interfaces';
