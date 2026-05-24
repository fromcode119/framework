import { CoercionUtils } from '../coercion-utils';
import type { Collection, Field } from '../types/schema.interfaces';
import type { EntityField, EntityInputAlias, EntityParseOptions, EntityParseResult } from '../types/entity.interfaces';

export class EntityValueParserService {
  parseCollectionInput(
    collection: Collection,
    input: Record<string, unknown>,
    options: EntityParseOptions = {},
  ): EntityParseResult {
    const source = CoercionUtils.toObject(input);
    const data: Record<string, unknown> = options.includeUnknown ? { ...source } : {};
    const errors: EntityParseResult['errors'] = [];

    for (const field of collection.fields || []) {
      const name = String(field.name || '').trim();
      if (!name || this.shouldSkipField(field, options)) {
        continue;
      }

      const resolved = this.resolveIncomingValue(collection, field, source);
      if (!resolved.exists && options.mode === 'update') {
        continue;
      }

      const value = resolved.exists ? resolved.value : field.defaultValue;
      if (this.isEmpty(value)) {
        if (field.required && (options.mode !== 'update' || resolved.exists)) {
          errors.push({ field: name, message: `Field "${field.label || name}" is required` });
        }
        if (resolved.exists) {
          data[name] = this.coerceEmptyFieldValue(field);
        } else if (field.defaultValue !== undefined) {
          data[name] = this.coerceFieldValue(field, field.defaultValue);
        }
        continue;
      }

      data[name] = this.coerceFieldValue(field, value);
    }

    return { data, errors };
  }

  cleanCollectionInput(collection: Collection, input: Record<string, unknown>, options: EntityParseOptions = {}): Record<string, unknown> {
    return this.parseCollectionInput(collection, input, options).data;
  }

  validateCollectionInput(collection: Collection, input: Record<string, unknown>, options: EntityParseOptions = {}): EntityParseResult['errors'] {
    return this.parseCollectionInput(collection, input, options).errors;
  }

  private shouldSkipField(field: Field, options: EntityParseOptions): boolean {
    if (field.name === 'id' || field.name === 'createdAt' || field.name === 'updatedAt') {
      return true;
    }
    return Boolean(options.skipReadOnly && field.admin?.readOnly);
  }

  private resolveIncomingValue(
    collection: Collection,
    field: Field,
    source: Record<string, unknown>,
  ): { exists: boolean; value: unknown } {
    const name = String(field.name || '').trim();
    const paths = this.resolveInputPaths(collection, field);
    for (const path of paths) {
      const value = this.readPath(source, path);
      if (!this.isEmpty(value)) {
        return { exists: true, value };
      }
    }
    if (Object.prototype.hasOwnProperty.call(source, name)) {
      return { exists: true, value: source[name] };
    }
    return { exists: false, value: undefined };
  }

  private resolveInputPaths(collection: Collection, field: Field): string[] {
    const aliases = ((collection as any).inputAliases || []) as EntityInputAlias[];
    const fieldName = String(field.name || '').trim();
    const entityAlias = aliases.find((alias) => alias.field === fieldName);
    const fieldAliases = ((field as EntityField).inputAliases || []) as string[];
    return [...(entityAlias?.from || []), ...fieldAliases, fieldName].filter(Boolean);
  }

  private readPath(source: Record<string, unknown>, path: string): unknown {
    const parts = String(path || '').split('.').map((part) => part.trim()).filter(Boolean);
    let current: unknown = source;
    for (const part of parts) {
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  private coerceFieldValue(field: Field, value: unknown): unknown {
    if (field.localized && value && typeof value === 'object') {
      return value;
    }

    switch (String(field.type)) {
      case 'number':
        return CoercionUtils.toNumber(value, CoercionUtils.toNumber(field.defaultValue, 0));
      case 'boolean':
      case 'checkbox':
        return CoercionUtils.toBoolean(value, CoercionUtils.toBoolean(field.defaultValue, false));
      case 'date':
      case 'datetime':
        return CoercionUtils.toIsoDateOrNull(value);
      case 'json':
      case 'group':
      case 'richText':
        return this.coerceObjectLikeValue(value);
      case 'array':
        return this.coerceArrayValue(value);
      case 'relationship':
      case 'upload':
        return field.hasMany ? this.coerceArrayValue(value) : this.coerceRelationshipValue(value);
      case 'select':
        return this.coerceSelectValue(field, value);
      case 'text':
      case 'textarea':
      case 'password':
      case 'color':
      case 'code':
      case 'permalink':
      default:
        return CoercionUtils.toString(value);
    }
  }

  private coerceEmptyFieldValue(field: Field): unknown {
    switch (String(field.type)) {
      case 'number':
      case 'date':
      case 'datetime':
      case 'json':
      case 'group':
      case 'richText':
        return null;
      case 'array':
        return [];
      case 'relationship':
      case 'upload':
        return field.hasMany ? [] : null;
      case 'boolean':
      case 'checkbox':
        return false;
      default:
        return '';
    }
  }

  private coerceObjectLikeValue(value: unknown): unknown {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (typeof value === 'string') {
      return CoercionUtils.parseJson(value, value);
    }
    return value;
  }

  private coerceArrayValue(value: unknown): unknown[] {
    if (value === null || value === undefined || value === '') {
      return [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = CoercionUtils.parseJson<unknown>(value, null);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [value];
  }

  private coerceRelationshipValue(value: unknown): unknown {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (value && typeof value === 'object') {
      const objectValue = value as Record<string, unknown>;
      return objectValue.id ?? objectValue._id ?? objectValue.value ?? value;
    }
    return value;
  }

  private coerceSelectValue(field: Field, value: unknown): unknown {
    if ((field.admin as any)?.multiple || (field as any).multiple) {
      return this.coerceArrayValue(value);
    }
    return CoercionUtils.toString(value);
  }

  private isEmpty(value: unknown): boolean {
    return value === undefined || value === null || value === '';
  }
}
