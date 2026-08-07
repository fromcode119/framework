import express, { Router, RequestHandler, Request, Response, NextFunction } from 'express';
import { PluginHealthRouteHandler } from '@core/plugin-health-route-handler';
import type { IPluginHealthRouteHandlerOptions } from '@core/interfaces/plugin-health-route-handler-options.interface';
import { RouteConstants } from '@core/constants/route.constants';
import { ApiAccessGate } from '@core/plugin/context/api-access-gate';
import { AccessLevel } from '@core/plugin/context/enums/access-level.enum';
import type { IApiAccessDescriptor } from '@core/plugin/context/interfaces/api-access-descriptor.interface';
import type { ApiPermissionRequirement } from '@core/plugin/context/api-permission-requirement';
import type { IRouteHandlerList } from '@core/interfaces/route-handler-list.interface';
import { AsyncRouteGuard } from '@core/base/async-route-guard';

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
      this.registerBaseRoutes();
      this.registerRoutes();
    }
    return this._router!;
  }

  constructor() {
    this.bindPrototypeMethods();
  }

  /**
   * Register framework-owned routes before subclass routes.
   */
  protected registerBaseRoutes(): void {
    // Subclasses may override.
  }

  /**
   * Register all routes for this router.
   * Called automatically during construction.
   */
  protected abstract registerRoutes(): void;

  /**
   * Strip a leading `{ access }` declaration and prepend the central fail-closed gate (inert unless
   * ENFORCE_AUTHZ_GATEWAY=true). Undeclared routes default to admin-only inside the gate.
   *
   * Every remaining handler is then passed through {@link AsyncRouteGuard}, because Express 4 does not
   * observe the promise an `async` handler returns — an unobserved rejection is fatal under Node 22 and
   * killed the API process on an ordinary "not found" request. See AsyncRouteGuard for the full note.
   */
  private gated(handlers: IRouteHandlerList): RequestHandler[] {
    let list = handlers;
    let access: AccessLevel | ApiPermissionRequirement | undefined;
    if (ApiAccessGate.isDescriptor(list[0])) {
      access = (list[0] as IApiAccessDescriptor).access;
      list = list.slice(1);
    }
    const gate = ApiAccessGate.build(access);
    const rest = AsyncRouteGuard.wrapAll(list as RequestHandler[], this.constructor.name);
    return gate ? [gate, ...rest] : rest;
  }

  /**
   * Register a GET route.
   */
  protected get(path: string, ...handlers: IRouteHandlerList): void {
    this.router.get(path, ...this.gated(handlers));
  }

  /**
   * Register the standard plugin health route. Always public — probes must not require auth.
   */
  protected health(...handlers: RequestHandler[]): void {
    this.get(RouteConstants.SEGMENTS.HEALTH, { access: AccessLevel.PUBLIC }, ...handlers);
  }

  /**
   * Register the standard plugin status route. Always public — probes must not require auth.
   */
  protected status(...handlers: RequestHandler[]): void {
    this.get(RouteConstants.SEGMENTS.STATUS, { access: AccessLevel.PUBLIC }, ...handlers);
  }

  /**
   * Register the standard plugin health route using a framework-owned handler.
   */
  protected healthCheck(options: IPluginHealthRouteHandlerOptions): void {
    this.health(PluginHealthRouteHandler.create(options));
  }

  /**
   * Register the standard plugin status route using a framework-owned handler.
   */
  protected statusCheck(options: IPluginHealthRouteHandlerOptions): void {
    this.status(PluginHealthRouteHandler.create(options));
  }

  /**
   * Register a POST route.
   */
  protected post(path: string, ...handlers: IRouteHandlerList): void {
    this.router.post(path, ...this.gated(handlers));
  }

  /**
   * Register a PUT route.
   */
  protected put(path: string, ...handlers: IRouteHandlerList): void {
    this.router.put(path, ...this.gated(handlers));
  }

  /**
   * Register a PATCH route.
   */
  protected patch(path: string, ...handlers: IRouteHandlerList): void {
    this.router.patch(path, ...this.gated(handlers));
  }

  /**
   * Register a DELETE route.
   */
  protected delete(path: string, ...handlers: IRouteHandlerList): void {
    this.router.delete(path, ...this.gated(handlers));
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
   * async error propagation.
   *
   * @example
   * // In router — regular router method:
   * async getFoo(req: Request, res: Response): Promise<void> {
   *   res.json(await this.service.getFoo());
   * }
   * this.get('/foo', this.getFoo);
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

  private bindPrototypeMethods(): void {
    let prototype = Object.getPrototypeOf(this) as object | null;

    while (prototype && prototype !== BaseRouter.prototype && prototype !== Object.prototype) {
      for (const propertyName of Object.getOwnPropertyNames(prototype)) {
        if (propertyName === 'constructor') {
          continue;
        }

        const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
        if (!descriptor || typeof descriptor.value !== 'function') {
          continue;
        }

        const instanceMethod = Reflect.get(this, propertyName);
        if (typeof instanceMethod !== 'function') {
          continue;
        }

        Object.defineProperty(this, propertyName, {
          value: instanceMethod.bind(this),
          configurable: true,
          writable: true,
        });
      }

      prototype = Object.getPrototypeOf(prototype) as object | null;
    }
  }
}
