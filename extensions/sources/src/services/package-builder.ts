import type { PluginContext } from '@fromcode119/sdk';
import { BuildSourceType } from '@plugin/src/services/enums/build-source-type.enum';
import * as path from 'path';
import * as fs from 'fs';
import { createRequire } from 'module';
import { PackageArchiver } from '@plugin/src/services/package-archiver';
import { ArtifactDigestService } from '@plugin/src/services/artifact-digest-service';
import type { IPackageResult } from '@plugin/src/services/interfaces/package-result.interface';

/**
 * Builds and packages plugins/themes into distributable ZIP archives.
 *
 * Mirrors the framework CLI `plugin build` command:
 *  1. Compile backend `index.ts` → `index.js` via esbuild (CJS, node)
 *  2. Compile UI `ui/index.ts` → `ui/bundle.js` via esbuild (ESM, browser)
 *  3. Remove source files and dev artifacts
 *  4. Create a ZIP archive
 *
 * Compilation is delegated to PackageCompiler and archive creation to
 * PackageArchiver; this class owns orchestration, manifest reading and the
 * integrity-checksum stamp.
 */
export class PackageBuilder {
  private static readonly runtimeRequire = createRequire(__filename);

  private archiver: PackageArchiver;

  constructor(
    private readonly context: PluginContext,
    private pluginsOutputDir: string,
    private themesOutputDir: string,
    private coreOutputDir: string,
    private appearancesOutputDir: string = path.join(path.dirname(pluginsOutputDir), 'appearances')
  ) {
    fs.mkdirSync(this.pluginsOutputDir, { recursive: true });
    fs.mkdirSync(this.themesOutputDir, { recursive: true });
    fs.mkdirSync(this.coreOutputDir, { recursive: true });
    fs.mkdirSync(this.appearancesOutputDir, { recursive: true });
    this.archiver = new PackageArchiver();
  }

  /**
   * Build and package a plugin or theme from its cloned source directory.
   */
  async build(sourceDir: string, type: BuildSourceType): Promise<IPackageResult> {
    if (type === BuildSourceType.CORE) {
      return this.buildCorePackage(sourceDir);
    }
    if (type === BuildSourceType.APPEARANCE) {
      return this.buildAppearancePackage(sourceDir);
    }

    const manifest = this.readManifest(sourceDir, type);
    const slug = manifest.slug;
    const version = manifest.version;

    if (!slug || !version) {
      throw new Error(`Invalid manifest in ${sourceDir}: missing slug or version`);
    }

    // Step 1: compile. The FRAMEWORK builds, through `context.extensions` — this plugin may not
    // import @fromcode119/extension-builder (SdkBoundaryGuard), and it no longer keeps its own copy
    // of the compilers. One builder means the theme head script and the seed, which this plugin
    // never compiled, now happen here too.
    const built = await this.context.extensions.build({
      sourceDir,
      kind: type === BuildSourceType.THEME ? 'theme' : 'plugin',
      slug,
    });
    if (!built.ok) {
      throw new Error(`Build failed at ${built.failedStep ?? 'unknown step'}: ${built.message ?? 'no detail'}`);
    }

    // Step 1b: Stamp the integrity checksum LAST — it must hash the fully-built
    // source dir. Mirrors `build-plugins.sh` so both build paths stay consistent
    // and reuses the runtime's own IntegrityService (the hash logic can never drift).
    await this.stampIntegrityChecksum(sourceDir, manifest);

    // Step 2: Create the ZIP archive
    const fileName = `${slug}-${version}.zip`;
    const outputDir = type === BuildSourceType.PLUGIN ? this.pluginsOutputDir : this.themesOutputDir;
    const filePath = path.join(outputDir, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await this.archiver.createZip(sourceDir, filePath);
    // Digest the finished archive. Recorded OUTSIDE the package (see ArtifactDigestService) so an
    // installer has something to verify against that the package itself did not supply.
    const artifactSha256 = await ArtifactDigestService.digestFile(filePath);
    return { filePath, fileName, version, slug, manifest, artifactSha256 };
  }

  /**
   * Stamp the plugin's integrity checksum into its manifest.json.
   *
   * The checksum is the SHA-256 directory hash produced by the framework's own
   * IntegrityService — loaded at runtime by absolute path so the hashing algorithm
   * and exclusion set (manifest.json / node_modules / package-lock.json / dotfiles)
   * are identical to what `lifecycle-service` verifies at boot. A mismatch would
   * disable the plugin, so the two sides must never diverge. manifest.json is
   * excluded from the hash, so writing the checksum back does not invalidate it.
   *
   * Best-effort: if the IntegrityService cannot be loaded, the build still succeeds
   * (the plugin simply ships unverified, the same as the CLI's "core not built" path).
   */
  private async stampIntegrityChecksum(sourceDir: string, manifest: Record<string, any>): Promise<void> {
    const manifestPath = path.join(sourceDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return;
    }

    const integrityService = this.loadIntegrityService();
    if (!integrityService) {
      console.warn('[package-builder] IntegrityService unavailable — skipping checksum stamp');
      return;
    }

    const checksum = await integrityService.calculateDirectoryHash(sourceDir);
    const onDisk = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    onDisk.checksum = checksum;
    fs.writeFileSync(manifestPath, JSON.stringify(onDisk, null, 2) + '\n');
    manifest.checksum = checksum;
  }

  /**
   * Resolve the framework IntegrityService by absolute path. `@fromcode119/core`
   * does not export it through the package "exports" map, so we resolve the package
   * main and navigate to the compiled module (an absolute-path require bypasses the
   * exports restriction). Returns null when core is not resolvable.
   */
  private loadIntegrityService(): any {
    try {
      const coreMain = PackageBuilder.runtimeRequire.resolve('@fromcode119/core');
      const servicePath = path.join(path.dirname(coreMain), 'security', 'integrity-service.js');
      return PackageBuilder.runtimeRequire(servicePath)?.IntegrityService ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Read the manifest file from a source directory.
   */
  private async buildAppearancePackage(sourceDir: string): Promise<IPackageResult> {
    const manifest = this.readManifest(sourceDir, BuildSourceType.APPEARANCE);
    const slug = manifest.slug;
    const version = manifest.version;
    if (!slug || !version) {
      throw new Error(`Invalid appearance.json in ${sourceDir}: missing slug or version`);
    }

    // Appearances ship a pre-built dist/ (esbuild bundle + LESS-compiled CSS, produced by
    // build-appearances.sh in the source repo). Sources does NOT recompile them — it just
    // packages the source + dist/ into a zip (createZip strips .ts source, keeps dist/*.js/.css + json).
    const fileName = `${slug}-${version}.zip`;
    const filePath = path.join(this.appearancesOutputDir, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    await this.archiver.createZip(sourceDir, filePath);
    const artifactSha256 = await ArtifactDigestService.digestFile(filePath);
    return { filePath, fileName, version, slug, manifest, artifactSha256 };
  }

  private readManifest(sourceDir: string, type: BuildSourceType): Record<string, any> {
    const candidates = type === BuildSourceType.PLUGIN
      ? ['manifest.json', 'plugin.json']
      : type === BuildSourceType.APPEARANCE
        ? ['appearance.json', 'manifest.json']
        : ['theme.json', 'manifest.json'];

    for (const name of candidates) {
      const p = path.join(sourceDir, name);
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    }

    throw new Error(`No manifest found in ${sourceDir} (tried: ${candidates.join(', ')})`);
  }

  private async buildCorePackage(sourceDir: string): Promise<IPackageResult> {
    const manifest = this.readCoreManifest(sourceDir);
    const version = String(manifest.version || '').trim();
    if (!version) {
      throw new Error(`Invalid core manifest in ${sourceDir}: missing version`);
    }

    const fileName = `fromcode-core-${version}.zip`;
    const filePath = path.join(this.coreOutputDir, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await this.archiver.createCoreZip(sourceDir, filePath);
    return {
      filePath,
      fileName,
      version,
      slug: 'core',
      manifest,
      artifactSha256: await ArtifactDigestService.digestFile(filePath),
    };
  }

  private readCoreManifest(sourceDir: string): Record<string, any> {
    const packageJsonPath = path.join(sourceDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`No package.json found in ${sourceDir} for core build`);
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return {
      slug: 'core',
      name: packageJson.name || 'Fromcode Core',
      version: packageJson.version,
      description: packageJson.description || 'Fromcode framework core release',
      changelog: '',
    };
  }
}
