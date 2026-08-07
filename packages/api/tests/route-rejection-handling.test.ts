import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { AsyncRouteGuard, BaseRouter, Logger } from '@fromcode119/core';
import { ErrorResponseMiddleware } from '@api/middlewares/error-response-middleware';

/** A plugin's own domain error — the shape `CmsApiError` has. */
class DomainError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'DomainError';
  }
}

/** A plugin router built the way every plugin in this repo builds one. */
class RejectingPluginRouter extends BaseRouter {
  protected registerRoutes(): void {
    this.get('/navigation/:slug', async () => {
      throw new DomainError(404, 'Navigation not found');
    });
    this.get('/exploding', async () => {
      throw new Error('SELECT * FROM users WHERE secret = "hunter2"');
    });
    this.get('/server-status-error', async () => {
      throw new DomainError(503, 'upstream ledger unreachable at 10.0.0.4:5432');
    });
    this.get('/fine', async (_req, res) => {
      res.json({ ok: true });
    });
  }
}

describe('rejected plugin route handlers', () => {
  let app: express.Express;
  let unhandled: unknown[];
  let logged: string[];

  const captureUnhandled = (reason: unknown): void => {
    unhandled.push(reason);
  };

  beforeEach(() => {
    unhandled = [];
    logged = [];
    process.on('unhandledRejection', captureUnhandled);

    const logger = new Logger({ namespace: 'test' });
    vi.spyOn(logger, 'error').mockImplementation((message: string) => {
      logged.push(String(message));
    });

    app = express();
    app.use('/api/v1/plugins/cms', new RejectingPluginRouter().router);
    app.use(new ErrorResponseMiddleware(logger).middleware());
  });

  afterEach(() => {
    process.off('unhandledRejection', captureUnhandled);
    vi.restoreAllMocks();
  });

  const settle = async (): Promise<void> => {
    await new Promise((resolve) => setImmediate(resolve));
  };

  it('answers with an HTTP error instead of leaving an unhandled rejection (the crash)', async () => {
    // Before the guard this request produced NO response and an unobserved rejection, which under
    // Node 22 terminates the process — a denial of service reachable by an anonymous 404-shaped GET.
    const res = await request(app).get('/api/v1/plugins/cms/navigation/no-such-menu');
    await settle();

    expect(res.status).toBe(404);
    expect(unhandled).toEqual([]);
  });

  it('maps a status-carrying domain error to its own status and message', async () => {
    const res = await request(app).get('/api/v1/plugins/cms/navigation/no-such-menu');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Navigation not found');
  });

  it('turns an unrecognised error into a 500 that leaks no internal detail', async () => {
    const res = await request(app).get('/api/v1/plugins/cms/exploding');

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(JSON.stringify(res.body)).not.toContain('SELECT');
    expect(res.body.error).toBe('Internal Server Error');
  });

  it('collapses a 5xx-carrying error to a generic 500 — a plugin cannot publish an internal failure code', async () => {
    const res = await request(app).get('/api/v1/plugins/cms/server-status-error');

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.4');
  });

  it('logs the failing route server-side so an operator can find the offending plugin', async () => {
    await request(app).get('/api/v1/plugins/cms/exploding');

    expect(logged.join('\n')).toContain('/api/v1/plugins/cms/exploding');
    expect(logged.join('\n')).toContain('RejectingPluginRouter');
  });

  it('leaves a successful route untouched', async () => {
    const res = await request(app).get('/api/v1/plugins/cms/fine');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('ErrorResponseMiddleware control-flow passthrough', () => {
  it('does not answer a request whose response already started — Express closes it instead', async () => {
    const logger = new Logger({ namespace: 'test' });
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    const app = express();
    app.get('/streaming', (_req, res, next) => {
      res.status(200);
      res.write('partial');
      next(new Error('failed mid-stream'));
    });
    app.use(new ErrorResponseMiddleware(logger).middleware());

    // The response must not be rewritten to a 500 body — headers are already on the wire.
    const res = await request(app).get('/streaming').catch((error: unknown) => error);
    expect(String(JSON.stringify(res))).not.toContain('Internal Server Error');

    vi.restoreAllMocks();
  });

  it('a raw router handed to context.api.use is protected too', async () => {
    // Plugins are not obliged to extend BaseRouter; wrapping happens at the context.api boundary as
    // well, which is what makes the fix generic rather than cms-specific.
    const raw = express.Router();
    raw.get('/raw', async () => {
      throw new DomainError(422, 'raw router rejected');
    });
    AsyncRouteGuard.wrapRouter(raw, 'somePlugin');

    const logger = new Logger({ namespace: 'test' });
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    const app = express();
    app.use('/api/v1/plugins/some-plugin', raw);
    app.use(new ErrorResponseMiddleware(logger).middleware());

    const res = await request(app).get('/api/v1/plugins/some-plugin/raw');
    expect(res.status).toBe(422);
    expect(res.body.message).toBe('raw router rejected');

    vi.restoreAllMocks();
  });
});
