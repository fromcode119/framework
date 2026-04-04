import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { Logger } from '../../logging';

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
    const hasLockfile = fs.existsSync(this.getPackageLockPath(pluginPath));
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const args = hasLockfile
      ? ['ci', '--omit=dev', '--no-audit']
      : ['install', '--omit=dev', '--no-audit'];

    this.logger.info(`Installing plugin backend dependencies for ${pluginPath}`);
    const result = spawnSync(command, args, {
      cwd: pluginPath,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        FROMCODE_PROJECT_ROOT: this.projectRoot,
      },
    });

    if (result.status !== 0) {
      throw new Error(`Plugin dependency install failed for ${pluginPath}`);
    }
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
