import { AuditOutcome, AuditManager, Logger } from '@fromcode119/core';
import { IMcpAuditRecorder } from '@api/controllers/mcp/interfaces/mcp-audit-recorder.interface';

/**
 * Records every MCP tool call — a log line for the operator tailing the api, AND a persisted row in
 * `_system_audit_logs` so the trail survives the process and is queryable from the admin (the spec's
 * requirement; the logger alone forgot everything on restart).
 *
 * Argument KEYS are recorded, values never are: an argument can hold a customer email, an address or
 * a discount code, and an audit trail that quietly accumulates that becomes its own liability. The
 * keys are enough to answer "what did this token touch, and when".
 */
export class McpAuditRecorder implements IMcpAuditRecorder {
  private static readonly SOURCE = 'mcp';

  constructor(private readonly logger: Logger, private readonly audit: AuditManager) {}

  record(entry: {
    tool: string;
    userId: string;
    argumentKeys: string[];
    ok: boolean;
    dryRun?: boolean;
    error?: string;
  }): void {
    const parts = [
      `tool=${entry.tool}`,
      `user=${entry.userId}`,
      `args=[${entry.argumentKeys.join(',')}]`,
      `ok=${entry.ok}`,
    ];
    if (entry.dryRun) parts.push('dryRun=true');
    if (entry.error) parts.push(`error=${entry.error}`);
    const line = `[mcp] ${parts.join(' ')}`;
    if (entry.ok) this.logger.info(line); else this.logger.warn(line);

    // Fire-and-forget: `logAction` catches its own DB failures, and an audit hiccup must never fail
    // the tool call it describes. Same ALLOWED/VIOLATION mapping the AI extension's audit sink uses.
    void this.audit.logAction(
      McpAuditRecorder.SOURCE,
      'tool.call',
      entry.tool,
      entry.ok ? AuditOutcome.ALLOWED : AuditOutcome.VIOLATION,
      {
        userId: entry.userId,
        argumentKeys: entry.argumentKeys,
        ok: entry.ok,
        dryRun: entry.dryRun || undefined,
        error: entry.error || undefined,
      },
    );
  }
}
