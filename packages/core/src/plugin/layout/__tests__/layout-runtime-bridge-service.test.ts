import { describe, expect, it } from 'vitest';
import { LayoutDiagnosticService } from '../layout-diagnostic-service';
import { LayoutLifecycleService } from '../layout-lifecycle-service';
import { LayoutResolutionService } from '../layout-resolution-service';
import { LayoutRuntimeBridgeService } from '../layout-runtime-bridge-service';
import { PluginLayoutRegistryService } from '../plugin-layout-registry-service';
import { ThemeLayoutOverrideRegistryService } from '../../../theme/theme-layout-override-registry-service';

function PluginRenderer(): null {
  return null;
}

function ThemeRenderer(): null {
  return null;
}

function OtherThemeRenderer(): null {
  return null;
}

const TEST_NAMESPACE = 'org.synthetic';
const CATALOG_PLUGIN = 'catalog-module';
const POLICY_PLUGIN = 'policy-module';
const OUTREACH_PLUGIN = 'outreach-module';
const LEARNING_PLUGIN = 'learning-module';
const PARTNER_PLUGIN = 'partner-module';
const THEME_ALPHA = 'theme-alpha';
const THEME_BETA = 'theme-beta';

const CATALOG_INDEX_TARGET = 'catalog-module.catalog-index';
const CATALOG_DETAIL_TARGET = 'catalog-module.catalog-detail';
const CATALOG_ORPHAN_TARGET = 'catalog-module.orphan-page';
const POLICY_PRIMARY_TARGET = 'policy-module.primary-policy-page';
const POLICY_SECONDARY_TARGET = 'policy-module.secondary-policy-page';
const OUTREACH_CONTACT_TARGET = 'outreach-module.contact-page';
const LEARNING_INDEX_TARGET = 'learning-module.course-index';
const LEARNING_DETAIL_TARGET = 'learning-module.course-detail';
const PARTNER_PORTAL_TARGET = 'partner-module.partner-portal';

describe('LayoutRuntimeBridgeService', () => {
  function createSubject(): LayoutRuntimeBridgeService {
    const pluginRegistry = new PluginLayoutRegistryService();
    const themeRegistry = new ThemeLayoutOverrideRegistryService();
    const resolutionService = new LayoutResolutionService(pluginRegistry, themeRegistry);
    const diagnosticService = new LayoutDiagnosticService(pluginRegistry, resolutionService);
    const lifecycleService = new LayoutLifecycleService(pluginRegistry, themeRegistry);
    return new LayoutRuntimeBridgeService(
      pluginRegistry,
      themeRegistry,
      resolutionService,
      diagnosticService,
      lifecycleService,
    );
  }

  it('prefers the highest-priority theme replacement for a page target', () => {
    const subject = createSubject();

    subject.registerPluginDefaults({
      namespace: TEST_NAMESPACE,
      pluginSlug: CATALOG_PLUGIN,
      layouts: [{ namespace: TEST_NAMESPACE, pluginSlug: CATALOG_PLUGIN, targetKind: 'page', targetKey: CATALOG_INDEX_TARGET, component: PluginRenderer, required: true }],
    });
    subject.registerThemeOverrides({
      themeSlug: THEME_ALPHA,
      replacements: [{ namespace: TEST_NAMESPACE, pluginSlug: CATALOG_PLUGIN, targetKind: 'page', targetKey: CATALOG_INDEX_TARGET, component: ThemeRenderer, themeSlug: THEME_ALPHA, priority: 200 }],
    });

    const resolved = subject.resolvePageTarget(CATALOG_INDEX_TARGET, THEME_ALPHA);

    expect(resolved.status).toBe('resolved');
    expect(resolved.source).toBe('theme-replacement');
    expect(resolved.winner).toBe(ThemeRenderer);
  });

  it('reports an equal-priority theme replacement conflict deterministically', () => {
    const subject = createSubject();

    subject.registerPluginDefaults({
      namespace: TEST_NAMESPACE,
      pluginSlug: CATALOG_PLUGIN,
      layouts: [{ namespace: TEST_NAMESPACE, pluginSlug: CATALOG_PLUGIN, targetKind: 'page', targetKey: CATALOG_INDEX_TARGET, component: PluginRenderer, required: true }],
    });
    subject.registerThemeOverrides({
      themeSlug: THEME_ALPHA,
      replacements: [
        { namespace: TEST_NAMESPACE, pluginSlug: CATALOG_PLUGIN, targetKind: 'page', targetKey: CATALOG_INDEX_TARGET, component: ThemeRenderer, themeSlug: THEME_ALPHA, priority: 200 },
        { namespace: TEST_NAMESPACE, pluginSlug: CATALOG_PLUGIN, targetKind: 'page', targetKey: CATALOG_INDEX_TARGET, component: OtherThemeRenderer, themeSlug: THEME_ALPHA, priority: 200 },
      ],
    });

    const resolved = subject.resolvePageTarget(CATALOG_INDEX_TARGET, THEME_ALPHA);

    expect(resolved.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'theme-replacement-conflict', severity: 'error' }),
      ]),
    );
    expect(resolved.winner).toBe(OtherThemeRenderer);
  });

  it('rejects a required page disable when no theme replacement exists', () => {
    const subject = createSubject();

    subject.registerPluginDefaults({
      namespace: TEST_NAMESPACE,
      pluginSlug: CATALOG_PLUGIN,
      layouts: [{ namespace: TEST_NAMESPACE, pluginSlug: CATALOG_PLUGIN, targetKind: 'page', targetKey: CATALOG_DETAIL_TARGET, component: PluginRenderer, required: true }],
    });
    subject.registerThemeOverrides({
      themeSlug: THEME_ALPHA,
      disables: [{ namespace: TEST_NAMESPACE, pluginSlug: CATALOG_PLUGIN, targetKind: 'page', targetKey: CATALOG_DETAIL_TARGET, themeSlug: THEME_ALPHA, priority: 300 }],
    });

    const resolved = subject.resolvePageTarget(CATALOG_DETAIL_TARGET, THEME_ALPHA);

    expect(resolved.status).toBe('resolved');
    expect(resolved.source).toBe('plugin');
    expect(resolved.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'required-route-disabled', severity: 'error' }),
      ]),
    );
  });

  it('cross-checks backend contracts against frontend defaults and theme winners', () => {
    const subject = createSubject();

    subject.registerPluginDefaults({
      namespace: TEST_NAMESPACE,
      pluginSlug: CATALOG_PLUGIN,
      layouts: [
        { namespace: TEST_NAMESPACE, pluginSlug: CATALOG_PLUGIN, targetKind: 'page', targetKey: CATALOG_INDEX_TARGET, component: PluginRenderer, required: true },
        { namespace: TEST_NAMESPACE, pluginSlug: CATALOG_PLUGIN, targetKind: 'page', targetKey: CATALOG_ORPHAN_TARGET, component: PluginRenderer, required: false },
      ],
    });
    subject.registerThemeOverrides({
      themeSlug: THEME_ALPHA,
      replacements: [{ namespace: TEST_NAMESPACE, pluginSlug: CATALOG_PLUGIN, targetKind: 'page', targetKey: CATALOG_INDEX_TARGET, component: ThemeRenderer, themeSlug: THEME_ALPHA, priority: 200 }],
    });

    const diagnostics = subject.createDefaultPageContractDiagnostics([
      {
        namespace: TEST_NAMESPACE,
        pluginSlug: CATALOG_PLUGIN,
        key: 'catalog-index',
        kind: 'index',
        defaultSlug: '/catalog',
        capability: 'catalog',
        recipe: CATALOG_INDEX_TARGET,
        materializationMode: 'singleton-document',
        dependencies: [],
        adoptionHints: [],
        required: true,
        canonicalKey: 'org.synthetic:catalog-module:catalog-index',
      },
      {
        namespace: TEST_NAMESPACE,
        pluginSlug: CATALOG_PLUGIN,
        key: 'catalog-detail',
        kind: 'detail',
        defaultSlug: '/catalog/:slug',
        capability: 'catalog',
        recipe: CATALOG_DETAIL_TARGET,
        materializationMode: 'singleton-document',
        dependencies: [],
        adoptionHints: [],
        required: true,
        canonicalKey: 'org.synthetic:catalog-module:catalog-detail',
        recordCollection: 'catalog',
      },
    ], THEME_ALPHA);

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'theme-override-selected', targetKey: CATALOG_INDEX_TARGET }),
        expect.objectContaining({ code: 'backend-contract-present/frontend-layout-missing', targetKey: CATALOG_DETAIL_TARGET }),
        expect.objectContaining({ code: 'frontend-layout-present/backend-contract-missing', targetKey: CATALOG_ORPHAN_TARGET }),
      ]),
    );
  });

  it('keeps policy page recipe keys aligned when contracts and frontend defaults use page targets', () => {
    const subject = createSubject();

    subject.registerPluginDefaults({
      namespace: TEST_NAMESPACE,
      pluginSlug: POLICY_PLUGIN,
      layouts: [
        {
          namespace: TEST_NAMESPACE,
          pluginSlug: POLICY_PLUGIN,
          targetKind: 'page',
          targetKey: POLICY_PRIMARY_TARGET,
          component: PluginRenderer,
          required: true,
        },
        {
          namespace: TEST_NAMESPACE,
          pluginSlug: POLICY_PLUGIN,
          targetKind: 'page',
          targetKey: POLICY_SECONDARY_TARGET,
          component: PluginRenderer,
          required: true,
        },
      ],
    });

    const diagnostics = subject.createDefaultPageContractDiagnostics([
      {
        namespace: TEST_NAMESPACE,
        pluginSlug: POLICY_PLUGIN,
        key: 'primary-policy-page',
        kind: 'policy',
        defaultSlug: '/primary-policy',
        capability: 'policy-content',
        recipe: POLICY_PRIMARY_TARGET,
        materializationMode: 'singleton-document',
        dependencies: [],
        adoptionHints: ['/primary-policy'],
        required: true,
        canonicalKey: 'org.synthetic:policy-module:primary-policy-page',
      },
      {
        namespace: TEST_NAMESPACE,
        pluginSlug: POLICY_PLUGIN,
        key: 'secondary-policy-page',
        kind: 'policy',
        defaultSlug: '/secondary-policy',
        capability: 'policy-content',
        recipe: POLICY_SECONDARY_TARGET,
        materializationMode: 'singleton-document',
        dependencies: [],
        adoptionHints: ['/secondary-policy'],
        required: true,
        canonicalKey: 'org.synthetic:policy-module:secondary-policy-page',
      },
    ]);

    expect(diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'backend-contract-present/frontend-layout-missing' }),
        expect.objectContaining({ code: 'frontend-layout-present/backend-contract-missing' }),
      ]),
    );

    const resolved = subject.resolvePageTarget(POLICY_PRIMARY_TARGET);

    expect(resolved.status).toBe('resolved');
    expect(resolved.source).toBe('plugin');
    expect(resolved.winner).toBe(PluginRenderer);
  });

  it('keeps phase 5 default page contracts aligned with plugin defaults and theme winners', () => {
    const subject = createSubject();

    subject.registerPluginDefaults({
      namespace: TEST_NAMESPACE,
      pluginSlug: OUTREACH_PLUGIN,
      layouts: [
        {
          namespace: TEST_NAMESPACE,
          pluginSlug: OUTREACH_PLUGIN,
          targetKind: 'page',
          targetKey: OUTREACH_CONTACT_TARGET,
          component: PluginRenderer,
          required: true,
        },
      ],
    });

    subject.registerPluginDefaults({
      namespace: TEST_NAMESPACE,
      pluginSlug: POLICY_PLUGIN,
      layouts: [
        {
          namespace: TEST_NAMESPACE,
          pluginSlug: POLICY_PLUGIN,
          targetKind: 'page',
          targetKey: POLICY_PRIMARY_TARGET,
          component: PluginRenderer,
          required: true,
        },
        {
          namespace: TEST_NAMESPACE,
          pluginSlug: POLICY_PLUGIN,
          targetKind: 'page',
          targetKey: POLICY_SECONDARY_TARGET,
          component: PluginRenderer,
          required: true,
        },
      ],
    });

    subject.registerPluginDefaults({
      namespace: TEST_NAMESPACE,
      pluginSlug: LEARNING_PLUGIN,
      layouts: [
        {
          namespace: TEST_NAMESPACE,
          pluginSlug: LEARNING_PLUGIN,
          targetKind: 'page',
          targetKey: LEARNING_INDEX_TARGET,
          component: PluginRenderer,
          required: true,
        },
        {
          namespace: TEST_NAMESPACE,
          pluginSlug: LEARNING_PLUGIN,
          targetKind: 'page',
          targetKey: LEARNING_DETAIL_TARGET,
          component: PluginRenderer,
          required: true,
        },
      ],
    });

    subject.registerPluginDefaults({
      namespace: TEST_NAMESPACE,
      pluginSlug: PARTNER_PLUGIN,
      layouts: [
        {
          namespace: TEST_NAMESPACE,
          pluginSlug: PARTNER_PLUGIN,
          targetKind: 'page',
          targetKey: PARTNER_PORTAL_TARGET,
          component: PluginRenderer,
          required: false,
        },
      ],
    });

    subject.registerThemeOverrides({
      themeSlug: THEME_BETA,
      replacements: [
        {
          namespace: TEST_NAMESPACE,
          pluginSlug: LEARNING_PLUGIN,
          targetKind: 'page',
          targetKey: LEARNING_INDEX_TARGET,
          component: ThemeRenderer,
          themeSlug: THEME_BETA,
          priority: 10,
        },
      ],
    });

    const diagnostics = subject.createDefaultPageContractDiagnostics([
      {
        namespace: TEST_NAMESPACE,
        pluginSlug: OUTREACH_PLUGIN,
        key: 'contact-page',
        kind: 'form-page',
        defaultSlug: '/contact',
        capability: 'lead-capture',
        recipe: OUTREACH_CONTACT_TARGET,
        materializationMode: 'singleton-document',
        dependencies: [],
        adoptionHints: ['/contact'],
        required: true,
        canonicalKey: 'org.synthetic:outreach-module:contact-page',
      },
      {
        namespace: TEST_NAMESPACE,
        pluginSlug: POLICY_PLUGIN,
        key: 'primary-policy-page',
        kind: 'policy',
        defaultSlug: '/primary-policy',
        capability: 'policy-content',
        recipe: POLICY_PRIMARY_TARGET,
        materializationMode: 'singleton-document',
        dependencies: [],
        adoptionHints: ['/primary-policy'],
        required: true,
        canonicalKey: 'org.synthetic:policy-module:primary-policy-page',
      },
      {
        namespace: TEST_NAMESPACE,
        pluginSlug: POLICY_PLUGIN,
        key: 'secondary-policy-page',
        kind: 'policy',
        defaultSlug: '/secondary-policy',
        capability: 'policy-content',
        recipe: POLICY_SECONDARY_TARGET,
        materializationMode: 'singleton-document',
        dependencies: [],
        adoptionHints: ['/secondary-policy'],
        required: true,
        canonicalKey: 'org.synthetic:policy-module:secondary-policy-page',
      },
      {
        namespace: TEST_NAMESPACE,
        pluginSlug: LEARNING_PLUGIN,
        key: 'course-index',
        kind: 'index',
        defaultSlug: '/courses',
        capability: 'catalog',
        recipe: LEARNING_INDEX_TARGET,
        materializationMode: 'singleton-document',
        dependencies: [],
        adoptionHints: ['/courses'],
        required: true,
        canonicalKey: 'org.synthetic:learning-module:course-index',
      },
      {
        namespace: TEST_NAMESPACE,
        pluginSlug: LEARNING_PLUGIN,
        key: 'course-detail',
        kind: 'detail',
        defaultSlug: '/courses/:slug',
        capability: 'catalog',
        recipe: LEARNING_DETAIL_TARGET,
        materializationMode: 'singleton-document',
        dependencies: [],
        adoptionHints: ['/courses/:slug'],
        required: true,
        canonicalKey: 'org.synthetic:learning-module:course-detail',
      },
      {
        namespace: TEST_NAMESPACE,
        pluginSlug: PARTNER_PLUGIN,
        key: 'partner-portal',
        kind: 'landing',
        defaultSlug: '/partner-portal',
        capability: 'partner-portal',
        recipe: PARTNER_PORTAL_TARGET,
        materializationMode: 'singleton-document',
        dependencies: [],
        adoptionHints: ['/partner-portal'],
        required: false,
        canonicalKey: 'org.synthetic:partner-module:partner-portal',
      },
    ], THEME_BETA);

    expect(diagnostics).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'backend-contract-present/frontend-layout-missing' }),
        expect.objectContaining({ code: 'frontend-layout-present/backend-contract-missing' }),
      ]),
    );
  });

});