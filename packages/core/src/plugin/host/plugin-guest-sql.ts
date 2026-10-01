import type { SqlRenderer } from '@fromcode119/database/sql/sql-renderer';

/**
 * A built `Sql` statement is an object graph of chunks, not data — it cannot cross to the host. The
 * guest renders it to `{ $sql, params }` here and the host runs it as a parametrised statement.
 */
export class PluginGuestSql {
  /** Loaded on the first SQL object, not when the class loads: most plugin processes never build one. */
  private static rendererInstance: SqlRenderer | null = null;

  private static get renderer(): SqlRenderer {
    if (!PluginGuestSql.rendererInstance) {
      const { SqlRenderer: Renderer } = require('@fromcode119/database/sql/sql-renderer') as typeof import('@fromcode119/database/sql/sql-renderer');
      PluginGuestSql.rendererInstance = Renderer.POSTGRES;
    }
    return PluginGuestSql.rendererInstance;
  }

  static isSqlObject(value: unknown): boolean {
    return !!value && typeof value === 'object' && Array.isArray((value as any).chunks) && typeof (value as any).getSQL === 'function';
  }

  static flatten(value: unknown): { $sql: string; params: unknown[] } {
    const { text, params } = PluginGuestSql.renderer.render(value);
    return { $sql: text, params };
  }

  /** Rewrites SQL objects among `args` so the whole list is clonable. */
  static portableArgs(args: unknown[]): unknown[] {
    return args.map((arg) => (PluginGuestSql.isSqlObject(arg) ? PluginGuestSql.flatten(arg) : arg));
  }
}
