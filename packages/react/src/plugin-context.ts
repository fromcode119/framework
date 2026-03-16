import { createContext } from 'react';
import type { PluginContextValue } from './context.interfaces';

/**
 * Registry holding the React context for plugin context values.
 * Extracted to its own module to break the circular dependency chain:
 * context-hooks.ts → context.tsx → system-shortcodes.ts → context-hooks.ts
 */
export class PluginContextRegistry {
  static readonly Context = createContext<PluginContextValue | null>(null);
}
