import fs from 'fs';
import path from 'path';
import type { PluginManifest } from '../../types';

export class PluginPackageValidator {
  static validateInstalledPackage(packageRoot: string, manifest: PluginManifest): void {
    this.validateServerEntry(packageRoot, manifest);
    this.validateUiEntries(packageRoot, manifest);
    this.validateMigrations(packageRoot, manifest);
  }

  private static validateServerEntry(packageRoot: string, manifest: PluginManifest): void {
    const entryFile = String(manifest.main || 'index.js').trim();
    if (!entryFile) {
      return;
    }

    const entryPath = path.resolve(packageRoot, entryFile);
    if (fs.existsSync(entryPath)) {
      return;
    }

    const sourceCandidate = this.toTypeScriptCandidate(entryPath);
    if (sourceCandidate && fs.existsSync(sourceCandidate)) {
      throw new Error(
        `Uploaded plugin archive is not a built package: missing compiled server entry "${entryFile}" ` +
        `(found source file "${path.relative(packageRoot, sourceCandidate)}"). Build/package the plugin before uploading.`
      );
    }

    throw new Error(`Uploaded plugin archive is invalid: missing server entry "${entryFile}".`);
  }

  private static validateUiEntries(packageRoot: string, manifest: PluginManifest): void {
    const uiRecord = manifest.ui && typeof manifest.ui === 'object'
      ? manifest.ui as Record<string, unknown>
      : null;
    const uiEntries = [
      String(uiRecord?.entry || '').trim(),
      String(uiRecord?.frontendEntry || '').trim(),
    ].filter(Boolean);

    for (const uiEntry of uiEntries) {
      const uiPath = path.resolve(packageRoot, 'src', 'ui', uiEntry);
      if (fs.existsSync(uiPath)) {
        continue;
      }

      const sourceCandidate = this.toTypeScriptCandidate(uiPath);
      if (sourceCandidate && fs.existsSync(sourceCandidate)) {
        throw new Error(
          `Uploaded plugin archive is not a built package: missing compiled UI file "ui/${uiEntry}" ` +
          `(found source file "${path.relative(packageRoot, sourceCandidate)}"). Build/package the plugin before uploading.`
        );
      }

      throw new Error(`Uploaded plugin archive is invalid: missing UI file "ui/${uiEntry}".`);
    }
  }

  private static validateMigrations(packageRoot: string, manifest: PluginManifest): void {
    const migrationsDirName = String(manifest?.migrations || '').trim();
    if (!migrationsDirName) {
      return;
    }

    const migrationsDir = path.resolve(packageRoot, migrationsDirName);
    if (!fs.existsSync(migrationsDir) || !fs.statSync(migrationsDir).isDirectory()) {
      throw new Error(
        `Uploaded plugin archive is invalid: manifest declares migrations at "${migrationsDirName}" but that directory is missing.`
      );
    }

    const entries = fs.readdirSync(migrationsDir);
    const jsMigrations = entries.filter((fileName) => fileName.endsWith('.js') && !fileName.endsWith('.js.map'));
    if (jsMigrations.length > 0) {
      return;
    }

    const tsMigrations = entries.filter((fileName) => fileName.endsWith('.ts') && !fileName.endsWith('.d.ts'));
    if (tsMigrations.length > 0) {
      throw new Error(
        `Uploaded plugin archive is not a built package: "${migrationsDirName}" contains TypeScript migrations but no compiled ".js" migrations. ` +
        'Build/package the plugin before uploading.'
      );
    }
  }

  private static toTypeScriptCandidate(compiledPath: string): string | null {
    if (compiledPath.endsWith('.js')) {
      return compiledPath.replace(/\.js$/i, '.ts');
    }

    if (compiledPath.endsWith('.jsx')) {
      return compiledPath.replace(/\.jsx$/i, '.tsx');
    }

    return null;
  }
}
