import { Request, Response, NextFunction } from 'express';
import type { ValidationOptions } from './validation-middleware.interfaces';
import { BaseMiddleware } from '../base-middleware';

export class ValidationMiddleware extends BaseMiddleware {
  constructor(private options: ValidationOptions) {
    super();
  }

  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (this.options.body && req.body) {
        await this.options.body(req.body);
      }

      if (this.options.query && req.query) {
        await this.options.query(req.query);
      }

      if (this.options.params && req.params) {
        await this.options.params(req.params);
      }

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

  private defaultFormatter(err: Error): { error: string; details?: any } {
    return {
      error: 'Validation Error',
      details: err.message
    };
  }

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

    options.formatError = (err: any) => {
      if (err.errors && Array.isArray(err.errors)) {
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

    options.formatError = (err: any) => {
      if (err.inner && Array.isArray(err.inner)) {
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