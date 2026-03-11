import type { Request, Response } from 'express';
import type { PluginManager, ThemeManager } from '@fromcode119/core';
import type { IDatabaseManager } from '@fromcode119/database';
import type { AdminAssistantRuntime } from '@fromcode119/ai';
import type { AssistantManagementToolsService } from '../forge/management-tools-service';
import type { AssistantSessionStore } from '../forge/session-store';
import type { AssistantCatalogService } from '../forge/catalog-service';
import type { AssistantRuntimeFactoryService } from '../forge/runtime-factory-service';
import type { AssistantRequestPayloadService } from '../forge/request-payload-service';
import type { EnhancedContextManager } from '../forge/enhanced-context-manager';
import type { ReasoningChainTracker } from '../forge/reasoning-chain-tracker';
import type { IntelligentToolSelector } from '../forge/intelligent-tool-selector';
import type { TaskComplexityDetector } from '../forge/task-complexity-detector';

/** Dependencies bundle passed to controller helper handlers. */
export interface ControllerDeps {
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
  prepareContextForLLM: (sessionId: string | undefined, history: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) => Promise<Array<{ role: 'system' | 'user' | 'assistant'; content: string }>>;
  restoreSessionContext: (sessionId: string, session: any) => Promise<EnhancedContextManager>;
  resolveAssistantClientFromRequest: (req: Request) => Promise<{ client: any; provider: string }>;
  createAssistantRuntime: (req: Request, aiClient?: any) => any;
  setAssistantDeprecationHeaders: (res: Response, replacementPath: string) => void;
  trimTrailingSlash: (value: string) => string;
}
