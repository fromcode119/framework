import fs from 'fs';
import path from 'path';
import { BlockFieldSourceReader } from './block-field-source-reader';

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
    const repoRoot = BlockFieldSourceReader.repoRoot();
    const findings: string[] = [];

    for (const root of roots) {
      const abs = path.join(repoRoot, root);
      if (!fs.existsSync(abs)) continue;

      const renderers = BlockFieldSourceReader.rendererIndex(abs);

      // `.tsx?`, not `.tsx`: a block whose definition carries no JSX lives in a `.ts` file (the content plugin's
      // `team-block.ts`, `testimonials-block.ts`, `two-col-icons-block.ts`, …). Matching only `.tsx`
      // skipped every one of them. The `renderSettings` gate below keeps enums/interfaces out.
      for (const blockFile of BlockFieldSourceReader.walk(abs, /blocks?[\\/].*\.tsx?$/)) {
        const src = BlockFieldSourceReader.read(blockFile);
        if (!src.includes('renderSettings')) continue;

        for (const [blockId, written] of BlockFieldSourceReader.writtenKeysByBlock(src, blockFile)) {
          const rendererFile = renderers.get(BlockFieldSourceReader.normalize(blockId));
          if (!rendererFile) continue;

          // A renderer delegates the same way an editor does — a `hero-renderer.tsx` picks between
          // `home-hero-renderer.tsx`, `detail-hero-renderer.tsx` and `hero-slider-renderer.tsx`, and
          // reads almost nothing itself. Judging it on its own text reported eleven working hero
          // controls as FAKE.
          const rawRendererSrc = BlockFieldSourceReader.read(rendererFile);
          const rendererSrc = BlockFieldSourceReader.withDelegates(
            rawRendererSrc,
            BlockFieldSourceReader.siblingSources(rendererFile, rawRendererSrc, 2),
          );
          const read = BlockFieldSourceReader.readKeys(rendererSrc);
          if (read.size === 0) continue;

          const fake = [...written].filter(
            (key) => !read.has(key) && !BlockFieldConformanceGuard.IGNORED_KEYS.has(key),
          );
          const fallbacks = BlockFieldSourceReader.fallbackKeys(rendererSrc);
          const groups = BlockFieldSourceReader.aliasGroups(rendererSrc);
          const covered = (key: string): boolean =>
            written.has(key)
            || fallbacks.has(key)
            || groups.some((group) => group.has(key) && [...group].some((alias) => written.has(alias)));
          const missing = [...read].filter(
            (key) => !covered(key) && !BlockFieldConformanceGuard.IGNORED_KEYS.has(key),
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

}
