import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemRuntimeController } from '@api/controllers/system/system-runtime-controller';
import { TenantMode } from '@fromcode119/core';

/**
 * The journal escalation answered WHO, and never asked WHERE.
 *
 * `/admin/logs` and `/admin/audit` read `_system_logs` / `_system_audit_logs`, which are tenant-scoped
 * by policy. Both controllers escalated whenever the ACCOUNT was a platform admin — and the marker
 * they escalate with (`runAsPlatformAdmin`) passes `tenantId = null`, so it CLEARS the bound site.
 * An operator who had entered a customer's site therefore got, on that site's own dashboard, every
 * other customer's log lines plus the platform's untenanted boot lines. Observed: initech's board
 * showed "Catalog 36, Shipping-adapter 7, Referrals 3" for plugins initech does not run.
 *
 * The whole-container view is a PLATFORM-SCOPE view. Inside a site, the site's own trail is the
 * answer, which is what the policy already returns when nothing escalates.
 */
const PLATFORM_ADMIN = { id: 'u1' };

beforeEach(() => TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true }));
afterEach(() => TenantMode.reset());

const respond = () => {
  const out: any = {};
  return {
    res: {
      json: (body: any) => { out.body = body; return out; },
      status: () => ({ json: (b: any) => { out.body = b; return out; } }),
    } as any,
    out,
  };
};

const controller = () => {
  const seen = { escalated: 0 };
  const runtime = {
    db: {
      // The account IS a platform admin — so the only thing that can withhold the container view
      // here is the scope, which is exactly what is under test.
      findOne: vi.fn(async () => ({ id: 'u1', is_platform_admin: true })),
      withPlatformAdmin: vi.fn(async (fn: () => Promise<unknown>) => { seen.escalated += 1; return fn(); }),
    },
    system: {
      getLogs: vi.fn(async () => ({ docs: [] })),
      getAuditLogs: vi.fn(async () => ({ docs: [] })),
    },
  };
  return { controller: new SystemRuntimeController(runtime as never), seen, runtime };
};

describe('journal reads inside a site', () => {
  it('does not escalate the log feed for a platform admin who is standing in a site', async () => {
    const { controller: subject, seen } = controller();
    const { res } = respond();

    await subject.getLogs({ user: PLATFORM_ADMIN, tenantId: 'initech', query: {} } as never, res);

    expect(seen.escalated).toBe(0);
  });

  it('does not escalate the audit trail either', async () => {
    const { controller: subject, seen } = controller();
    const { res } = respond();

    await subject.getAuditLogs({ user: PLATFORM_ADMIN, tenantId: 'initech', query: {} } as never, res);

    expect(seen.escalated).toBe(0);
  });
});

describe('journal reads in the platform scope', () => {
  it('still reads the whole container for a platform admin with no site bound', async () => {
    const { controller: subject, seen } = controller();
    const { res } = respond();

    await subject.getLogs({ user: PLATFORM_ADMIN, query: {} } as never, res);

    expect(seen.escalated).toBe(1);
  });

  it('still reads the whole audit trail in the platform scope', async () => {
    const { controller: subject, seen } = controller();
    const { res } = respond();

    await subject.getAuditLogs({ user: PLATFORM_ADMIN, query: {} } as never, res);

    expect(seen.escalated).toBe(1);
  });

  it('does not escalate for an account that is not a platform admin', async () => {
    const { controller: subject, seen, runtime } = controller();
    runtime.db.findOne = vi.fn(async () => ({ id: 'u2', is_platform_admin: false }));
    const { res } = respond();

    await subject.getLogs({ user: { id: 'u2' }, query: {} } as never, res);

    expect(seen.escalated).toBe(0);
  });
});
