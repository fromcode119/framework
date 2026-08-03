/**
 * The `context.recordVersions` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextRecordVersions {
  getById(id: any): Promise<Record<string, any> | null>;
  listByRef(refCollection: string, refId: any, limit?: number): Promise<Array<Record<string, any>>>;
}
