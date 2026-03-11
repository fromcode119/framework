import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Abstract base class for plugin API controllers.
 *
 * Controllers handle HTTP request orchestration: validate input,
 * call the service layer, and format the response.
 * They do NOT contain business logic (that belongs in services).
 *
 * Controller methods MUST be arrow function class fields (not regular methods)
 * to preserve the correct 'this' binding when passed as route handlers:
 *
 * @example
 * ```typescript
 * export class OrderController extends BaseController {
 *   constructor(private service: OrderService) {
 *     super();
 *   }
 *
 *   // ✅ Arrow function — 'this' is always the controller instance
 *   listOrders = async (req: Request, res: Response): Promise<void> => {
 *     const orders = await this.service.listOrders(req.query);
 *     res.json(orders);
 *   };
 *
 *   // ❌ Regular method — 'this' is lost when passed to router.get()
 *   // async listOrders(req: Request, res: Response) { ... }
 * }
 * ```
 */
export abstract class BaseController {
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
}
