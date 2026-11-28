import type { NextFunction, Request, Response } from 'express';
import { AuthManager } from '@fromcode119/auth';
import { BaseRouter, RouteConstants } from '@fromcode119/core';
import { EmailLogAdminController } from '@api/controllers/system/email-log-admin-controller';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';

/**
 * `/system/admin/emails` — the Emails page and the email catalog. Lists and the catalog's example
 * previews are `system:view`, like Jobs. A SENT email's content, sending it again and a test send take
 * `system:manage`: a sent body can hold a live link, and a send mails a real person.
 */
export class EmailLogAdminRouter extends BaseRouter {
  private readonly controller: EmailLogAdminController;

  constructor(manager: any, private readonly auth: AuthManager, private readonly platformAdmin: PlatformAdminGuard) {
    super();
    this.controller = new EmailLogAdminController(manager);
  }

  protected registerRoutes(): void {
    const S = RouteConstants.SEGMENTS;
    // With no site bound the rows are the PLATFORM's own mail — its password resets among them — so
    // that scope is a platform admin's, never any account that merely holds `system:view`.
    const scope = (req: Request, res: Response, next: NextFunction) => (String((req as any).tenantId || '').trim() ? next() : this.platformAdmin.handle(req, res, next));
    this.get(S.TENANTS_ROOT, this.auth.requirePermission('system:view'), scope, this.controller.list);
    this.get(S.EMAILS_CATALOG, this.auth.requirePermission('system:view'), scope, this.controller.catalog);
    this.get(S.EMAILS_CATALOG_PREVIEW, this.auth.requirePermission('system:view'), scope, this.controller.preview);
    this.post(S.EMAILS_CATALOG_TEST, this.auth.requirePermission('system:manage'), scope, this.controller.test);
    this.get(S.EMAILS_SUPPRESSIONS, this.auth.requirePermission('system:view'), scope, this.controller.suppressions);
    this.get(S.EMAILS_ID, this.auth.requirePermission('system:manage'), scope, this.controller.one);
    this.post(S.EMAILS_ID_RESEND, this.auth.requirePermission('system:manage'), scope, this.controller.resend);
  }
}
