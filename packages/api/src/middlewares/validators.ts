import type { IValidatorFunction } from '@api/middlewares/validation/interfaces/validator-function.interface';

/**
 * Quick validator helpers for common validation patterns.
 */
export class Validators {
  /**
   * Validate that required fields are present.
   */
  static required(...fields: string[]): IValidatorFunction {
    return (data: any) => {
      for (const field of fields) {
        if (!data[field]) {
          throw new Error(`Field "${field}" is required`);
        }
      }
      return true;
    };
  }

  /**
   * Validate email format.
   */
  static email(field: string): IValidatorFunction {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return (data: any) => {
      if (data[field] && !emailRegex.test(data[field])) {
        throw new Error(`Field "${field}" must be a valid email`);
      }
      return true;
    };
  }

  /**
   * Validate string length.
   */
  static minLength(field: string, min: number): IValidatorFunction {
    return (data: any) => {
      if (data[field] && String(data[field]).length < min) {
        throw new Error(`Field "${field}" must be at least ${min} characters`);
      }
      return true;
    };
  }

  /**
   * Validate numeric range.
   */
  static range(field: string, min: number, max: number): IValidatorFunction {
    return (data: any) => {
      const value = Number(data[field]);
      if (isNaN(value) || value < min || value > max) {
        throw new Error(`Field "${field}" must be between ${min} and ${max}`);
      }
      return true;
    };
  }

  /**
   * Combine multiple validators with AND logic.
   */
  static all(...validators: IValidatorFunction[]): IValidatorFunction {
    return async (data: any) => {
      for (const validator of validators) {
        await validator(data);
      }
      return true;
    };
  }
}
