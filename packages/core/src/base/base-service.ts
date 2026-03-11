import type { PluginContext } from '@fromcode119/sdk';

/**
 * Abstract base class for all plugin services.
 *
 * Services contain the business/domain logic for a plugin.
 * They receive a PluginContext for database and hook access,
 * and delegate data access to repositories.
 *
 * @example
 * ```typescript
 * export class OrderService extends BaseService {
 *   constructor(
 *     context: PluginContext,
 *     private readonly repo: OrderRepository
 *   ) {
 *     super(context);
 *   }
 *
 *   async cancelOrder(id: number): Promise<Order> {
 *     const order = await this.repo.findById(id);
 *     if (!order) throw new Error(`Order ${id} not found`);
 *     return this.repo.update(id, { status: 'cancelled' });
 *   }
 * }
 * ```
 */
export abstract class BaseService {
  constructor(protected readonly context: PluginContext) {}

  /**
   * Logs an info message prefixed with the service class name.
   */
  protected log(message: string): void {
    this.context.logger.info(`[${this.constructor.name}] ${message}`);
  }

  /**
   * Logs a warning prefixed with the service class name.
   */
  protected warn(message: string): void {
    this.context.logger.warn(`[${this.constructor.name}] ${message}`);
  }

  /**
   * Logs an error prefixed with the service class name.
   */
  protected error(message: string, err?: unknown): void {
    const detail = err instanceof Error ? err.message : String(err ?? '');
    this.context.logger.error(`[${this.constructor.name}] ${message}${detail ? `: ${detail}` : ''}`);
  }
}
