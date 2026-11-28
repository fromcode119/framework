import { Request, Response } from 'express';
import { BaseController, CoercionUtils, Logger } from '@fromcode119/core';
import { EmailLogOverviewService } from '@api/services/system/email-log-overview-service';

/**
 * HTTP for the Emails page: what mail this scope sent, one email, and "send it again".
 *
 * Inside a site, that site's own mail; the platform scope, which the router opens to platform admins
 * only, reads the platform's.
 */
export class EmailLogAdminController extends BaseController {
  private readonly logger = new Logger({ namespace: 'email-log-admin' });
  private readonly overview: EmailLogOverviewService;

  constructor(private readonly manager: any) {
    super();
    this.overview = new EmailLogOverviewService(manager.db);
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const q = req.query;
      const result = await this.read(req, () => this.overview.list({
        address: CoercionUtils.toString(q.address),
        status: CoercionUtils.toString(q.status),
        sender: CoercionUtils.toString(q.sender),
        template: CoercionUtils.toString(q.template),
        since: CoercionUtils.toString(q.since),
        until: CoercionUtils.toString(q.until),
        before: EmailLogOverviewService.id(q.before) || undefined,
      }));
      res.json({ scope: EmailLogAdminController.tenantOf(req) ? 'site' : 'platform', ...result });
    } catch (error) {
      this.logger.error('Reading the email log failed', error);
      res.status(500).json({ error: 'emails_unavailable' });
    }
  }

  async one(req: Request, res: Response): Promise<void> {
    try {
      const email = await this.read(req, () => this.overview.one(EmailLogOverviewService.id(req.params.id)));
      if (!email) {
        res.status(404).json({ error: 'email_not_found' });
        return;
      }
      res.json({ email });
    } catch (error) {
      this.logger.error('Reading the email failed', error);
      res.status(500).json({ error: 'emails_unavailable' });
    }
  }

  /**
   * Send a logged email again, exactly as it was, to the same address. Through the same driver as any
   * other mail, so a suppressed address is still refused and the resend is itself a new log row.
   */
  async resend(req: Request, res: Response): Promise<void> {
    try {
      const email = await this.read(req, () => this.overview.one(EmailLogOverviewService.id(req.params.id)));
      if (!email) {
        res.status(404).json({ error: 'email_not_found' });
        return;
      }
      if (!email.html && !email.text) {
        res.status(409).json({ error: 'email_content_removed' });
        return;
      }
      const result = await this.manager.integrations.email.send({
        to: email.to,
        subject: email.subject,
        html: email.html ?? undefined,
        text: email.text ?? undefined,
        category: email.category ?? undefined,
        sender: email.sender ?? undefined,
        template: email.template ?? undefined,
      });
      res.json({ ok: true, skipped: Boolean(result?.skipped) });
    } catch (error) {
      this.logger.error('Sending the email again failed', error);
      res.status(502).json({ error: 'email_resend_failed', message: error instanceof Error ? error.message : String(error) });
    }
  }

  /** The router already refused the platform scope to anyone who is not a platform admin. */
  private async read<T>(req: Request, work: () => Promise<T>): Promise<T> {
    return EmailLogAdminController.tenantOf(req) ? work() : this.manager.db.withPlatformAdmin(work);
  }

  private static tenantOf(req: Request): string {
    return String((req as any).tenantId || '').trim();
  }
}
