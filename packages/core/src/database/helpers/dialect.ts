import { Logger } from '../../logging/logger';

const logger = new Logger({ namespace: 'DialectHelper' });

/**
 * Flexible dialect execution helper that supports any database dialect
 * without requiring rigid union types or code changes.
 * 
 * @param dialect The current database dialect (e.g., 'postgres', 'mysql', 'sqlite', 'mariadb')
 * @param queries A map of dialect names to async functions that execute the migration
 */
export const executeForDialect = (
  dialect: string,
  queries: Record<string, () => Promise<void>>
): Promise<void> =>
  (queries[dialect.toLowerCase()] ||
    queries[Object.keys(queries).find((key) => dialect.toLowerCase().includes(key)) || 'default']
  )?.() ??
  Promise.reject(
    new Error(`No migration implementation found for dialect "${dialect}". Available: ${Object.keys(queries).join(', ')}`)
  );

