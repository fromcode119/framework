/**
 * Client-side stub for @fromcode119/database.
 * The real database package is server-only (uses drizzle-orm/pg).
 * This stub prevents webpack from failing when core/sdk modules are compiled
 * for the browser — none of the database classes are ever called client-side.
 */
module.exports = new Proxy({}, {
  get: () => () => {},
});
