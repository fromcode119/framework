/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';
import { SourceTree } from './source-tree';
import { FrameworkRoot } from './cli/framework-root';

/**
 * A `type: 'json'` collection field with no real admin control.
 *
 * Such a field renders as `JSON.stringify` in a textarea. Asking an operator to hand-edit a blob is
 * the same failure as a half-wired field: the control does not do what it implies. Every json field
 * resolves to a real control (`admin.component`), a read-only display (`StructuredReadOnlyField` with
 * an `admin.description` naming who writes it), or deletion.
 *
 * `admin.hidden` is NOT a resolution. A hidden value still ships and still drives behaviour with no
 * control anyone can point at, which is the Rule Zero violation the whole rule exists to prevent.
 *
 * Matches BOTH quote styles. A single-quote-only version of this scanner once reported a confident
 * "0 findings" across 45 fields it had never looked at.
 */
export class JsonFieldControlGuard {
  private static readonly SKIP = new Set(['migrations', 'tests']);

  /**
   * The enclosing field literal for an offset, by walking balanced braces outward.
   *
   * A regex cannot do this: `defaultValue: { monday: {…} }` closes braces the field does not, so any
   * pattern that stops at the first `}` reads the wrong block and judges the wrong field.
   */
  private static enclosingObject(source: string, offset: number): string | null {
    let depth = 0;
    let start = -1;

    for (let at = offset; at >= 0; at--) {
      const char = source[at];
      if (char === '}') depth++;
      else if (char === '{') {
        if (depth === 0) { start = at; break; }
        depth--;
      }
    }
    if (start === -1) return null;

    depth = 0;
    for (let at = start; at < source.length; at++) {
      const char = source[at];
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) return source.slice(start, at + 1);
      }
    }
    return null;
  }

  /** Why this field fails the rule, or null when it passes. */
  private static verdict(block: string): string | null {
    if (/hidden:\s*true/.test(block)) return 'hidden — Rule Zero violation, the operator cannot see it';

    const component = (block.match(/component:\s*['"]([^'"]+)['"]/) ?? [])[1] ?? '';
    if (!component) return 'no admin.component — renders a raw JSON textarea';

    if (component === 'StructuredReadOnlyField' && !/description:\s*['"`]/.test(block)) {
      return 'display without admin.description naming who writes it';
    }
    return null;
  }

  static run(): number {
    const pluginsDir = path.resolve(FrameworkRoot.repo(), 'plugins');
    const findings: string[] = [];
    let scanned = 0;

    let plugins: fs.Dirent[] = [];
    try {
      plugins = fs.readdirSync(pluginsDir, { withFileTypes: true });
    } catch {
      console.log(`No plugins directory at ${pluginsDir}; nothing to scan.`);
      return 0;
    }

    for (const plugin of plugins) {
      if (!plugin.isDirectory()) continue;
      const src = path.join(pluginsDir, plugin.name, 'src');
      if (!fs.existsSync(src)) continue;

      const files = SourceTree.files(
        src,
        (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
        JsonFieldControlGuard.SKIP,
      );

      for (const file of files) {
        const source = SourceTree.lines(file).join('\n');
        for (const match of source.matchAll(/type:\s*['"]json['"]/g)) {
          scanned++;
          const block = JsonFieldControlGuard.enclosingObject(source, match.index!);
          if (!block) continue;

          const why = JsonFieldControlGuard.verdict(block);
          if (!why) continue;

          const name = (block.match(/name:\s*['"]([^'"]+)['"]/) ?? [])[1] ?? '<unnamed>';
          const line = source.slice(0, match.index!).split('\n').length;
          findings.push(`  ${plugin.name.padEnd(16)} ${name.padEnd(24)} ${SourceTree.cite(file)}:${line}\n`
            + `  ${''.padEnd(16)} ${''.padEnd(24)} ${why}`);
        }
      }
    }

    console.log(`Scanned ${scanned} json collection field(s), both quote styles.`);
    if (!findings.length) {
      console.log('OK — every json field has a real control, or a display that names who writes it.');
      return 0;
    }

    console.log(`\n${findings.length} json field(s) the operator cannot properly see or set:\n`);
    for (const finding of findings) console.log(finding);
    console.log('\nEach needs a real control (admin.component), a read-only display');
    console.log("(admin.component: 'StructuredReadOnlyField' + admin.description naming the writer),");
    console.log('or deletion if nothing writes AND nothing reads it. Never admin.hidden.');
    return findings.length ? 1 : 0;
  }
}
