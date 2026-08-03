/** A resolved frontend document (CMS page or plugin doc) from the dynamic page resolver. */
export interface IResolvedDocResult {
  type: string;
  plugin: string;
  doc: Record<string, unknown> | null;
}
