import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BuildSourceType } from '@sources/sources/enums/build-source-type.enum';
import { PackageDownloadService } from '@sources/packaging/package-download-service';

/**
 * The archive, made when somebody asks for it.
 *
 * The trap here is that the filename carries the VERSION, so a rebuild of the same version lands on
 * the same path — and an archive that merely exists is not necessarily an archive of THIS build.
 * Staging handed out a package built ninety minutes earlier for exactly that reason.
 */
describe('PackageDownloadService', () => {
  let root: string;
  let staged: string;
  let themesDir: string;
  let service: PackageDownloadService;
  let recorded: Array<[string, string, string]>;

  const artifact = (over: Record<string, unknown> = {}) => ({
    stagedDir: staged,
    filePath: null,
    fileName: null,
    downloadPath: '/sources/fromcode/package',
    artifactSha256: '',
    type: BuildSourceType.THEME,
    version: '0.1.29',
    ...over,
  }) as never;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-download-'));
    themesDir = path.join(root, 'themes');
    staged = path.join(themesDir, 'packages', 'fromcode-0.1.29');
    fs.mkdirSync(staged, { recursive: true });
    fs.writeFileSync(path.join(staged, 'theme.json'), '{"slug":"fromcode","version":"0.1.29"}');

    recorded = [];
    service = new PackageDownloadService(
      { outputDirFor: () => themesDir } as never,
      async (slug, fileName, digest) => { recorded.push([slug, fileName, digest]); },
    );
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('makes the archive on the first ask and records it', async () => {
    const result = await service.archive('fromcode', artifact());

    expect(result?.fileName).toBe('fromcode-0.1.29.zip');
    expect(fs.existsSync(result!.filePath)).toBe(true);
    expect(recorded).toHaveLength(1);
  });

  it('serves the same archive again without remaking it', async () => {
    await service.archive('fromcode', artifact());
    recorded = [];

    await service.archive('fromcode', artifact());

    expect(recorded).toHaveLength(0);
  });

  it('REMAKES it when the package has been rebuilt since', async () => {
    const first = await service.archive('fromcode', artifact());
    // The same version rebuilt: same staged path, same archive name, newer content.
    const later = new Date(Date.now() + 60_000);
    fs.utimesSync(staged, later, later);
    recorded = [];

    await service.archive('fromcode', artifact());

    expect(recorded).toHaveLength(1);
    expect(fs.statSync(first!.filePath).mtimeMs).toBeGreaterThanOrEqual(fs.statSync(staged).mtimeMs - 60_000);
  });

  it('hands back core\'s own archive rather than zipping a directory core never staged', async () => {
    const coreZip = path.join(themesDir, 'fromcode-core-1.0.0.zip');
    fs.writeFileSync(coreZip, 'PK');

    const result = await service.archive('core', artifact({ stagedDir: null, filePath: coreZip, type: BuildSourceType.CORE }));

    expect(result?.filePath).toBe(coreZip);
    expect(recorded).toHaveLength(0);
  });

  it('is null when there is no package to archive, rather than an empty zip', async () => {
    expect(await service.archive('fromcode', artifact({ stagedDir: path.join(root, 'gone') }))).toBeNull();
    expect(await service.archive('fromcode', null)).toBeNull();
  });
});
