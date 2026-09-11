import type { RequestHandler } from 'express';
import type { HookManager } from '@fromcode119/core';
import type { IExtensionInstaller } from '@sources/interfaces/extension-installer.interface';

/**
 * What Sources needs from the framework to run.
 *
 * Every entry is a real framework service the caller already holds. As a plugin these arrived as one
 * opaque `context` whose members were gated by declared capabilities — seven of them, asking
 * permission for things the framework owns. Naming the dependencies instead means a reader can see
 * the whole surface, and adding one is a visible change rather than a new line in a manifest.
 */
export interface ISourcesModuleInput {
  db: unknown;
  hooks: HookManager;
  adminGuard: RequestHandler;
  /** Where the platform is installed; the build workspace is resolved beneath it. */
  projectRoot: string;
  /** An operator-configured workspace, when one is set. Overrides the default beneath `projectRoot`. */
  workspaceRoot?: string;
  /** Encrypts stored repository tokens with the installation's own key. */
  secrets?: { isConfigured(): boolean; encrypt(value: string): string; decrypt(value: unknown): string };
  /** Installs what auto-update just built. Absent means auto-update reports that it cannot run. */
  installer?: IExtensionInstaller;
  /** Publishes built versions to the admin catalogue, so the Plugins screen learns about them. */
  catalog?: {
    contribute(
      provider: () => Promise<unknown[]>,
      resolveArtifact?: (slug: string, kind: string) => Promise<string | null>,
    ): void;
  };
  /** Runs the auto-build timer. */
  scheduler?: { register(name: string, schedule: string, handler: () => Promise<void>): Promise<void> };
}
