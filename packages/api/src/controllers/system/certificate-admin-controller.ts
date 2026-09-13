import { Request, Response } from 'express';
import { BaseController, CertificateSource, CertificateValidationError, CoercionUtils, Logger } from '@fromcode119/core';
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

  /** Every served host and its certificate, or one site's hosts when `tenantId` is given. */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = CoercionUtils.toString(req.query?.tenantId ?? '');
      res.json(tenantId ? await this.service.forTenant(tenantId) : await this.service.overview());
    } catch (error) {
      this.fail(res, error);
    }
  }

  async upload(req: Request, res: Response): Promise<void> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const stored = await this.service.upload(
        CoercionUtils.toString(body.host),
        body.certificatePem,
        body.privateKeyPem,
      );
      res.status(201).json(stored.toAdminJson());
    } catch (error) {
      this.fail(res, error);
    }
  }

  async setSource(req: Request, res: Response): Promise<void> {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const source = CertificateSource.find(body.source);
      if (!source) {
        res.status(400).json({ error: 'unknown_certificate_source' });
        return;
      }
      const updated = await this.service.setSource(CoercionUtils.toString(req.params.host), source);
      if (!updated) {
        res.status(404).json({ error: 'certificate_not_found' });
        return;
      }
      res.json(updated.toAdminJson());
    } catch (error) {
      this.fail(res, error);
    }
  }

  async remove(req: Request, res: Response): Promise<void> {
    try {
      const removed = await this.service.remove(CoercionUtils.toString(req.params.host));
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
   * A refusal the operator can act on.
   *
   * A rejected certificate is 422 and carries WHICH refusal it was, because "invalid certificate"
   * sends somebody back to their issuer to re-download both files when only one of them is wrong.
   * The message is never echoed from the pasted material.
   */
  private fail(res: Response, error: unknown): void {
    if (error instanceof CertificateValidationError) {
      res.status(422).json({ error: String(error.reason.value), reasonKey: error.reason.translationKey });
      return;
    }
    const message = error instanceof Error ? error.message : 'Certificate operation failed.';
    this.logger.error(message, error);
    res.status(500).json({ error: message });
  }
}
