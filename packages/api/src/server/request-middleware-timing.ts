import { performance } from 'perf_hooks';
import type express from 'express';
import { RequestServerTiming } from '@fromcode119/core';

/**
 * Says what each middleware of the request chain spent (`mw1`, `mw2`, … in the order they were mounted), so
 * the time before a handler (`api-pre`) shows WHICH of them it went to.
 *
 * Only the time a middleware spends itself is counted: from the moment it is entered to the moment it passes
 * the request on, so what runs after it is not added to it. A router, a sub-application and an error handler
 * are mounted as they are; a middleware that answers the request instead of passing it on says nothing.
 * Steps under a third of a millisecond are left out — they would only lengthen the header.
 */
export class RequestMiddlewareTiming {
  private static readonly MIN_MS = 0.3;

  /** From now on, every function mounted with `app.use` reports its own time. */
  static instrument(app: express.Application): void {
    const mount = app.use.bind(app) as (...args: unknown[]) => express.Application;
    let count = 0;
    (app as unknown as { use: (...args: unknown[]) => express.Application }).use = (...args: unknown[]) => {
      const last = args.length - 1;
      const handler = args[last];
      if (RequestMiddlewareTiming.isPlainMiddleware(handler)) {
        count += 1;
        args[last] = RequestMiddlewareTiming.timed(`mw${count}`, handler);
      }
      return mount(...args);
    };
  }

  private static isPlainMiddleware(handler: unknown): handler is express.RequestHandler {
    if (typeof handler !== 'function' || handler.length !== 3) return false;
    const carried = handler as unknown as Record<string, unknown>;
    return carried.stack === undefined && carried.handle === undefined && carried.set === undefined;
  }

  private static timed(name: string, handler: express.RequestHandler): express.RequestHandler {
    return function timedMiddleware(this: unknown, req, res, next) {
      const entered = performance.now();
      let reported = false;
      const passOn: express.NextFunction = (error?: unknown) => {
        if (!reported) {
          reported = true;
          const spent = performance.now() - entered;
          if (spent >= RequestMiddlewareTiming.MIN_MS) RequestServerTiming.record(name, spent);
        }
        (next as (error?: unknown) => void)(error);
      };
      return handler.call(this, req, res, passOn);
    };
  }
}
