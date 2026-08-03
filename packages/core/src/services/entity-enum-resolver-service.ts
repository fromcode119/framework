import { CoercionUtils } from '@core/coercion-utils';
import type { IEntityEnumOptions } from '@core/interfaces/entity-enum-options.interface';

export class EntityEnumResolverService {
  static resolve(value: unknown, options: IEntityEnumOptions): string {
    const normalized = CoercionUtils.toString(value).trim().toLowerCase();
    for (const [target, aliases] of Object.entries(options.values)) {
      if (normalized === target.toLowerCase()) {
        return target;
      }
      if (aliases.map((alias) => alias.trim().toLowerCase()).includes(normalized)) {
        return target;
      }
    }
    return options.default || normalized;
  }
}
