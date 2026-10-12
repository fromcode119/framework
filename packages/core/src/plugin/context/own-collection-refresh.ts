import type { ICollection } from '@core/collections/interfaces/collection.interface';
import type { IField } from '@core/interfaces/field.interface';
import type { Logger } from '@core/logging';
import type { PluginEntityRegistrationService } from '@core/plugin/services/plugin-entity-registration-service';

/**
 * A plugin updated in place registers its collections again from its new code. A field the release
 * ADDS used to join the collection at once, so every read selected its column before the table had
 * it — "column … does not exist" on every list until the hot update's own table sync ran, after the
 * new process had finished starting (29 s once, on a release adding one field).
 *
 * Everything else in the new definition — access, hooks, admin, changed fields — still applies at once
 * (the old hooks call a process that is gone). The new fields join only once their columns exist.
 * Syncs of one table run one after another, because a plugin can register twice in one update and two
 * concurrent syncs would both try to add the same column.
 *
 * The collection is announced at once — it is the same object, still registered, and the hot update's
 * prune drops every collection the new process did not announce — and again when the new fields join.
 * The returned promise settles then, so the prune waits for it.
 */
export class OwnCollectionRefresh {
  private static readonly pending = new Map<string, Promise<void>>();

  static apply(
    schemaManager: { syncCollection(collection: ICollection): Promise<void> } | undefined,
    registration: PluginEntityRegistrationService,
    existing: ICollection,
    incoming: ICollection,
    logger: Logger,
    announce: () => void,
  ): Promise<void> | void {
    const known = new Set(existing.fields.map((field: IField) => field.name));
    const added = incoming.fields.filter((field: IField) => !known.has(field.name));
    if (!added.length || !schemaManager) {
      registration.refreshOwnCollection(existing, incoming);
      announce();
      return;
    }

    registration.refreshOwnCollection(existing, { ...incoming, fields: incoming.fields.filter((field: IField) => known.has(field.name)) });
    announce();
    const table = String(existing.slug);
    const previous = OwnCollectionRefresh.pending.get(table) ?? Promise.resolve();
    const next = previous
      .then(() => schemaManager.syncCollection({ ...existing, fields: [...existing.fields, ...added] }))
      .catch((error: unknown) => {
        logger.error(`New fields of "${table}" (${added.map((field) => field.name).join(', ')}) could not get their columns before use: ${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => {
        registration.refreshOwnCollection(existing, incoming);
        announce();
        if (OwnCollectionRefresh.pending.get(table) === next) OwnCollectionRefresh.pending.delete(table);
      });
    OwnCollectionRefresh.pending.set(table, next);
    return next;
  }
}
