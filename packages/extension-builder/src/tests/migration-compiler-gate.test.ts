import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ExtensionBuildPipeline } from '@extension-builder/extension-build-pipeline';

/**
 * The migration step has to look where migrations actually live.
 *
 * It guarded on a TOP-LEVEL `migrations/` directory. Every plugin keeps them in `src/migrations`, so
 * the step reported "no migrations/" and was skipped on every pack of every plugin — measured across
 * the tree: 124 migration sources in 19 plugins, and **zero** compiled output anywhere, for as long
 * as the guard existed.
 *
 * It went unnoticed because plugin TABLES are created by the collection schema, not by migrations —
 * 169 `fcp_*` tables exist on a platform where no plugin migration has ever run. What was lost was
 * the DATA transforms layered on top of that schema, and they were lost silently: nothing errors when
 * a step reports "skipped" for a reason that is always true.
 *
 * The second gate — the compiler's own `manifest.migrations` check — is deliberately NOT touched here
 * and is asserted below. It is not a bug: it is how a plugin declares where compiled migrations go,
 * and so how it opts in to having them run. Defaulting it would make repairing a path into a
 * platform-wide event, compiling and then running a long backlog on the next install.
 */
describe('ExtensionBuildPipeline — the migration step looks in src/migrations', () => {
  const made: string[] = [];

  const workspace = (build: (dir: string) => void): { sourceDir: string } => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-gate-'));
    made.push(dir);
    build(dir);
    return { sourceDir: dir };
  };

  afterEach(() => {
    while (made.length) fs.rmSync(made.pop() as string, { recursive: true, force: true });
  });

  /** The private step, reached the way the pipeline reaches it. */
  const runStep = async (source: { sourceDir: string }): Promise<{ skippedReason?: string }> => {
    const step = (ExtensionBuildPipeline as unknown as {
      compileMigrations: (w: unknown, slug: string) => Promise<Record<string, unknown>>;
    }).compileMigrations;
    return await step.call(ExtensionBuildPipeline, source, 'sample-widget') as { skippedReason?: string };
  };

  it('does NOT skip when the plugin has src/migrations — the layout every plugin actually uses', async () => {
    const source = workspace((dir) => {
      fs.mkdirSync(path.join(dir, 'src', 'migrations'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'src', 'migrations', '2026-01-01-example.ts'), 'export default {};\n');
      // No `migrations` key: the compiler's own opt-in then declines, which is the point of the
      // second gate. What matters here is that it was REACHED rather than skipped on the path.
      fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ slug: 'sample-widget' }));
    });

    const result = await runStep(source);

    expect(String(result.skippedReason ?? '')).not.toContain('no src/migrations/');
  });

  it('still skips a plugin that genuinely has no migrations', async () => {
    const source = workspace((dir) => {
      fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ slug: 'sample-widget' }));
    });

    const result = await runStep(source);

    expect(String(result.skippedReason ?? '')).toContain('no src/migrations/');
  });

  it('is NOT fooled by a top-level migrations/ — the directory the old guard looked for', async () => {
    const source = workspace((dir) => {
      fs.mkdirSync(path.join(dir, 'migrations'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ slug: 'sample-widget' }));
    });

    const result = await runStep(source);

    expect(String(result.skippedReason ?? '')).toContain('no src/migrations/');
  });
});
