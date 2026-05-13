import fs from 'fs';
import path from 'path';

export class PluginContextFileReader {
  constructor(
    private readonly resolveCurrentPluginRoot: () => string,
    private readonly resolveActiveThemeRoot: () => Promise<string | null>,
  ) {}

  async readText(
    relativePath: string,
    options: { pluginDirectory?: string; themeDirectory?: string } = {},
  ): Promise<string> {
    const candidate = await this.resolveFirstFile(relativePath, options);
    if (!candidate) {
      return '';
    }

    return fs.readFileSync(candidate, 'utf8').trim();
  }

  async readJson(
    relativePath: string,
    options: { pluginDirectory?: string; themeDirectory?: string } = {},
  ): Promise<Record<string, any>> {
    const candidate = await this.resolveFirstFile(relativePath, options);
    if (!candidate) {
      return {};
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, any>
        : {};
    } catch {
      return {};
    }
  }

  private async resolveFirstFile(
    relativePath: string,
    options: { pluginDirectory?: string; themeDirectory?: string },
  ): Promise<string | null> {
    const normalizedPath = this.normalizeRelativeSegment(relativePath);
    if (!normalizedPath) {
      return null;
    }

    const candidates = await this.resolveCandidates(normalizedPath, options);
    return candidates.find((candidate) => this.isFile(candidate)) || null;
  }

  private async resolveCandidates(
    relativePath: string,
    options: { pluginDirectory?: string; themeDirectory?: string },
  ): Promise<string[]> {
    const candidates: string[] = [];
    const normalizedPluginDirectory = this.normalizeRelativeSegment(options.pluginDirectory);
    const normalizedThemeDirectory = this.normalizeRelativeSegment(options.themeDirectory);

    if (normalizedThemeDirectory) {
      const activeThemeRoot = await this.resolveActiveThemeRoot();
      if (activeThemeRoot) {
        candidates.push(path.join(activeThemeRoot, normalizedThemeDirectory, relativePath));
      }
    }

    const pluginRoot = this.resolveCurrentPluginRoot();
    candidates.push(
      normalizedPluginDirectory
        ? path.join(pluginRoot, normalizedPluginDirectory, relativePath)
        : path.join(pluginRoot, relativePath),
    );

    return Array.from(new Set(candidates));
  }

  private normalizeRelativeSegment(value?: string): string {
    const normalized = path.posix
      .normalize(String(value || '').replace(/\\/g, '/'))
      .replace(/^\/+/, '');

    if (!normalized || normalized === '.') {
      return '';
    }

    return normalized.startsWith('..') ? '' : normalized;
  }

  private isFile(candidatePath: string): boolean {
    try {
      return fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile();
    } catch {
      return false;
    }
  }
}
