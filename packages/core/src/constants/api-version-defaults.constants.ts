/**
 * The API base path and version used when nothing is configured.
 *
 * Deliberately DEPENDENCY-FREE. `ApiVersionUtils` — where these used to live — imports
 * `ApplicationUrlUtils`, which reads `window`/`document`; that made two string literals unusable from
 * any non-DOM context. The admin service worker needs exactly these two values to know which paths must
 * always hit the network, and pulling them from `ApiVersionUtils` dragged the whole browser-URL chain
 * into a `ServiceWorkerGlobalScope` that has no `window`.
 */
export class ApiVersionDefaults {
  static readonly BASE_PATH = '/api';
  static readonly VERSION = 'v1';
}
