/* eslint-disable */
import { createHash } from 'node:crypto';

/**
 * Names the framework must never spell, held as HASHES so that this file does not spell them either.
 *
 * `ExtensionNameGuard` finds a slug by the shapes only a slug can take (`fcp_<slug>_`, `<slug>Api`, a
 * versioned plugin route), because most slugs are ordinary English and a bare-word scan for them is
 * all false positives. That left the prose untouched, and the prose is where names actually leaked:
 * 229 of them across 98 framework files, every one a comment or a test fixture — a plugin cited as the
 * example, a courier named in an incident note, a client's site as the tenant id in a CLI usage line.
 *
 * Some names are NOT ordinary words, and for those a bare-word match is exact. They cannot be read off
 * the extension directories the way the structural shapes are: a courier or a client site is not a
 * directory name, and the framework's CI checks out no extension at all, so a list discovered on disk
 * is empty exactly where it has to hold. Written out in plain text the list would put every name back
 * into `packages/` — the very thing it forbids. A hash is the one form that is both checkable
 * everywhere and names nothing.
 *
 * Only DISTINCTIVE names belong here. A slug that is also an English word the framework uses for its
 * own features (`search`, `forms`, `marketplace`, …) must never be added: it would fire on the
 * framework describing itself, and a guard that cries wolf is switched off within a day.
 *
 * To add one: `arch-guard extension-names --hash <name>`, and paste the line it prints.
 */
export class DistinctiveNameScan {
  /** `hash(name)` for each denied name. */
  private static readonly DENIED: ReadonlySet<string> = new Set([
    'da0a54c67f1f29cd',
    '39bcae4f93d4e3fc',
    '16314fa6adb68da6',
    '8c7ba4ba6fe81046',
    '0bf7fde021283475',
    '3c69684fb58f5ba8',
    '535c2e888a01839f',
    '9f1efbe70a003f6a',
    '02f5f0a9b7e47af7',
    'f2a36343a196395f',
    'c0a1e82821a80f6c',
    '7674444391fb9647',
    '14df33447097f33a',
    '07b137fa1dafeaef',
    '6684bd7ca5b11822',
  ]);

  /** A word seen once is not hashed again; a scan of the framework meets the same words constantly. */
  private readonly seen = new Map<string, boolean>();

  /** The first 16 hex characters of the SHA-256 of the lower-cased name. */
  static hash(name: string): string {
    return createHash('sha256').update(name.trim().toLowerCase()).digest('hex').slice(0, 16);
  }

  /**
   * Every word on the line a name could hide in, lower-cased.
   *
   * A hyphenated run yields each of its contiguous sub-runs, so a slug with a hyphen is found inside a
   * longer one and a name is found as one half of a slug. Each part is also split on its camelCase
   * humps, so the name is found at the front of a class or a variable as well as standing alone.
   */
  static candidates(line: string): string[] {
    const out: string[] = [];

    for (const token of line.match(/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/g) ?? []) {
      const parts = token.split('-');
      for (let start = 0; start < parts.length; start++) {
        for (let end = start + 1; end <= parts.length; end++) out.push(parts.slice(start, end).join('-').toLowerCase());
      }
      for (const part of parts) {
        const humps = part.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|[0-9]+/g) ?? [];
        if (humps.length > 1) for (const hump of humps) out.push(hump.toLowerCase());
      }
    }

    return out;
  }

  /** The first denied word on the line, lower-cased, or null when it names nothing. */
  match(line: string): string | null {
    for (const word of DistinctiveNameScan.candidates(line)) {
      let denied = this.seen.get(word);
      if (denied === undefined) {
        denied = DistinctiveNameScan.DENIED.has(DistinctiveNameScan.hash(word));
        this.seen.set(word, denied);
      }
      if (denied) return word;
    }
    return null;
  }
}
