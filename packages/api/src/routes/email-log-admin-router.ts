import { AuthManager } from '@fromcode119/auth';
import { BaseRouter, RouteConstants } from '@fromcode119/core';
import { EmailLogAdminController } from '@api/controllers/system/email-log-admin-controller';

/**
 * `/system/admin/emails` — the Emails page. Reading is `system:view`, like Jobs; sending an email again
 * mails a real person, so it takes `system:manage`.
 */
export class EmailLogAdminRouter extends BaseRouter {
  private readonly controller: EmailLogAdminController;

  constructor(manager: any, private readonly auth: AuthManager) {
    super();
    this.controller = new EmailLogAdminController(manager);
  }

  protected registerRoutes(): void {
    const S = RouteConstants.SEGMENTS;
    this.get(S.TENANTS_ROOT, this.auth.requirePermission('system:view'), this.controller.list);
    this.get(S.EMAILS_ID, this.auth.requirePermission('system:view'), this.controller.one);
    this.post(S.EMAILS_ID_RESEND, this.auth.requirePermission('system:manage'), this.controller.resend);
  }
}
