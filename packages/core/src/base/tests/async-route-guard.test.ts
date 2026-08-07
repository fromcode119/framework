import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AsyncRouteGuard } from '@core/base/async-route-guard';

/**
 * These tests exist because the failure they describe is not a bad response — it is a DEAD PROCESS.
 * An `async` route handler that rejects is invisible to Express 4's try/catch, and Node 22 kills the
 * process on an unobserved rejection. `GET /api/v1/plugins/cms/navigation/<missing>` did exactly that
 * to the live API, anonymously, on an ordinary not-found request.
 */
describe('AsyncRouteGuard', () => {
  const request = (): Request => ({ method: 'GET', originalUrl: '/api/v1/plugins/cms/navigation/x' } as Request);
  const response = (): Response => ({ headersSent: false } as Response);

  const flush = async (): Promise<void> => {
    await new Promise((resolve) => setImmediate(resolve));
  };

  it('forwards an async rejection to next() instead of leaving it unobserved', async () => {
    const boom = new Error('Navigation not found');
    const handler: RequestHandler = async () => {
      throw boom;
    };
    const next = vi.fn() as unknown as NextFunction;

    AsyncRouteGuard.wrap(handler, 'cms')(request(), response(), next);
    await flush();

    expect(next).toHaveBeenCalledWith(boom);
  });

  it('records the plugin slug and route on the forwarded error so the log can name the offender', async () => {
    const handler: RequestHandler = async () => {
      throw new Error('Navigation not found');
    };
    let forwarded: unknown;
    const next = ((error: unknown) => {
      forwarded = error;
    }) as NextFunction;

    AsyncRouteGuard.wrap(handler, 'cms')(request(), response(), next);
    await flush();

    expect(AsyncRouteGuard.originOf(forwarded)).toEqual({
      source: 'cms',
      method: 'GET',
      path: '/api/v1/plugins/cms/navigation/x',
    });
  });

  it('leaves a synchronous throw alone — Express already routes those, and control-flow throws must pass through untouched', () => {
    const signal = new Error('DYNAMIC_SERVER_USAGE');
    const handler: RequestHandler = () => {
      throw signal;
    };
    const next = vi.fn() as unknown as NextFunction;

    expect(() => AsyncRouteGuard.wrap(handler, 'cms')(request(), response(), next)).toThrow(signal);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not touch a resolving handler', async () => {
    const handler: RequestHandler = async (_req, res) => {
      (res as unknown as { body?: string }).body = 'ok';
    };
    const next = vi.fn() as unknown as NextFunction;
    const res = response();

    await AsyncRouteGuard.wrap(handler, 'cms')(request(), res, next);
    await flush();

    expect(next).not.toHaveBeenCalled();
    expect((res as unknown as { body?: string }).body).toBe('ok');
  });

  it('never rewraps an Express error handler — a 4-argument handler keeps its role', () => {
    const errorHandler = ((_e: unknown, _q: Request, _s: Response, _n: NextFunction) => undefined) as unknown as RequestHandler;
    expect(AsyncRouteGuard.wrap(errorHandler, 'cms')).toBe(errorHandler);
  });

  it('is idempotent, so BaseRouter and context.api cannot nest wrappers', () => {
    const handler: RequestHandler = async () => undefined;
    const once = AsyncRouteGuard.wrap(handler, 'cms');
    expect(AsyncRouteGuard.wrap(once, 'cms')).toBe(once);
  });

  it('wrapRouter reaches handlers inside a router a plugin built by hand', async () => {
    // This is the boundary `context.api.use('/', router)` creates: Express invokes the router's layers
    // itself, so wrapping the router VALUE protects nothing.
    const router = express.Router();
    const boom = new Error('rejected inside a mounted router');
    router.get('/thing', async () => {
      throw boom;
    });

    AsyncRouteGuard.wrapRouter(router, 'somePlugin');

    let forwarded: unknown;
    await new Promise<void>((resolve) => {
      router(
        { method: 'GET', url: '/thing', originalUrl: '/thing' } as Request,
        { headersSent: false } as Response,
        ((error: unknown) => {
          forwarded = error;
          resolve();
        }) as NextFunction
      );
    });

    expect(forwarded).toBe(boom);
    expect(AsyncRouteGuard.originOf(forwarded)?.source).toBe('somePlugin');
  });

  it('wrapRouter descends into a nested router', async () => {
    const inner = express.Router();
    const boom = new Error('nested');
    inner.get('/deep', async () => {
      throw boom;
    });
    const outer = express.Router();
    outer.use('/inner', inner);

    AsyncRouteGuard.wrapRouter(outer, 'somePlugin');

    let forwarded: unknown;
    await new Promise<void>((resolve) => {
      outer(
        { method: 'GET', url: '/inner/deep', originalUrl: '/inner/deep' } as Request,
        { headersSent: false } as Response,
        ((error: unknown) => {
          forwarded = error;
          resolve();
        }) as NextFunction
      );
    });

    expect(forwarded).toBe(boom);
  });
});
