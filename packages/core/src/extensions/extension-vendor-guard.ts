import * as fs from 'fs';
import * as path from 'path';

/**
 * Refuses to install an extension over a same-slug one from another vendor.
 *
 * An extension's identity on this server is its slug: the directory it lives in, and for a plugin its
 * tables, settings, capabilities and routes, for a theme the sites using it and their layouts, for an
 * appearance the workspaces that wear it. A package from a different `namespace` that happens to share
 * the slug would otherwise be taken for an UPDATE and inherit all of that. Same vendor is an update;
 * an installed extension that declares no namespace cannot be told apart, so it stays replaceable.
 */
export class ExtensionVendorGuard {
  /**
   * @param targetDir     where the extension is (or would be) installed
   * @param manifestFile  the kind's own manifest name: `manifest.json`, `theme.json`, `appearance.json`
   * @param incoming      the slug and namespace of the package being installed
   * @param kind          the word for the extension in the refusal: `plugin`, `theme`, `appearance`
   */
  static refuse(targetDir: string, manifestFile: string, incoming: { slug?: string; namespace?: string }, kind: string): void {
    const installedVendor = ExtensionVendorGuard.installedNamespace(path.join(targetDir, manifestFile));
    const incomingVendor = String(incoming.namespace ?? '').trim();
    if (!installedVendor || installedVendor === incomingVendor) return;
    throw new Error(
      `Refusing to install ${kind} "${incoming.slug}" from "${incomingVendor || 'no vendor'}": a ${kind} with that slug from `
      + `"${installedVendor}" is already installed, and installing over it would hand the new one everything the installed `
      + `${kind} owns. Remove the installed ${kind} first, or install one with a different slug.`,
    );
  }

  private static installedNamespace(manifestPath: string): string {
    if (!fs.existsSync(manifestPath)) return '';
    try {
      return String(JSON.parse(fs.readFileSync(manifestPath, 'utf8'))?.namespace ?? '').trim();
    } catch {
      return '';
    }
  }
}
