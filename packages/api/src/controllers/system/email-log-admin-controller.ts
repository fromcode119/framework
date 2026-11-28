import { Request, Response } from 'express';
import { BaseController, CoercionUtils, EmailGateway, Logger, SystemConstants } from '@fromcode119/core';
import { EmailLogOverviewService } from '@api/services/system/email-log-overview-service';
import { EmailCatalogService } from '@api/services/system/email-catalog-service';

/**
 * HTTP for the Emails page: what mail this scope sent, one email, and "send it again".
 *
 * Inside a site, that site's own mail; the platform scope, which the router opens to platform admins
 * only, reads the platform's.
 */
export class EmailLogAdminController extends BaseController {
  private readonly logger = new Logger({ namespace: 'email-log-admin' });
  private readonly overview: EmailLogOverviewService;
  private readonly catalogService: EmailCatalogService;

  constructor(private readonly manager: any) {
    super();
    this.overview = new EmailLogOverviewService(manager.db);
    const translate = (key: string, fallback: string) => manager.i18n?.translateOrFallback?.(key, fallback) ?? fallback;
    this.catalogService = new EmailCatalogService(manager.db, translate);
  }

  async catalog(req: Request, res: Response): Promise<void> {
    try {
      res.json({ templates: await this.read(req, () => this.catalogService.list()) });
    } catch (error) {
      this.logger.error('Reading the email catalog failed', error);
      res.status(500).json({ error: 'emails_unavailable' });
    }
  }

  async preview(req: Request, res: Response): Promise<void> {
    try {
      const preview = await this.catalogService.preview(CoercionUtils.toString(req.params.template));
      if (!preview) {
        res.status(404).json({ error: 'email_template_not_found' });
        return;
      }
      res.json({ preview });
    } catch (error) {
      this.logger.error('Drawing the email failed', error);
      res.status(502).json({ error: 'email_preview_failed', message: error instanceof Error ? error.message : String(error) });
    }
  }

  /** Draw one email with its example data and send it to the signed-in operator — and only to them. */
  async test(req: Request, res: Response): Promise<void> {
    try {
      const id = CoercionUtils.toString(req.params.template);
      const to = String((req as any).user?.email || '').trim();
      const entry = EmailCatalogService.entry(id);
      const preview = await this.catalogService.preview(id);
      if (!entry || !preview) {
        res.status(404).json({ error: 'email_template_not_found' });
        return;
      }
      if (!to) {
        res.status(409).json({ error: 'no_address', message: 'Your account has no email address to send the test to.' });
        return;
      }
      await this.manager.integrations.email.send({
        to, subject: preview.subject, html: preview.html, text: preview.text,
        sender: entry.sender || undefined, template: entry.id, category: entry.category || undefined,
      });
      res.json({ ok: true, to });
    } catch (error) {
      this.logger.error('Sending the test email failed', error);
      res.status(502).json({ error: 'email_test_failed', message: error instanceof Error ? error.message : String(error) });
    }
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
      res.json({ scope: EmailLogAdminController.tenantOf(req) ? 'site' : 'platform', ...result, bounceMailbox: await this.bounceMailbox() });
    } catch (error) {
      this.logger.error('Reading the email log failed', error);
      res.status(500).json({ error: 'emails_unavailable' });
    }
  }

  async suppressions(req: Request, res: Response): Promise<void> {
    try {
      const address = CoercionUtils.toString(req.query.address);
      res.json({ suppressions: await this.read(req, () => this.overview.suppressions(address)) });
    } catch (error) {
      this.logger.error('Reading the do-not-email list failed', error);
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

  /**
   * Whether this scope's bounce mailbox is set (Settings → Integrations → Email) and how its last read
   * went — so the page never implies that bounces are being tracked when they are not.
   */
  private async bounceMailbox(): Promise<Record<string, unknown>> {
    const configs: any[] = await this.manager.integrations.resolveMany('email').catch(() => []);
    const configured = configs.some((entry) => EmailGateway.bounceOf(entry?.config ?? {}));
    // Not under the platform marker: `_system_meta` would then answer with every site's row for the key.
    const row = await this.manager.db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.EMAIL_BOUNCE_CURSOR }).catch(() => null);
    let cursor: Record<string, unknown> = {};
    try { cursor = JSON.parse(String(row?.value || '{}')); } catch { cursor = {}; }
    return { configured, readAt: cursor.readAt ?? null, error: cursor.error ?? null, applied: Number(cursor.applied) || 0 };
  }

  /** The router already refused the platform scope to anyone who is not a platform admin. */
  private async read<T>(req: Request, work: () => Promise<T>): Promise<T> {
    return EmailLogAdminController.tenantOf(req) ? work() : this.manager.db.withPlatformAdmin(work);
  }

  private static tenantOf(req: Request): string {
    return String((req as any).tenantId || '').trim();
  }
}
