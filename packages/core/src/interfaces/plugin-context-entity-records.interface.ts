import type { IEntityRecordRef } from '@core/services/entity-records/interfaces/entity-record-ref.interface';
import type { IEntityRecordItem } from '@core/services/entity-records/interfaces/entity-record-item.interface';

/**
 * The `context.entityRecords` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 *
 * The item shape is {@link IEntityRecordItem} — the SAME type the registry, the resolution service and
 * the renderer use. It used to be re-declared inline here and had drifted: it still advertised
 * `amount`/`currency` (nothing reads them — the framework is domain-agnostic and holds no money
 * concept) and omitted `trailing`, the opaque label the framework actually renders and that all three
 * shipping providers emit.
 */
export interface IPluginContextEntityRecords {
  registerProvider(input: {
    key: string;
    label: string;
    resolve: (ref: IEntityRecordRef) => Promise<IEntityRecordItem[]>;
  }): any;
  unregister(key: string): void;
}
