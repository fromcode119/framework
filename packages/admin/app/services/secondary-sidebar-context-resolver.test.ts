import { describe, expect, it } from 'vitest';
import type { MenuItem, SecondaryPanelState } from '@fromcode119/react';
import { SecondarySidebarContextResolver } from './secondary-sidebar-context-resolver';

describe('SecondarySidebarContextResolver', () => {
  const resolver = new SecondarySidebarContextResolver();

  const menuItems: MenuItem[] = [
    { label: 'Dashboard', path: '/admin', pluginSlug: 'system' },
    { label: 'Analytics', path: '/admin/plugins/analytics', pluginSlug: 'analytics' },
  ];

  const secondaryPanel: SecondaryPanelState = {
    version: 1,
    contexts: {
      'org.fromcode:analytics': {
        id: 'org.fromcode:analytics',
        label: 'Analytics',
        targetNamespace: 'org.fromcode',
        targetPlugin: 'analytics',
        targetCanonicalKey: 'org.fromcode:analytics',
      },
    },
    itemsByContext: {
      'org.fromcode:analytics': [
        {
          canonicalId: 'org.fromcode:analytics:self:org.fromcode:analytics:overview',
          id: 'overview',
          label: 'Overview',
          path: '/admin/plugins/analytics/overview',
          sourcePaths: ['/admin/plugins/analytics'],
          scope: 'self',
          sourceNamespace: 'org.fromcode',
          sourcePlugin: 'analytics',
          sourceCanonicalKey: 'org.fromcode:analytics',
          targetNamespace: 'org.fromcode',
          targetPlugin: 'analytics',
          targetCanonicalKey: 'org.fromcode:analytics',
          priority: 10,
          requiredRoles: ['admin'],
          requiredCapabilities: [],
        },
      ],
    },
    globalItems: [
      {
        canonicalId: 'org.fromcode:system:global:none:none:help',
        id: 'help',
        label: 'Help',
        path: '/admin/help',
        sourcePaths: ['/admin/plugins/analytics'],
        scope: 'global',
        sourceNamespace: 'org.fromcode',
        sourcePlugin: 'system',
        sourceCanonicalKey: 'org.fromcode:system',
        targetNamespace: 'none',
        targetPlugin: 'none',
        targetCanonicalKey: 'none:none',
        priority: 100,
        requiredRoles: [],
        requiredCapabilities: ['support.read'],
      },
    ],
    policy: {
      allowlistKey: 'admin.secondaryPanel.allowlist.v1',
      allowlistEntries: 1,
      evaluatedAt: '2026-04-02T00:00:00.000Z',
    },
    precedence: {
      scopeOrder: ['self', 'plugin-target', 'global'],
      tieBreakOrder: ['priority-asc', 'canonicalId-asc'],
    },
  };

  it('resolves active context from primary plugin context id', () => {
    const result = resolver.resolve({
      pathname: '/admin/plugins/analytics',
      primaryContextId: 'analytics',
      menuItems,
      secondaryPanel,
      plugins: [{ slug: 'analytics', namespace: 'org.fromcode' }],
      userRoles: ['admin'],
      userCapabilities: ['support.read'],
    });

    expect(result.activeContextId).toBe('org.fromcode:analytics');
    expect(result.activeSourcePath).toBe('/admin/plugins/analytics');
    expect(result.items.map((entry) => entry.id)).toEqual(['overview', 'help']);
  });

  it('filters out items user cannot access by role/capability', () => {
    const result = resolver.resolve({
      pathname: '/admin/plugins/analytics',
      primaryContextId: 'analytics',
      menuItems,
      secondaryPanel,
      plugins: [{ slug: 'analytics', namespace: 'org.fromcode' }],
      userRoles: ['editor'],
      userCapabilities: [],
    });

    expect(result.items).toHaveLength(0);
  });

  it('resolves context from route segment when menu plugin slug is missing', () => {
    const result = resolver.resolve({
      pathname: '/cms/templates',
      primaryContextId: '',
      menuItems: [{ label: 'CMS', path: '/cms', pluginSlug: '' }],
      secondaryPanel: {
        ...secondaryPanel,
        contexts: {
          'org.fromcode:cms': {
            id: 'org.fromcode:cms',
            label: 'CMS',
            targetNamespace: 'org.fromcode',
            targetPlugin: 'cms',
            targetCanonicalKey: 'org.fromcode:cms',
          },
        },
        itemsByContext: {
          'org.fromcode:cms': [
            {
              canonicalId: 'org.fromcode:cms:self:org.fromcode:cms:templates',
              id: 'templates',
              label: 'Templates',
              path: '/cms/templates',
              sourcePaths: ['/cms'],
              scope: 'self',
              sourceNamespace: 'org.fromcode',
              sourcePlugin: 'cms',
              sourceCanonicalKey: 'org.fromcode:cms',
              targetNamespace: 'org.fromcode',
              targetPlugin: 'cms',
              targetCanonicalKey: 'org.fromcode:cms',
              priority: 10,
              requiredRoles: [],
              requiredCapabilities: [],
            },
          ],
        },
        globalItems: [],
      },
      plugins: [{ slug: 'cms', namespace: 'org.fromcode' }],
      userRoles: ['admin'],
      userCapabilities: [],
    });

    expect(result.activeContextId).toBe('org.fromcode:cms');
    expect(result.items.map((entry) => entry.id)).toEqual(['templates']);
  });

  it('uses the owning source path for direct secondary routes', () => {
    const result = resolver.resolve({
      pathname: '/cms/tags',
      primaryContextId: 'cms',
      menuItems: [
        { label: 'Overview', path: '/cms', pluginSlug: 'cms' },
        { label: 'Posts', path: '/cms/posts', pluginSlug: 'cms' },
        { label: 'Pages', path: '/cms/pages', pluginSlug: 'cms' },
      ],
      secondaryPanel: {
        ...secondaryPanel,
        contexts: {
          'org.fromcode:cms': {
            id: 'org.fromcode:cms',
            label: 'CMS',
            targetNamespace: 'org.fromcode',
            targetPlugin: 'cms',
            targetCanonicalKey: 'org.fromcode:cms',
          },
        },
        itemsByContext: {
          'org.fromcode:cms': [
            {
              canonicalId: 'org.fromcode:cms:self:org.fromcode:cms:navigation',
              id: 'navigation',
              label: 'Navigation',
              path: '/cms/navigation',
              sourcePaths: ['/cms'],
              scope: 'self',
              sourceNamespace: 'org.fromcode',
              sourcePlugin: 'cms',
              sourceCanonicalKey: 'org.fromcode:cms',
              targetNamespace: 'org.fromcode',
              targetPlugin: 'cms',
              targetCanonicalKey: 'org.fromcode:cms',
              priority: 10,
              requiredRoles: [],
              requiredCapabilities: [],
            },
            {
              canonicalId: 'org.fromcode:cms:self:org.fromcode:cms:categories',
              id: 'categories',
              label: 'Categories',
              path: '/cms/categories',
              sourcePaths: ['/cms/posts'],
              scope: 'self',
              sourceNamespace: 'org.fromcode',
              sourcePlugin: 'cms',
              sourceCanonicalKey: 'org.fromcode:cms',
              targetNamespace: 'org.fromcode',
              targetPlugin: 'cms',
              targetCanonicalKey: 'org.fromcode:cms',
              priority: 20,
              requiredRoles: [],
              requiredCapabilities: [],
            },
            {
              canonicalId: 'org.fromcode:cms:self:org.fromcode:cms:tags',
              id: 'tags',
              label: 'Tags',
              path: '/cms/tags',
              sourcePaths: ['/cms/posts'],
              scope: 'self',
              sourceNamespace: 'org.fromcode',
              sourcePlugin: 'cms',
              sourceCanonicalKey: 'org.fromcode:cms',
              targetNamespace: 'org.fromcode',
              targetPlugin: 'cms',
              targetCanonicalKey: 'org.fromcode:cms',
              priority: 30,
              requiredRoles: [],
              requiredCapabilities: [],
            },
          ],
        },
        globalItems: [],
      },
      plugins: [{ slug: 'cms', namespace: 'org.fromcode' }],
      userRoles: ['admin'],
      userCapabilities: [],
    });

    expect(result.activeContextId).toBe('org.fromcode:cms');
    expect(result.activeSourcePath).toBe('/cms/posts');
    expect(result.items.map((entry) => entry.id)).toEqual(['categories', 'tags']);
  });

  it('prefers the owning top-level source path over a direct child route match', () => {
    const result = resolver.resolve({
      pathname: '/mlm/networks',
      primaryContextId: 'mlm',
      menuItems: [
        {
          label: 'MLM',
          path: '/mlm',
          pluginSlug: 'mlm',
          children: [{ label: 'Networks', path: '/mlm/networks', pluginSlug: 'mlm' }],
        },
      ],
      secondaryPanel: {
        ...secondaryPanel,
        contexts: {
          'org.fromcode:mlm': {
            id: 'org.fromcode:mlm',
            label: 'MLM',
            targetNamespace: 'org.fromcode',
            targetPlugin: 'mlm',
            targetCanonicalKey: 'org.fromcode:mlm',
          },
        },
        itemsByContext: {
          'org.fromcode:mlm': [
            {
              canonicalId: 'org.fromcode:mlm:self:org.fromcode:mlm:networks',
              id: 'networks',
              label: 'Networks',
              path: '/mlm/networks',
              sourcePaths: ['/mlm'],
              scope: 'self',
              sourceNamespace: 'org.fromcode',
              sourcePlugin: 'mlm',
              sourceCanonicalKey: 'org.fromcode:mlm',
              targetNamespace: 'org.fromcode',
              targetPlugin: 'mlm',
              targetCanonicalKey: 'org.fromcode:mlm',
              priority: 10,
              requiredRoles: [],
              requiredCapabilities: [],
            },
          ],
        },
        globalItems: [],
      },
      plugins: [{ slug: 'mlm', namespace: 'org.fromcode' }],
      userRoles: ['admin'],
      userCapabilities: [],
    });

    expect(result.activeContextId).toBe('org.fromcode:mlm');
    expect(result.activeSourcePath).toBe('/mlm');
    expect(result.items.map((entry) => entry.id)).toEqual(['networks']);
  });

  it('resolves org.fromcode:system users items from the shared system context', () => {
    const result = resolver.resolve({
      pathname: '/users/roles',
      primaryContextId: 'system',
      menuItems: [
        { label: 'Users', path: '/users', pluginSlug: 'system' },
        { label: 'Settings', path: '/settings', pluginSlug: 'system' },
      ],
      secondaryPanel: {
        ...secondaryPanel,
        contexts: {
          'org.fromcode:system': {
            id: 'org.fromcode:system',
            label: 'System',
            targetNamespace: 'org.fromcode',
            targetPlugin: 'system',
            targetCanonicalKey: 'org.fromcode:system',
          },
        },
        itemsByContext: {
          'org.fromcode:system': [
            {
              canonicalId: 'org.fromcode:system:self:org.fromcode:system:users-list',
              id: 'users-list',
              label: 'Users List',
              path: '/users',
              sourcePaths: ['/users'],
              scope: 'self',
              sourceNamespace: 'org.fromcode',
              sourcePlugin: 'system',
              sourceCanonicalKey: 'org.fromcode:system',
              targetNamespace: 'org.fromcode',
              targetPlugin: 'system',
              targetCanonicalKey: 'org.fromcode:system',
              priority: 10,
              requiredRoles: ['admin'],
              requiredCapabilities: [],
            },
            {
              canonicalId: 'org.fromcode:system:self:org.fromcode:system:roles',
              id: 'roles',
              label: 'Roles',
              path: '/users/roles',
              sourcePaths: ['/users'],
              scope: 'self',
              sourceNamespace: 'org.fromcode',
              sourcePlugin: 'system',
              sourceCanonicalKey: 'org.fromcode:system',
              targetNamespace: 'org.fromcode',
              targetPlugin: 'system',
              targetCanonicalKey: 'org.fromcode:system',
              priority: 20,
              requiredRoles: ['admin'],
              requiredCapabilities: [],
            },
            {
              canonicalId: 'org.fromcode:system:self:org.fromcode:system:permissions',
              id: 'permissions',
              label: 'Permissions',
              path: '/users/permissions',
              sourcePaths: ['/users'],
              scope: 'self',
              sourceNamespace: 'org.fromcode',
              sourcePlugin: 'system',
              sourceCanonicalKey: 'org.fromcode:system',
              targetNamespace: 'org.fromcode',
              targetPlugin: 'system',
              targetCanonicalKey: 'org.fromcode:system',
              priority: 30,
              requiredRoles: ['admin'],
              requiredCapabilities: [],
            },
            {
              canonicalId: 'org.fromcode:system:self:org.fromcode:system:general',
              id: 'general',
              label: 'General',
              path: '/settings/general',
              sourcePaths: ['/settings'],
              scope: 'self',
              sourceNamespace: 'org.fromcode',
              sourcePlugin: 'system',
              sourceCanonicalKey: 'org.fromcode:system',
              targetNamespace: 'org.fromcode',
              targetPlugin: 'system',
              targetCanonicalKey: 'org.fromcode:system',
              priority: 100,
              requiredRoles: ['admin'],
              requiredCapabilities: [],
            },
          ],
        },
        globalItems: [],
      },
      plugins: [],
      userRoles: ['admin'],
      userCapabilities: [],
    });

    expect(result.activeContextId).toBe('org.fromcode:system');
    expect(result.activeSourcePath).toBe('/users');
    expect(result.items.map((entry) => entry.id)).toEqual(['users-list', 'roles', 'permissions']);
  });

  it('filters system items through secondary authorization rules', () => {
    const input = {
      pathname: '/settings/security',
      primaryContextId: 'system',
      menuItems: [{ label: 'Settings', path: '/settings', pluginSlug: 'system' }],
      secondaryPanel: {
        ...secondaryPanel,
        contexts: {
          'org.fromcode:system': {
            id: 'org.fromcode:system',
            label: 'System',
            targetNamespace: 'org.fromcode',
            targetPlugin: 'system',
            targetCanonicalKey: 'org.fromcode:system',
          },
        },
        itemsByContext: {
          'org.fromcode:system': [
            {
              canonicalId: 'org.fromcode:system:self:org.fromcode:system:general',
              id: 'general',
              label: 'General',
              path: '/settings/general',
              sourcePaths: ['/settings'],
              scope: 'self',
              sourceNamespace: 'org.fromcode',
              sourcePlugin: 'system',
              sourceCanonicalKey: 'org.fromcode:system',
              targetNamespace: 'org.fromcode',
              targetPlugin: 'system',
              targetCanonicalKey: 'org.fromcode:system',
              priority: 100,
              requiredRoles: ['admin'],
              requiredCapabilities: [],
            },
            {
              canonicalId: 'org.fromcode:system:self:org.fromcode:system:security',
              id: 'security',
              label: 'Security',
              path: '/settings/security',
              sourcePaths: ['/settings'],
              scope: 'self',
              sourceNamespace: 'org.fromcode',
              sourcePlugin: 'system',
              sourceCanonicalKey: 'org.fromcode:system',
              targetNamespace: 'org.fromcode',
              targetPlugin: 'system',
              targetCanonicalKey: 'org.fromcode:system',
              priority: 110,
              requiredRoles: ['admin'],
              requiredCapabilities: [],
            },
          ],
        },
        globalItems: [],
      },
      plugins: [],
      userCapabilities: [],
    };

    expect(resolver.resolve({ ...input, userRoles: ['admin'] }).items.map((entry) => entry.id)).toEqual(['general', 'security']);
    expect(resolver.resolve({ ...input, userRoles: ['editor'] }).items).toHaveLength(0);
  });

  it('keeps plugin secondary-sidebar contexts unchanged when system context exists', () => {
    const result = resolver.resolve({
      pathname: '/admin/plugins/analytics',
      primaryContextId: 'analytics',
      menuItems,
      secondaryPanel: {
        ...secondaryPanel,
        contexts: {
          ...secondaryPanel.contexts,
          'org.fromcode:system': {
            id: 'org.fromcode:system',
            label: 'System',
            targetNamespace: 'org.fromcode',
            targetPlugin: 'system',
            targetCanonicalKey: 'org.fromcode:system',
          },
        },
        itemsByContext: {
          ...secondaryPanel.itemsByContext,
          'org.fromcode:system': [
            {
              canonicalId: 'org.fromcode:system:self:org.fromcode:system:general',
              id: 'general',
              label: 'General',
              path: '/settings/general',
              sourcePaths: ['/settings'],
              scope: 'self',
              sourceNamespace: 'org.fromcode',
              sourcePlugin: 'system',
              sourceCanonicalKey: 'org.fromcode:system',
              targetNamespace: 'org.fromcode',
              targetPlugin: 'system',
              targetCanonicalKey: 'org.fromcode:system',
              priority: 100,
              requiredRoles: ['admin'],
              requiredCapabilities: [],
            },
          ],
        },
      },
      plugins: [{ slug: 'analytics', namespace: 'org.fromcode' }],
      userRoles: ['admin'],
      userCapabilities: ['support.read'],
    });

    expect(result.activeContextId).toBe('org.fromcode:analytics');
    expect(result.items.map((entry) => entry.id)).toEqual(['overview', 'help']);
  });
});
