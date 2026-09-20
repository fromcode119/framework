/* eslint-disable */
import { SourceTree } from './source-tree';

/**
 * The same field read under two spellings — `row.cityName || row.city_name` — where one is dead.
 *
 * The database proxy denormalises every row to the schema's camelCase names, so a snake_case
 * alternative beside a camelCase one never matches anything. It reads like defensiveness and is
 * simply unreachable, which is why it survives: nothing fails when it is wrong.
 *
 * PROPERTY ACCESS only, never string literals. A snake_case key inside a third-party payload is
 * correct and common — a payment processor's `amount_refunded`, a courier's `city_name` — so the
 * rule is about a line reading BOTH spellings of one field, not about the existence of a snake name.
 *
 * Reports, never gates. Two findings stand today and both are the legitimate third-party case; a
 * rule that cannot tell those from a real duplicate has no business failing a build.
 */
export class SnakePropertyAccessGuard {
  private static readonly SKIP = new Set(['ui-ssr', 'archive', 'migrations', 'seeds']);

  /**
   * The line with every string literal blanked out.
   *
   * The rule is about PROPERTY ACCESS, and a dotted path inside a quoted string is not one. An i18n
   * key like `'shop.fields.currency_overrides.remove_row'` sitting on the same line as a
   * `this.removeRow(index)` call reads, to a naive regex, as the same field spelled two ways. It is
   * not — and that single shape accounted for most of 115 reported hits when this rule was first run
   * over the whole tree, having previously only ever seen a fraction of it.
   *
   * Blanked rather than removed, so every column stays where it was and a citation still points at
   * the right place.
   */
  private static withoutStrings(line: string): string {
    return line.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, (match) => match[0] + ' '.repeat(Math.max(0, match.length - 2)) + match[0]);
  }

  /** `city_name` -> `cityName`, so the two spellings of one field can be compared. */
  private static camelOf(name: string): string {
    return name.replace(/_([a-z0-9])/g, (_full, letter: string) => letter.toUpperCase());
  }

  static run(): number {
    const hits: string[] = [];

    for (const file of SourceTree.typescript(SnakePropertyAccessGuard.SKIP)) {
      // A FILE whose name says migration or normalizer is excluded — those legitimately speak SQL's
      // spelling. Excluded by skipping the file, not by ending the directory: the script this came
      // from returned instead of continuing, so one such file stopped the walk of everything after it.
      if (/migration|normalizer/i.test(file)) continue;

      SourceTree.lines(file).forEach((line, index) => {
        if (SourceTree.isComment(line)) return;

        const code = SnakePropertyAccessGuard.withoutStrings(line);

        // The RECEIVER matters. `this.logRetentionDays = String(response?.log_retention_days)` names
        // two different objects, and the snake one is a third party's field arriving over the wire —
        // exactly the spelling that is allowed to be snake. Only the same receiver read twice is the
        // duplication this rule is about.
        const reads = [...code.matchAll(/\b([A-Za-z_$][\w$]*)\s*\??\.\s*([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/g)];
        if (!reads.length) return;

        for (const [, receiver, snake] of reads) {
          const camel = SnakePropertyAccessGuard.camelOf(snake!);
          if (!new RegExp(`\\b${receiver}\\s*\\??\\.\\s*${camel}\\b`).test(code)) continue;
          hits.push(`${SourceTree.cite(file)}:${index + 1}  ${line.trim().slice(0, 120)}`);
          return;
        }
      });
    }

    console.log(`Same field read under two spellings (property access): ${hits.length}`);
    for (const hit of hits) console.log(`  ${hit}`);
    if (hits.length) {
      console.log('Each line reads one field twice. Establish which spelling the schema declares and delete the other —');
      console.log('deleting the wrong half is silent, and removing a third-party payload\'s own name breaks the read.');
    }
    return 0;
  }
}
