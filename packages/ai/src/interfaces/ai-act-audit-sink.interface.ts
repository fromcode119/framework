import type { IAiActAuditEntry } from '@ai/interfaces/ai-act-audit-entry.interface';

/** Receives AI-Act audit entries (callable contract). */
export interface IAiActAuditSink {
  (entry: IAiActAuditEntry): void;
}
