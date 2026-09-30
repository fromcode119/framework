import { TenantMode } from '@fromcode119/core';
import { FirstSiteRestart } from '@api/services/tenants/first-site-restart';

/**
 * Sites are decided at boot, so the first one only takes effect after the api starts again. These
 * pin WHEN the api restarts itself: only on the step that brings the first site into being.
 */

const actor = { userId: '1', email: 'owner@example.test' };

function build(sites: number) {
  const scheduleExit = vi.fn(() => ({ scheduled: true, exitInMs: 500 }));
  return { restart: new FirstSiteRestart(async () => sites, scheduleExit), scheduleExit };
}

afterEach(() => TenantMode.reset());

describe('FirstSiteRestart', () => {
  it('restarts the api once the first site exists on a deployment still running without sites', async () => {
    TenantMode.configure({ tenantCount: 0, dialect: 'postgres', isolationSupported: true });
    const { restart, scheduleExit } = build(1);

    expect(await restart.afterSiteAdded(actor)).toEqual({ restarting: true, exitInMs: 500 });
    expect(scheduleExit).toHaveBeenCalledTimes(1);
    expect(String((scheduleExit.mock.calls[0] as unknown[])[0])).toContain('owner@example.test');
  });

  it('does not restart when sites are already on — a second site needs no restart', async () => {
    TenantMode.configure({ tenantCount: 1, dialect: 'postgres', isolationSupported: true });
    const { restart, scheduleExit } = build(2);

    expect(await restart.afterSiteAdded(actor)).toBeNull();
    expect(scheduleExit).not.toHaveBeenCalled();
  });

  it('does not restart when nothing was actually added', async () => {
    TenantMode.configure({ tenantCount: 0, dialect: 'postgres', isolationSupported: true });
    const { restart, scheduleExit } = build(0);

    expect(await restart.afterSiteAdded(actor)).toBeNull();
    expect(scheduleExit).not.toHaveBeenCalled();
  });

  it('reports a restart that could not be scheduled instead of claiming one', async () => {
    TenantMode.configure({ tenantCount: 0, dialect: 'postgres', isolationSupported: true });
    const restart = new FirstSiteRestart(async () => 1, vi.fn(() => ({ scheduled: false, exitInMs: 0 })));

    expect(await restart.afterSiteAdded(actor)).toEqual({ restarting: false, exitInMs: 0 });
  });
});
