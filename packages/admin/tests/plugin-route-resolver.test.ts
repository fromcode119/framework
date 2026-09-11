import { describe, it, expect } from 'vitest';
import { PluginRouteResolver } from '@/lib/plugin-route-resolver';

describe('PluginRouteResolver.resolveSlug', () => {
  const plugins = [
    { slug: 'build-server', manifest: { admin: { menu: [{ path: '/sources' }] } } },
    { slug: 'forms', manifest: { admin: { menu: [{ path: '/forms' }] } } },
  ];

  /** The screen a person clicks is named for what it does; the slug names tables and slots. */
  it('resolves a path that differs from the slug', () => {
    expect(PluginRouteResolver.resolveSlug(plugins, 'sources')).toBe('build-server');
  });

  it('resolves a path that matches the slug, as every existing plugin does', () => {
    expect(PluginRouteResolver.resolveSlug(plugins, 'forms')).toBe('forms');
  });

  /** An unknown segment stays itself, so the caller reports "not found" for the thing asked for. */
  it('falls back to the segment when nothing declares it', () => {
    expect(PluginRouteResolver.resolveSlug(plugins, 'nothing')).toBe('nothing');
  });

  it('tolerates a plugin with no menu at all', () => {
    expect(PluginRouteResolver.resolveSlug([{ slug: 'bare' }], 'bare')).toBe('bare');
  });
});
