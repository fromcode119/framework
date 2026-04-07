import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import type { ThemeDefaultPageContractOverride } from '../types';

export class ThemeDefaultPageContractOverrideLoader {
  private static readonly FILE_BASENAME = 'theme-default-page-contract-overrides';
  private static readonly SEARCH_DIR = 'seeds';

  async load(themeDirectory: string): Promise<ThemeDefaultPageContractOverride[]> {
    const overrideModulePath = this.resolveOverrideModulePath(themeDirectory);
    if (!overrideModulePath) {
      return [];
    }

    const moduleExports = await this.loadModule(overrideModulePath);
    return this.readOverrides(moduleExports);
  }

  private resolveOverrideModulePath(themeDirectory: string): string | null {
    const basePath = path.resolve(themeDirectory, ThemeDefaultPageContractOverrideLoader.SEARCH_DIR);
    const candidates = [
      `${ThemeDefaultPageContractOverrideLoader.FILE_BASENAME}.js`,
      `${ThemeDefaultPageContractOverrideLoader.FILE_BASENAME}.cjs`,
      `${ThemeDefaultPageContractOverrideLoader.FILE_BASENAME}.mjs`,
      `${ThemeDefaultPageContractOverrideLoader.FILE_BASENAME}.ts`,
    ].map((fileName) => path.join(basePath, fileName));

    return candidates.find((candidate) => fs.existsSync(candidate)) || null;
  }

  private async loadModule(modulePath: string): Promise<any> {
    try {
      return require(modulePath);
    } catch {
      return import(pathToFileURL(modulePath).href);
    }
  }

  private readOverrides(moduleExports: any): ThemeDefaultPageContractOverride[] {
    const callable = this.resolveOverrideProvider(moduleExports);
    const overrides = callable();
    if (!Array.isArray(overrides)) {
      throw new Error('Theme default page contract overrides must return an array.');
    }

    return overrides.map((override) => this.cloneOverride(override));
  }

  private resolveOverrideProvider(moduleExports: any): () => ThemeDefaultPageContractOverride[] {
    if (typeof moduleExports?.getOverrides === 'function') {
      return moduleExports.getOverrides.bind(moduleExports);
    }

    if (typeof moduleExports?.default?.getOverrides === 'function') {
      return moduleExports.default.getOverrides.bind(moduleExports.default);
    }

    for (const value of Object.values(moduleExports || {})) {
      const provider = value as { getOverrides?: () => ThemeDefaultPageContractOverride[] } | undefined;
      if (typeof provider?.getOverrides === 'function') {
        return provider.getOverrides.bind(value);
      }
    }

    throw new Error('Theme override module must export a getOverrides() provider.');
  }

  private cloneOverride(override: ThemeDefaultPageContractOverride): ThemeDefaultPageContractOverride {
    return {
      contract: {
        namespace: String(override?.contract?.namespace || '').trim(),
        pluginSlug: String(override?.contract?.pluginSlug || '').trim(),
        key: String(override?.contract?.key || '').trim(),
      },
      slug: typeof override?.slug === 'string' ? override.slug : undefined,
      aliases: Array.isArray(override?.aliases) ? [...override.aliases] : undefined,
      title: typeof override?.title === 'string' ? override.title : undefined,
      themeLayout: typeof override?.themeLayout === 'string' ? override.themeLayout : undefined,
      recipe: typeof override?.recipe === 'string' ? override.recipe : undefined,
      install: typeof override?.install === 'boolean' ? override.install : undefined,
    };
  }
}