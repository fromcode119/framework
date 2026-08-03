import type { IValidatorFunction } from '@api/middlewares/validation/interfaces/validator-function.interface';

export interface IValidationOptions {
  body?: IValidatorFunction;
  query?: IValidatorFunction;
  params?: IValidatorFunction;
  headers?: IValidatorFunction;
  formatError?: (err: Error) => { error: string; details?: any };
}