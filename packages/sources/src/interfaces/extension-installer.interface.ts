import type { ExtensionScope } from '@fromcode119/core';

/**
 * Installing a built archive.
 *
 * Sources auto-update produces an archive and then has to install it. As a plugin it reached this
 * through `context.extensions.installArchive`, a capability-gated hop that existed because a plugin
 * may not call the manager. Framework code calls the manager; this interface is here so the package
 * states the one method it needs rather than depending on the whole manager.
 */
export interface IExtensionInstaller {
  installExtensionArchive(
    filePath: string,
    scope: ExtensionScope,
    options?: { activate?: boolean; enable?: boolean },
  ): Promise<unknown>;
}
