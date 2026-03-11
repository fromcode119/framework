import express, { Router, RequestHandler, Request, Response, NextFunction } from 'express';

/**
 * Base class for all API routers.
 *
 * Provides a consistent pattern for route registration with:
 * - Dependency injection via constructor
 * - Protected route registration method
 * - Automatic router initialization
 * - Type-safe route handlers
 *
 * Lives in @fromcode119/sdk so that plugins can extend it without triggering
 * a circular dependency (api → sdk → api/routers).
 *
 * @example
 * ```typescript
 * export class AuthRouter extends BaseRouter {
 *   constructor(
 *     private controller: AuthController,
 *     private auth: AuthManager
 *   ) {
 *     super();
 *   }
 *
 *   protected registerRoutes(): void {
 *     this.post('/login', this.controller.login);
 *     this.post('/logout', this.middleware.auth(), this.controller.logout);
 *   }
 * }
 * ```
 */
export abstract class BaseRouter {
  private _router: Router | null = null;
  private _routesRegistered = false;

  /**
   * Lazy getter: defers registerRoutes() until first access so that
   * subclass constructor dependency injection (TypeScript 'private x: X'
   * shorthand) is fully assigned before routes are wired up.
   */
  get router(): Router {
    if (!this._router) {
      this._router = express.Router();
    }
    if (!this._routesRegistered) {
      this._routesRegistered = true;
      this.registerRoutes();
    }
    return this._router!;
  }

  constructor() {
    // Router is initialized lazily via the 'router' getter above.
    // No setup needed here.
  }

  /**
   * Register all routes for this router.
   * Called automatically during construction.
   */
  protected abstract registerRoutes(): void;

  /**
   * Register a GET route.
   */
  protected get(path: string, ...handlers: RequestHandler[]): void {
    this.router.get(path, ...handlers);
  }

  /**
   * Register a POST route.
   */
  protected post(path: string, ...handlers: RequestHandler[]): void {
    this.router.post(path, ...handlers);
  }

  /**
   * Register a PUT route.
   */
  protected put(path: string, ...handlers: RequestHandler[]): void {
    this.router.put(path, ...handlers);
  }

  /**
   * Register a PATCH route.
   */
  protected patch(path: string, ...handlers: RequestHandler[]): void {
    this.router.patch(path, ...handlers);
  }

  /**
   * Register a DELETE route.
   */
  protected delete(path: string, ...handlers: RequestHandler[]): void {
    this.router.delete(path, ...handlers);
  }

  /**
   * Register middleware for all routes in this router.
   */
  protected use(...handlers: RequestHandler[]): void {
    this.router.use(...handlers);
  }

  /**
   * Wrap async handlers to catch errors automatically.
   */
  protected asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
  ): RequestHandler {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Wraps a controller method as an Express RequestHandler with automatic
   * async error propagation. The method must be bound to its controller
   * instance (via `.bind(controller)`) so that 'this' is correctly resolved.
   *
   * @example
   * // In controller — regular async method:
   * async getFoo(req: Request, res: Response): Promise<void> {
   *   res.json(await this.service.getFoo());
   * }
   * // In router — use .bind() to preserve 'this':
   * this.get('/foo', this.bind(this.controller.getFoo.bind(this.controller)));
   */
  protected bind(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    method: (req: Request, res: Response, next?: NextFunction) => any
  ): RequestHandler {
    return (req, res, next) => {
      try {
        const result = method(req, res, next);
        if (result && typeof result.catch === 'function') {
          result.catch(next);
        }
      } catch (err) {
        next(err);
      }
    };
  }
}
