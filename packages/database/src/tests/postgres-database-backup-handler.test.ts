import { afterEach, describe, expect, it, vi } from 'vitest';
import { PostgresDatabaseBackupHandler } from '@database/dialects/postgres/database-backup-handler';

/**
 * The PostgreSQL backup, and what it must hold to besides producing a file: the password stays out of
 * the command and out of every message, and one table the role cannot read does not cost the dump.
 */
describe('PostgresDatabaseBackupHandler', () => {
  const url = 'postgresql://app:s3cr3t@db:5432/fromcode?sslmode=require';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const runWith = async (dbUrl: string, behaviour: { unreadable?: string; dumpError?: any } = {}) => {
    const calls: Array<{ file: string; args: string[]; options: any }> = [];
    (PostgresDatabaseBackupHandler as any).execFileAsync = async (file: string, args: string[], options: any) => {
      calls.push({ file, args, options });
      if (file === 'psql') return { stdout: behaviour.unreadable ?? '', stderr: '' };
      if (behaviour.dumpError) throw behaviour.dumpError;
      return { stdout: '', stderr: '' };
    };
    const warnings: string[] = [];
    const logged: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((line: unknown) => { logged.push(String(line)); });
    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => { logged.push(String(line)); });
    const result = await new PostgresDatabaseBackupHandler().createBackup(dbUrl, { backupsPath: '/tmp/backups', timestamp: '2026-11-19', projectRoot: '/app', warnings });
    return { result, calls, warnings, logged, dump: calls.find((call) => call.file === 'pg_dump') };
  };

  it('keeps the password out of every command and passes it through the environment', async () => {
    const { calls, dump, result } = await runWith(url);

    expect(result).toBe('/tmp/backups/db-dump-2026-11-19.sql');
    for (const call of calls) expect(call.args.join(' ')).not.toContain('s3cr3t');
    expect(dump?.options.env.PGPASSWORD).toBe('s3cr3t');
    expect(dump?.options.shell).toBeUndefined();
    expect(dump?.args).toContain('--dbname=postgresql://app@db:5432/fromcode?sslmode=require');
  });

  it('never prints the password when the dump fails, and says why it failed', async () => {
    const dumpError = Object.assign(new Error(`Command failed: pg_dump "${url}"`), {
      stderr: 'pg_dump: error: connection to "postgresql://app:s3cr3t@db" failed\npg_dump: detail: more',
    });
    const { result, warnings, logged } = await runWith(url, { dumpError });

    expect(result).toBeNull();
    expect([...warnings, ...logged].join('\n')).not.toContain('s3cr3t');
    expect(warnings).toEqual(['The database was not backed up: pg_dump: error: connection to "postgresql://app:***@db" failed']);
  });

  it('leaves out a table the role cannot read and names it', async () => {
    const { result, dump, warnings } = await runWith(url, { unreadable: 'public._bak_sale_doc\npublic."Odd Name"\n' });

    expect(result).toBe('/tmp/backups/db-dump-2026-11-19.sql');
    expect(dump?.args).toContain('--exclude-table=public._bak_sale_doc');
    expect(dump?.args).toContain('--exclude-table=public."Odd Name"');
    expect(warnings).toEqual(["The database backup leaves out tables the application's database role cannot read: public._bak_sale_doc, public.\"Odd Name\"."]);
  });

  it('dumps everything, with no warning, when every table is readable', async () => {
    const { dump, warnings } = await runWith(url);

    expect(dump?.args.some((arg) => arg.startsWith('--exclude-table'))).toBe(false);
    expect(warnings).toEqual([]);
  });
});
