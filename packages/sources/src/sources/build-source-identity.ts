import { ExtensionScope } from '@fromcode119/core';
import { BuildSlugPolicy } from '@sources/sources/build-slug-policy';

/**
 * WHICH source. A kind and a slug, together, because either alone names more than one thing.
 *
 * A slug is an extension's name WITHIN its kind: `tagiqx` the plugin, `tagiqx` the theme and
 * `tagiqx` the appearance are three different extensions that clone into three different
 * directories, stage into three different roots and install through three different validators.
 * Sources stored them in one table keyed on the slug alone, so the second one could not be added
 * at all — and if it ever had been, `update(table, { slug }, …)` would have written BOTH rows, and
 * a theme's build status would have landed on the plugin.
 *
 * The database now carries the same key (a unique index on `(type, slug)`), so the two cannot drift.
 *
 * `parse` refuses rather than defaults. `ExtensionScope.resolve` answers PLUGIN for anything it does
 * not recognise, which is right for a label and catastrophic here: it decides which root gets
 * written, and a mistyped kind would quietly address — and overwrite — a different extension.
 */
export class BuildSourceIdentity {
  private constructor(
    readonly type: ExtensionScope,
    readonly slug: string,
  ) {}

  /**
   * Builds an identity from untrusted input, throwing when either half does not name something.
   *
   * The slug goes through {@link BuildSlugPolicy} for the reason it always has: it becomes a
   * directory name, and `../` in it is a path traversal.
   */
  static parse(type: unknown, slug: unknown): BuildSourceIdentity {
    const scope = ExtensionScope.find(type);
    if (!scope) {
      throw new Error(`"${String(type ?? '')}" is not an extension kind this build knows.`);
    }

    return new BuildSourceIdentity(scope, BuildSlugPolicy.assertAllowed(slug as string | undefined));
  }

  /** The filter every read and write uses, so the pair is never half-applied. */
  get where(): { slug: string; type: string } {
    return { slug: this.slug, type: String(this.type.value) };
  }

  /** A single string for the places that need one key — a Map, a React list, a comparison. */
  get key(): string {
    return `${String(this.type.value)}/${this.slug}`;
  }

  toString(): string {
    return this.key;
  }
}
