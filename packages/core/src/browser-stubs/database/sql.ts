/**
 * Browser-side stand-in for `sql` of `@fromcode119/database`. The real package is server-only
 * (drizzle-orm/pg); core modules that import it are compiled for the browser too, where this name is
 * never called. An empty class keeps the import resolvable — nothing more.
 */

// Lower-case on purpose: it stands in for a FUNCTION export of the same name (drizzle's tagged template / operator).
export class sql {}
