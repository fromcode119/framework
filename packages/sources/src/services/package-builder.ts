import { BuildSourceType } from '@sources/services/enums/build-source-type.enum';
import * as path from 'path';
import { ExtensionBuildPipeline, ExtensionKind } from '@fromcode119/extension-builder';
import { IntegrityService } from '@fromcode119/core';
import * as fs from 'fs';
import { PackageArchiver } from '@sources/services/package-archiver';
import { ArtifactDigestService } from '@sources/services/artifact-digest-service';
import type { IPackageResult } from '@sources/services/interfaces/package-result.interface';

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
  private archiver: PackageArchiver;

  constructor(
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

    // Step 1: compile, by calling the builder. Directly — this used to go out through
    // `context.extensions.build`, a bridge that existed for exactly one caller: core cannot import
    // the builder (the builder depends on core), so the api layer registered an implementation into
    // a registry for a "plugin" to reach. Sources is not a plugin, so it just calls it.
    const steps = await ExtensionBuildPipeline.run({
      sourceDir,
      kind: type === BuildSourceType.THEME ? ExtensionKind.THEME : ExtensionKind.PLUGIN,
      slug,
      // In place: the zip below is made from this same directory, and packing would strip the
      // sources the checksum is then stamped over.
      pack: false,
    });
    const failed = steps.find((step) => step.failed);
    if (failed) {
      throw new Error(`Build failed at ${failed.step}: ${failed.message ?? 'no detail'}`);
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
   * Uses the runtime's OWN IntegrityService, so the hashing algorithm and exclusion set
   * (manifest.json / node_modules / package-lock.json / dotfiles) cannot drift from what
   * `lifecycle-service` verifies at boot — a mismatch disables the extension being built.
   * manifest.json is excluded from the hash, so writing the checksum back does not invalidate it.
   *
   * It used to be resolved at runtime by absolute path, because a plugin could not import core.
   * Framework code imports it.
   */
  private async stampIntegrityChecksum(sourceDir: string, manifest: Record<string, any>): Promise<void> {
    const manifestPath = path.join(sourceDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return;
    }

    const checksum = await IntegrityService.calculateDirectoryHash(sourceDir);
    const onDisk = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    onDisk.checksum = checksum;
    fs.writeFileSync(manifestPath, JSON.stringify(onDisk, null, 2) + '\n');
    manifest.checksum = checksum;
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
