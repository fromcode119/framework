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
    /**
     * Correlation keys this provider understands (`['orderNumber']`). Declared → the provider answers
     * about SUBJECTS offering one of them and never about a person. Omitted → it is a person provider,
     * which is what every provider written before subjects existed is.
     */
    matchKeys?: string[];
    resolve: (ref: IEntityRecordRef) => Promise<IEntityRecordItem[]>;
  }): any;
  /**
   * Ask what relates to a subject — the same question the admin's related-records panel asks. Lets a
   * plugin find out whether anything still answers for something its own record names, without
   * querying, or naming, whoever owns it.
   */
  resolve(ref: IEntityRecordRef): Promise<any>;
  unregister(key: string): void;
}
