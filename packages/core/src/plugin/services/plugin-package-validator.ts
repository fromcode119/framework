import fs from 'fs';
import path from 'path';
import type { IPluginManifest } from '@core/interfaces/plugin-manifest.interface';
import { PluginPackageLayout } from '@core/plugin/plugin-package-layout';

export class PluginPackageValidator {
  static validateInstalledPackage(packageRoot: string, manifest: IPluginManifest): void {
    this.validateServerEntry(packageRoot, manifest);
    this.validateUiEntries(packageRoot, manifest);
    this.validateMigrations(packageRoot, manifest);
  }

  private static validateServerEntry(packageRoot: string, manifest: IPluginManifest): void {
    // NOT resolved through PluginPackageLayout.resolve() on purpose: the conventional server entry is
    // unconditional, so a source-only archive (index.ts, no index.js) still fails here as it must.
    const entryFile = String(manifest.main || PluginPackageLayout.SERVER_ENTRY).trim();
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

  private static validateUiEntries(packageRoot: string, manifest: IPluginManifest): void {
    const uiRecord = manifest.ui && typeof manifest.ui === 'object'
      ? manifest.ui as Record<string, unknown>
      : null;
    // Same reason as migrations: the conventional bundle names are no longer restated per manifest, so
    // an archive that ships them must still be checked for the compiled artifact.
    const uiEntries = [
      String(uiRecord?.entry || (PluginPackageLayout.hasUiAsset(packageRoot, PluginPackageLayout.UI_ENTRY) ? PluginPackageLayout.UI_ENTRY : '')).trim(),
      String(uiRecord?.frontendEntry || (PluginPackageLayout.hasUiAsset(packageRoot, PluginPackageLayout.FRONTEND_ENTRY) ? PluginPackageLayout.FRONTEND_ENTRY : '')).trim(),
    ].filter(Boolean);

    for (const uiEntry of uiEntries) {
      const uiPath = path.resolve(packageRoot, PluginPackageLayout.UI_DIR, uiEntry);
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

  private static validateMigrations(packageRoot: string, manifest: IPluginManifest): void {
    // A manifest no longer restates the conventional migrations directory, so fall back to it when the
    // archive actually ships one — otherwise a packaged plugin's migrations would go unvalidated.
    const migrationsDirName = String(
      manifest?.migrations
      || (PluginPackageLayout.hasMigrations(packageRoot) ? PluginPackageLayout.MIGRATIONS_DIR : '')
    ).trim();
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
