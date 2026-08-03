import { CoercionUtils } from '@core/coercion-utils';
import { NumberUtils } from '@core/number-utils';
import { EntityEnumResolverService } from '@core/services/entity-enum-resolver-service';
import type { IEntityFieldConfig } from '@core/interfaces/entity-field-config.interface';
import type { IEntityFieldsConfig } from '@core/interfaces/entity-fields-config.interface';

export class EntityObjectMapperService {
  static map<TOutput>(source: unknown, fields: IEntityFieldsConfig): TOutput {
    const row = CoercionUtils.toParsedObject(source);
    const output: Record<string, unknown> = {};

    for (const [targetKey, config] of Object.entries(fields)) {
      output[targetKey] = this.coerceValue(this.resolveValue(row, output, targetKey, config), config);
    }

    return output as TOutput;
  }

  static clean<TOutput>(source: unknown, fields: IEntityFieldsConfig): Partial<TOutput> {
    const row = CoercionUtils.toParsedObject(source);
    const output: Record<string, unknown> = {};

    for (const [targetKey, config] of Object.entries(fields)) {
      if (config.admin?.readOnly) {
        continue;
      }
      const resolved = this.resolveValue(row, output, targetKey, config);
      if (resolved !== undefined || config.default !== undefined) {
        output[targetKey] = this.coerceValue(resolved, config);
      }
    }

    return output as Partial<TOutput>;
  }

  private static resolveValue(
    row: Record<string, unknown>,
    output: Record<string, unknown>,
    targetKey: string,
    config: IEntityFieldConfig,
  ): unknown {
    const sources = config.from?.length ? config.from : [targetKey];
    for (const path of sources) {
      const value = this.readPath(row, path);
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
    if (config.fallbackTo && output[config.fallbackTo] !== undefined && output[config.fallbackTo] !== '') {
      return output[config.fallbackTo];
    }
    return config.default;
  }

  private static readPath(row: Record<string, unknown>, path: string): unknown {
    return String(path || '').split('.').filter(Boolean).reduce<unknown>((current, part) => {
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      return (current as Record<string, unknown>)[part];
    }, row);
  }

  private static coerceValue(value: unknown, config: IEntityFieldConfig): unknown {
    if (config.optional && (value === undefined || value === null || value === '')) {
      return undefined;
    }
    let nextValue = this.coerceBaseValue(value, config);
    for (const transform of this.resolveTransforms(config.transform)) {
      nextValue = this.applyTransform(nextValue, transform);
    }
    return nextValue;
  }

  private static coerceBaseValue(value: unknown, config: IEntityFieldConfig): unknown {
    switch (config.type) {
      case 'number':
        return CoercionUtils.toNumber(value, CoercionUtils.toNumber(config.default, 0));
      case 'string':
        return CoercionUtils.toString(value ?? config.default ?? '');
      case 'raw':
        return value ?? config.default ?? null;
      case 'boolean':
      case 'checkbox':
        return CoercionUtils.toBoolean(value, CoercionUtils.toBoolean(config.default, false));
      case 'array':
        return CoercionUtils.toParsedArray(value);
      case 'json':
      case 'group':
      case 'richText':
      case 'object':
        return CoercionUtils.toParsedObject(value);
      case 'date':
      case 'datetime':
      case 'isoDate':
        return CoercionUtils.toIsoDateOrNull(value);
      case 'isoDateOrNow':
        return CoercionUtils.toIsoDateOrNow(value);
      case 'relationId':
        return CoercionUtils.toRelationId(value);
      case 'relationship':
      case 'upload':
        return config.hasMany ? CoercionUtils.toParsedArray(value) : CoercionUtils.toRelationId(value);
      case 'enum':
      case 'select':
        return config.values
          ? EntityEnumResolverService.resolve(value, { default: String(config.default || ''), values: config.values })
          : CoercionUtils.toString(value ?? config.default ?? '');
      default:
        return CoercionUtils.toString(value ?? config.default ?? '');
    }
  }

  private static resolveTransforms(transforms: IEntityFieldConfig['transform']): string[] {
    if (!transforms) {
      return [];
    }
    // Config may name a transform as an EntityFieldTransform member OR a raw string; `Enum.toString()`
    // yields the bare value, so normalizing once here keeps the comparisons below working for both.
    const list = Array.isArray(transforms) ? transforms : [transforms];
    return list.map((entry) => String(entry));
  }

  private static applyTransform(value: unknown, transform: string): unknown {
    if (transform === 'round2') {
      return NumberUtils.round2(CoercionUtils.toNumber(value, 0));
    }
    if (transform === 'min0') {
      return Math.max(0, CoercionUtils.toNumber(value, 0));
    }
    if (transform === 'currencyObject') {
      if (!value) {
        return null;
      }
      return typeof value === 'string' ? { code: value } : value;
    }
    if (transform === 'stringArray') {
      return CoercionUtils.toParsedArray(value).map((entry) => CoercionUtils.toString(entry)).filter(Boolean);
    }
    if (transform === 'lowercase') {
      return CoercionUtils.toString(value).toLowerCase();
    }
    if (transform === 'uppercase') {
      return CoercionUtils.toString(value).toUpperCase();
    }
    if (transform === 'trim') {
      return CoercionUtils.toString(value).trim();
    }
    return value;
  }
}
