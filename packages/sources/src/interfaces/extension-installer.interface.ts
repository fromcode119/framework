import type { ExtensionScope } from '@fromcode119/core';

/**
 * Installing what a build produced.
 *
 * As a plugin, Sources reached this through `context.extensions.installArchive`, a capability-gated
 * hop that existed because a plugin may not call the manager. Framework code calls the manager;
 * this interface is here so the package states the methods it needs rather than depending on the
 * whole manager.
 */
export interface IExtensionInstaller {
  /** Installs a package DIRECTORY — what a build on this installation produces. */
  installExtensionDirectory(
    packageDir: string,
    scope: ExtensionScope,
    options?: { activate?: boolean; enable?: boolean },
  ): Promise<unknown>;

  /**
   * Installs an ARCHIVE. Still needed for core, which replaces the live project root and is
   * deliberately not on the directory path.
   */
  installExtensionArchive(
    filePath: string,
    scope: ExtensionScope,
    options?: { activate?: boolean; enable?: boolean },
  ): Promise<unknown>;

  /**
   * Whether this extension is already installed.
   *
   * The question that separates the two settings: "install after build" puts a package in place
   * that is not there yet, and "update if already installed" is what allows REPLACING code that is
   * currently serving a site. Without this the framework cannot tell the two apart, which is how
   * they ended up as one setting that did neither well.
   */
  isExtensionInstalled(slug: string, scope: ExtensionScope): Promise<boolean>;
}
