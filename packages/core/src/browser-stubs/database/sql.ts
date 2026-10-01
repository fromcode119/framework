/**
 * Browser-side stand-in for `Sql` of `@fromcode119/database`. The real package is server-only; core
 * modules that import it are compiled for the browser too, where it is never called. An empty class
 * keeps the import resolvable — nothing more.
 */
export class Sql {}
