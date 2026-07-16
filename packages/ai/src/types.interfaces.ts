import type { AssistantRole, AssistantAction, AssistantTrace } from './types.types';

export interface AssistantMessage {
  role: AssistantRole;
  content: string;
  actions?: AssistantAction[];
  actionBatch?: {
    id: string;
    state: 'staged' | 'previewed' | 'applied' | 'stale';
    createdAt: number;
  };
  model?: string;
  provider?: string;
  iterations?: number;
  loopCapReached?: boolean;
  traces?: AssistantTrace[];
  execution?: {
    dryRun?: boolean;
    results?: any[];
  };
}

export interface AssistantSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AssistantMessage[];
}

export interface AssistantChatParams {
  messages: AssistantMessage[];
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** EU AI Act: the feature invoking the model (e.g. 'mlm.retention_insight') — recorded for the audit log. */
  purpose?: string;
  /** EU AI Act risk classification for this call. Default 'limited' (AI interacting with a natural person). */
  riskTier?: 'minimal' | 'limited' | 'high';
}

export interface AssistantChatResponse {
  content: string;
  model: string;
  usage?: any;
  raw?: any;
  /** EU AI Act transparency metadata stamped by the compliance wrapper (disclosure + risk tier + log time). */
  aiAct?: {
    disclosure: string;
    riskTier: 'minimal' | 'limited' | 'high';
    loggedAt: string;
  };
}

export interface AssistantClient {
  chat: (params: AssistantChatParams) => Promise<AssistantChatResponse>;
}

/**
 * EU AI Act Art. 12 record-keeping entry — one row per model invocation. Prompt/response TEXT is never
 * included (privacy-preserving); only structural metrics + classification. Written to a framework-owned,
 * retained, queryable sink so an admin/regulator can review every income-adjacent AI interaction.
 */
export interface AiActAuditEntry {
  provider: string;
  model: string;
  purpose: string;
  riskTier: 'minimal' | 'limited' | 'high';
  ok: boolean;
  ms: number;
  promptChars: number;
  responseChars: number;
  error?: string;
}

/** Sink the framework injects at boot to persist {@link AiActAuditEntry} rows. */
export type AiActAuditSink = (entry: AiActAuditEntry) => void;

