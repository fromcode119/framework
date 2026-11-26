/** What a workspace package's manifest asks for. */
export interface IStackManifest {
  readonly dependencies?: Record<string, string>;
}
