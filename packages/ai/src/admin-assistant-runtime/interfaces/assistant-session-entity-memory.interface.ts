export interface IAssistantSessionEntityMemory {
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
}
