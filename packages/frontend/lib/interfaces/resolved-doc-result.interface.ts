/** A resolved frontend document (content page or plugin doc) from the dynamic page resolver. */
export interface IResolvedDocResult {
  type: string;
  plugin: string;
  doc: Record<string, unknown> | null;
  /**
   * The ONE path this document is served at, as declared by the plugin that owns it — root-relative and
   * locale-free, or `''` when the owner declares none. A request on any other path redirects here.
   */
  canonicalPath: string;
}
