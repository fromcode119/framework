import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuildService } from '@sources/packaging/build-service';
import { BuildSourceType } from '@sources/sources/enums/build-source-type.enum';

/**
 * Where a built package IS, versus the route a browser would fetch it from.
 *
 * These were one value, and something that had to OPEN the archive got the route: an installer
 * opened `/themes/fromcode-0.1.29.zip` as a filesystem path and died on a directory it had no
 * business writing to, while the archive sat in the workspace the builder had written it into.
 */
describe('BuildService — resolving a built artifact', () => {
  const WORKSPACE = '/app/data/sources';
  let service: any;

  beforeEach(() => {
    service = Object.create(BuildService.prototype);
    service.buildsSlug = 'fcp_sources_builds';
    service.packageBuilder = {
      outputDirFor: (type: BuildSourceType) => `${WORKSPACE}/${type === BuildSourceType.THEME ? 'themes' : 'plugins'}`,
    };
    service.db = {
      findOne: vi.fn(async () => ({
        slug: 'fromcode',
        type: 'theme',
        file_name: 'fromcode-0.1.29.zip',
        version: '0.1.29',
        artifactSha256: 'abc',
      })),
    };
  });

  it('reports the file inside the workspace the builder wrote into', async () => {
    const artifact = await service.resolvePackageArtifact('fromcode', BuildSourceType.THEME);

    expect(artifact.filePath).toBe('/app/data/sources/themes/fromcode-0.1.29.zip');
  });

  it('keeps the browser-facing route separate from the file', async () => {
    const artifact = await service.resolvePackageArtifact('fromcode', BuildSourceType.THEME);

    expect(artifact.downloadPath).toBe('/themes/fromcode-0.1.29.zip');
    expect(artifact.filePath).not.toBe(artifact.downloadPath);
  });

  it('hands an installer the file path, never the route', async () => {
    expect(await service.resolvePackageFilePath('fromcode', BuildSourceType.THEME))
      .toBe('/app/data/sources/themes/fromcode-0.1.29.zip');
    expect(await service.resolvePackageDownloadPath('fromcode', BuildSourceType.THEME))
      .toBe('/themes/fromcode-0.1.29.zip');
  });

  it('is null for a build that recorded no file, rather than a directory path', async () => {
    service.db.findOne = vi.fn(async () => ({ slug: 'fromcode', type: 'theme', file_name: '  ' }));

    expect(await service.resolvePackageFilePath('fromcode', BuildSourceType.THEME)).toBeNull();
  });
});
