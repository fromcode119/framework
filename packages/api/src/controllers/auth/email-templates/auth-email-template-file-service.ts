import { promises as fs } from 'fs';
import path from 'path';

export class AuthEmailTemplateFileService {
  static async readTemplate(relativePath: string): Promise<string> {
    const candidatePaths = this.getCandidatePaths(relativePath);
    let lastError: unknown = null;

    for (const candidatePath of candidatePaths) {
      try {
        return await fs.readFile(candidatePath, 'utf-8');
      } catch (error: unknown) {
        lastError = error;
      }
    }

    throw lastError;
  }

  private static getCandidatePaths(relativePath: string): string[] {
    const normalizedRelativePath = String(relativePath || '').replace(/^\/+/, '');

    return [
      path.join(__dirname, 'templates', normalizedRelativePath),
      path.join(__dirname, '../../../../src/controllers/auth/email-templates/templates', normalizedRelativePath),
      path.join(__dirname, '../../../../dist/controllers/auth/email-templates/templates', normalizedRelativePath),
    ];
  }
}
