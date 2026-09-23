/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';

/**
 * A plugin does not write SQL at runtime.
 *
 * `context.db` is the whole surface: declarative collections shape the schema, and the framework
 * derives every statement from them. The three call sites this guard was written to hold at zero
 * were all the same shape — a plugin reaching past its own API to do something the framework should
 * own:
 *
 *   - one plugin ran `ALTER TABLE … DROP NOT NULL` for eleven columns on every boot, built by string
 *     interpolation, on the REQUEST connection — a non-owner, so it always failed and was swallowed.
 *     The framework reconciles a relaxed `required` now.
 *   - another carried three catalog reads against a table that no longer exists, in a class nothing
 *     called.
 *   - a third added a UNIQUE by hand for the same reason, and the declared-UNIQUE reconcile replaced it.
 *
 * MIGRATIONS ARE EXEMPT. A migration is DDL by nature and the repo's conventions say raw SQL there is
 * correct. That exemption is also why this guard matters: it is the line between "SQL in a frozen,
 * reviewed migration" and "SQL a plugin runs against a live database on every boot".
 */
export class PluginRawSqlGuard {
  /** Reaching for the raw database from plugin code. */
  private static readonly RAW_CALLS = [
    /\.db\.execute\s*\(/,
    /\.db\.queryRaw\s*\(/,
  ];

  private static readonly ALLOWED = [
    /\/migrations\//,
    /\.test\.tsx?$/,
    /\/tests?\//,
  ];

  /** Plugins that still hold a runtime raw call. Empty, and it must stay that way. */
  private static readonly BASELINE = new Set<string>([]);

  static run(): number {
    const root = process.cwd();
    // Run from framework/Source like every other guard; plugins live beside it.
    const pluginsRoot = path.resolve(root, '../../plugins');
    const offenders: Array<{ file: string; line: number; text: string }> = [];

    for (const file of PluginRawSqlGuard.walk(pluginsRoot)) {
      const relative = path.relative(path.resolve(root, '../..'), file).split(path.sep).join('/');
      if (PluginRawSqlGuard.ALLOWED.some((allowed) => allowed.test(`/${relative}`))) continue;

      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((text, index) => {
        if (PluginRawSqlGuard.isComment(text)) return;
        if (!PluginRawSqlGuard.RAW_CALLS.some((pattern) => pattern.test(text))) return;
        offenders.push({ file: relative, line: index + 1, text: text.trim() });
      });
    }

    const unexpected = offenders.filter((entry) => !PluginRawSqlGuard.BASELINE.has(entry.file));

    console.log('Plugin raw SQL (runtime `db.execute` / `db.queryRaw`, migrations exempt):');
    console.log(`  runtime raw calls outside migrations: ${unexpected.length}`);

    if (unexpected.length === 0) {
      console.log('\nPlugin raw SQL guard passed.');
      return 0;
    }

    console.log('\nA plugin is running SQL against a live database:\n');
    for (const entry of unexpected) {
      console.log(`  ${entry.file}:${entry.line}`);
      console.log(`    ${entry.text.slice(0, 140)}`);
    }
    console.log(
      '\nDeclare it instead. A schema change belongs in the collection (the framework reconciles an'
      + '\nexisting table); a read or write belongs in `context.db.find/insert/update`. If the'
      + '\nframework genuinely cannot express it, add the capability there rather than reaching'
      + '\npast it here — a plugin runs on the REQUEST connection, which owns no table.',
    );
    return 1;
  }

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
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'ui') continue;
        yield* PluginRawSqlGuard.walk(full);
        continue;
      }
      if (/\.tsx?$/.test(entry.name)) yield full;
    }
  }
}
