import { Request, Response, NextFunction } from 'express';
import type { ValidationOptions } from './validation-middleware.interfaces';
import { BaseMiddleware } from './base-middleware';

/**
 * Validation middleware for request data validation.
 * 
 * Supports validation of:
 * - Request body
 * - Query parameters
 * - Route parameters
 * - Request headers
 * 
 * @example
 * ```typescript
 * // Using a custom validator function
 * const validator = new ValidationMiddleware({
 *   body: (data) => {
 *     if (!data.email) throw new Error('Email is required');
 *     if (!data.password) throw new Error('Password is required');
 *     return true;
 *   }
 * });
 * router.post('/login', validator.middleware(), loginHandler);
 * 
 * // Using Zod schema (if available)
 * import { z } from 'zod';
 * const loginSchema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(8)
 * });
 * const validator = ValidationMiddleware.fromZod({ body: loginSchema });
 * ```
 */

export class ValidationMiddleware extends BaseMiddleware {
  constructor(private options: ValidationOptions) {
    super();
  }

  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate body
      if (this.options.body && req.body) {
        await this.options.body(req.body);
      }

      // Validate query
      if (this.options.query && req.query) {
        await this.options.query(req.query);
      }

      // Validate params
      if (this.options.params && req.params) {
        await this.options.params(req.params);
      }

      // Validate headers
      if (this.options.headers && req.headers) {
        await this.options.headers(req.headers);
      }

      next();
    } catch (error: any) {
      const formatter = this.options.formatError || this.defaultFormatter;
      const formatted = formatter(error);
      res.status(400).json(formatted);
    }
  }

  /**
   * Default error formatter.
   */
  private defaultFormatter(err: Error): { error: string; details?: any } {
    return {
      error: 'Validation Error',
      details: err.message
    };
  }

  /**
   * Create validation middleware from Zod schemas.
   * Requires Zod to be installed: npm install zod
   * 
   * @example
   * ```typescript
   * import { z } from 'zod';
   * const validator = ValidationMiddleware.fromZod({
   *   body: z.object({ email: z.string().email() }),
   *   query: z.object({ page: z.string().optional() })
   * });
   * ```
   */
  static fromZod(schemas: {
    body?: any;
    query?: any;
    params?: any;
    headers?: any;
  }): ValidationMiddleware {
    const options: ValidationOptions = {};

    if (schemas.body) {
      options.body = async (data) => {
        schemas.body.parse(data);
        return true;
      };
    }

    if (schemas.query) {
      options.query = async (data) => {
        schemas.query.parse(data);
        return true;
      };
    }

    if (schemas.params) {
      options.params = async (data) => {
        schemas.params.parse(data);
        return true;
      };
    }

    if (schemas.headers) {
      options.headers = async (data) => {
        schemas.headers.parse(data);
        return true;
      };
    }

    // Custom Zod error formatter
    options.formatError = (err: any) => {
      if (err.errors && Array.isArray(err.errors)) {
        // Zod validation error
        return {
          error: 'Validation Error',
          details: err.errors.map((e: any) => ({
            path: e.path.join('.'),
            message: e.message
          }))
        };
      }
      return {
        error: 'Validation Error',
        details: err.message
      };
    };

    return new ValidationMiddleware(options);
  }

  /**
   * Create validation middleware from Yup schemas.
   * Requires Yup to be installed: npm install yup
   * 
   * @example
   * ```typescript
   * import * as yup from 'yup';
   * const validator = ValidationMiddleware.fromYup({
   *   body: yup.object({ email: yup.string().email().required() })
   * });
   * ```
   */
  static fromYup(schemas: {
    body?: any;
    query?: any;
    params?: any;
    headers?: any;
  }): ValidationMiddleware {
    const options: ValidationOptions = {};

    if (schemas.body) {
      options.body = async (data) => {
        await schemas.body.validate(data, { abortEarly: false });
        return true;
      };
    }

    if (schemas.query) {
      options.query = async (data) => {
        await schemas.query.validate(data, { abortEarly: false });
        return true;
      };
    }

    if (schemas.params) {
      options.params = async (data) => {
        await schemas.params.validate(data, { abortEarly: false });
        return true;
      };
    }

    if (schemas.headers) {
      options.headers = async (data) => {
        await schemas.headers.validate(data, { abortEarly: false });
        return true;
      };
    }

    // Custom Yup error formatter
    options.formatError = (err: any) => {
      if (err.inner && Array.isArray(err.inner)) {
        // Yup validation error
        return {
          error: 'Validation Error',
          details: err.inner.map((e: any) => ({
            path: e.path,
            message: e.message
          }))
        };
      }
      return {
        error: 'Validation Error',
        details: err.message
      };
    };

    return new ValidationMiddleware(options);
  }

}

