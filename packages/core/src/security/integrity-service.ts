import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Logger } from '@fromcode119/sdk';

export class IntegrityService {
  private static logger = new Logger({ namespace: 'integrity-service' });

  /**
   * Calculates the SHA-256 hash of a directory's contents
   */
  public static async calculateDirectoryHash(dirPath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    await this.processDirectory(dirPath, hash);
    return hash.digest('hex');
  }

  private static async processDirectory(dirPath: string, hash: crypto.Hash): Promise<void> {
    const items = fs.readdirSync(dirPath).sort(); // Sort to ensure deterministic hashing

    for (const item of items) {
      if (item.startsWith('.') || item === 'node_modules') continue;

      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        await this.processDirectory(fullPath, hash);
      } else {
        const content = fs.readFileSync(fullPath);
        hash.update(item);
        hash.update(content);
      }
    }
  }

  /**
   * Verifies that a plugin's contents match its manifest checksum
   */
  public static async verifyPluginIntegrity(dirPath: string, expectedChecksum: string): Promise<boolean> {
    if (!expectedChecksum) return true; // Skip if no checksum provided

    try {
      const actualChecksum = await this.calculateDirectoryHash(dirPath);
      if (actualChecksum !== expectedChecksum) {
        this.logger.error(`Integrity Check Failed at ${dirPath}. Expected: ${expectedChecksum}, got: ${actualChecksum}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.error(`Integrity Check Error: ${e}`);
      return false;
    }
  }
}