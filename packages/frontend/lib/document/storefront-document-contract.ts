/**
 * The two DOM ids the islands document and the runtime agree on. Lives in a dependency-free file so the
 * SERVER document renderer can name them without importing the browser runtime (whose `react-dom/client`
 * import Next refuses inside a route handler's graph).
 */
export class StorefrontDocumentContract {
  /** The element whose innerHTML is the server-rendered theme and which `hydrateRoot` adopts. */
  static readonly ROOT_ID = 'fc-root';

  /** The `<script type="application/json">` carrying `FrontendRuntimeConfig`. */
  static readonly CONFIG_ELEMENT_ID = 'fc-runtime-config';
}
