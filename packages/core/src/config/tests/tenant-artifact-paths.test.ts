import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { ProjectPaths } from '@core/config/paths';

/**
 * Where a SITE's own themes and plugins live on disk.
 *
 * Framework-owned resolution, because the comment on the uploads equivalent already records what
 * happens otherwise: "a hand-built relative upload path has already broken every image on this
 * platform once". The tenant id here arrives from a URL or a session, so it is validated rather than
 * trusted — and a rejected id must never produce a path built from the rejected text.
 */

const withRoots = (themes: string, plugins: string) => {
  vi.spyOn(ProjectPaths, 'getThemesDir').mockReturnValue(themes);
  vi.spyOn(ProjectPaths, 'getPluginsDir').mockReturnValue(plugins);
};

describe('per-site artifact paths', () => {
  it('puts a site’s themes and plugins one level down, under a directory named for it', () => {
    withRoots('/srv/themes', '/srv/plugins');

    expect(ProjectPaths.getThemesDirFor('acme')).toBe(path.join('/srv/themes', 'tenants', 'acme'));
    expect(ProjectPaths.getPluginsDirFor('acme')).toBe(path.join('/srv/plugins', 'tenants', 'acme'));
  });

  it('REFUSES a traversing id and falls back to the root, never building a path from it', () => {
    withRoots('/srv/themes', '/srv/plugins');

    for (const hostile of ['../../etc', 'a/../../b', './x', 'acme/../globex', '..']) {
      const resolved = ProjectPaths.getThemesDirFor(hostile);
      expect(resolved).toBe('/srv/themes');
      expect(resolved).not.toContain('..');
    }
  });

  it('treats a blank or whitespace id as no site', () => {
    withRoots('/srv/themes', '/srv/plugins');

    expect(ProjectPaths.getThemesDirFor('')).toBe('/srv/themes');
    expect(ProjectPaths.getThemesDirFor('   ')).toBe('/srv/themes');
    expect(ProjectPaths.getThemesDirFor(undefined as any)).toBe('/srv/themes');
  });

  it('rejects ids carrying separators, control or shell-ish characters', () => {
    withRoots('/srv/themes', '/srv/plugins');

    const hostile = ['acme/evil', 'acme\\evil', 'acme;rm -rf', 'acme .', 'acme$x', `acme${String.fromCharCode(0)}`];
    for (const id of hostile) {
      expect(ProjectPaths.getThemesDirFor(id)).toBe('/srv/themes');
    }
  });

  it('accepts the id shapes real tenants actually use', () => {
    withRoots('/srv/themes', '/srv/plugins');

    for (const id of ['acme', 't1', 'example-site', 'widgets-app', 'a_b-9']) {
      expect(ProjectPaths.getThemesDirFor(id)).toBe(path.join('/srv/themes', 'tenants', id));
    }
  });

  it('names the tenants container once, so scanners do not each carry the literal', () => {
    expect(ProjectPaths.tenantArtifactsRoot('/srv/themes')).toBe(path.join('/srv/themes', 'tenants'));
    expect(ProjectPaths.isTenantArtifactsDir('tenants')).toBe(true);
    expect(ProjectPaths.isTenantArtifactsDir('aurora')).toBe(false);
  });
});
