import { SeederCallableResolverErrorCodes } from './seeder-callable-resolver-error-codes';
import type { SeederCallableResolution, SeederCallableSymbol } from './seeder-callable-resolver.types';

export class SeederCallableResolver {
  private static readonly PRECEDENCE: SeederCallableSymbol[] = ['default', 'seed', 'run', 'execute'];

  resolveCallable(moduleExports: unknown): SeederCallableResolution {
    if (!moduleExports || (typeof moduleExports !== 'object' && typeof moduleExports !== 'function')) {
      throw this.buildResolverError(
        SeederCallableResolverErrorCodes.INVALID_MODULE_EXPORTS,
        'Invalid seed module exports. Expected object or function export payload.'
      );
    }

    const exportsRecord = moduleExports as Record<string, unknown>;

    for (const symbolName of SeederCallableResolver.PRECEDENCE) {
      const candidate = symbolName === 'default'
        ? this.readDefaultCandidate(moduleExports, exportsRecord)
        : exportsRecord[symbolName];

      if (candidate === undefined || candidate === null) {
        continue;
      }

      if (typeof candidate !== 'function') {
        throw this.buildResolverError(
          SeederCallableResolverErrorCodes.NON_CALLABLE_SEED_SYMBOL,
          `Seed symbol "${symbolName}" exists but is not callable.`
        );
      }

      return {
        callable: candidate,
        symbolName,
        sourceType: symbolName === 'default' ? 'default' : 'named'
      };
    }

    throw this.buildResolverError(
      SeederCallableResolverErrorCodes.MISSING_SEED_CALLABLE,
      'No valid seed callable found. Allowed symbols: default, seed, run, execute.'
    );
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