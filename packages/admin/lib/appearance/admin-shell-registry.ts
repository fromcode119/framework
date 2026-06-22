import type React from 'react';

/**
 * Registry of admin shells (chrome) keyed by appearance id. Each appearance has at most one shell.
 * `resolve` returns the appearance's shell or undefined; the host falls back to the framework's
 * default ClientLayoutShell when undefined. A shared singleton is exposed as AdminShellRegistry.shared;
 * tests construct fresh instances for isolation.
 */
export class AdminShellRegistry {
  static readonly shared = new AdminShellRegistry();

  private readonly shells = new Map<string, React.ComponentType<any>>();

  register(appearanceId: string, shell: React.ComponentType<any>): void {
    this.shells.set(appearanceId, shell);
  }

  resolve(appearanceId: string): React.ComponentType<any> | undefined {
    return this.shells.get(appearanceId);
  }
}
