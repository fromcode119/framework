import { describe, expect, it, vi } from 'vitest';
import { CertificateAdminController } from '@api/controllers/system/certificate-admin-controller';
import { CertificateAutomationUnavailableError, CertificateRejection, CertificateValidationError } from '@fromcode119/core';

/**
 * `setSource` throws a well-formed, expected refusal when automation cannot run on this deployment
 * (no authority configured, or the gateway isn't terminating TLS) — the UI already hides the control
 * for this, so reaching it is a direct API call, not an operator mistake. It used to fall through
 * `fail()`'s generic branch: 500, logged as a server error, for a request that was entirely correct.
 */
const respond = () => {
  const out: any = { status: 200 };
  const res: any = {
    json: (body: any) => { out.body = body; return res; },
    status: (code: number) => { out.status = code; return res; },
    end: () => res,
  };
  return { res, out };
};

const controllerWith = (setSourceImpl: () => Promise<unknown>) => {
  const service = { setSource: vi.fn(setSourceImpl), hostTenantId: vi.fn(async () => undefined) };
  return new CertificateAdminController(service as never);
};

describe('certificate admin error mapping', () => {
  it('answers a CertificateAutomationUnavailableError with 409, not 500', async () => {
    const controller = controllerWith(async () => {
      throw new CertificateAutomationUnavailableError('This deployment\'s gateway is not terminating TLS.');
    });
    const { res, out } = respond();

    await controller.setSource({ params: { host: 'acme.example' }, body: { source: 'automatic' } } as any, res);

    expect(out.status).toBe(409);
    expect(out.body).toEqual({ error: 'This deployment\'s gateway is not terminating TLS.' });
  });

  it('still answers a CertificateValidationError with 422 and its reason code', async () => {
    const controller = controllerWith(async () => {
      throw new CertificateValidationError(CertificateRejection.HOST_NOT_COVERED, 'acme.example');
    });
    const { res, out } = respond();

    await controller.setSource({ params: { host: 'acme.example' }, body: { source: 'automatic' } } as any, res);

    expect(out.status).toBe(422);
    expect(out.body.error).toBe('host_not_covered');
  });

  it('still answers a genuinely unexpected error with 500', async () => {
    const controller = controllerWith(async () => { throw new Error('database connection lost'); });
    const { res, out } = respond();

    await controller.setSource({ params: { host: 'acme.example' }, body: { source: 'automatic' } } as any, res);

    expect(out.status).toBe(500);
    expect(out.body).toEqual({ error: 'database connection lost' });
  });
});
