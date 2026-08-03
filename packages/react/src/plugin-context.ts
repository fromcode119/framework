import { Context as ReactorContext } from '@fromcode119/reactor';
import type { IPluginContextValue } from '@react/interfaces/plugin-context-value.interface';

/**
 * Registry holding the React context for plugin context values.
 * Extracted to its own module to break the circular dependency chain:
 * context-hooks.ts → context.tsx → system-shortcodes.ts → context-hooks.ts
 */
export class PluginContextRegistry {
  static readonly Context = new ReactorContext<IPluginContextValue | null>(null).raw;
}
