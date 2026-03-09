import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Base class for all Express middlewares.
 * 
 * Provides a consistent pattern for middleware creation with:
 * - Dependency injection via constructor
 * - Abstract handle method for logic
 * - Automatic middleware function generation
 * - Error handling support
 * 
 * @example
 * ```typescript
 * export class AuthMiddleware extends BaseMiddleware {
 *   constructor(private authManager: AuthManager) {
 *     super();
 *   }
 * 
 *   async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
 *     const token = req.headers.authorization?.replace('Bearer ', '');
 *     if (!token) {
 *       throw new ApiError('Unauthorized', 401);
 *     }
 *     req.user = await this.authManager.verify(token);
 *     next();
 *   }
 * }
 * 
 * // Usage
 * const authMiddleware = new AuthMiddleware(authManager);
 * router.get('/protected', authMiddleware.middleware(), handler);
 * ```
 */
export abstract class BaseMiddleware {
  /**
   * The core middleware logic.
   * Implement this method in subclasses.
   * 
   * @throws ApiError for expected errors (will be caught and formatted)
   * @throws Error for unexpected errors (will be caught and logged)
   */
  abstract handle(req: Request, res: Response, next: NextFunction): void | Promise<void>;

  /**
   * Get the Express middleware function.
   * Wraps the handle method with error handling.
   */
  middleware(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = this.handle(req, res, next);
        if (result instanceof Promise) {
          result.catch(next);
        }
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Create an optional middleware that only runs if a condition is met.
   */
  conditional(predicate: (req: Request) => boolean): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
      if (predicate(req)) {
        return this.middleware()(req, res, next);
      }
      next();
    };
  }

  /**
   * Combine this middleware with others in sequence.
   */
  compose(...others: BaseMiddleware[]): RequestHandler[] {
    return [this, ...others].map((mw) => mw.middleware());
  }
}

/**
 * Utility to convert a function into a middleware instance.
 * Useful for simple middlewares that don't need a full class.
 */
export class FunctionalMiddleware extends BaseMiddleware {
  constructor(
    private fn: (req: Request, res: Response, next: NextFunction) => void | Promise<void>
  ) {
    super();
  }

  handle(req: Request, res: Response, next: NextFunction): void | Promise<void> {
    return this.fn(req, res, next);
  }
}

/**
 * Create a middleware instance from a function.
 */
export function createMiddleware(
  fn: (req: Request, res: Response, next: NextFunction) => void | Promise<void>
): BaseMiddleware {
  return new FunctionalMiddleware(fn);
}
