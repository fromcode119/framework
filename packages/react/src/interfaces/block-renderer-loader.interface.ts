import type React from 'react';

/**
 * Lazily imports a block renderer component.
 *
 * A call signature has no class form, so this stays an `interface` — the same reason
 * `IRedirectResolver` and `IContentResolutionGate` do.
 */
export interface IBlockRendererLoader {
  (): Promise<{ default: React.ComponentType<unknown> }>;
}
