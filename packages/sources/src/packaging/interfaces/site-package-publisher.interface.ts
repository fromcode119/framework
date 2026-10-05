import type { IPackagePublishedEvent } from '@sources/packaging/interfaces/package-published-event.interface';

/**
 * How Sources hands a built package to a site. Implemented by the platform, which owns the sites,
 * their media and their hook delivery; Sources only decides WHEN and WHAT.
 */
export interface ISitePackagePublisher {
  /** Whether `siteId` names an active site of this platform. */
  isSite(siteId: string): Promise<boolean>;
  /**
   * Stores the archive in that site's media library and announces PACKAGE_PUBLISHED inside the
   * site's scope. Returns the media id.
   */
  publish(siteId: string, archive: { filePath: string; fileName: string }, event: Omit<IPackagePublishedEvent, 'mediaId'>): Promise<string>;
}
