import { Logger } from '../../logging';

const logger = new Logger({ namespace: 'DialectHelper' });

/**
 * Flexible dialect execution helper that supports any database dialect
 * without requiring rigid union types or code changes.
 */
export class DialectHelper {
  static executeForDialect(
    dialect: string,
    queries: Record<string, () => Promise<void>>
  ): Promise<void> {
    const fn =
      queries[dialect.toLowerCase()] ||
      queries[Object.keys(queries).find((key) => dialect.toLowerCase().includes(key)) || 'default'];
    if (!fn) {
      return Promise.reject(
        new Error(`No migration implementation found for dialect "${dialect}". Available: ${Object.keys(queries).join(', ')}`)
      );
    }
    return fn();
  }
}