export type AssistantSessionEntityMemory = {
  listing?: {
    collectionSlug: string;
    lastSelectedRowIndex?: number;
    lastSelectedRecordId?: string;
    lastSelectedField?: string;
  };
  factual?: {
    tool: string;
    input?: Record<string, any>;
    rangeLabel?: string;
    rangeFrom?: string;
    rangeTo?: string;
    currency?: string;
    primaryMetricPath?: string;
    metrics?: Array<{ path: string; value: string | number | boolean }>;
  };
};

export type AssistantSessionCheckpoint = {
  resumePrompt: string;
  reason: 'loop_cap' | 'time_cap' | 'user_continue' | 'clarification_needed' | 'loop_recovery';
  stage?: 'classify' | 'retrieve' | 'plan' | 'clarify' | 'finalize';
  planningPassesUsed?: number;
  memory?: AssistantSessionEntityMemory;
};

export type AssistantActionBatch = {
  id: string;
  state: 'staged' | 'previewed' | 'applied' | 'stale';
  createdAt: number;
};
