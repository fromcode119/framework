import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { FrameworkReleaseDefaults } from '@core/management/framework-release-defaults';

/**
 * Where the framework's own releases come from when no marketplace is configured.
 *
 * A deployment with no marketplace could not answer "is there a newer version" at all — the Updates
 * screen said "Latest Registry Version: Unknown" and called it a failed check, which is indistinguishable
 * from being up to date. The framework publishes its releases as tags on its own repository, so that
 * is the source of last resort: it is the same place the images are built from.
 *
 * The repository is a SETTING, resolved through the platform settings service like every other
 * configurable value, so an operator running their own fork points this at theirs and can see what
 * it is pointed at. `FRAMEWORK_REPOSITORY` in the environment does the same for a deployment that
 * configures itself that way.
 */
export class FrameworkReleaseSource {
  /** GitHub's releases API; `latest` excludes drafts and pre-releases by definition. */
  private static readonly RELEASE_API = 'https://api.github.com/repos';

  private static readonly TIMEOUT_MS = 8000;

  static async repository(): Promise<string> {
    return PlatformSettingsService.resolve(
      process.env.FRAMEWORK_REPOSITORY,
      PlatformSettingsService.KEY.FRAMEWORK_REPOSITORY,
      FrameworkReleaseDefaults.REPOSITORY,
    );
  }

  /**
   * The newest published release, or `''` when the source cannot answer.
   *
   * An unreachable registry and a registry reporting no releases are DIFFERENT answers, and the
   * caller needs to tell them apart — an empty string here means "could not read", never "nothing
   * newer exists".
   */
  static async latestVersion(): Promise<string> {
    const repository = await FrameworkReleaseSource.repository();
    if (!repository) return '';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FrameworkReleaseSource.TIMEOUT_MS);
    try {
      const response = await fetch(`${FrameworkReleaseSource.RELEASE_API}/${repository}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal,
      });
      if (!response.ok) return '';
      const release = await response.json() as Record<string, unknown>;
      return FrameworkReleaseSource.normalize(String(release?.tag_name || ''));
    } catch {
      return '';
    } finally {
      clearTimeout(timer);
    }
  }

  /** `v0.2.13` and `0.2.13` are the same release; comparisons need the bare form. */
  static normalize(tag: string): string {
    return tag.trim().replace(/^v/, '');
  }
}
