import { EntityObjectMapperService } from '../services/entity-object-mapper-service';
import { EntityMetadataService } from '../services/entity-metadata-service';
import { CoercionUtils } from '../coercion-utils';
import type { EntityFieldsConfig } from '../types/entity-field-config.types';

export abstract class BaseEntity<TRecord extends object> {
  readonly fields?: EntityFieldsConfig;

  constructor(private readonly record?: TRecord) {}

  cast(row: unknown): TRecord {
    return this.map(row);
  }

  map(row: unknown): TRecord {
    return EntityObjectMapperService.map<TRecord>(row, this.entityFields());
  }

  mapMany(rows: unknown[]): TRecord[] {
    return rows.map((row) => this.map(row));
  }

  clean(input: unknown): Partial<TRecord> {
    return EntityObjectMapperService.clean<TRecord>(input, this.entityFields());
  }

  mapMerged(...values: unknown[]): TRecord {
    return this.map(BaseEntity.mergeObjects(...values));
  }

  castMerged(...values: unknown[]): TRecord {
    return this.mapMerged(...values);
  }

  mapFromFactories(
    factories: Record<string, (raw: Record<string, unknown>) => Record<string, unknown>>,
    raw: unknown,
  ): TRecord {
    return this.map(BaseEntity.buildSources(factories, CoercionUtils.toObject(raw)));
  }

  castFromFactories(
    factories: Record<string, (raw: Record<string, unknown>) => Record<string, unknown>>,
    raw: unknown,
  ): TRecord {
    return this.mapFromFactories(factories, raw);
  }

  toFields(): TRecord {
    return this.record ?? this.map({});
  }

  entityFields(): EntityFieldsConfig {
    return this.fields || EntityMetadataService.resolveFields(this);
  }

  protected static mergeObjects(...values: unknown[]): Record<string, unknown> {
    return values.reduce<Record<string, unknown>>((merged, value) => ({
      ...merged,
      ...CoercionUtils.toObject(value),
    }), {});
  }

  protected static buildSources(
    factories: Record<string, (raw: Record<string, unknown>) => Record<string, unknown>>,
    raw: Record<string, unknown>,
  ): Record<string, Record<string, unknown>> {
    const sources: Record<string, Record<string, unknown>> = {};
    for (const name of Object.keys(factories)) {
      sources[name] = factories[name](raw);
    }
    return sources;
  }
}
