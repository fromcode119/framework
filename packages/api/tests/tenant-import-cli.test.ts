import { afterEach, describe, expect, it, vi } from 'vitest';
import { TenantImportCli } from '@api/cli/tenant-import-cli';

/**
 * The CLI's own contract, before it touches a database.
 *
 * What matters here is what it REFUSES: an import creates a site and inserts every row of somebody's
 * real shop, so the expensive mistakes are a forgotten flag and a typo'd one.
 */
describe('tenant-import CLI arguments', () => {
  const parse = (argv: string[]) => (TenantImportCli as any).parse(argv);

  it('previews by default — writing requires --execute', () => {
    // The whole safety of running this from a script rests on this default.
    expect(parse(['--archive', '/tmp/a.tar.gz']).execute).toBe(false);
    expect(parse(['--archive', '/tmp/a.tar.gz', '--execute']).execute).toBe(true);
  });

  it('refuses an unknown flag instead of ignoring it', () => {
    // A typo'd `--excute` that silently previewed would read as "it did nothing"; a typo'd identity
    // flag would silently import under the archive's own host.
    expect(() => parse(['--archive', '/tmp/a.tar.gz', '--excute'])).toThrow(/Unknown argument/);
  });

  it('requires the archive it is asked to import', () => {
    expect(() => (TenantImportCli as any).required('', '--archive')).toThrow(/--archive is required/);
  });

  it('collects every --alias rather than keeping only the last', () => {
    expect(parse(['--alias', 'a.example', '--alias', 'b.example']).aliases).toEqual(['a.example', 'b.example']);
  });

  it('sends only the flags actually passed, so an absent one means "use the archive"', () => {
    // An override map that named every key would blank the archive's own identity with empty strings.
    const overrides = (TenantImportCli as any).overrides(parse(['--slug', 'staging']));
    expect(overrides).toEqual({ slug: 'staging' });
  });

  it('passes an explicit production import through untouched', () => {
    const overrides = (TenantImportCli as any).overrides(parse(['--environment', 'production']));
    expect(overrides).toEqual({ environment: 'production' });
  });
});

describe('tenant-import CLI human-readable report', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints export warnings under their own label, distinct from decision warnings — not just in --json', async () => {
    // Regression: after `warnings` split into `warnings` (this import's decisions) and
    // `exportWarnings` (written into the archive at export time), the human-readable report kept
    // looping over `plan.warnings` alone and never read `exportWarnings` at all.
    const { TenantImportPlan } = await import('@fromcode119/core');
    const plan = new TenantImportPlan(
      { tenant: {}, toJSON: () => ({}) } as any,
      [], [], null,
      { total: 0, existing: 0, toCreate: 0 },
      { count: 0, bytes: 0, colliding: 0 },
      [],
      ['a decision this import makes'],
      ['a note written into the archive at export time'],
    );
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => { lines.push(line); });

    (TenantImportCli as any).report(plan, false);

    expect(lines).toContain('[tenant-import] warning: a decision this import makes');
    expect(lines).toContain('[tenant-import] export warning: a note written into the archive at export time');
  });
});
