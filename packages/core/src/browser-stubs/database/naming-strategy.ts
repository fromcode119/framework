/**
 * Browser-side stand-in for `NamingStrategy` of `@fromcode119/database`. The real package is server-only
 * (drizzle-orm/pg); core modules that import it are compiled for the browser too, where this name is
 * never called. An empty class keeps the import resolvable — nothing more.
 */
export class NamingStrategy {}
