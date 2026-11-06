/**
 * A marketplace install that would replace an installed theme with an OLDER version. The catalogue may
 * still list an earlier build of a theme that has moved on; installing it would roll a live site back.
 */
export class ThemeDowngradeRefusedError extends Error {
  constructor(readonly slug: string, readonly installedVersion: string, readonly offeredVersion: string) {
    super(`Theme "${slug}" ${installedVersion} is installed; the marketplace offers ${offeredVersion}, which is older. Nothing was installed.`);
    this.name = 'ThemeDowngradeRefusedError';
  }
}
