import { EventEmitter } from 'node:events';
import { vi } from 'vitest';
import { Logger, RequestServerTiming } from '@fromcode119/core';
import { RequestLoggerMiddleware } from '@api/middlewares/request-logger-middleware';
import { ApiConfig } from '@api/config/api-config';

describe('RequestLoggerMiddleware — the api access log', () => {
  const run = (originalUrl: string, statusCode: number, user?: { id: number; email: string }) => {
    const info = vi.spyOn(Logger.prototype, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const res = Object.assign(new EventEmitter(), { statusCode });
    const req = { method: 'GET', originalUrl, headers: { 'x-forwarded-host': 'shop.example' }, user };
    const next = vi.fn();
    new RequestLoggerMiddleware().middleware()(req as any, res as any, next);
    res.emit('finish');
    const lines = [...info.mock.calls, ...warn.mock.calls].map((call) => String(call[0]));
    const result = { next, lines, info: info.mock.calls.length, warn: warn.mock.calls.length };
    info.mockRestore();
    warn.mockRestore();
    return result;
  };

  it('writes one line per finished response with host, method, path, status, duration and user id', () => {
    const { next, lines, info } = run('/api/collections/pages', 200, { id: 7, email: 'person@example.com' });
    expect(next).toHaveBeenCalledOnce();
    expect(info).toBe(1);
    expect(lines[0]).toMatch(/^shop\.example GET \/api\/collections\/pages 200 \d+ms user=7$/);
    expect(lines[0]).not.toContain('person@example.com');
  });

  it('never writes the query string', () => {
    const { lines } = run('/api/search?email=person@example.com&token=abc', 200);
    expect(lines[0]).toContain('GET /api/search 200');
    expect(lines[0]).not.toMatch(/email|token|\?/);
  });

  it('logs a server error at warn', () => {
    const { info, warn } = run('/api/boom', 503);
    expect(info).toBe(0);
    expect(warn).toBe(1);
  });

  it('skips liveness and readiness probes', () => {
    const { next, lines } = run(`/api${ApiConfig.getInstance().probeRoutes.HEALTH}`, 200);
    expect(next).toHaveBeenCalledOnce();
    expect(lines).toEqual([]);
  });

  const timed = (elapsedMs: number) => {
    const info = vi.spyOn(Logger.prototype, 'info').mockImplementation(() => {});
    const clock = vi.spyOn(process.hrtime, 'bigint').mockReturnValueOnce(0n).mockReturnValueOnce(BigInt(elapsedMs) * 1_000_000n);
    const res = Object.assign(new EventEmitter(), { statusCode: 200, locals: { [RequestServerTiming.LOCALS_KEY]: 'plugin-handler;dur=1400.0, api-total;dur=1450.2' } });
    new RequestLoggerMiddleware().middleware()({ method: 'GET', originalUrl: '/api/plugins/demo/me', headers: { host: 'site.example' }, user: { id: 3 } } as any, res as any, vi.fn());
    res.emit('finish');
    const line = String(info.mock.calls[0]?.[0]);
    info.mockRestore();
    clock.mockRestore();
    return line;
  };

  it('says where the time of a slow response went, for a signed-in caller too', () => {
    expect(timed(1500)).toBe('site.example GET /api/plugins/demo/me 200 1500ms user=3 timing=plugin-handler;dur=1400.0, api-total;dur=1450.2');
  });

  it('keeps a fast response to its one short line', () => {
    expect(timed(40)).toBe('site.example GET /api/plugins/demo/me 200 40ms user=3');
  });
});
