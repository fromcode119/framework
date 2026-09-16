import { Request, Response } from 'express';
import {
  BaseController, CertificateAutomationUnavailableError, CertificateSource, CertificateValidationError, CoercionUtils, Logger,
} from '@fromcode119/core';
import { CertificateAdminService } from '@api/services/certificates/certificate-admin-service';

/**
 * HTTP for the certificate screens. Every route sits behind `auth.guard(['admin'])` AND
 * `PlatformAdminGuard` in the router — certificates are platform infrastructure, and a tenant's own
 * administrator must not be able to read or replace one.
 *
 * NOTHING HERE EVER RETURNS A PRIVATE KEY. The responses are built from `toAdminJson()`, which has
 * no key field to return; that is a property of the record rather than a rule this controller has to
 * remember. A refused upload answers with the REASON CODE, and the admin turns it into a sentence —
 * the copy lives in the locale files like all user-facing text.
 */
export class CertificateAdminController extends BaseController {
  private readonly logger = new Logger({ namespace: 'certificate-admin' });

  constructor(private readonly service: CertificateAdminService) {
    super();
  }

  /**
   * Every served host and its certificate, or one site's hosts when the request asks for one.
   *
   * `PlatformAdminGuard` on this route answers WHO — every caller here is a platform admin. It does
   * not answer WHERE: an operator who has stepped INTO a site is still that role, but the console is
   * headed with that site's name and this list has to match it. `req.tenantId` is what carries WHERE
   * (see `system-runtime-controller.ts`'s `readsWholeContainer` for the identical shape of bug, fixed
   * the same way) — when it is bound, `forTenant` is the answer regardless of any `?tenantId=` query
   * param, because a bound request has no business reading a DIFFERENT site's hosts either. Only an
   * unbound request — the platform-wide `/certificates` screen — still lets the query param pick one
   * site, or falls through to every host on the box.
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const boundTenantId = CoercionUtils.toString((req as any).tenantId ?? '');
      if (boundTenantId) {
        res.json(await this.service.forTenant(boundTenantId));
        return;
      }
      const tenantId = CoercionUtils.toString(req.query?.tenantId ?? '');
      res.json(tenantId ? await this.service.forTenant(tenantId) : await this.service.overview());
    } catch (error) {
      this.fail(res, error);
    }
  }

  /** A suggestion for the addresses setting, resolved on demand. Never stored by this call. */
  async platformAddresses(_req: Request, res: Response): Promise<void> {
    try {
      res.json({ candidates: await this.service.detectPlatformAddresses() });
    } catch (error) {
      this.fail(res, error);
    }
  }

  async upload(req: Request, res: Response): Promise<void> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const host = CoercionUtils.toString(body.host);
      if (!(await this.assertHostInScope(req, res, host))) return;
      const stored = await this.service.upload(host, body.certificatePem, body.privateKeyPem);
      res.status(201).json(stored.toAdminJson());
    } catch (error) {
      this.fail(res, error);
    }
  }

  async setSource(req: Request, res: Response): Promise<void> {
    try {
      const host = CoercionUtils.toString(req.params.host);
      if (!(await this.assertHostInScope(req, res, host))) return;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const source = CertificateSource.find(body.source);
      if (!source) {
        res.status(400).json({ error: 'unknown_certificate_source' });
        return;
      }
      const updated = await this.service.setSource(host, source, {
        dnsWildcard: body.dnsWildcard === true,
      });
      if (!updated) {
        res.status(404).json({ error: 'certificate_not_found' });
        return;
      }
      res.json(updated.toAdminJson());
    } catch (error) {
      this.fail(res, error);
    }
  }

  /** Store or clear the Cloudflare API token. Responds with whether one is now configured, never the value. */
  async setCloudflareToken(req: Request, res: Response): Promise<void> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      res.json(await this.service.setCloudflareToken(body.token));
    } catch (error) {
      this.fail(res, error);
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      const host = CoercionUtils.toString(req.params.host);
      if (!(await this.assertHostInScope(req, res, host))) return;
      const removed = await this.service.remove(host);
      if (!removed) {
        res.status(404).json({ error: 'certificate_not_found' });
        return;
      }
      res.status(204).end();
    } catch (error) {
      this.fail(res, error);
    }
  }

  /**
   * Does a WRITE against `host` stay inside the request's own site, when it is bound to one?
   *
   * The mirror of `list()`'s read-side scoping, for `upload`/`setSource`/`remove`: a bound request
   * (`req.tenantId` truthy — an operator stepped into a site) must not touch a host belonging to a
   * DIFFERENT site, or to no site at all. The owning tenant is resolved server-side via the same
   * `servedHosts()` lookup `list()` already uses — never a client-supplied tenant id, which would let
   * the caller assert its own way past the check.
   *
   * A mismatch answers `certificate_not_found`, the SAME 404 `setSource`/`remove` already use for a
   * host that resolves to nothing at all — so a scoped-out host does not leak its existence, or whose
   * site it belongs to, through a different error shape. An unbound (platform-scope) request is
   * unrestricted, same as today.
   */
  private async assertHostInScope(req: Request, res: Response, host: string): Promise<boolean> {
    const boundTenantId = CoercionUtils.toString((req as any).tenantId ?? '');
    if (!boundTenantId) return true;
    const owner = await this.service.hostTenantId(host);
    if (owner !== boundTenantId) {
      res.status(404).json({ error: 'certificate_not_found' });
      return false;
    }
    return true;
  }

  /**
   * A refusal the operator can act on.
   *
   * A rejected certificate is 422 and carries WHICH refusal it was, because "invalid certificate"
   * sends somebody back to their issuer to re-download both files when only one of them is wrong.
   * The message is never echoed from the pasted material.
   *
   * `CertificateAutomationUnavailableError` is a DIFFERENT kind of expected refusal — nothing was
   * pasted wrong, the deployment itself cannot automate right now (no authority configured, or its
   * gateway isn't terminating TLS). That is a 409, not a 500: the request was well-formed and the
   * server did exactly what it should, so it must not be logged as a server fault.
   */
  private fail(res: Response, error: unknown): void {
    if (error instanceof CertificateValidationError) {
      res.status(422).json({ error: String(error.reason.value), reasonKey: error.reason.translationKey });
      return;
    }
    if (error instanceof CertificateAutomationUnavailableError) {
      res.status(409).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : 'Certificate operation failed.';
    this.logger.error(message, error);
    res.status(500).json({ error: message });
  }
}
