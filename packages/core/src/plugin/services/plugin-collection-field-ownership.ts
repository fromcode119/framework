import type { IField } from '@core/interfaces/field.interface';

/**
 * Which fields of a registered collection are its OWNER's own declaration.
 *
 * A plugin updated in place registers its collections again, and the api has to tell two things
 * apart in what it already holds: a field the owner has just DROPPED from its declaration, which
 * must go with it, and a field somebody else put there — another plugin extending the collection,
 * or the framework's own (workflow, archive, permalink) — which must stay whatever the owner
 * declares. Without that, a release that removed a control left it on the console's screens,
 * writing a column nothing reads, until the api restarted.
 *
 * Membership is by OBJECT IDENTITY, never by name: two plugins may each declare a field called
 * `status` on the same collection, and only one of them is the owner's. A WeakSet, so a definition
 * that falls out of use is collected with it.
 */
export class PluginCollectionFieldOwnership {
  private static readonly declared = new WeakSet<object>();

  /** These definitions are the collection owner's, as of the release registering now. */
  static claim(fields: IField[] | undefined): void {
    for (const field of fields ?? []) PluginCollectionFieldOwnership.declared.add(field as unknown as object);
  }

  /** This definition came from elsewhere after all — another plugin's extension of the collection. */
  static release(field: IField): void {
    PluginCollectionFieldOwnership.declared.delete(field as unknown as object);
  }

  /** Whether the collection's owner declared this very definition. */
  static claimed(field: IField): boolean {
    return PluginCollectionFieldOwnership.declared.has(field as unknown as object);
  }
}
