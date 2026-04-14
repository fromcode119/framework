import fs from 'fs';
import path from 'path';
import type { DatabaseBackupContext, DatabaseBackupHandler } from './database-backup.interfaces';

export class SqliteDatabaseBackupHandler implements DatabaseBackupHandler {
  readonly dialect = 'sqlite';

  async createBackup(dbUrl: string, context: DatabaseBackupContext): Promise<string | null> {
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