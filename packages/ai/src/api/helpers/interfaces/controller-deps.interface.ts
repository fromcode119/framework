import { AssistantRole } from '@ai/enums/assistant-role.enum';
import type { Request, Response } from 'express';
import type { PluginManager, ThemeManager } from '@fromcode119/core';
import type { IDatabaseManager } from '@fromcode119/database';

import type { AssistantManagementToolsService } from '@ai/api/forge/management-tools-service';
import type { AssistantSessionStore } from '@ai/api/forge/session-store';
import type { AssistantCatalogService } from '@ai/api/forge/catalog-service';
import type { AssistantRuntimeFactoryService } from '@ai/api/forge/runtime-factory-service';
import type { AssistantRequestPayloadService } from '@ai/api/forge/request-payload-service';
import type { EnhancedContextManager } from '@ai/api/forge/enhanced-context-manager';
import type { ReasoningChainTracker } from '@ai/api/forge/reasoning-chain-tracker';
import type { IntelligentToolSelector } from '@ai/api/forge/intelligent-tool-selector';
import type { TaskComplexityDetector } from '@ai/api/forge/task-complexity-detector';

/** Dependencies bundle passed to controller helper handlers. */
export interface IControllerDeps {
  db: IDatabaseManager;
  manager: PluginManager;
  themeManager: ThemeManager;
  sessions: AssistantSessionStore;
  catalog: AssistantCatalogService;
  runtimeFactory: AssistantRuntimeFactoryService;
  payloadService: AssistantRequestPayloadService;
  managementTools: AssistantManagementToolsService;
  complexityDetector: TaskComplexityDetector;
  toolSelector: IntelligentToolSelector;
  activeSessions: Map<string, { context: EnhancedContextManager; reasoning: ReasoningChainTracker }>;
  // Utility function references (bound to controller instance)
  getSessionTrackers: (id: string) => { context: EnhancedContextManager; reasoning: ReasoningChainTracker };
  recordReasoningStep: (id: string | undefined, thinking: string, input: Record<string, any>, output: Record<string, any>, confidence?: number) => void;
  getReasoningReport: (id: string | undefined) => string | null;
  emitAssistantTelemetry: (event: string, payload: Record<string, any>) => Promise<void>;
  getStoredAiProviderConfig: (key: string) => Promise<Record<string, any>>;
  normalizeAssistantCheckpoint: (input: any) => any;
  prepareContextForLLM: (sessionId: string | undefined, history: Array<{ role: AssistantRole; content: string }>) => Promise<Array<{ role: AssistantRole; content: string }>>;
  restoreSessionContext: (sessionId: string, session: any) => Promise<EnhancedContextManager>;
  resolveAssistantClientFromRequest: (req: Request) => Promise<{ client: any; provider: string }>;
  createAssistantRuntime: (req: Request, aiClient?: any) => any;
  setAssistantDeprecationHeaders: (res: Response, replacementPath: string) => void;
  trimTrailingSlash: (value: string) => string;
}
