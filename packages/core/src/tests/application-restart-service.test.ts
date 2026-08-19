import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationRestartService } from '@core/management/application-restart-service';
import { InternalServiceAuth } from '@core/security/internal-service-auth';

/**
 * What the api will and will not do on an operator's behalf.
 *
 * The two properties worth guarding are both about NOT acting: it must not send the internal secret to
 * an app this deployment never declared, and it must not report a restart that no Fromcode app
 * confirmed. Everything else is allowed to fail — loudly, with a reason the operator can read.
 */
describe('ApplicationRestartService', () => {
  const envKeys = ['INTERNAL_SERVICE_SECRET', 'INTERNAL_FRONTEND_URL', 'FRONTEND_URL'];
  const original = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const service = new ApplicationRestartService();

  beforeEach(() => {
    process.env[InternalServiceAuth.ENV_KEY] = 'test-secret';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of envKeys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it('sends nothing at all when the deployment never declared where the app runs', async () => {
    delete process.env.INTERNAL_FRONTEND_URL;
    delete process.env.FRONTEND_URL;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const outcome = await service.restart('frontend', 'test');

    // The whole point: no request means no secret left this process.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(outcome.restarting).toBe(false);
    expect(outcome.reason).toContain('has not declared where the frontend app runs');
  });

  it('refuses when nothing is configured to verify the call', async () => {
    delete process.env[InternalServiceAuth.ENV_KEY];
    process.env.INTERNAL_FRONTEND_URL = 'http://frontend:3000';
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const outcome = await service.restart('frontend', 'test');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(outcome.reason).toContain(InternalServiceAuth.ENV_KEY);
  });

  it('carries the secret to a declared address and reports the confirmed restart', async () => {
    process.env.INTERNAL_FRONTEND_URL = 'http://frontend:3000';
    const fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ app: 'frontend', restarting: true, exitInMs: 500 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchSpy);

    const outcome = await service.restart('frontend', 'test');

    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://frontend:3000/internal/restart');
    expect((init.headers as Record<string, string>)[InternalServiceAuth.HEADER]).toBe('test-secret');
    expect(outcome.restarting).toBe(true);
    expect(outcome.exitInMs).toBe(500);
  });

  it('does not call a restart successful when the host answers as something else', async () => {
    process.env.INTERNAL_FRONTEND_URL = 'https://not-our-app.example.com';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ restarting: true, exitInMs: 500 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));

    const outcome = await service.restart('frontend', 'test');

    expect(outcome.restarting).toBe(false);
    expect(outcome.reason).toContain('answered as "unknown"');
  });

  it('rejects an app it does not know without resolving any address for it', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const outcome = await service.restart('database', 'test');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(outcome.reason).toContain('Unknown app');
  });
});
