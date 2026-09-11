import { describe, it, expect } from 'vitest';
import { FrameworkReleaseSource } from '@core/management/framework-release-source';

describe('FrameworkReleaseSource.highest', () => {
  /**
   * GitHub lists tags newest-COMMIT-first, which is not highest-VERSION first: a patch tagged on an
   * older branch arrives before a newer minor and would be offered as the upgrade.
   */
  it('picks the highest version, not the first one listed', () => {
    expect(FrameworkReleaseSource.highest(['v0.1.99', 'v0.2.14', 'v0.2.9'])).toBe('0.2.14');
  });

  it('compares numerically rather than as text', () => {
    expect(FrameworkReleaseSource.highest(['v0.2.9', 'v0.2.14'])).toBe('0.2.14');
  });

  /** An installation is not offered a release candidate as its update. */
  it('ignores pre-releases', () => {
    expect(FrameworkReleaseSource.highest(['v0.3.0-rc.1', 'v0.2.14'])).toBe('0.2.14');
  });

  it('ignores tags that are not versions', () => {
    expect(FrameworkReleaseSource.highest(['nightly', 'latest', 'v0.2.14'])).toBe('0.2.14');
  });

  /** Empty means "could not read", and the caller must not treat it as "nothing newer". */
  it('returns an empty string when no tag is a version', () => {
    expect(FrameworkReleaseSource.highest(['nightly', 'main'])).toBe('');
    expect(FrameworkReleaseSource.highest([])).toBe('');
  });
});
