import type { ITableNameResolver } from '@database/interfaces/table-name-resolver.interface';
import { NamingStrategy } from '@database/naming-strategy';
import { PhysicalTableNameUtils } from '@database/physical-table-name-utils';

/**
 * Manages the resolution of semantic table names (e.g., @content/pages)
 * to physical database table names.
 */
export class TableResolver {
  private static resolver: ITableNameResolver = (name: any): any => {
    if (typeof name !== 'string') return name;
    
    // Handle @plugin/entity format
    if (name.startsWith('@')) {
      const parts = name.slice(1).split('/');
      if (parts.length >= 2) {
        const plugin = NamingStrategy.toSnakeIdentifier(parts[0]);
        const table = NamingStrategy.toSnakeIdentifier(parts.slice(1).join('_'));
        return PhysicalTableNameUtils.create(plugin, table);
      }
    }
    
    return name;
  };

  /**
   * Overrides the default resolution logic.
   */
  static set(resolver: ITableNameResolver) {
    this.resolver = resolver;
  }

  /**
   * Resolves a name using the current resolver.
   */
  static resolve(name: any): any {
    return this.resolver(name);
  }
}
