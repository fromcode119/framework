/**
 * How long the platform's journals are kept (Settings → Infrastructure). Part of `SystemConstants.META_KEY`
 * — spread into `SystemMetaKeys.ALL` — and split out only for size.
 */
export class RetentionMetaKeys {
  static readonly ALL = {
    /**
     * Days of `_system_logs` history to keep. Empty or 0 means KEEP FOREVER, and the admin field
     * says so — nothing prunes behind the operator's back. Read by JournalRetentionService.
     */
    LOG_RETENTION_DAYS: 'log_retention_days',
    /**
     * Days of `_system_audit_logs` history to keep. Empty means KEEP FOREVER.
     *
     * SEPARATE FROM `LOG_RETENTION_DAYS`, and floored, because this table is not debug output. It is
     * the security and operator record — denied actions, `settings.update`, `collection.delete`, MCP
     * `tool.call` — and `packages/ai/src/extension.ts` declares it the platform's **EU AI Act Art. 12**
     * record-keeping store for `ai.invoke`. A window shorter than the six months that record is
     * expected to survive would let the platform quietly break a commitment its own code makes, so a
     * value below {@link AUDIT_RETENTION_MIN_DAYS} is REFUSED with the reason rather than clamped.
     */
    AUDIT_RETENTION_DAYS: 'audit_retention_days',
    /**
     * Days of `_system_scheduler_runs` — what each background job did, and when — to keep. Empty or 0
     * means KEEP FOREVER, as the admin field says. Read by JournalRetentionService.
     */
    JOB_RUN_RETENTION_DAYS: 'job_run_retention_days',
  } as const;
}
