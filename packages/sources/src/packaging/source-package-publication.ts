import { CoercionUtils } from '@fromcode119/core';
import { ArtifactDigestService } from '@sources/packaging/artifact-digest-service';
import type { ISitePackagePublisher } from '@sources/packaging/interfaces/site-package-publisher.interface';
import type { BuildSourceIdentity } from '@sources/sources/build-source-identity';

/**
 * Hands a successful build to the site its source publishes to.
 *
 * Returns the outcome as the sentence the Sources screen shows beside the build, so the operator can
 * see whether the hand-over happened without reading logs. A failed hand-over never fails the build:
 * the package was built, and that stays true.
 */
export class SourcePackagePublication {
  constructor(
    private readonly archive: (identity: BuildSourceIdentity) => Promise<{ filePath: string; fileName: string } | null>,
    private readonly publisher?: ISitePackagePublisher,
  ) {}

  async publish(
    identity: BuildSourceIdentity,
    siteId: string,
    pkg: { version: string; manifest: Record<string, any> | null },
  ): Promise<string> {
    const at = new Date().toISOString();
    if (!this.publisher) return `Not published to "${siteId}" (${at}): this installation cannot publish to sites.`;
    try {
      if (!(await this.publisher.isSite(siteId))) {
        return `Not published to "${siteId}" (${at}): there is no active site with that id.`;
      }
      const archive = await this.archive(identity);
      if (!archive) return `Not published to "${siteId}" (${at}): the built package could not be archived.`;
      const manifest = pkg.manifest ?? {};
      await this.publisher.publish(siteId, archive, {
        type: String(identity.type.value),
        slug: identity.slug,
        version: pkg.version,
        name: CoercionUtils.toString(manifest.name),
        description: CoercionUtils.toString(manifest.description),
        author: CoercionUtils.toString(typeof manifest.author === 'object' ? manifest.author?.name : manifest.author),
        artifactSha256: await ArtifactDigestService.digestFile(archive.filePath),
      });
      return `Published ${pkg.version} to "${siteId}" (${at}).`;
    } catch (error: unknown) {
      return `Not published to "${siteId}" (${at}): ${error instanceof Error ? error.message : String(error)}`.slice(0, 2000);
    }
  }
}
