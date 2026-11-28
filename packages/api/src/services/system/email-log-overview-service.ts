import { CoercionUtils, SystemConstants } from '@fromcode119/core';

/**
 * What mail went out, as one site or the platform may see it.
 *
 * THE SCOPE DECIDES THE ROWS: the log is a journal, so inside a site the policy narrows every read to
 * that site's mail, and the platform scope sees the platform's own. Nothing here filters by site.
 */
export class EmailLogOverviewService {
  private static readonly PAGE_LIMIT = 100;

  constructor(private readonly db: any) {}

  /** Newest first, filtered by what the operator asked for; every filter is optional and stated. */
  async list(filters: { address?: string; status?: string; sender?: string; template?: string; since?: string; until?: string; before?: number }): Promise<{ emails: Array<Record<string, unknown>>; senders: string[] }> {
    const where: Record<string, unknown> = {};
    if (filters.address) where.to_address = filters.address.trim().toLowerCase();
    if (filters.status) where.status = filters.status;
    if (filters.sender) where.sender = filters.sender === EmailLogOverviewService.PLATFORM ? null : filters.sender;
    if (filters.template) where.template_key = filters.template;
    const created: Record<string, string> = {};
    if (filters.since) created.gte = filters.since;
    if (filters.until) created.lte = filters.until;
    if (Object.keys(created).length) where.created_at = created;
    if (filters.before) where.id = { lt: filters.before };
    const rows = await this.db.find(SystemConstants.TABLE.EMAIL_LOG, {
      where,
      orderBy: { id: 'desc' },
      limit: EmailLogOverviewService.PAGE_LIMIT,
      columns: { id: true, sender: true, template_key: true, category: true, to_address: true, subject: true, status: true, error: true, created_at: true, updated_at: true },
    });
    const groups: Array<Record<string, unknown>> = await this.db.groupCount(SystemConstants.TABLE.EMAIL_LOG, { where: {}, groupBy: ['sender'] });
    const senders = groups.map((group) => String(group?.sender ?? '') || EmailLogOverviewService.PLATFORM).sort();
    return { emails: (rows || []).map((row: any) => EmailLogOverviewService.summary(row)), senders };
  }

  /** One email, with its content when the content is still kept. */
  async one(id: number): Promise<Record<string, unknown> | null> {
    const row = await this.db.findOne(SystemConstants.TABLE.EMAIL_LOG, { id });
    if (!row) return null;
    return {
      ...EmailLogOverviewService.summary(row),
      html: row.html ?? null,
      text: row.text ?? null,
      smtpResponse: row.smtp_response ?? null,
      messageId: row.message_id ?? null,
      schedulerRunId: row.scheduler_run_id ?? null,
      contentRemovedAt: row.content_removed_at ?? null,
    };
  }

  /**
   * Which streams an address is on the do-not-email list for, and since when. Read-only on purpose:
   * an opt-out is the PERSON's to lift (their preferences page), not the operator's.
   */
  async suppressions(address: string): Promise<Array<Record<string, unknown>>> {
    const normalized = address.trim().toLowerCase();
    if (!normalized) return [];
    const rows = await this.db.find(SystemConstants.TABLE.EMAIL_SUPPRESSIONS, { where: { address: normalized }, limit: 100 });
    return (rows || []).map((row: any) => ({ category: row.category, source: row.source || null, createdAt: row.created_at ?? null }));
  }

  /** The value the list's sender filter uses for mail the platform itself sent. */
  static readonly PLATFORM = 'platform';

  static id(value: unknown): number {
    return CoercionUtils.toNumber(value, 0);
  }

  private static summary(row: any): Record<string, unknown> {
    return {
      id: Number(row.id),
      sender: row.sender ?? null,
      template: row.template_key ?? null,
      category: row.category ?? null,
      to: row.to_address,
      subject: row.subject ?? '',
      status: row.status,
      error: row.error ?? null,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    };
  }
}
