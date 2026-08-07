/**
 * The `context.people` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextPeople {
  match(input: { userId?: any; email?: string; phone?: string }): Promise<Record<string, any> | null>;
  getById(id: any): Promise<Record<string, any> | null>;
  getByUserId(userId: any): Promise<Record<string, any> | null>;
  getByEmail(email: string): Promise<Record<string, any> | null>;
  upsert(input: Record<string, any>): Promise<Record<string, any> | null>;
  /**
   * Resolve (or create) the person behind one identity payload taken from a plugin row, filling only
   * fields the person does not already have. The framework owns the match/merge rules so no plugin
   * hand-rolls them; returns `null` when the payload has no email/userId/phone to anchor on.
   */
  ingest(input: Record<string, any>): Promise<Record<string, any> | null>;
  /**
   * Ingest rows of one of THIS plugin's own tables into the shared people directory, resuming from a
   * framework-owned cursor in `_system_meta` so only rows added since the last run are read. Returns
   * how many people were ingested. Never scans the whole table.
   */
  syncDirectory(
    table: string,
    map: (row: Record<string, any>) => Record<string, any> | Promise<Record<string, any>>,
    batch?: number
  ): Promise<number>;
  linkAccount(personId: any, userId: any): Promise<any>;
  addRelationship(fromPersonId: any, toPersonId: any, type: string, metadata?: Record<string, any>): Promise<any>;
  listRelated(fromPersonId: any, type?: string): Promise<Array<Record<string, any>>>;
  catalogs: {
    register(kind: string, entry: { key: string; label: string; pluginSlug?: string }): Promise<void>;
    list(kind: string): Promise<Array<{ key: string; label: string }>>;
  };
  /**
   * Reusable address book on the shared `people_addresses` table. Plugins delegate their account
   * address book here instead of owning a parallel store. `ref` resolves (or, on upsert, creates)
   * the owning person from { personId } | { userId } | { email }. Plugin-specific delivery binding
   * (e.g. Econt city/office) is stored on each address's `metadata` JSON blob. A fully anonymous
   * ref (no userId/email) is rejected — guest checkout address snapshots live on the order instead.
   */
  addresses: {
    list(ref: { personId?: any; userId?: any; email?: string }): Promise<Array<Record<string, any>>>;
    upsert(ref: { personId?: any; userId?: any; email?: string }, addr: Record<string, any>): Promise<Record<string, any>>;
    delete(addressId: any): Promise<{ deleted: boolean }>;
    setDefault(ref: { personId?: any; userId?: any; email?: string }, addressId: any): Promise<Record<string, any> | null>;
  };
}
