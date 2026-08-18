import { describe, expect, it } from 'vitest';
import type { IMenuItem, ISecondaryPanelState } from '@fromcode119/react';
import { SecondarySidebarContextResolver } from '@/app/services/secondary-sidebar-context-resolver';

describe('SecondarySidebarContextResolver', () => {
  const resolver = new SecondarySidebarContextResolver();

  const menuItems: IMenuItem[] = [
    { label: 'Dashboard', path: '/admin', pluginSlug: 'system' },
    { label: 'Analytics', path: '/admin/plugins/analytics', pluginSlug: 'analytics' },
  ];

  const secondaryPanel: ISecondaryPanelState = {
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

  it('grants capability-gated items to an admin holding the * permission wildcard', () => {
    // Admins carry `['*']` rather than per-capability entries. Without wildcard handling every
    // `requiredCapabilities` item was denied to them — the filter is fed the session's PERMISSIONS.
    const result = resolver.resolve({
      pathname: '/admin/plugins/analytics',
      primaryContextId: 'analytics',
      menuItems,
      secondaryPanel,
      plugins: [{ slug: 'analytics', namespace: 'org.fromcode' }],
      userRoles: ['admin'],
      userCapabilities: ['*'],
    });

    expect(result.items.map((entry) => entry.id)).toContain('help');
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
      pathname: '/alpha/templates',
      primaryContextId: '',
      menuItems: [{ label: 'Alpha', path: '/alpha', pluginSlug: '' }],
      secondaryPanel: {
        ...secondaryPanel,
        contexts: {
          'org.fromcode:alpha': {
            id: 'org.fromcode:alpha',
            label: 'Alpha',
            targetNamespace: 'org.fromcode',
            targetPlugin: 'alpha',
            targetCanonicalKey: 'org.fromcode:alpha',
          },
        },
        itemsByContext: {
          'org.fromcode:alpha': [
            {
              canonicalId: 'org.fromcode:alpha:self:org.fromcode:alpha:templates',
              id: 'templates',
              label: 'Templates',
              path: '/alpha/templates',
              sourcePaths: ['/alpha'],
              scope: 'self',
              sourceNamespace: 'org.fromcode',
              sourcePlugin: 'alpha',
              sourceCanonicalKey: 'org.fromcode:alpha',
              targetNamespace: 'org.fromcode',
              targetPlugin: 'alpha',
              targetCanonicalKey: 'org.fromcode:alpha',
              priority: 10,
              requiredRoles: [],
              requiredCapabilities: [],
            },
          ],
        },
        globalItems: [],
      },
      plugins: [{ slug: 'alpha', namespace: 'org.fromcode' }],
      userRoles: ['admin'],
      userCapabilities: [],
    });

    expect(result.activeContextId).toBe('org.fromcode:alpha');
    expect(result.items.map((entry) => entry.id)).toEqual(['templates']);
  });

  it('uses the owning source path for direct secondary routes', () => {
    const result = resolver.resolve({
      pathname: '/alpha/tags',
      primaryContextId: 'alpha',
      menuItems: [
        { label: 'Overview', path: '/alpha', pluginSlug: 'alpha' },
        { label: 'Posts', path: '/alpha/posts', pluginSlug: 'alpha' },
        { label: 'Pages', path: '/alpha/pages', pluginSlug: 'alpha' },
      ],
      secondaryPanel: {
        ...secondaryPanel,
        contexts: {
          'org.fromcode:alpha': {
            id: 'org.fromcode:alpha',
            label: 'Alpha',
            targetNamespace: 'org.fromcode',
            targetPlugin: 'alpha',
            targetCanonicalKey: 'org.fromcode:alpha',
          },
        },
        itemsByContext: {
          'org.fromcode:alpha': [
            {
              canonicalId: 'org.fromcode:alpha:self:org.fromcode:alpha:navigation',
              id: 'navigation',
              label: 'Navigation',
              path: '/alpha/navigation',
              sourcePaths: ['/alpha'],
              scope: 'self',
              sourceNamespace: 'org.fromcode',
              sourcePlugin: 'alpha',
              sourceCanonicalKey: 'org.fromcode:alpha',
              targetNamespace: 'org.fromcode',
              targetPlugin: 'alpha',
              targetCanonicalKey: 'org.fromcode:alpha',
              priority: 10,
              requiredRoles: [],
              requiredCapabilities: [],
            },
            {
              canonicalId: 'org.fromcode:alpha:self:org.fromcode:alpha:categories',
              id: 'categories',
              label: 'Categories',
              path: '/alpha/categories',
              sourcePaths: ['/alpha/posts'],
              scope: 'self',
              sourceNamespace: 'org.fromcode',
              sourcePlugin: 'alpha',
              sourceCanonicalKey: 'org.fromcode:alpha',
              targetNamespace: 'org.fromcode',
              targetPlugin: 'alpha',
              targetCanonicalKey: 'org.fromcode:alpha',
              priority: 20,
              requiredRoles: [],
              requiredCapabilities: [],
            },
            {
              canonicalId: 'org.fromcode:alpha:self:org.fromcode:alpha:tags',
              id: 'tags',
              label: 'Tags',
              path: '/alpha/tags',
              sourcePaths: ['/alpha/posts'],
              scope: 'self',
              sourceNamespace: 'org.fromcode',
              sourcePlugin: 'alpha',
              sourceCanonicalKey: 'org.fromcode:alpha',
              targetNamespace: 'org.fromcode',
              targetPlugin: 'alpha',
              targetCanonicalKey: 'org.fromcode:alpha',
              priority: 30,
              requiredRoles: [],
              requiredCapabilities: [],
            },
          ],
        },
        globalItems: [],
      },
      plugins: [{ slug: 'alpha', namespace: 'org.fromcode' }],
      userRoles: ['admin'],
      userCapabilities: [],
    });

    expect(result.activeContextId).toBe('org.fromcode:alpha');
    expect(result.activeSourcePath).toBe('/alpha/posts');
    expect(result.items.map((entry) => entry.id)).toEqual(['categories', 'tags']);
  });

  it('prefers the owning top-level source path over a direct child route match', () => {
    const result = resolver.resolve({
      pathname: '/beta/networks',
      primaryContextId: 'beta',
      menuItems: [
        {
          label: 'Beta',
          path: '/beta',
          pluginSlug: 'beta',
          children: [{ label: 'Networks', path: '/beta/networks', pluginSlug: 'beta' }],
        },
      ],
      secondaryPanel: {
        ...secondaryPanel,
        contexts: {
          'org.fromcode:beta': {
            id: 'org.fromcode:beta',
            label: 'Beta',
            targetNamespace: 'org.fromcode',
            targetPlugin: 'beta',
            targetCanonicalKey: 'org.fromcode:beta',
          },
        },
        itemsByContext: {
          'org.fromcode:beta': [
            {
              canonicalId: 'org.fromcode:beta:self:org.fromcode:beta:networks',
              id: 'networks',
              label: 'Networks',
              path: '/beta/networks',
              sourcePaths: ['/beta'],
              scope: 'self',
              sourceNamespace: 'org.fromcode',
              sourcePlugin: 'beta',
              sourceCanonicalKey: 'org.fromcode:beta',
              targetNamespace: 'org.fromcode',
              targetPlugin: 'beta',
              targetCanonicalKey: 'org.fromcode:beta',
              priority: 10,
              requiredRoles: [],
              requiredCapabilities: [],
            },
          ],
        },
        globalItems: [],
      },
      plugins: [{ slug: 'beta', namespace: 'org.fromcode' }],
      userRoles: ['admin'],
      userCapabilities: [],
    });

    expect(result.activeContextId).toBe('org.fromcode:beta');
    expect(result.activeSourcePath).toBe('/beta');
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
