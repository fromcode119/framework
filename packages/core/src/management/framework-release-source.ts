import semver from 'semver';
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
  /**
   * TAGS, not releases.
   *
   * The release pipeline tags each version and publishes images; it does not create GitHub Release
   * objects, so `/releases/latest` answers 404 and a check built on it reports "unknown" forever —
   * which is the exact failure this class exists to remove. Tags are what this project actually
   * publishes, so tags are what it reads.
   */
  private static readonly TAGS_API = 'https://api.github.com/repos';

  /** One page is a decade of releases at this cadence, and ordering is by semver, not by position. */
  private static readonly PAGE_SIZE = 100;

  private static readonly TIMEOUT_MS = 8000;

  /** Each pending release costs one more request for its notes; a long-neglected install is capped. */
  private static readonly MAX_PENDING = 10;

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

    const tags = await FrameworkReleaseSource.fetchTags(repository);
    return FrameworkReleaseSource.highest(tags.map((tag) => String(tag?.name || '')));
  }

  /**
   * The highest version among the tags, by SEMVER rather than by the order GitHub returned them.
   *
   * GitHub lists tags newest-commit-first, which is not the same as highest-version: a patch tagged
   * on an older branch would otherwise be offered as an upgrade over a newer minor. Pre-releases are
   * excluded — an installation is not offered a release candidate as its update.
   */
  static highest(tags: string[]): string {
    const versions = tags
      .map((tag) => FrameworkReleaseSource.normalize(tag))
      .filter((version) => Boolean(semver.valid(version)) && semver.prerelease(version) === null);
    return versions.sort(semver.rcompare)[0] || '';
  }

  /**
   * Every version newer than the installed one, newest first, each with what changed in it.
   *
   * "Update to v0.2.16" tells an operator nothing about what they are agreeing to, and one release
   * behind is not the same decision as five. The notes are the RELEASE COMMIT's own message — the
   * text written when the version was cut — never a generated summary and never a stand-in: a
   * release whose commit says nothing shows nothing.
   */
  static async pending(currentVersion: string): Promise<Array<{ version: string; notes: string }>> {
    const repository = await FrameworkReleaseSource.repository();
    if (!repository || !semver.valid(currentVersion)) return [];

    const tags = await FrameworkReleaseSource.fetchTags(repository);
    const newer = tags
      .filter((tag) => {
        const version = FrameworkReleaseSource.normalize(String(tag?.name || ''));
        return Boolean(semver.valid(version))
          && semver.prerelease(version) === null
          && semver.gt(version, currentVersion);
      })
      .slice(0, FrameworkReleaseSource.MAX_PENDING);

    const described = await Promise.all(newer.map(async (tag) => ({
      version: FrameworkReleaseSource.normalize(String(tag?.name || '')),
      notes: await FrameworkReleaseSource.notesFor(repository, String((tag?.commit as any)?.sha || '')),
    })));

    return described.sort((a, b) => semver.rcompare(a.version, b.version));
  }

  /**
   * The release commit's message, minus its subject line.
   *
   * The subject is `chore: 0.2.16` — the version, which the reader already has. The body is what was
   * written about the release, and it is returned verbatim.
   */
  private static async notesFor(repository: string, sha: string): Promise<string> {
    if (!sha) return '';
    const commit = await FrameworkReleaseSource.readJson(`${FrameworkReleaseSource.TAGS_API}/${repository}/commits/${sha}`);
    const message = String((commit as any)?.commit?.message || '');
    return message.split('\n').slice(1).join('\n').trim();
  }

  private static async fetchTags(repository: string): Promise<Array<Record<string, unknown>>> {
    const url = `${FrameworkReleaseSource.TAGS_API}/${repository}/tags?per_page=${FrameworkReleaseSource.PAGE_SIZE}`;
    const tags = await FrameworkReleaseSource.readJson(url);
    return Array.isArray(tags) ? tags : [];
  }

  /** One place that talks to the API, so the timeout and the "unreachable means empty" rule are one rule. */
  private static async readJson(url: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FrameworkReleaseSource.TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal,
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** `v0.2.13` and `0.2.13` are the same release; comparisons need the bare form. */
  static normalize(tag: string): string {
    return tag.trim().replace(/^v/, '');
  }
}
