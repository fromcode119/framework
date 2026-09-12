import fs from 'fs';
import path from 'path';

/**
 * What an extension says it IS, read from the manifest in its own repository.
 *
 * The form used to ask the operator to type a slug. That is the extension's identity — it names the
 * built package, the directory it is cloned into, the tables it owns — and it is already declared in
 * the repository. Typing it again is a second source of truth that can only ever disagree, and the
 * disagreement surfaces at the first build.
 *
 * Nothing here guesses. A repository with no manifest returns nothing, and the caller says so.
 */
export class ExtensionManifestReader {
  /**
   * Each kind declares itself in its own file; the first one found decides the type.
   *
   * ORDER IS THE RULE: the specific names first, the generic `manifest.json` last. A theme or an
   * appearance may ship a `manifest.json` as well as its own file, and with the generic name checked
   * first every one of them was read as a plugin — which is how an appearance came to be listed,
   * built and installed as a plugin while `appearance.json` sat unread beside it.
   *
   * `appearance.json` was missing outright. Appearances have been buildable the whole time
   * (`BuildSourceType.APPEARANCE`, `PackageBuilder.buildAppearancePackage`); nothing could ever say
   * that a repository was one.
   */
  private static readonly MANIFESTS: Array<{ file: string; type: 'plugin' | 'theme' | 'appearance' }> = [
    { file: 'theme.json', type: 'theme' },
    { file: 'appearance.json', type: 'appearance' },
    { file: 'manifest.json', type: 'plugin' },
  ];

  static read(directory: string): { slug: string; type: 'plugin' | 'theme' | 'appearance' | 'core'; name: string; version: string } | null {
    for (const candidate of ExtensionManifestReader.MANIFESTS) {
      const declared = ExtensionManifestReader.readFile(path.join(directory, candidate.file));
      if (!declared) continue;

      const slug = String(declared.slug || '').trim();
      if (!slug) continue;

      return {
        slug,
        type: candidate.type,
        name: String(declared.name || '').trim(),
        version: String(declared.version || '').trim(),
      };
    }

    return ExtensionManifestReader.readCore(directory);
  }

  /**
   * The framework itself has no manifest.json — it is a workspace whose package.json names it. Read
   * separately so a repository that is neither still returns nothing rather than a package name
   * dressed up as a slug.
   */
  private static readCore(directory: string): { slug: string; type: 'core'; name: string; version: string } | null {
    const pkg = ExtensionManifestReader.readFile(path.join(directory, 'package.json'));
    const name = String(pkg?.name || '').trim();
    if (!name || !String(pkg?.workspaces || '')) return null;

    return {
      slug: name.replace(/^@[^/]+\//, ''),
      type: 'core',
      name,
      version: String(pkg?.version || '').trim(),
    };
  }

  private static readFile(file: string): Record<string, any> | null {
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      // A manifest that is not valid JSON is not a manifest. The caller reports "could not read".
      return null;
    }
  }
}
