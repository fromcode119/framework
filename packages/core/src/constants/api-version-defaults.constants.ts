/**
 * The api base path used when nothing is configured.
 *
 * Deliberately DEPENDENCY-FREE. `ApiVersionUtils` — where this used to live — imports
 * `ApplicationUrlUtils`, which reads `window`/`document`; that made a string literal unusable from
 * any non-DOM context. The admin service worker needs exactly this value to know which paths must
 * always hit the network, and pulling it from `ApiVersionUtils` dragged the whole browser-URL chain
 * into a `ServiceWorkerGlobalScope` that has no `window`.
 *
 * Routes live directly under it (`/api/...`); there is no version segment, and `/api/v<N>/...` is not
 * answered.
 */
export class ApiVersionDefaults {
  static readonly BASE_PATH = '/api';
}
