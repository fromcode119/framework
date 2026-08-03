import fs from 'fs';
import path from 'path';
import type { IDatabaseBackupContext } from '@database/dialects/interfaces/database-backup-context.interface';
import type { IDatabaseBackupHandler } from '@database/dialects/interfaces/database-backup-handler.interface';

export class SqliteDatabaseBackupHandler implements IDatabaseBackupHandler {
  readonly dialect = 'sqlite';

  async createBackup(dbUrl: string, context: IDatabaseBackupContext): Promise<string | null> {
    const sourcePath = this.resolveSqlitePath(dbUrl, context.projectRoot);
    if (!fs.existsSync(sourcePath)) {
      return null;
    }

    const dumpPath = path.join(context.backupsPath, `db-copy-${context.timestamp}.db`);
    fs.copyFileSync(sourcePath, dumpPath);
    return dumpPath;
  }

  private resolveSqlitePath(dbUrl: string, projectRoot: string): string {
    const normalizedUrl = String(dbUrl || '').trim();

    if (normalizedUrl.startsWith('sqlite:///')) {
      return normalizedUrl.replace(/^sqlite:\/\//, '/');
    }

    if (normalizedUrl.startsWith('sqlite://')) {
      return path.resolve(projectRoot, normalizedUrl.replace(/^sqlite:\/\//, ''));
    }

    if (normalizedUrl.startsWith('sqlite:file:')) {
      return this.resolveFileProtocolPath(normalizedUrl.replace(/^sqlite:/, ''), projectRoot);
    }

    if (normalizedUrl.startsWith('file:')) {
      return this.resolveFileProtocolPath(normalizedUrl, projectRoot);
    }

    return path.isAbsolute(normalizedUrl) ? normalizedUrl : path.resolve(projectRoot, normalizedUrl);
  }

  private resolveFileProtocolPath(fileUrl: string, projectRoot: string): string {
    if (fileUrl.startsWith('file:///')) {
      return fileUrl.replace(/^file:\/\//, '/');
    }

    return path.resolve(projectRoot, fileUrl.replace(/^file:/, ''));
  }
}