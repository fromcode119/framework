import { SeederCallableResolverErrorCodes } from '@core/database/seeder-callable-resolver-error-codes';
import type { ISeederCallableResolution } from '@core/database/interfaces/seeder-callable-resolution.interface';
import { SeederCallableSymbol } from '@core/database/enums/seeder-callable-symbol.enum';
import { SeederCallableSourceType } from '@core/database/enums/seeder-callable-source-type.enum';

export class SeederCallableResolver {
  private static readonly PRECEDENCE: SeederCallableSymbol[] = SeederCallableSymbol.values() as SeederCallableSymbol[];
  private static readonly STATIC_METHOD_PRECEDENCE: SeederCallableSymbol[] = [SeederCallableSymbol.SEED, SeederCallableSymbol.RUN, SeederCallableSymbol.EXECUTE];

  resolveCallable(moduleExports: unknown): ISeederCallableResolution {
    if (!moduleExports || (typeof moduleExports !== 'object' && typeof moduleExports !== 'function')) {
      throw this.buildResolverError(
        SeederCallableResolverErrorCodes.INVALID_MODULE_EXPORTS,
        'Invalid seed module exports. Expected object or function export payload.'
      );
    }

    const exportsRecord = moduleExports as Record<string, unknown>;

    for (const symbolName of SeederCallableResolver.PRECEDENCE) {
      const candidate = symbolName === SeederCallableSymbol.DEFAULT
        ? this.readDefaultCandidate(moduleExports, exportsRecord)
        : exportsRecord[symbolName.value];

      if (candidate === undefined || candidate === null) {
        continue;
      }

      if (typeof candidate !== 'function') {
        throw this.buildResolverError(
          SeederCallableResolverErrorCodes.NON_CALLABLE_SEED_SYMBOL,
          `Seed symbol "${symbolName}" exists but is not callable.`
        );
      }

      // A class can't be invoked as `callable(db)` (throws without `new`). When the precedence
      // symbol resolves to a class, use its static seed method instead of the bare constructor.
      const classStatic = this.resolveClassStaticCallable(candidate);
      if (classStatic) {
        return classStatic;
      }

      return {
        callable: candidate as (...args: unknown[]) => unknown,
        symbolName,
        sourceType: symbolName === SeederCallableSymbol.DEFAULT ? SeederCallableSourceType.DEFAULT : SeederCallableSourceType.NAMED
      };
    }

    // No directly-callable precedence symbol. Accept a single exported class that exposes a static
    // `seed`/`run`/`execute` method — this lets a seed file be PURELY one `export class`, with no
    // `export const` or `export default` wrapper around the callable.
    for (const value of Object.values(exportsRecord)) {
      const classStatic = this.resolveClassStaticCallable(value);
      if (classStatic) {
        return classStatic;
      }
    }

    throw this.buildResolverError(
      SeederCallableResolverErrorCodes.MISSING_SEED_CALLABLE,
      'No valid seed callable found. Allowed: a default/seed/run/execute callable, '
        + 'or an exported class with a static seed/run/execute method.'
    );
  }

  /**
   * If `value` is a class (constructor function) carrying a static `seed`/`run`/`execute` method,
   * return that method bound to the class. Plain functions have no such static members, so they
   * fall through and resolve as direct callables — keeping the old behavior intact.
   */
  private resolveClassStaticCallable(value: unknown): ISeederCallableResolution | null {
    if (typeof value !== 'function') {
      return null;
    }
    const owner = value as unknown as Record<string, unknown>;
    for (const methodName of SeederCallableResolver.STATIC_METHOD_PRECEDENCE) {
      const method = owner[methodName.value];
      if (typeof method === 'function') {
        return {
          callable: (...args: unknown[]) => (method as (...args: unknown[]) => unknown).apply(value, args),
          symbolName: methodName,
          sourceType: SeederCallableSourceType.STATIC
        };
      }
    }
    return null;
  }

  private readDefaultCandidate(moduleExports: unknown, exportsRecord: Record<string, unknown>): unknown {
    if (typeof moduleExports === 'function') {
      return moduleExports;
    }
    return exportsRecord.default;
  }

  private buildResolverError(code: string, message: string): Error {
    const error = new Error(message) as Error & { code?: string };
    error.code = code;
    return error;
  }
}