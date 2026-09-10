import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Logger } from '@core/logging';
import { DependencyInstaller } from '@core/plugin/services/installation/dependency-installer';

export class PluginDependencyInstallerService {
  private logger = new Logger({ namespace: 'plugin-dependency-installer' });

  constructor(private projectRoot: string) {}

  hasPackageManifest(pluginPath: string): boolean {
    return fs.existsSync(this.getPackageJsonPath(pluginPath));
  }

  async ensureInstalled(pluginPath: string): Promise<void> {
    if (!this.hasPackageManifest(pluginPath)) {
      return;
    }

    // `@fromcode119/*` packages are NOT on the public npm registry — they are externalized in the
    // plugin bundle and provided by the host at runtime. Leaving them in the manifest makes the
    // install below 404 (`npm ci`/`install`), which would fail the whole plugin (and any plugin that
    // depends on it). Strip them + drop the lockfile so a plain `npm install` resolves the plugin's
    // REAL third-party deps only.
    DependencyInstaller.stripHostProvidedDependencies(pluginPath);

    const fingerprint = this.createFingerprint(pluginPath);
    if (!this.shouldInstall(pluginPath, fingerprint)) {
      return;
    }

    this.installDependencies(pluginPath);
    this.writeState(pluginPath, fingerprint);
  }

  private shouldInstall(pluginPath: string, fingerprint: string): boolean {
    const nodeModulesPath = path.join(pluginPath, 'node_modules');
    if (!fs.existsSync(nodeModulesPath) || !fs.statSync(nodeModulesPath).isDirectory()) {
      return true;
    }

    return this.readInstalledFingerprint(pluginPath) !== fingerprint;
  }

  private installDependencies(pluginPath: string): void {
    // The flags, and the reasoning behind each, live in ONE place now — this service owns only the
    // fingerprint gate and the state file, which are core's concern and nobody else's.
    this.logger.info(`Installing plugin backend dependencies for ${pluginPath}`);
    DependencyInstaller.install(pluginPath, { omitDev: true });
  }

  private createFingerprint(pluginPath: string): string {
    const packageJson = fs.readFileSync(this.getPackageJsonPath(pluginPath), 'utf8');
    const packageLock = fs.existsSync(this.getPackageLockPath(pluginPath))
      ? fs.readFileSync(this.getPackageLockPath(pluginPath), 'utf8')
      : '';

    return crypto
      .createHash('sha256')
      .update(packageJson)
      .update('\n')
      .update(packageLock)
      .digest('hex');
  }

  private readInstalledFingerprint(pluginPath: string): string {
    const statePath = this.getStatePath(pluginPath);
    if (!fs.existsSync(statePath)) {
      return '';
    }

    try {
      const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      return typeof raw?.fingerprint === 'string' ? raw.fingerprint : '';
    } catch {
      return '';
    }
  }

  private writeState(pluginPath: string, fingerprint: string): void {
    fs.writeFileSync(this.getStatePath(pluginPath), JSON.stringify({
      fingerprint,
      installedAt: new Date().toISOString(),
    }, null, 2));
  }

  private getPackageJsonPath(pluginPath: string): string {
    return path.join(pluginPath, 'package.json');
  }

  private getPackageLockPath(pluginPath: string): string {
    return path.join(pluginPath, 'package-lock.json');
  }

  private getStatePath(pluginPath: string): string {
    return path.join(pluginPath, '.fromcode-plugin-deps.json');
  }
}
