import type { PluginContext } from '../types';
import { NumberUtils } from '../number-utils';

/**
 * Abstract base class for all plugin data repositories.
 *
 * Provides consistent database access patterns, shared query helpers,
 * and enforces the repository layer contract across all plugins.
 *
 * @template TRow   - The shape of a database row after mapping
 * @template TQuery - The shape of the query/filter parameters
 *
 * @example
 * ```typescript
 * export class OrderRepository extends BaseRepository<Order, OrderQuery> {
 *   async findMany(query: OrderQuery): Promise<Order[]> {
 *     const limit = this.parseLimit(query.limit);
 *     const rows = await this.context.db.find(Tables.ECOMMERCE_ORDERS, { limit });
 *     return rows.map(mapOrder);
 *   }
 * }
 * ```
 */
export abstract class BaseRepository<TRow, TQuery = Record<string, unknown>> {
  constructor(protected readonly context: PluginContext) {}

  /**
   * Find multiple records matching the given query parameters.
   */
  abstract findMany(query: TQuery): Promise<TRow[]>;

  /**
   * Find a single record by its ID. Returns null if not found.
   */
  abstract findById(id: number | string): Promise<TRow | null>;

  /**
   * Create a new record. Returns the created record.
   */
  abstract create(data: Partial<TRow>): Promise<TRow>;

  /**
   * Update an existing record by ID. Returns the updated record.
   */
  abstract update(id: number | string, data: Partial<TRow>): Promise<TRow>;

  /**
   * Delete a record by ID.
   */
  abstract delete(id: number | string): Promise<void>;

  /**
   * Parses and clamps a limit value for pagination queries.
   * Uses the SDK parseLimit utility for consistency.
   *
   * @param value    - Raw limit value from request query
   * @param fallback - Default limit if value is invalid (default: 50)
   * @param max      - Maximum allowed limit (default: 200)
   */
  protected parseLimit(value: unknown, fallback = 50, max = 200): number {
    return NumberUtils.parseLimit(value, fallback, max);
  }

  /**
   * Parses an offset (page * perPage) from a raw value.
   * Returns 0 for invalid or negative values.
   */
  protected parseOffset(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
  }

  /**
   * Parses a sort direction from a raw query value.
   * Accepts 'asc'/'desc' (case-insensitive), defaults to 'desc'.
   */
  protected parseSortDir(value: unknown): 'asc' | 'desc' {
    const v = String(value || '').toLowerCase().trim();
    return v === 'asc' ? 'asc' : 'desc';
  }

  /**
   * Logs an info message prefixed with the repository class name.
   */
  protected log(message: string): void {
    this.context.logger.info(`[${this.constructor.name}] ${message}`);
  }

  /**
   * Logs an error message prefixed with the repository class name.
   */
  protected error(message: string, err?: unknown): void {
    const detail = err instanceof Error ? err.message : String(err ?? '');
    this.context.logger.error(`[${this.constructor.name}] ${message}${detail ? `: ${detail}` : ''}`);
  }
}
