import fs from 'fs';
import path from 'path';
import { BackupOperationError } from './backup-operation-error';
import { BackupService } from './backup-service';

export class BackupImportService {
  private static readonly DEFAULT_FILENAME = 'imported-backup.tar.gz';

  static importArchive(tempPath: string, originalFilename: string): string {
    if (!tempPath || !fs.existsSync(tempPath) || !fs.statSync(tempPath).isFile()) {
      throw new BackupOperationError(400, 'Uploaded backup archive is missing.');
    }

    const sanitizedFilename = this.sanitizeFilename(originalFilename);
    const extension = this.resolveSupportedExtension(sanitizedFilename);
    if (!extension) {
      throw new BackupOperationError(400, 'Unsupported backup archive format. Upload a .tar.gz, .sql, or .db backup.');
    }

    const targetDirectory = BackupService.getBackupsDirectory(this.resolveTargetSubdirectory(extension));
    fs.mkdirSync(targetDirectory, { recursive: true });

    const targetPath = this.resolveUniqueDestinationPath(targetDirectory, sanitizedFilename, extension);
    try {
      fs.copyFileSync(tempPath, targetPath);
    } finally {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }

    return targetPath;
  }

  private static sanitizeFilename(value: string): string {
    const rawFilename = path.basename(String(value || '').trim()) || BackupImportService.DEFAULT_FILENAME;
    return rawFilename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  }

  private static resolveSupportedExtension(filename: string): '.tar.gz' | '.sql' | '.db' | null {
    const lowerCaseFilename = filename.toLowerCase();
    if (lowerCaseFilename.endsWith('.tar.gz')) return '.tar.gz';
    if (lowerCaseFilename.endsWith('.sql')) return '.sql';
    if (lowerCaseFilename.endsWith('.db')) return '.db';
    return null;
  }

  private static resolveTargetSubdirectory(extension: '.tar.gz' | '.sql' | '.db'): 'system' | 'database' {
    return extension === '.sql' || extension === '.db' ? 'database' : 'system';
  }

  private static resolveUniqueDestinationPath(directoryPath: string, filename: string, extension: '.tar.gz' | '.sql' | '.db'): string {
    const basename = filename.slice(0, filename.length - extension.length) || 'imported-backup';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let candidatePath = path.join(directoryPath, `${basename}${extension}`);
    if (!fs.existsSync(candidatePath)) {
      return candidatePath;
    }

    candidatePath = path.join(directoryPath, `${basename}-${timestamp}${extension}`);
    let counter = 1;
    while (fs.existsSync(candidatePath)) {
      candidatePath = path.join(directoryPath, `${basename}-${timestamp}-${counter}${extension}`);
      counter += 1;
    }

    return candidatePath;
  }
}