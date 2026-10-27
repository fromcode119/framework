/**
 * Declares a collection's records PUBLIC CONTENT: pages a visitor can open at an address of their own,
 * which a sitemap, an llms.txt or a search plugin may list and describe. The owning plugin answers for
 * its records through its own namespace API, so a consumer never names the plugin or reads its table.
 *
 * - `list`: the owner's API method that answers `({ limit })` with the published, public records only,
 *   each carrying the address it is shown at (`path`) beside `id`, `title`/`name`, `slug`, `updatedAt`
 *   and whatever SEO fields the record holds. The address is the owner's to resolve — its permalink
 *   rules and route prefixes are its own settings.
 * - `at`: the owner's API method that answers `({ path })` with the record shown at that address, or
 *   `null`. For records reached by address that `list` does not enumerate (a category page).
 *
 * Read with `context.collections.publicContent()`; a plugin adds fields to every declaring collection
 * with `context.collections.extendPublicContent()`.
 */
export interface ICollectionPublicContent {
  list?: string;
  at?: string;
}
