import type { ValidatorFunction } from './validation-middleware.types';

export interface ValidationOptions {
  body?: ValidatorFunction;
  query?: ValidatorFunction;
  params?: ValidatorFunction;
  headers?: ValidatorFunction;
  formatError?: (err: Error) => { error: string; details?: any };
}