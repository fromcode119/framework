import path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { ProjectPaths } from '@core/config/paths';
import { SystemConstants } from '@core/constants/system.constants';

/**
 * The invariant this file exists for: a private file must not be reachable from a static mount. The
 * uploads dir is handed to `express.static` before cookies, CSRF, auth and the rate limiter, so anything
 * under it is anonymous by construction and no route guard can change that.
 */
describe('ProjectPaths private uploads', () => {
  const originalPrivate = process.env[SystemConstants.STORAGE.PRIVATE_DIR_ENV];
  const originalUploads = process.env[SystemConstants.STORAGE.UPLOAD_DIR_ENV];

  afterEach(() => {
    if (originalPrivate === undefined) delete process.env[SystemConstants.STORAGE.PRIVATE_DIR_ENV];
    else process.env[SystemConstants.STORAGE.PRIVATE_DIR_ENV] = originalPrivate;
    if (originalUploads === undefined) delete process.env[SystemConstants.STORAGE.UPLOAD_DIR_ENV];
    else process.env[SystemConstants.STORAGE.UPLOAD_DIR_ENV] = originalUploads;
  });

  it('defaults outside the statically served uploads tree', () => {
    delete process.env[SystemConstants.STORAGE.PRIVATE_DIR_ENV];
    delete process.env[SystemConstants.STORAGE.UPLOAD_DIR_ENV];
    expect(ProjectPaths.isServedStatically(ProjectPaths.getPrivateUploadsDir(), ProjectPaths.getUploadsDir())).toBe(false);
  });

  it('resolves a relative override against the project root, not cwd', () => {
    process.env[SystemConstants.STORAGE.PRIVATE_DIR_ENV] = './var/secret-files';
    expect(ProjectPaths.getPrivateUploadsDir()).toBe(path.resolve(ProjectPaths.getProjectRoot(), 'var/secret-files'));
  });

  it('detects a private dir misconfigured INTO the served tree', () => {
    const uploads = ProjectPaths.getUploadsDir();
    expect(ProjectPaths.isServedStatically(path.join(uploads, 'private'), uploads)).toBe(true);
    expect(ProjectPaths.isServedStatically(uploads, uploads)).toBe(true);
  });

  it('does not mistake a sibling with a shared prefix for a child', () => {
    expect(ProjectPaths.isServedStatically('/srv/uploads-private', '/srv/uploads')).toBe(false);
  });
});
