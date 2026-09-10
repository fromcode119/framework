import type { IExtensionBuildService } from '@core/plugin/interfaces/extension-build-service.interface';

/**
 * Where the api layer registers the extension builder, and where `context.extensions` reads it.
 *
 * Core declares the contract and must NEVER import `@fromcode119/extension-builder`: the builder
 * depends on core, so importing it back is a cycle. Inversion through this registry is what keeps
 * the dependency one-way.
 */
export class ExtensionBuildRegistry {
  private static implementation: IExtensionBuildService | null = null;

  static register(implementation: IExtensionBuildService): void {
    ExtensionBuildRegistry.implementation = implementation;
  }

  static isRegistered(): boolean {
    return ExtensionBuildRegistry.implementation !== null;
  }

  /**
   * Fail-CLOSED: a deployment with no build toolchain returns a refusal naming the reason, rather
   * than throwing into a plugin that cannot do anything about it.
   */
  static resolve(): IExtensionBuildService {
    return ExtensionBuildRegistry.implementation ?? {
      build: async () => ({
        ok: false,
        failedStep: 'extension-build-registry',
        message: 'No extension builder is registered in this deployment.',
        steps: [],
      }),
    };
  }
}
