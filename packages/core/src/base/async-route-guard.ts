import type { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import type { IRouteFailureOrigin } from '@core/base/interfaces/route-failure-origin.interface';

/**
 * Routes a rejected async route handler into Express's error channel.
 *
 * WHY THIS EXISTS. Express 4 calls a route handler inside a `try/catch`, so a *synchronous* throw
 * becomes `next(err)` and reaches the global error handler. An `async` handler returns a promise
 * instead: the `try/catch` sees a clean return, the rejection is never observed, and under Node 22 an
 * unobserved rejection is FATAL — the process dies. That is a denial of service reachable by any
 * ordinary 404-shaped request: `GET /api/v1/plugins/cms/navigation/<missing>` threw a 404-carrying
 * `CmsApiError` out of an async handler and killed the API container, anonymously, every time.
 *
 * Every plugin that mounts an `express.Router()` (the repo convention — `BaseRouter` subclasses
 * mounted with `context.api.use`) carried the same hole, so the fix belongs here once rather than in
 * each plugin. `wrapAll` covers handlers registered through {@link BaseRouter}; `wrapRouter` covers a
 * whole router handed to `context.api.use`, including one a plugin built by hand.
 *
 * WHAT IT DOES NOT DO. It never swallows and never answers a request itself. A rejection is forwarded
 * with `next(error)` — the same channel Express uses for a synchronous throw — so control-flow signals
 * a framework may throw (aborts, redirects) pass through exactly as they did before, and the global
 * error handler stays the single place that decides a status.
 */
export class AsyncRouteGuard {
  /** Express treats a 4-argument handler as an ERROR handler. Rewrapping one would change its role. */
  private static readonly ERROR_HANDLER_ARITY = 4;

  /** Marks an already-wrapped handler so double registration cannot nest wrappers. */
  private static readonly WRAPPED = Symbol.for('fromcode.asyncRouteGuard.wrapped');

  /** Where a forwarded error came from, read by the global error handler for logging. */
  private static readonly ORIGIN = Symbol.for('fromcode.asyncRouteGuard.origin');

  /**
   * Wrap one handler. Non-functions, error handlers and already-wrapped handlers are returned as-is.
   */
  static wrap(handler: RequestHandler, source: string): RequestHandler {
    if (!AsyncRouteGuard.isWrappable(handler)) {
      return handler;
    }

    const guarded = function guardedRouteHandler(req: Request, res: Response, next: NextFunction) {
      // A synchronous throw is deliberately NOT caught here: Express's own try/catch already turns it
      // into next(err), and catching it would change behaviour that was never broken.
      const result: unknown = (handler as RequestHandler)(req, res, next);

      if (AsyncRouteGuard.isPromiseLike(result)) {
        (result as PromiseLike<unknown>).then(undefined, (error: unknown) => {
          AsyncRouteGuard.forward(error, req, res, next, source);
        });
      }

      return result;
    } as RequestHandler;

    Reflect.set(guarded, AsyncRouteGuard.WRAPPED, true);
    return guarded;
  }

  /**
   * Wrap a handler list, preserving order. Leading non-handler descriptors (a route's `{ access }`
   * declaration) must already have been stripped by the caller.
   */
  static wrapAll(handlers: RequestHandler[], source: string): RequestHandler[] {
    return handlers.map((handler) => AsyncRouteGuard.wrap(handler, source));
  }

  /**
   * Wrap every handler already registered on an Express router, in place, including nested routers.
   *
   * This is the boundary case `context.api.use('/', router)` creates: the plugin hands over a router
   * whose layers Express will invoke directly, so wrapping the router VALUE achieves nothing — the
   * layers inside it have to be wrapped.
   */
  static wrapRouter(router: Router, source: string): void {
    const stack = AsyncRouteGuard.stackOf(router) ?? AsyncRouteGuard.appStackOf(router);
    if (!stack) {
      return;
    }

    for (const layer of stack) {
      if (!layer || typeof layer !== 'object') {
        continue;
      }

      const routeStack = AsyncRouteGuard.stackOf(Reflect.get(layer as object, 'route'));
      if (routeStack) {
        for (const routeLayer of routeStack) {
          AsyncRouteGuard.rewrapLayer(routeLayer, source);
        }
        continue;
      }

      const handle = Reflect.get(layer as object, 'handle');
      if (AsyncRouteGuard.stackOf(handle)) {
        AsyncRouteGuard.wrapRouter(handle as Router, source);
        continue;
      }

      AsyncRouteGuard.rewrapLayer(layer, source);
    }
  }

  /**
   * The plugin slug / router name recorded on an error that this guard forwarded, if any.
   */
  static originOf(error: unknown): IRouteFailureOrigin | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }
    return Reflect.get(error as object, AsyncRouteGuard.ORIGIN) as IRouteFailureOrigin | undefined;
  }

  private static rewrapLayer(layer: unknown, source: string): void {
    if (!layer || typeof layer !== 'object') {
      return;
    }
    const handle = Reflect.get(layer, 'handle');
    if (!AsyncRouteGuard.isWrappable(handle)) {
      return;
    }
    Reflect.set(layer, 'handle', AsyncRouteGuard.wrap(handle as RequestHandler, source));
  }

  private static forward(
    error: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
    source: string
  ): void {
    if (error && typeof error === 'object') {
      const origin: IRouteFailureOrigin = {
        source,
        method: String(req.method || ''),
        path: String(req.originalUrl || req.path || ''),
      };
      Reflect.set(error as object, AsyncRouteGuard.ORIGIN, origin);
    }

    // Headers already sent means the handler began streaming a response and then failed. Express's
    // default handler destroys the socket in that case, which is the correct outcome; next() still
    // has to be called so it gets the chance.
    next(error);
  }

  private static isWrappable(handler: unknown): handler is RequestHandler {
    return (
      typeof handler === 'function' &&
      (handler as RequestHandler).length < AsyncRouteGuard.ERROR_HANDLER_ARITY &&
      !Reflect.get(handler, AsyncRouteGuard.WRAPPED)
    );
  }

  private static isPromiseLike(value: unknown): boolean {
    return !!value && typeof (value as PromiseLike<unknown>).then === 'function';
  }

  /**
   * An Express *application* keeps its layers one level down, on the router it builds lazily. Passing
   * the app itself is how the framework sweeps handlers registered straight onto `app.get`/`app.use`,
   * which no router class ever sees.
   */
  private static appStackOf(app: unknown): unknown[] | undefined {
    if (!app || (typeof app !== 'object' && typeof app !== 'function')) {
      return undefined;
    }
    const inner = Reflect.get(app as object, '_router') ?? Reflect.get(app as object, 'router');
    return AsyncRouteGuard.stackOf(inner);
  }

  private static stackOf(value: unknown): unknown[] | undefined {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
      return undefined;
    }
    const stack = Reflect.get(value as object, 'stack');
    return Array.isArray(stack) ? (stack as unknown[]) : undefined;
  }
}
