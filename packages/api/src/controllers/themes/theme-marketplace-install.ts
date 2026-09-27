import { CoercionUtils, CoreServices, ThemeManager, Logger } from '@fromcode119/core';

/**
 * Installing a theme from THIS platform's marketplace — never from a URL the caller chose. Shared by the
 * platform's install and a site adding a marketplace theme, so the two cannot disagree about what a
 * marketplace theme is or where its package comes from.
 */
export class ThemeMarketplaceInstall {
  constructor(private readonly manager: ThemeManager, private readonly logger: Logger) {}

  /** How it was installed (`local` or `marketplace`), or null when the marketplace has no such theme. */
  async install(slug: string, version?: string): Promise<'local' | 'marketplace' | null> {
    const themes = await this.manager.getMarketplaceThemes();
    const pkg = themes.find((theme: any) => theme.slug === slug && (!version || theme.version === version));
    if (!pkg) return null;

    // An offer from THIS installation is a file on disk, not a URL. Its catalogue row borrows the
    // marketplace shape, whose only location is `downloadUrl` — so a locally built theme was
    // installed by resolving its bare filename against the REMOTE marketplace, producing
    // `https://marketplace.fromcode.com/.../aurora-0.1.29.zip` for a file sitting in this
    // installation's own workspace. The contributor that offered it is the one that knows where it is.
    const localPath = await ThemeMarketplaceInstall.localPackage(pkg, slug);
    if (localPath) {
      this.logger.info(`Installing theme "${slug}" from this installation: ${localPath}`);
      await this.manager.installFromZip(localPath);
      return 'local';
    }
    await this.manager.installTheme(pkg);
    return 'marketplace';
  }

  /**
   * Where a locally built theme actually is, or null when the offer came from a remote catalogue.
   *
   * Asked of the catalogue-contribution registry rather than of any named producer: nothing here may
   * know that something called Sources exists, only that whatever offered the package can say where it
   * put it. The path is resolved server-side from the offer the server itself looked up, so nothing the
   * caller sent chooses which file is opened.
   */
  private static async localPackage(pkg: unknown, slug: string): Promise<string | null> {
    const offer = CoercionUtils.toObject(pkg);
    if (CoercionUtils.toString(offer.source) !== 'local') return null;
    return CoreServices.getInstance().catalogContributions.resolveArtifact(slug, CoercionUtils.toString(offer.kind) || 'theme');
  }
}
