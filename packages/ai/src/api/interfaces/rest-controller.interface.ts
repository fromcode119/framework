/**
 * The REST surface the assistant drives on the host's collection controller.
 *
 * A real behavioural contract, replacing `export type IRestController = any` — which stated nothing, so
 * every call site was unchecked. The instance is supplied by the `api` package at runtime; `ai` must not
 * import that package (it would invert the dependency), so the four operations it actually uses are
 * declared here and the host's controller satisfies them structurally.
 */
export interface IRestController {
  find(collection: string, request: Record<string, unknown>): Promise<any>;
  findOne(collection: string, request: Record<string, unknown>): Promise<any>;
  create(collection: string, request: Record<string, unknown>): Promise<any>;
  update(collection: string, request: Record<string, unknown>): Promise<any>;
}
