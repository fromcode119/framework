import { afterEach, describe, expect, it } from 'vitest';
import path from 'path';
import { ProjectPaths } from '@core/config/paths';
import { RequestContextUtils } from '@core/context/request-context';

describe('ProjectPaths.getUploadsDir tenant scoping', () => {
  afterEach(() => { delete process.env.STORAGE_UPLOAD_DIR; });

  it('single-tenant: returns the base directory unchanged', () => {
    // Every existing installation is in this state — its paths must not move.
    expect(ProjectPaths.getUploadsDir()).not.toContain(`${path.sep}tenants${path.sep}`);
  });

  it('gives each tenant its own subdirectory under the uploads root', () => {
    const a = RequestContextUtils.storage.run({ locale: 'en', tenantId: 't1' }, () => ProjectPaths.getUploadsDir());
    const b = RequestContextUtils.storage.run({ locale: 'en', tenantId: 't2' }, () => ProjectPaths.getUploadsDir());
    expect(a).not.toBe(b);
    expect(a.endsWith(path.join('tenants', 't1'))).toBe(true);
    expect(b.endsWith(path.join('tenants', 't2'))).toBe(true);
  });

  it('keeps the tenant directory INSIDE the uploads root', () => {
    const base = ProjectPaths.getUploadsDir();
    const scoped = RequestContextUtils.storage.run({ locale: 'en', tenantId: 't1' }, () => ProjectPaths.getUploadsDir());
    expect(scoped.startsWith(base)).toBe(true);
  });

  it('refuses a tenant id that is not a plain segment, rather than joining it into a path', () => {
    // A tenant id is framework-controlled, but joining an unvalidated identifier into a filesystem
    // path is how traversal bugs happen. Falls back to the base directory instead.
    const base = ProjectPaths.getUploadsDir();
    for (const bad of ['../escape', 'a/b', '..']) {
      const resolved = RequestContextUtils.storage.run(
        { locale: 'en', tenantId: bad }, () => ProjectPaths.getUploadsDir(),
      );
      expect(resolved).toBe(base);
    }
  });
});
