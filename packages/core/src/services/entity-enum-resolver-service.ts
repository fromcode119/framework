import { CoercionUtils } from '../coercion-utils';
import type { EntityEnumOptions } from '../types/entity-field-config.interfaces';

export class EntityEnumResolverService {
  static resolve(value: unknown, options: EntityEnumOptions): string {
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
