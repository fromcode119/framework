import { Request, Response, NextFunction } from 'express';
import { BaseMiddleware } from './base-middleware';

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

  static create(
    fn: (req: Request, res: Response, next: NextFunction) => void | Promise<void>
  ): BaseMiddleware {
    return new FunctionalMiddleware(fn);
  }
}
