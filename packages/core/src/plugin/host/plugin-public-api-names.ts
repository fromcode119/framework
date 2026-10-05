/**
 * The key under which a public-API proxy of an isolated plugin answers with its own method names.
 *
 * Asking such a proxy for each name instead (`Object.getOwnPropertyNames`, then one `get` per name, each
 * scanning the list again) is quadratic in the API's size, and the host did it for every peer on every
 * request. A symbol registered by name, so the process that reads it and the one that answers it share it
 * without importing each other.
 */
export class PluginPublicApiNames {
  static readonly KEY = Symbol.for('fromcode.plugin.publicApi.methodNames');
}
