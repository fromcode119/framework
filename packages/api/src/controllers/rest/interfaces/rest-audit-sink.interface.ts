import { AuditOutcome } from '@fromcode119/core';

/** Minimal audit sink — matches AuditManager.logAction so api never imports core's class directly. */
export interface IRestAuditSink {
  logAction(pluginSlug: string, action: string, resource: string, status: AuditOutcome, metadata?: any): Promise<void>;
}
