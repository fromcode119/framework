import { afterEach, describe, expect, it } from 'vitest';
import * as path from 'path';
import { ProjectPaths } from '@core/config/paths';
import { RequestContextUtils } from '@core/context/request-context';

/**
 * WHERE a site's uploads are written.
 *
 * The public uploads directory was one flat folder for every site, because the storage driver's root
 * was resolved ONCE at boot — where there is no request and therefore no site — and then captured for
 * the life of the process. Every site wrote into the shared parent.
 *
 * The per-site part already existed and was already validated; nothing used it for storage. These pin
 * the two directories apart, because confusing them is one-way dangerous: the ROOT where the site's
 * was meant puts one customer's file where every other customer reads, while the reverse only fails
 * to find something.
 */
const inSite = <T>(tenantId: string, fn: () => T): T =>
  RequestContextUtils.storage.run({ tenantId } as any, fn);

afterEach(() => { delete process.env.STORAGE_UPLOAD_DIR; });

describe('uploads directory scoping', () => {
  it('gives a bound site its OWN subdirectory', () => {
    const root = ProjectPaths.getUploadsRoot();

    expect(inSite('my-site', () => ProjectPaths.getUploadsDir()))
      .toBe(path.join(root, 'tenants', 'my-site'));
  });

  it('keeps two sites apart', () => {
    const a = inSite('site-a', () => ProjectPaths.getUploadsDir());
    const b = inSite('site-b', () => ProjectPaths.getUploadsDir());

    expect(a).not.toBe(b);
    expect(a.startsWith(ProjectPaths.getUploadsRoot())).toBe(true);
  });

  it('answers the shared parent when no site is bound', () => {
    // A boot, a timer, a background job: there is no site whose directory it could be.
    expect(ProjectPaths.getUploadsDir()).toBe(ProjectPaths.getUploadsRoot());
  });

  it('refuses to build a path from an id that is not a plain segment', () => {
    // A tenant id is framework-controlled, but joining an unvalidated identifier into a filesystem
    // path is how traversal happens, so the check lives where the join does.
    expect(inSite('../../etc', () => ProjectPaths.getUploadsDir())).toBe(ProjectPaths.getUploadsRoot());
    expect(inSite('a/b', () => ProjectPaths.getUploadsDir())).toBe(ProjectPaths.getUploadsRoot());
  });

  it('applies the same rule to an operator-configured root', () => {
    // The driver's directory is an admin field, so the per-site rule has to apply to whatever they
    // named — not only to this module's default.
    const configured = '/srv/media';

    expect(inSite('my-site', () => ProjectPaths.withTenantSubdirectory(configured)))
      .toBe(path.join(configured, 'tenants', 'my-site'));
  });

  it('leaves a configured root untouched with no site bound', () => {
    expect(ProjectPaths.withTenantSubdirectory('/srv/media')).toBe('/srv/media');
  });

  it('honours STORAGE_UPLOAD_DIR for the root, and still scopes beneath it', () => {
    process.env.STORAGE_UPLOAD_DIR = '/srv/uploads';

    expect(ProjectPaths.getUploadsRoot()).toBe('/srv/uploads');
    expect(inSite('my-site', () => ProjectPaths.getUploadsDir())).toBe(path.join('/srv/uploads', 'tenants', 'my-site'));
  });
});
