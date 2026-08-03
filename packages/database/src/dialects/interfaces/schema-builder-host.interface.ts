/**
 * Host hooks a dialect schema builder needs from its owning manager:
 * the engine-specific query executor and the JSON-column cache invalidator.
 */
export interface ISchemaBuilderHost {
  execute(query: any): Promise<any>;
  invalidateTableCache(tableName: string): void;
}
