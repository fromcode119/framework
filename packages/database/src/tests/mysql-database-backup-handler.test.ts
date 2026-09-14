import { afterEach, describe, expect, it, vi } from 'vitest';
import { MysqlDatabaseBackupHandler } from '@database/dialects/mysql/database-backup-handler';

/**
 * The MySQL backup, and the two properties that are not about producing a file.
 *
 * A password must not reach the command line: `--password=` is readable in `ps` by every user on the
 * host for as long as the dump runs, which on a real database is minutes. And the arguments must not
 * go through a shell, or a password containing a quote or a `$` is parsed before `mysqldump` ever
 * sees it — at best the dump fails, at worst part of it executes.
 */
describe('MysqlDatabaseBackupHandler', () => {
  const context = { backupsPath: '/tmp/backups', timestamp: '2026-09-14', projectRoot: '/app' };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const runWith = async (url: string) => {
    const calls: Array<{ file: string; args: string[]; options: any }> = [];
    (MysqlDatabaseBackupHandler as any).execFileAsync = async (file: string, args: string[], options: any) => {
      calls.push({ file, args, options });
      return { stdout: '', stderr: '' };
    };
    const result = await new MysqlDatabaseBackupHandler().createBackup(url, context);
    return { result, calls };
  };

  it('never puts the password in the argument vector', async () => {
    const { calls } = await runWith('mysql://app:s3cr3t@db:3306/fromcode');

    expect(calls).toHaveLength(1);
    expect(calls[0].args.join(' ')).not.toContain('s3cr3t');
    expect(calls[0].args.some((arg) => arg.startsWith('--password'))).toBe(false);
  });

  it('passes it through the environment instead, where ps cannot read it', async () => {
    const { calls } = await runWith('mysql://app:s3cr3t@db:3306/fromcode');

    expect(calls[0].options.env.MYSQL_PWD).toBe('s3cr3t');
  });

  it('runs mysqldump directly rather than through a shell', async () => {
    const { calls } = await runWith('mysql://app:s3cr3t@db:3306/fromcode');

    // execFile takes an argv; a `shell: true` here would reintroduce the quoting problem this avoids.
    expect(calls[0].file).toBe('mysqldump');
    expect(calls[0].options.shell).toBeUndefined();
  });

  it('decodes credentials that had to be URL-encoded', async () => {
    const { calls } = await runWith(`mysql://${encodeURIComponent('user@corp')}:${encodeURIComponent('p@ss:w/rd')}@db:3306/fromcode`);

    expect(calls[0].args).toContain('--user=user@corp');
    expect(calls[0].options.env.MYSQL_PWD).toBe('p@ss:w/rd');
  });

  it('dumps consistently without locking a database that is still serving', async () => {
    const { calls } = await runWith('mysql://app:s3cr3t@db:3306/fromcode');

    expect(calls[0].args).toContain('--single-transaction');
    // A restore missing these looks complete and is not.
    expect(calls[0].args).toContain('--routines');
    expect(calls[0].args).toContain('--triggers');
  });

  it('names the database last, and writes where the caller asked', async () => {
    const { result, calls } = await runWith('mysql://app:s3cr3t@db:3306/fromcode');

    expect(calls[0].args[calls[0].args.length - 1]).toBe('fromcode');
    expect(calls[0].args).toContain('--result-file=/tmp/backups/db-dump-2026-09-14.sql');
    expect(result).toBe('/tmp/backups/db-dump-2026-09-14.sql');
  });

  it('refuses a connection string that names no database rather than dumping something else', async () => {
    const { result, calls } = await runWith('mysql://app:s3cr3t@db:3306/');

    expect(result).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('returns null when the dump fails, so a backup is reported missing rather than empty', async () => {
    (MysqlDatabaseBackupHandler as any).execFileAsync = async () => { throw new Error('mysqldump: not found'); };
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await new MysqlDatabaseBackupHandler().createBackup('mysql://a:b@db:3306/fromcode', context)).toBeNull();
  });
});
