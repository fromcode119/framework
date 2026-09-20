/**
 * Runs a theme's BUILT seed against the verify stack's own database.
 *
 * Executed INSIDE the api container, from `/app/data`, so `@fromcode119/*` resolves out of
 * `/app/node_modules` — the seed bundle keeps those packages external. This file is TypeScript;
 * `verify-stack.sh` compiles it to an ESM artifact beside the state directory and runs THAT, the same
 * way every other entry point here ships as built output rather than as source.
 *
 * Core's SERVER-only services (collection write compatibility, page contracts, …) are registered by an
 * explicit call at api boot, never by a barrel side effect. A theme seed reaches them through
 * CoreServices, so this makes the same call the api makes.
 */
import { ServerCoreServices } from '@fromcode119/core';
import { DatabaseFactory } from '@fromcode119/sdk/database';

/** A seed module exports one class with a static `seed(db)`; which name it has is the theme's business. */
interface SeedClass {
  seed(db: unknown): Promise<void>;
}

class VerifySeedRunner {
  /**
   * The database must be THIS stack's own, and the guard exists to make seeding the SHARED stack
   * impossible. It once allowed only `file:/app/data/…` because the stack ran on SQLite; it runs on its
   * own PostgreSQL now, so the rule is the same idea restated — named `fcverify`, on the `db` host
   * inside the fcverify network. A seed pointed at the shared stack would write a client's pages.
   */
  private static isOwnDatabase(url: string): boolean {
    const ownSqlite = url.startsWith('file:/app/data/');
    const ownPostgres = /^postgres(ql)?:\/\/[^@]*@db:5432\/fcverify(\?|$)/.test(url);
    return ownSqlite || ownPostgres;
  }

  static async main(): Promise<number> {
    ServerCoreServices.register();

    const slug = process.argv[2];
    if (!slug) {
      console.error('usage: verify-seed-runner <theme-slug>');
      return 2;
    }

    const url = String(process.env.DATABASE_URL || '');
    if (!VerifySeedRunner.isOwnDatabase(url)) {
      console.error(`refusing to seed a database that is not this stack's own: ${url.replace(/:\/\/[^@]*@/, '://***@')}`);
      return 2;
    }

    const module = await import(`./theme-${slug}/seed.mjs`);
    const seedClass = Object.values(module)
      .find((value): value is SeedClass => Boolean(value) && typeof (value as SeedClass).seed === 'function');
    if (!seedClass) {
      console.error('seed module exports no class with a static seed(db)');
      return 2;
    }

    const db = DatabaseFactory.create(url);
    await db.connect();
    await seedClass.seed(db);
    return 0;
  }
}

process.exit(await VerifySeedRunner.main());
