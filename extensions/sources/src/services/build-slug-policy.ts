/**
 * Validates the source slug.
 *
 * The slug is not a label: it becomes a path segment in the clone directory
 * (`<sourceDir>/<type>/<slug>`), so `../` or an absolute path escapes the build workspace. Only the
 * package-slug shape is accepted — lowercase alphanumerics and single internal hyphens.
 */
export class BuildSlugPolicy {
  static readonly PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  static readonly REQUIREMENT = 'A slug may contain lowercase letters, digits and single hyphens only.';

  static assertAllowed(slug: unknown): string {
    const normalized = String(slug ?? '').trim();

    if (!normalized) {
      throw new Error('Slug is required.');
    }
    if (!BuildSlugPolicy.PATTERN.test(normalized)) {
      throw new Error(`Slug rejected: "${normalized}" is not a valid package slug. ${BuildSlugPolicy.REQUIREMENT}`);
    }

    return normalized;
  }

  static isAllowed(slug: unknown): boolean {
    try {
      BuildSlugPolicy.assertAllowed(slug);
      return true;
    } catch {
      return false;
    }
  }
}
