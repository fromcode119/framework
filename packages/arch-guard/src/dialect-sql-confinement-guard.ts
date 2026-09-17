/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Dialect-specific SQL stays beside the driver that owns it.
 *
 * Row-level security, the `pg_*` catalog and `set_config` are POSTGRES features with no portable
 * form. For a long time the statements that use them sat in a dialect-neutral folder and were called
 * from core, which cost two things visibly: every caller guarded with its own
 * `dialect !== 'postgres'` string compare, and a browser build needed an empty stub of the SQL class
 * to resolve — a stub whose methods would all have been `undefined` had it ever been reached.
 *
 * A convention with no guard is what produced that drift, so this is mechanical, and the allowance
 * is ZERO. It used to carry a list of three files permitted to break the rule, each with a note
 * saying which spec would move them; the notes were right and nothing moved, which is what an
 * exemption list does. All three are gone: one was dead code, one was a `DO $$` block that became a
 * driver method, and one was five catalog queries in CORE that became `ISchemaIntrospection`.
 *
 * Migrations are exempt by design: a migration is frozen raw SQL by nature, and the repo's own
 * conventions say so.
 */
export class DialectSqlConfinementGuard {
  /** What only a specific driver can execute. */
  private static readonly DIALECT_SQL = [
    /ROW LEVEL SECURITY/,
    /CREATE\s+POLICY/i,
    /DROP\s+POLICY/i,
    /set_config\s*\(/,
    /\bpg_policies\b/,
    /\bpg_index\b/,
    /\bpg_constraint\b/,
    /\bpg_attribute\b/,
    /\binformation_schema\b/,
  ];

  /**
   * Where dialect SQL is ALLOWED to live.
   *
   * `dialects/<name>/` is the home, and `migrations/` is exempt because a migration is frozen raw
   * SQL by nature — the repo's conventions say so explicitly.
   *
   * TESTS are exempt too, and deliberately: an isolation integration test has to set `app.tenant_id`
   * on a real client and read `pg_policies` back, which is the whole point of it. A test ships
   * nothing, so SQL there cannot drift into the product — and this guard exists to stop the product
   * carrying another driver's SQL, not to stop anyone testing Postgres against Postgres.
   *
   * The guard's own pattern list is exempt for the obvious reason.
   */
  private static readonly ALLOWED = [
    /\/packages\/database\/src\/dialects\/[^/]+\//,
    /\/migrations\//,
    /\.test\.tsx?$/,
    /\/tests?\//,
    /\/dialect-sql-confinement-guard\.ts$/,
  ];


  static run(): number {
    const root = process.cwd();
    const roots = [path.resolve(root, 'packages')];
    const offenders: Array<{ file: string; line: number; text: string }> = [];

    for (const dir of roots) {
      for (const file of DialectSqlConfinementGuard.walk(dir)) {
        const relative = path.relative(root, file).split(path.sep).join('/');
        const full = `/${relative}`;
        if (DialectSqlConfinementGuard.ALLOWED.some((allowed) => allowed.test(full))) continue;

        const lines = fs.readFileSync(file, 'utf8').split('\n');
        lines.forEach((text, index) => {
          if (DialectSqlConfinementGuard.isComment(text)) return;
          if (!DialectSqlConfinementGuard.DIALECT_SQL.some((pattern) => pattern.test(text))) return;
          offenders.push({ file: relative, line: index + 1, text: text.trim() });
        });
      }
    }

    console.log('Dialect SQL confinement (row-level security, pg catalog, set_config):');

    if (offenders.length === 0) {
      console.log('\nDialect SQL confinement passed.');
      return 0;
    }

    console.log(`\n${offenders.length} line(s) of dialect SQL outside the dialect that owns it:\n`);
    for (const entry of offenders) {
      console.log(`  ${entry.file}:${entry.line}`);
      console.log(`    ${entry.text.slice(0, 140)}`);
    }
    console.log(
      '\nMove it into packages/database/src/dialects/<dialect>/ and expose BEHAVIOUR through the'
      + '\ndriver (see ITenantIsolation) rather than handing SQL text back to the caller.',
    );
    return 1;
  }

  /** A commented-out or documented statement is prose, not something that runs. */
  private static isComment(text: string): boolean {
    const trimmed = text.trim();
    return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
  }

  private static *walk(dir: string): Generator<string> {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.next') continue;
        yield* DialectSqlConfinementGuard.walk(full);
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry.name)) yield full;
    }
  }
}
