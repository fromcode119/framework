import * as fs from 'fs';
import * as path from 'path';
import { ArtifactDigestService } from '@sources/packaging/artifact-digest-service';
import { PackageArchiver } from '@sources/packaging/package-archiver';
import type { IBuiltPackageArtifact } from '@sources/packaging/interfaces/built-package-artifact.interface';
import type { PackageBuilder } from '@sources/packaging/package-builder';

/**
 * The archive, made when somebody asks for it.
 *
 * A build stages a package directory and stops there: zipping it so that an install could unzip it
 * back into the same shape was the round trip, and the zip was where the packaging quietly stopped
 * happening — it was globbed out of an uncleaned source tree rather than made from a packaged one.
 *
 * The zip exists for the one case that genuinely wants a file, and is written beside the staged
 * package so asking twice costs nothing. Nothing is stripped here, which is the point: what you
 * download is exactly what installs.
 */
export class PackageDownloadService {
  constructor(
    private readonly packageBuilder: PackageBuilder,
    private readonly recordArchive: (slug: string, fileName: string, digest: string) => Promise<void>,
  ) {}

  async archive(slug: string, artifact: IBuiltPackageArtifact | null): Promise<{ filePath: string; fileName: string } | null> {
    if (!artifact) return null;

    // Core never stages; it has an archive already.
    if (artifact.filePath && fs.existsSync(artifact.filePath)) {
      return { filePath: artifact.filePath, fileName: path.basename(artifact.filePath) };
    }
    if (!artifact.stagedDir || !fs.existsSync(artifact.stagedDir)) return null;

    const fileName = `${slug}-${artifact.version}.zip`;
    const filePath = path.join(this.packageBuilder.outputDirFor(artifact.type), fileName);
    if (!fs.existsSync(filePath)) {
      await new PackageArchiver().createZip(artifact.stagedDir, filePath);
      // Recorded so a consumer of the catalogue has a hash that did not travel inside the package.
      await this.recordArchive(slug, fileName, await ArtifactDigestService.digestFile(filePath));
    }

    return { filePath, fileName };
  }
}
