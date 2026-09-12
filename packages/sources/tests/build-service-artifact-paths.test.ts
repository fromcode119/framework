import { ExtensionScope } from '@fromcode119/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuildService } from '@sources/packaging/build-service';
import { SourcesCollectionRegistry } from '@sources/sources/sources-tables';

/**
 * Where a built package IS, versus the route a download comes from.
 *
 * These were one value, and something that had to OPEN the package got the route: an installer
 * opened `/themes/fromcode-0.1.29.zip` as a filesystem path and died on a directory it had no
 * business writing to, while the archive sat in the workspace the builder had written it into.
 * A build now stages a DIRECTORY and writes an archive only when somebody downloads one, so
 * "there is no file" is a normal answer rather than a failure.
 */
describe('BuildService — resolving a built artifact', () => {
  const WORKSPACE = '/app/data/sources';
  let service: any;

  beforeEach(() => {
    service = Object.create(BuildService.prototype);
    service.buildsSlug = SourcesCollectionRegistry.BUILDS;
    service.packageBuilder = {
      outputDirFor: (type: ExtensionScope) => `${WORKSPACE}/${type === ExtensionScope.THEME ? 'themes' : 'plugins'}`,
      stagingDirFor: (type: ExtensionScope, slug: string, version: string) =>
        `${WORKSPACE}/${type === ExtensionScope.THEME ? 'themes' : 'plugins'}/packages/${slug}-${version}`,
    };
    service.db = {
      findOne: vi.fn(async () => ({
        // No `file_name`: a build stages a package directory and records no archive. One is only
        // written, and recorded, when somebody downloads it.
        slug: 'fromcode',
        type: 'theme',
        version: '0.1.29',
      })),
    };
  });

  it('reports the staged package inside the workspace the builder wrote into', async () => {
    const artifact = await service.resolvePackageArtifact('fromcode', ExtensionScope.THEME);

    expect(artifact.stagedDir).toBe('/app/data/sources/themes/packages/fromcode-0.1.29');
  });

  it('answers with the route that MAKES a download, not a file that may not exist', async () => {
    const artifact = await service.resolvePackageArtifact('fromcode', ExtensionScope.THEME);

    expect(artifact.downloadPath).toBe('/sources/fromcode/package');
    // No archive has been written: a build stages a directory and zips only on request.
    expect(artifact.filePath).toBeNull();
    expect(artifact.fileName).toBeNull();
  });

  it('reports the archive once one has been recorded', async () => {
    service.db.findOne = vi.fn(async () => ({
      slug: 'fromcode', type: 'theme', version: '0.1.29', file_name: 'fromcode-0.1.29.zip',
    }));

    const artifact = await service.resolvePackageArtifact('fromcode', ExtensionScope.THEME);

    expect(artifact.filePath).toBe('/app/data/sources/themes/fromcode-0.1.29.zip');
  });

  it('stages nothing for a build that recorded no version, rather than naming a directory', async () => {
    service.db.findOne = vi.fn(async () => ({ slug: 'fromcode', type: 'theme', version: '  ' }));

    const artifact = await service.resolvePackageArtifact('fromcode', ExtensionScope.THEME);
    expect(artifact.stagedDir).toBeNull();
  });
});
