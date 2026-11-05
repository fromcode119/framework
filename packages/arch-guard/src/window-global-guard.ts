import { SourceTree } from './source-tree';

/**
 * WRITES to a browser/process global: `window.x = …`, `(window as any)[k] ||= …`, `globalThis[k] = …`,
 * `Object.defineProperty(window, …)`.
 *
 * Any script or console on the page can replace a value hung on `window`, so a global used as a channel
 * is data anyone can forge. Values a page needs come from a module (module-private state, an accessor
 * such as `PagePrefetch`) or inert markup (`<script type="application/json">`).
 *
 * `window.dataLayer` is Google Tag's own contract and is not reported.
 *
 * Ratcheted per file: the writes listed in {@link BASELINE} are the runtime handoff that is still being
 * replaced. The count of a listed file may fall, never rise; any other file must have none.
 */
export class WindowGlobalGuard {
  private static readonly PATTERNS = [
    /\(*\b(?:window|globalThis)\b(?:\s+as\s+[^)\]=]+)?\)*\s*(?:\??\.\s*(?!dataLayer\b)[A-Za-z_$][\w$]*|(?:\?\.)?\[[^\]]+\])\s*(?:\|\|=|\?\?=|=(?![=>]))/g,
    /Object\.defineProperty\(\s*(?:window|globalThis)\b/g,
  ];

  /** Files still allowed their CURRENT number of writes — the runtime registry / boot handoff. */
  static readonly BASELINE: Readonly<Record<string, number>> = {
    // The runtime module registry: ONE locked binding (non-writable, non-configurable) whose view refuses
    // every write — only the framework's private store behind it changes.
    'core/src/runtime-registry-access.ts': 1,
    // SERVER process, never a page: the privileged spawner shared between the two copies of core one
    // process loads (Next bundles core from source, the launcher runs it from dist). No script reaches it.
    'core/src/process/spawner-client.ts': 5,
  };

  /**
   * Tests and migrations only. `ui` and `ui-ssr` used to be skipped too, which by name left out every
   * plugin's browser code — the one place a page global is actually written.
   */
  static readonly SKIP_DIRS: ReadonlySet<string> = new Set(['tests', '__tests__', 'migrations']);

  /** The text of each string literal on a line, blanked: `'…window.x = 1…'` is markup, not a write. */
  private static readonly LITERAL = /(['"`])(?:\\.|(?!\1)[^\\])*\1/g;

  static code(line: string): string {
    return line.replace(WindowGlobalGuard.LITERAL, (literal) => `${literal[0]}${' '.repeat(literal.length - 2)}${literal[0]}`);
  }

  /** `const w = window as …` / `const target = globalThis` — a write through the alias is a write to the global. */
  private static readonly ALIAS = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*\(*\s*(?:window|globalThis)\b(?!\s*\.)/g;

  static violationsIn(file: string): string[] {
    const lines = SourceTree.lines(file);
    const aliases = new Set<string>();
    for (const line of lines) for (const match of line.matchAll(WindowGlobalGuard.ALIAS)) aliases.add(match[1]);
    // A file that declares its own `window` (a date window, a rank-maintenance window) is not writing the global.
    const shadowsWindow = lines.some((line) => /\b(?:const|let|var)\s+window\b|[(,]\s*window\s*[:,)]/.test(line));
    const patterns = shadowsWindow ? [] : [...WindowGlobalGuard.PATTERNS];
    if (aliases.size) {
      const names = [...aliases].map((name) => name.replace(/\$/g, '\\$')).join('|');
      patterns.push(new RegExp(`\\(*\\b(?:${names})\\b\\)*\\s*(?:\\??\\.\\s*[A-Za-z_$][\\w$]*|(?:\\?\\.)?\\[[^\\]]+\\])\\s*(?:\\|\\|=|\\?\\?=|=(?![=>]))`, 'g'));
    }
    const hits: string[] = [];
    lines.forEach((raw, index) => {
      if (/^\s*(\*|\/\/|\/\*)/.test(raw)) return;
      const line = WindowGlobalGuard.code(raw);
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        for (const match of line.matchAll(pattern)) hits.push(`${index + 1}: ${match[0].trim().slice(0, 80)}`);
      }
    });
    return hits;
  }

  static baselineKey(file: string): string {
    const normalized = file.replace(/\\/g, '/');
    const at = normalized.lastIndexOf('/packages/');
    return at >= 0 ? normalized.slice(at + '/packages/'.length) : normalized;
  }

  static run(): number {
    const findings: string[] = [];
    let scanned = 0;
    for (const { area, dir } of SourceTree.areas()) {
      const files = SourceTree.files(dir, (name) => /\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith('.d.ts') && !/\.setup\.tsx?$/.test(name), WindowGlobalGuard.SKIP_DIRS);
      for (const file of files) {
        scanned++;
        const hits = WindowGlobalGuard.violationsIn(file);
        if (!hits.length) continue;
        const allowed = area === 'framework' ? (WindowGlobalGuard.BASELINE[WindowGlobalGuard.baselineKey(file)] ?? 0) : 0;
        if (hits.length <= allowed) continue;
        findings.push(`  ${SourceTree.cite(file)} — ${hits.length} write(s), ${allowed} allowed\n${hits.map((hit) => `      ${hit}`).join('\n')}`);
      }
    }
    if (!findings.length) {
      console.log(`no-window-globals: ${scanned} files, no new global writes.`);
      return 0;
    }
    console.error(`no-window-globals: ${findings.length} file(s) write a browser/process global.\n`
      + 'A global is writable by any script on the page — keep the value in a module or inert JSON instead.\n\n'
      + findings.join('\n'));
    return 1;
  }
}
