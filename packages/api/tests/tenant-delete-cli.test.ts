import { describe, expect, it } from 'vitest';
import { TenantDeleteCli } from '@api/cli/tenant-delete-cli';

/**
 * The CLI's contract before it touches a database.
 *
 * This one deletes a site, so what matters is entirely what it REFUSES. Every test here is a way
 * somebody loses a shop.
 */
describe('tenant-delete CLI arguments', () => {
  const parse = (argv: string[]) => (TenantDeleteCli as any).parse(argv);

  it('previews by default — deleting requires --execute', () => {
    // The whole safety of running this from a script rests on this default.
    expect(parse(['--id', 'shop']).execute).toBe(false);
    expect(parse(['--id', 'shop', '--execute']).execute).toBe(true);
  });

  it('refuses an unknown flag instead of ignoring it', () => {
    // A typo'd `--excute` that silently previewed would read as "it did nothing", and the operator
    // would reach for a bigger hammer.
    expect(() => parse(['--id', 'shop', '--excute'])).toThrow(/Unknown argument/);
  });

  it('requires the id it is asked to delete', () => {
    expect(() => (TenantDeleteCli as any).required('', '--id')).toThrow(/--id is required/);
  });

  it('keeps --confirm separate from --id, so one typo cannot satisfy both', () => {
    const args = parse(['--id', 'shop-a', '--confirm', 'shop-b']);
    expect(args.id).toBe('shop-a');
    expect(args.confirm).toBe('shop-b');
  });

  it('defaults --confirm to empty, so it can never match a real slug by accident', () => {
    expect(parse(['--id', 'shop']).confirm).toBe('');
  });

  it('says in its usage that the export always happens first', () => {
    expect((TenantDeleteCli as any).usage()).toMatch(/ALWAYS exported/);
  });
});
