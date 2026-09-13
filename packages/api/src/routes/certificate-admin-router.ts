import { AuthManager } from '@fromcode119/auth';
import { BaseRouter, RouteConstants } from '@fromcode119/core';
import { CertificateAdminController } from '@api/controllers/system/certificate-admin-controller';
import { CertificateAdminService } from '@api/services/certificates/certificate-admin-service';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';

/**
 * `/system/admin/certificates` — reading, uploading and removing TLS certificates.
 *
 * Every route: `admin` role AND platform admin. A certificate is platform infrastructure even when
 * it covers one site's host — the key it comes with lives in a table every site's traffic is served
 * from, and a tenant administrator who could upload one could serve their own certificate for a
 * host, or read the state of everyone else's.
 */
export class CertificateAdminRouter extends BaseRouter {
  private readonly controller: CertificateAdminController;

  constructor(
    service: CertificateAdminService,
    private readonly auth: AuthManager,
    private readonly platformAdmin: PlatformAdminGuard,
  ) {
    super();
    this.controller = new CertificateAdminController(service);
  }

  protected registerRoutes(): void {
    const admin = this.auth.guard(['admin']);
    const platform = this.platformAdmin.middleware();
    const S = RouteConstants.SEGMENTS;
    this.get(S.TENANTS_ROOT, admin, platform, this.controller.list);
    // Before `/:host`, so "platform-addresses" is never read as a hostname.
    this.get(S.CERTIFICATES_PLATFORM_ADDRESSES, admin, platform, this.controller.platformAddresses);
    this.post(S.TENANTS_ROOT, admin, platform, this.controller.upload);
    // `/:host/source` is registered before `/:host` so "source" is never read as a hostname.
    this.put(S.CERTIFICATES_HOST_SOURCE, admin, platform, this.controller.setSource);
    this.delete(S.CERTIFICATES_HOST, admin, platform, this.controller.remove);
  }
}
