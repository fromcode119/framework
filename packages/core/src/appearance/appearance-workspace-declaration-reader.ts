import type { IAppearanceWorkspaceDeclaration } from '@core/appearance/interfaces/appearance-workspace-declaration.interface';

/** Reads the optional `workspace` block of an appearance.json; absent or shapeless → undefined. */
export class AppearanceWorkspaceDeclarationReader {
  static read(manifest: unknown): IAppearanceWorkspaceDeclaration | undefined {
    const block = (manifest as { workspace?: unknown } | null)?.workspace;
    if (!block || typeof block !== 'object') return undefined;
    const raw = block as Record<string, unknown>;
    const plugins = Array.isArray(raw.plugins) ? raw.plugins.map((slug) => String(slug ?? '').trim().toLowerCase()).filter(Boolean) : [];
    return {
      label: raw.label ? String(raw.label) : undefined,
      description: raw.description ? String(raw.description) : undefined,
      plugins: [...new Set(plugins)],
    };
  }
}
