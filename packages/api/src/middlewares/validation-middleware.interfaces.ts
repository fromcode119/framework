import type { ValidatorFunction } from './validation-middleware.types';

export interface ValidationOptions {
  /**
   * Validate request body.
   */
  body?: ValidatorFunction;

  /**
   * Validate query parameters.
   */
  query?: ValidatorFunction;

  /**
   * Validate route parameters.
   */
  params?: ValidatorFunction;

  /**
   * Validate request headers.
   */
  headers?: ValidatorFunction;

  /**
   * Custom error message formatter.
   */
  formatError?: (err: Error) => { error: string; details?: any };
}
