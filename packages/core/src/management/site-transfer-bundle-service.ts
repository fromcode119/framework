import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';
import * as tar from 'tar';
import { IDatabaseManager, systemPlugins, systemThemes, eq } from '@fromcode119/database';
import { ProjectPaths } from '../config/paths';
import { BackupService } from './backup-service';
import type {
  SiteTransferBundleManifest,
  SiteTransferBundleOptions,
  SiteTransferBundleResult,
} from './site-transfer-bundle-service.types';

export class SiteTransferBundleService {
  constructor(private readonly db: IDatabaseManager) {}

  async createBundle(options: SiteTransferBundleOptions = {}): Promise<SiteTransferBundleResult> {
    const resolvedOptions = this.resolveOptions(options);
    const stagingDirectory = this.createBundleDirectory(resolvedOptions.outputDirectory, resolvedOptions.label);
    const statusPath = path.join(stagingDirectory, 'bundle-status.json');

    this.writeJson(statusPath, { status: 'incomplete', updatedAt: new Date().toISOString() });

    try {
      const snapshotPath = await BackupService.createSystemBackup({ excludePaths: resolvedOptions.excludedPaths });
      const bundledSnapshotPath = path.join(stagingDirectory, 'site-snapshot.tar.gz');
      fs.copyFileSync(snapshotPath, bundledSnapshotPath);

      const requiredEnvironmentKeys = this.readRequiredEnvironmentKeys();
      const manifest = await this.createManifest(stagingDirectory, bundledSnapshotPath, resolvedOptions.label, resolvedOptions.excludedPaths, requiredEnvironmentKeys);
      const manifestPath = path.join(stagingDirectory, 'manifest.json');
      const instructionsPath = path.join(stagingDirectory, 'import-instructions.md');
      const environmentKeysPath = path.join(stagingDirectory, 'required-environment-keys.txt');

      this.writeJson(manifestPath, manifest);
      fs.writeFileSync(instructionsPath, manifest.importChecklist.map((entry) => `- ${entry}`).join(os.EOL) + os.EOL, 'utf8');
      fs.writeFileSync(environmentKeysPath, requiredEnvironmentKeys.join(os.EOL) + os.EOL, 'utf8');

      const checksumPath = resolvedOptions.skipChecksum ? null : this.writeChecksums(stagingDirectory);
      const archivePath = await this.createArchive(stagingDirectory, resolvedOptions.label);

      this.writeJson(statusPath, {
        status: 'complete',
        updatedAt: new Date().toISOString(),
        archivePath,
        manifestPath,
      });

      return {
        bundleDirectory: stagingDirectory,
        manifestPath,
        archivePath,
        checksumPath,
        snapshotPath: bundledSnapshotPath,
      };
    } catch (error) {
      this.writeJson(statusPath, {
        status: 'incomplete',
        updatedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private resolveOptions(options: SiteTransferBundleOptions): {
    outputDirectory: string;
    label: string;
    excludedPaths: string[];
    skipChecksum: boolean;
  } {
    const label = this.slugify(String(options.label || 'site-transfer').trim() || 'site-transfer');
    const outputDirectory = options.outputDir
      ? path.resolve(options.outputDir)
      : ProjectPaths.getRepositoryArtifactsDir('site-transfer');

    const excludedPaths = ['backups', '.env', '.env.local', '.env.production'];
    if (!options.includePublic) {
      excludedPaths.push('public');
    }
    if (options.includePublic && !options.includeUploads) {
      excludedPaths.push('public/uploads');
    }
    if (!options.includeSecrets) {
      excludedPaths.push('secrets');
    }

    return {
      outputDirectory,
      label,
      excludedPaths,
      skipChecksum: Boolean(options.skipChecksum),
    };
  }

  private createBundleDirectory(outputDirectory: string, label: string): string {
    fs.mkdirSync(outputDirectory, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const directoryPath = path.join(outputDirectory, `${timestamp}-${label}`);
    fs.mkdirSync(directoryPath, { recursive: true });
    return directoryPath;
  }

  private async createManifest(
    stagingDirectory: string,
    bundledSnapshotPath: string,
    label: string,
    excludedPaths: string[],
    requiredEnvironmentKeys: string[],
  ): Promise<SiteTransferBundleManifest> {
    const frameworkPackagePath = path.join(ProjectPaths.getProjectRoot(), 'package.json');
    const frameworkPackage = JSON.parse(fs.readFileSync(frameworkPackagePath, 'utf8')) as { version?: string };
    const activeTheme = await this.readActiveTheme();
    const activePlugins = await this.readActivePlugins();

    return {
      createdAt: new Date().toISOString(),
      label,
      repositoryRoot: ProjectPaths.getRepositoryRoot(),
      frameworkRoot: ProjectPaths.getProjectRoot(),
      frameworkVersion: String(frameworkPackage.version || '0.0.0'),
      activeTheme,
      activePlugins,
      includedArtifacts: [
        {
          name: 'site-snapshot',
          relativePath: path.relative(stagingDirectory, bundledSnapshotPath).replace(/\\/g, '/'),
        },
      ],
      excludedPaths,
      requiredEnvironmentKeys,
      importChecklist: [
        'Copy the generated site-snapshot.tar.gz into the destination repository.',
        'Recreate every value listed in required-environment-keys.txt before importing the snapshot.',
        'Create a fresh safety backup on the destination environment before extraction.',
        'Restore the snapshot into the destination framework root using the admin backup restore API or offline maintenance workflow.',
        'Reinstall dependencies and restart API, admin, and frontend services after extraction.',
      ],
    };
  }

  private async readActiveTheme(): Promise<{ slug: string | null; version: string | null }> {
    const rows = await this.db.find(systemThemes, { where: eq(systemThemes.state, 'active') });
    const activeTheme = rows[0];
    if (!activeTheme?.slug) {
      return { slug: null, version: null };
    }

    const manifestVersion = this.readManifestVersion(path.join(ProjectPaths.getThemesDir(), String(activeTheme.slug), 'theme.json'));
    return {
      slug: String(activeTheme.slug),
      version: manifestVersion,
    };
  }

  private async readActivePlugins(): Promise<Array<{ slug: string; version: string | null }>> {
    const rows = await this.db.find(systemPlugins, {
      where: eq(systemPlugins.state, 'active'),
      orderBy: this.db.asc(systemPlugins.slug),
    });

    return rows.map((row) => ({
      slug: String(row.slug),
      version: row.version ? String(row.version) : this.readManifestVersion(path.join(ProjectPaths.getPluginsDir(), String(row.slug), 'manifest.json')),
    }));
  }

  private readManifestVersion(manifestPath: string): string | null {
    if (!fs.existsSync(manifestPath)) {
      return null;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { version?: string };
      return manifest.version ? String(manifest.version) : null;
    } catch {
      return null;
    }
  }

  private readRequiredEnvironmentKeys(): string[] {
    const projectRoot = ProjectPaths.getProjectRoot();
    const environmentFiles = ['.env.example', '.env'];
    const keys = new Set<string>();

    for (const fileName of environmentFiles) {
      const filePath = path.join(projectRoot, fileName);
      if (!fs.existsSync(filePath)) {
        continue;
      }

      const contents = fs.readFileSync(filePath, 'utf8');
      for (const line of contents.split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=/);
        if (match?.[1]) {
          keys.add(match[1]);
        }
      }
    }

    return Array.from(keys).sort((left, right) => left.localeCompare(right));
  }

  private writeChecksums(stagingDirectory: string): string {
    const checksumPath = path.join(stagingDirectory, 'checksums.txt');
    const fileEntries = fs.readdirSync(stagingDirectory)
      .filter((entry) => entry !== 'checksums.txt')
      .map((entry) => ({
        entry,
        filePath: path.join(stagingDirectory, entry),
      }))
      .filter((entry) => fs.statSync(entry.filePath).isFile())
      .sort((left, right) => left.entry.localeCompare(right.entry));

    const lines = fileEntries.map(({ entry, filePath }) => `${this.hashFile(filePath)}  ${entry}`);
    fs.writeFileSync(checksumPath, lines.join(os.EOL) + os.EOL, 'utf8');
    return checksumPath;
  }

  private async createArchive(stagingDirectory: string, label: string): Promise<string> {
    const archivePath = path.join(stagingDirectory, `${label}.tar.gz`);
    const entries = fs.readdirSync(stagingDirectory).filter((entry) => entry !== path.basename(archivePath));
    await tar.create(
      {
        gzip: true,
        file: archivePath,
        cwd: stagingDirectory,
      },
      entries,
    );
    return archivePath;
  }

  private hashFile(filePath: string): string {
    const hash = createHash('sha256');
    hash.update(fs.readFileSync(filePath));
    return hash.digest('hex');
  }

  private writeJson(filePath: string, value: unknown): void {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + os.EOL, 'utf8');
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'site-transfer';
  }
}