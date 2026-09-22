/* eslint-disable */
import fs from 'node:fs';
import path from 'node:path';
import { SourceTree } from './source-tree';
import { FrameworkRoot } from './cli/framework-root';

/**
 * `admin.renderedBy` must name a field that actually renders it.
 *
 * `renderedBy` tells the admin to skip a field because a SIBLING field's component draws its control.
 * That is what separates it from `admin.hidden`: hidden asserts there is no control, which Rule Zero
 * forbids, while `renderedBy` names where the control lives and stays answerable.
 *
 * It only stays answerable if the name is right. A typo, a rename of the host field, or a host that
 * never declares `admin.component` all produce the SAME outcome as `hidden` — the value ships, still
 * drives behaviour, and has no control anyone can point at — except now it looks deliberate, because
 * the declaration claims an owner. That is worse than `hidden`, which is at least honest about it.
 *
 * So this checks three things per declaration:
 *   1. the named field exists in the same collection file;
 *   2. it is not the field itself (a field cannot render itself);
 *   3. it declares `admin.component`, because only a custom component can render a sibling's value.
 *
 * Matches BOTH quote styles, for the reason written on `JsonFieldControlGuard`: a single-quote-only
 * scanner once reported a confident zero across fields it had never looked at.
 */
export class RenderedByTargetGuard {
  private static readonly SKIP = new Set(['migrations', 'tests']);

  /** Field blocks in a source file, keyed by declared name. */
  private static fieldBlocks(source: string): Map<string, string> {
    const blocks = new Map<string, string>();
    for (const match of source.matchAll(/name:\s*['"]([^'"]+)['"]/g)) {
      const block = RenderedByTargetGuard.enclosingObject(source, match.index!);
      if (block) blocks.set(match[1], block);
    }
    return blocks;
  }

  /** The enclosing object literal for an offset, by walking balanced braces outward. */
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

  /**
   * The FIELD block for an offset, not merely the nearest one.
   *
   * `renderedBy` sits inside `admin: { … }`, so walking out once lands in the admin block, which has
   * no `name:` — the first version of this guard reported every finding as `<unnamed>`, which tells a
   * reader nothing about which field broke. Keep walking outward until a block declares a name.
   */
  private static enclosingField(source: string, offset: number): string | null {
    let at = offset;
    for (let depth = 0; depth < 4; depth++) {
      const block = RenderedByTargetGuard.enclosingObject(source, at);
      if (!block) return null;
      if (/name:\s*['"]/.test(block)) return block;
      const start = source.lastIndexOf(block, at);
      if (start <= 0) return null;
      at = start - 1;
    }
    return null;
  }

  private static verdict(owner: string, self: string, blocks: Map<string, string>): string | null {
    if (owner === self) return `renderedBy points at itself`;
    const host = blocks.get(owner);
    if (!host) return `renderedBy: '${owner}' — no field by that name in this collection`;
    if (!/component:\s*['"]/.test(host)) {
      return `renderedBy: '${owner}' — that field declares no admin.component, so nothing renders this value`;
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
        RenderedByTargetGuard.SKIP,
      );

      for (const file of files) {
        const source = SourceTree.lines(file).join('\n');
        if (!/renderedBy:\s*['"]/.test(source)) continue;
        const blocks = RenderedByTargetGuard.fieldBlocks(source);

        for (const match of source.matchAll(/renderedBy:\s*['"]([^'"]+)['"]/g)) {
          scanned++;
          const block = RenderedByTargetGuard.enclosingField(source, match.index!);
          if (!block) continue;
          const self = (block.match(/name:\s*['"]([^'"]+)['"]/) ?? [])[1] ?? '<unnamed>';

          const why = RenderedByTargetGuard.verdict(match[1], self, blocks);
          if (!why) continue;

          const line = source.slice(0, match.index!).split('\n').length;
          findings.push(`  ${plugin.name.padEnd(16)} ${self.padEnd(24)} ${SourceTree.cite(file)}:${line}\n`
            + `  ${''.padEnd(16)} ${''.padEnd(24)} ${why}`);
        }
      }
    }

    console.log(`Scanned ${scanned} renderedBy declaration(s), both quote styles.`);
    if (!findings.length) {
      console.log('OK — every renderedBy names a sibling field that renders it.');
      return 0;
    }

    console.log(`\n${findings.length} field(s) whose declared renderer cannot render them:\n`);
    for (const finding of findings) console.log(finding);
    console.log('\nEach value is now invisible to the operator with nothing to point at — the exact');
    console.log('Rule Zero failure `renderedBy` exists to avoid. Point it at a sibling field on the');
    console.log('same collection that declares admin.component, or drop the declaration.');
    return 1;
  }
}
