import { ExtensionScope } from '@fromcode119/core';
import * as path from 'path';
import { ExtensionBuildPipeline, ExtensionKind } from '@fromcode119/extension-builder';

import * as fs from 'fs';
import { PackageArchiver } from '@sources/packaging/package-archiver';
import { PackCleaner } from '@fromcode119/extension-builder';
import { ArtifactDigestService } from '@sources/packaging/artifact-digest-service';
import type { IPackageResult } from '@sources/packaging/interfaces/package-result.interface';

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
   * The directory this builder writes a given kind into.
   *
   * Published because an installer has to find what was built, and the only other way to say where
   * that is was to rebuild the path somewhere else — which is what happened: a caller joined the
   * kind's name onto `process.cwd()` and produced `/app/themes/<file>` for an archive living in the
   * workspace at `/app/data/sources/themes/<file>`. One owner of the layout, asked rather than
   * guessed.
   */
  outputDirFor(type: ExtensionScope): string {
    if (type === ExtensionScope.CORE) return this.coreOutputDir;
    if (type === ExtensionScope.APPEARANCE) return this.appearancesOutputDir;
    if (type === ExtensionScope.THEME) return this.themesOutputDir;
    return this.pluginsOutputDir;
  }

  /**
   * Build and package a plugin or theme from its cloned source directory.
   */
  async build(sourceDir: string, type: ExtensionScope): Promise<IPackageResult> {
    if (type === ExtensionScope.CORE) {
      return this.buildCorePackage(sourceDir);
    }
    if (type === ExtensionScope.APPEARANCE) {
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
    // Step 2: compile AND package, into a staging directory that is the artifact.
    //
    // `pack: true` is the whole correction. The server used to pass `pack: false` and then zip the
    // uncleaned source tree with a glob ignore-list — which meant three steps of packaging never
    // ran here at all: PackCleaner, the theme's SSR dependency closure, and the integrity stamp
    // over CLEANED content. The last is not cosmetic: registration hashes the INSTALLED directory,
    // which has no `.ts`, against a checksum stamped over a source tree that does, so a plugin
    // built here could never verify. `archive: false` stops before the tarball, which nothing here
    // wants — an install copies this directory, and a download archives it on request.
    const stagedDir = this.stagingDirFor(type, slug, version);
    fs.rmSync(stagedDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(stagedDir), { recursive: true });

    const steps = await ExtensionBuildPipeline.run({
      sourceDir,
      kind: type === ExtensionScope.THEME ? ExtensionKind.THEME : ExtensionKind.PLUGIN,
      slug,
      pack: true,
      packDir: stagedDir,
      archive: false,
    });
    const failed = steps.find((step) => step.failed);
    if (failed) {
      throw new Error(`Build failed at ${failed.step}: ${failed.message ?? 'no detail'}`);
    }

    // The manifest is re-read from the STAGED directory: the pipeline stamped the checksum there,
    // over the cleaned content, and the copy read from `sourceDir` above predates that stamp.
    return { stagedDir, version, slug, manifest: this.readManifest(stagedDir, type) };
  }

  /**
   * Where a built package is staged.
   *
   * Versioned, so a rebuild of a different version does not overwrite a package something may
   * still be downloading, and so the directory name states what it holds.
   */
  stagingDirFor(type: ExtensionScope, slug: string, version: string): string {
    return path.join(this.outputDirFor(type), 'packages', `${slug}-${version}`);
  }

  /**
   * Every version of this extension still staged on disk, newest first.
   *
   * Nothing prunes these: a build clears its OWN version's directory and leaves the rest, so the
   * versions an installation has built accumulate and are already installable — which is what makes
   * going back to one a listing problem rather than a rebuild.
   *
   * Derived from the directories rather than from a build record, because the record holds ONE
   * version — the latest — and the whole point here is the others.
   *
   * A remainder must LOOK like a version — it has to start with a digit. Slugs contain hyphens
   * (`shipping-adapter`), so a bare prefix match would read `acme-extra-0.1.0` as version
   * `extra-0.1.0` of `acme` and offer another extension's package as one of this one's.
   */
  listStagedVersions(type: ExtensionScope, slug: string): string[] {
    const name = String(slug || '').trim();
    if (!name) return [];

    const packagesDir = path.join(this.outputDirFor(type), 'packages');
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(packagesDir, { withFileTypes: true });
    } catch {
      // No directory means nothing has been built for this kind yet — an empty list, not an error.
      return [];
    }

    const prefix = `${name}-`;
    return entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
      .map((entry) => entry.name.slice(prefix.length))
      .filter((version) => /^\d/.test(version))
      .sort(PackageBuilder.byVersionDescending);
  }

  /**
   * Newest first.
   *
   * Two things a plain string sort gets wrong, both of which put the wrong entry at the top of a
   * list an operator is about to install from:
   *
   *   NUMBERS  — `0.1.9` sorts above `0.1.31` as text, so the newest build would not be first.
   *   PRERELEASES — `1.0.0-rc.1` sorts above `1.0.0` as text, and it is the OLDER of the two: a
   *                 release outranks the candidates that preceded it.
   *
   * The release part is compared segment by segment as numbers; a version with no prerelease suffix
   * then outranks the same release with one. Non-numeric segments fall back to text so the order
   * stays stable rather than correct by luck.
   */
  private static byVersionDescending(left: string, right: string): number {
    const split = (value: string): { release: string[]; pre: string } => {
      const at = value.indexOf('-');
      return at === -1
        ? { release: value.split('.'), pre: '' }
        : { release: value.slice(0, at).split('.'), pre: value.slice(at + 1) };
    };

    const a = split(left);
    const b = split(right);

    for (let index = 0; index < Math.max(a.release.length, b.release.length); index += 1) {
      const x = a.release[index];
      const y = b.release[index];
      if (x === undefined) return 1;
      if (y === undefined) return -1;
      const nx = Number(x);
      const ny = Number(y);
      if (Number.isInteger(nx) && Number.isInteger(ny)) {
        if (nx !== ny) return ny - nx;
        continue;
      }
      const comparison = String(y).localeCompare(String(x));
      if (comparison !== 0) return comparison;
    }

    // Same release. No prerelease suffix is the finished one and comes first.
    if (a.pre === b.pre) return 0;
    if (!a.pre) return -1;
    if (!b.pre) return 1;
    return b.pre.localeCompare(a.pre);
  }

  /**
   * Read the manifest file from a source directory.
   */
  private async buildAppearancePackage(sourceDir: string): Promise<IPackageResult> {
    const manifest = this.readManifest(sourceDir, ExtensionScope.APPEARANCE);
    const slug = manifest.slug;
    const version = manifest.version;
    if (!slug || !version) {
      throw new Error(`Invalid appearance.json in ${sourceDir}: missing slug or version`);
    }

    // Appearances ship a pre-built dist/ (esbuild bundle + LESS-compiled CSS, produced in the
    // source repo). Sources does NOT recompile them — it stages the source + dist/ and lets the
    // cleaner strip what must not ship, exactly as for a plugin or theme. Staged rather than
    // zipped for the same reason as the others: an install copies the directory.
    const stagedDir = this.stagingDirFor(ExtensionScope.APPEARANCE, slug, version);
    fs.rmSync(stagedDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(stagedDir), { recursive: true });
    fs.cpSync(sourceDir, stagedDir, { recursive: true });
    PackCleaner.clean(stagedDir);

    return { stagedDir, version, slug, manifest };
  }

  private readManifest(sourceDir: string, type: ExtensionScope): Record<string, any> {
    const candidates = type === ExtensionScope.PLUGIN
      ? ['manifest.json', 'plugin.json']
      : type === ExtensionScope.APPEARANCE
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
      name: packageJson.name || 'Fromcode Atlantis',
      version: packageJson.version,
      description: packageJson.description || 'Fromcode Atlantis core release',
      changelog: '',
    };
  }
}
