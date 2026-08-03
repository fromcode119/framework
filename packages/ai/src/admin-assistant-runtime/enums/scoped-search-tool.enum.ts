import { Enum } from '@fromcode119/reactor';

/**
 * The scope-paired MCP tool names the assistant reads evidence from. Each member also carries the WRITE tool
 * for its own scope, so a staged update can never be paired with another scope's search results.
 */
export class ScopedSearchTool extends Enum {
  static readonly PLUGIN_CONFIG = new ScopedSearchTool('plugins.settings.search_text', 'plugins.settings.update');
  static readonly THEME_CONFIG = new ScopedSearchTool('themes.config.search_text', 'themes.config.update');
  static readonly PLUGIN_FILES = new ScopedSearchTool('plugins.files.search_text', 'plugins.files.replace_text');
  static readonly THEME_FILES = new ScopedSearchTool('themes.files.search_text', 'themes.files.replace_text');

  /** The write tool paired with this search — so a staged update can never target the other scope. */
  readonly updateTool: string;

  private constructor(value: string, updateTool: string) {
    super(value);
    this.updateTool = updateTool;
  }

  /** Resolve a raw string to a member; defaults to PLUGIN_CONFIG. */
  static resolve(value: unknown): ScopedSearchTool {
    if (value instanceof ScopedSearchTool) return value;
    const found = ScopedSearchTool.fromValue(String(value ?? '').trim());
    return (found as ScopedSearchTool | undefined) ?? ScopedSearchTool.PLUGIN_CONFIG;
  }
}
