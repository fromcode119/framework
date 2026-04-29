import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Abstract base class for plugin API controllers.
 *
 * Controllers handle HTTP request orchestration: validate input,
 * call the service layer, and format the response.
 * They do NOT contain business logic (that belongs in services).
 *
 * Controller methods may use normal prototype syntax. BaseController binds
 * subclass methods once during construction so they can be passed directly
 * to routers without losing `this`.
 *
 * @example
 * ```typescript
 * export class OrderController extends BaseController {
 *   constructor(private service: OrderService) {
 *     super();
 *   }
 *
 *   // ✅ Regular method — auto-bound by BaseController
 *   async listOrders(req: Request, res: Response): Promise<void> {
 *     const orders = await this.service.listOrders(req.query);
 *     res.json(orders);
 *   }
 * }
 * ```
 */
export abstract class BaseController {
  constructor() {
    this.bindPrototypeMethods();
  }

  /**
   * Wraps a controller method as an Express RequestHandler.
   * Automatically propagates async errors to Express's next() handler.
   *
   * Use this when a method cannot be an arrow function class field:
   *
   * @example
   * ```typescript
   * router.get('/orders', this.handle((req, res) => this.service.list(req.query)));
   * ```
   */
  protected handle(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fn: (req: Request, res: Response) => any
  ): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = fn(req, res);
        if (result && typeof (result as Promise<unknown>).catch === 'function') {
          (result as Promise<unknown>).catch(next);
        }
      } catch (err) {
        next(err);
      }
    };
  }

  /**
   * Sends a standardised JSON error response.
   */
  protected sendError(res: Response, statusCode: number, message: string): void {
    res.status(statusCode).json({ error: message });
  }

  /**
   * Sends a standardised 404 Not Found response.
   */
  protected notFound(res: Response, resource = 'Resource'): void {
    this.sendError(res, 404, `${resource} not found`);
  }

  private bindPrototypeMethods(): void {
    let prototype = Object.getPrototypeOf(this) as object | null;

    while (prototype && prototype !== BaseController.prototype && prototype !== Object.prototype) {
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
