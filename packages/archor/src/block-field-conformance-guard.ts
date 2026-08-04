import fs from 'fs';
import path from 'path';

/**
 * A block's editor and its renderer must agree on the data keys.
 *
 * Two failure modes, both shipped repeatedly before this guard existed:
 *
 *  - **FAKE control** — `renderSettings` writes a key the renderer never reads. The editor shows a
 *    control that changes nothing, which is worse than no control because it lies to the editor.
 *    Real examples: a hero's "Show pricing + CTA" in a mode whose renderer ignores it; a slider
 *    slide `description` field read exactly 0 times.
 *  - **MISSING control** — the renderer reads a key no editor writes, so content visible on the page
 *    has no field anywhere. Real example: the homepage hero's `description` and `services`.
 *
 * Deliberately textual and conservative: it pairs a block definition with the renderer of the same
 * id and only reports keys it is confident about. Defaults to warn mode so it can be adopted without
 * blocking a build on day one; `BLOCK_CONFORMANCE_MODE=error` makes it fail.
 */
export class BlockFieldConformanceGuard {
  /** Keys owned by the framework/wrapper rather than a block's own renderer. */
  private static readonly IGNORED_KEYS = new Set([
    'anchor', 'id', 'type', 'layout', 'style', 'children', 'childBlocks',
    'styleVariant', 'colorScheme', 'className',
  ]);

  static run(
    roots: string[] = ['themes', 'plugins'],
    mode: string = process.env.BLOCK_CONFORMANCE_MODE || 'warn',
  ): number {
    const repoRoot = BlockFieldConformanceGuard.repoRoot();
    const findings: string[] = [];

    for (const root of roots) {
      const abs = path.join(repoRoot, root);
      if (!fs.existsSync(abs)) continue;

      const renderers = BlockFieldConformanceGuard.rendererIndex(abs);

      for (const blockFile of BlockFieldConformanceGuard.walk(abs, /blocks?[\\/].*\.tsx$/)) {
        const src = BlockFieldConformanceGuard.read(blockFile);
        if (!src.includes('renderSettings')) continue;

        for (const [blockId, written] of BlockFieldConformanceGuard.writtenKeysByBlock(src)) {
          const rendererFile = renderers.get(BlockFieldConformanceGuard.normalize(blockId));
          if (!rendererFile) continue;

          const read = BlockFieldConformanceGuard.readKeys(BlockFieldConformanceGuard.read(rendererFile));
          if (read.size === 0) continue;

          const fake = [...written].filter(
            (key) => !read.has(key) && !BlockFieldConformanceGuard.IGNORED_KEYS.has(key),
          );
          const missing = [...read].filter(
            (key) => !written.has(key) && !BlockFieldConformanceGuard.IGNORED_KEYS.has(key),
          );
          const rel = path.relative(repoRoot, blockFile);
          if (fake.length) {
            findings.push(`  ${rel}  [${blockId}]  FAKE (editor writes, renderer never reads): ${fake.join(', ')}`);
          }
          if (missing.length) {
            findings.push(`  ${rel}  [${blockId}]  MISSING (renderer reads, no control): ${missing.join(', ')}`);
          }
        }
      }
    }

    if (!findings.length) {
      console.log('[check-block-field-conformance] OK');
      return 0;
    }
    console.error('[check-block-field-conformance] Block editor/renderer key mismatches:\n');
    for (const finding of findings) console.error(finding);
    console.error(
      `\n  ${findings.length} mismatch(es). FAKE = a control that changes nothing. MISSING = content with no field.`,
    );
    return mode === 'error' ? 1 : 0;
  }

  /**
   * Block id -> the data keys its `renderSettings` writes.
   *
   * Two layouts exist and mixing them up produces WRONG findings, which is worse than none:
   *   1. inline — `{ id: 'x', renderSettings: … updateData('k') … }`
   *   2. deferred — `static readonly FooBlock = Factory.create({ id: 'x' })` and then, further down,
   *      `static { Owner.FooBlock.renderSettings = … }`. Slicing purely on `id:` position blames the
   *      NEXT block for the previous one's keys (detailHero was reported as writing the slider's).
   * So: resolve member -> id first, then attribute each `<Owner>.<Member>.renderSettings =` chunk to
   * the id of THAT member. Only fall back to positional slicing for the inline form.
   */
  private static writtenKeysByBlock(src: string): Map<string, Set<string>> {
    const out = new Map<string, Set<string>>();
    // Literal keys, plus keys fed in dynamically. A block that does
    // `['paragraph1','paragraph2'].map((k) => updateData(k, …))` writes those keys just as surely as
    // a literal call — counting only literals reported them as MISSING, which is a false alarm and
    // exactly the kind of noise that gets a check ignored.
    const keysIn = (chunk: string) => {
      const keys = new Set(
        [...chunk.matchAll(/updateData\(\s*['"]([A-Za-z0-9_]+)['"]/g)].map((match) => match[1]),
      );
      const hasDynamicCall = /updateData\(\s*[A-Za-z_$][A-Za-z0-9_$]*\s*,/.test(chunk);
      if (hasDynamicCall) {
        for (const arrayLiteral of chunk.matchAll(/\[\s*((?:['"][A-Za-z0-9_]+['"]\s*,\s*)+['"][A-Za-z0-9_]+['"])\s*\]/g)) {
          for (const item of arrayLiteral[1].matchAll(/['"]([A-Za-z0-9_]+)['"]/g)) keys.add(item[1]);
        }
      }
      return keys;
    };

    // member name -> block id, e.g. `HomeHeroSectionBlock` -> `custom-homeHero`
    const memberToId = new Map<string, string>();
    for (const match of src.matchAll(
      /static\s+readonly\s+([A-Za-z0-9_]+)\s*=[\s\S]{0,400}?id:\s*['"]([A-Za-z0-9_-]+)['"]/g,
    )) {
      memberToId.set(match[1], match[2]);
    }

    // deferred: `Owner.Member.renderSettings = ( … )` up to the next such assignment
    const assignments = [...src.matchAll(/([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\.renderSettings\s*=/g)]
      .map((match) => ({ member: match[2], at: match.index ?? 0 }));
    for (let i = 0; i < assignments.length; i += 1) {
      const id = memberToId.get(assignments[i].member);
      if (!id) continue;
      const end = i + 1 < assignments.length ? assignments[i + 1].at : src.length;
      const keys = keysIn(src.slice(assignments[i].at, end));
      if (keys.size) out.set(id, keys);
    }

    // inline: slice on `id:` markers, skipping ids already resolved above
    const marks = [...src.matchAll(/id:\s*['"]([A-Za-z0-9_-]+)['"]/g)]
      .map((match) => ({ id: match[1], at: match.index ?? 0 }));
    for (let i = 0; i < marks.length; i += 1) {
      if (out.has(marks[i].id)) continue;
      const end = i + 1 < marks.length ? marks[i + 1].at : src.length;
      const chunk = src.slice(marks[i].at, end);
      if (!chunk.includes('renderSettings')) continue;
      const keys = keysIn(chunk);
      if (keys.size) out.set(marks[i].id, keys);
    }
    return out;
  }

  /** `data?.key` / `data.key` reads in a renderer. */
  private static readKeys(src: string): Set<string> {
    return new Set([...src.matchAll(/\bdata\s*\??\.\s*([A-Za-z0-9_]+)/g)].map((match) => match[1]));
  }

  /** Renderer files indexed by normalised basename, so `custom-vision-board` matches `custom-visionBoard`. */
  private static rendererIndex(abs: string): Map<string, string> {
    const index = new Map<string, string>();
    for (const file of BlockFieldConformanceGuard.walk(abs, /renderers?[\\/].*\.tsx$/)) {
      index.set(BlockFieldConformanceGuard.normalize(path.basename(file, '.tsx')), file);
    }
    return index;
  }

  private static normalize(value: string): string {
    return value.toLowerCase().replace(/[-_]/g, '');
  }

  private static read(file: string): string {
    try {
      return fs.readFileSync(file, 'utf8');
    } catch {
      return '';
    }
  }

  private static *walk(dir: string, match: RegExp): Generator<string> {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.next') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) yield* BlockFieldConformanceGuard.walk(full, match);
      else if (match.test(full)) yield full;
    }
  }

  private static repoRoot(): string {
    let dir = process.cwd();
    for (let i = 0; i < 8; i += 1) {
      if (fs.existsSync(path.join(dir, 'build-plugins.sh'))) return dir;
      dir = path.dirname(dir);
    }
    return process.cwd();
  }
}
