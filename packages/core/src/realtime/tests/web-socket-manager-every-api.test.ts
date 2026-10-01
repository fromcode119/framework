import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { HookManager } from '@core/hooks/hook-manager';
import { RequestContextUtils } from '@core/context/request-context';
import { TenantMode } from '@core/tenant/tenant-mode';
import { WebSocketManager } from '@core/realtime/web-socket-manager';
import { ProcessSignals } from '@core/signals/process-signals';
import { ProcessSignal } from '@core/signals/enums/process-signal.enum';

/** An admin's socket lives in one api process; the write that produced an event may happen in another. */
describe('a live event with several api processes', () => {
  const workers = process.env.API_WORKERS;
  afterEach(() => {
    vi.restoreAllMocks();
    TenantMode.reset();
    if (workers === undefined) delete process.env.API_WORKERS; else process.env.API_WORKERS = workers;
  });

  const withSockets = () => {
    const manager = new WebSocketManager(new HookManager());
    const s1 = { readyState: WebSocket.OPEN, send: vi.fn() };
    const s2 = { readyState: WebSocket.OPEN, send: vi.fn() };
    (manager as any).clients.set(s1, { tenantId: 'site-1' });
    (manager as any).clients.set(s2, { tenantId: 'site-2' });
    return { manager, s1, s2 };
  };

  it('is passed on to the other api processes, with the site it belongs to', () => {
    process.env.API_WORKERS = '3';
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    const announce = vi.spyOn(ProcessSignals, 'announce');
    const { manager, s1, s2 } = withSockets();
    RequestContextUtils.storage.run({ tenantId: 'site-1' } as any, () => manager.broadcast('collection:orders:created', { id: 1 }));
    expect(s1.send).toHaveBeenCalledTimes(1);
    expect(s2.send).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith(ProcessSignal.REALTIME_BROADCAST, expect.objectContaining({ tenantId: 'site-1' }));
  });

  it('one passed on from another api process reaches only this process\'s sockets of that site', () => {
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    const { s1, s2 } = withSockets();
    (ProcessSignals as any).receive(JSON.stringify({ origin: 'another-api-process', signal: String(ProcessSignal.REALTIME_BROADCAST.value), payload: { data: '{"type":"x"}', tenantId: 'site-2' } }));
    expect(s2.send).toHaveBeenCalledWith('{"type":"x"}');
    expect(s1.send).not.toHaveBeenCalled();
  });

  it('a single api process tells nobody', () => {
    delete process.env.API_WORKERS;
    TenantMode.configure({ tenantCount: 2, dialect: 'postgres', isolationSupported: true });
    const announce = vi.spyOn(ProcessSignals, 'announce');
    const { manager } = withSockets();
    RequestContextUtils.storage.run({ tenantId: 'site-1' } as any, () => manager.broadcast('realtime:x', {}));
    expect(announce).not.toHaveBeenCalledWith(ProcessSignal.REALTIME_BROADCAST, expect.anything());
  });
});
