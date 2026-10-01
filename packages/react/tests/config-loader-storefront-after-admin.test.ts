import { renderHook } from '@testing-library/react';
import { ContextProviderConfigLoaderHooks } from '@react/context/context-provider-config-loader-hooks';
import { ContextProviderStateService } from '@react/context/context-provider-state-service';

/**
 * The admin loads its plugins, collections, menu and settings from the admin metadata. A plugin
 * component that calls `getFrontendMetadata()` then loads the STOREFRONT config into the same
 * provider, whose plugins carry no `admin` section. On a site with no active theme that load replaced
 * the admin's collections with `[]`, and every plugin edit page (`/cms/pages/<id>`) rendered
 * "collection not found" while the list page, mounted before the load, still worked.
 */
const ADMIN_METADATA_PATH = '/system/admin/metadata';
const FRONTEND_PATH = ContextProviderStateService.getFrontendConfigPath();

const adminMetadata = {
  plugins: [{ slug: 'cms', admin: { collections: [{ slug: 'fcp_cms_pages', shortSlug: 'pages' }] } }],
  menu: [{ label: 'Pages', path: '/cms/pages' }],
  settings: { admin_url: 'http://console.example.test' },
};

const storefrontConfig = {
  plugins: [{ slug: 'cms' }],
  menu: [{ label: 'Home', path: '/' }],
  settings: {},
  secondaryPanel: undefined,
  activeTheme: null,
};

function mountLoader(responses: Record<string, unknown>) {
  const setters = {
    setServerRuntimeModules: vi.fn(),
    setPlugins: vi.fn(),
    setCollections: vi.fn(),
    setMenuItems: vi.fn(),
    setSecondaryPanel: vi.fn(),
    setSettings: vi.fn(),
    setActiveTheme: vi.fn(),
    setThemeVariables: vi.fn(),
    setIsReady: vi.fn(),
  };
  const { result } = renderHook(() => ContextProviderConfigLoaderHooks.useConfigLoader({
    apiFetch: async (path: string) => responses[path],
    getBaseURL: () => 'http://api.example.test',
    inFlightConfigLoadsRef: { current: new Map() },
    loadedConfigPathsRef: { current: new Set<string>() },
    ...setters,
  } as any));
  return { loadConfig: result.current.loadConfig, setters };
}

describe('config loader: storefront config after the admin metadata', () => {
  it('keeps the admin plugins, collections, menu and settings', async () => {
    const { loadConfig, setters } = mountLoader({ [ADMIN_METADATA_PATH]: adminMetadata, [FRONTEND_PATH]: storefrontConfig });

    await loadConfig(ADMIN_METADATA_PATH);
    expect(setters.setCollections).toHaveBeenLastCalledWith([{ slug: 'fcp_cms_pages', shortSlug: 'pages', pluginSlug: 'cms' }]);
    vi.clearAllMocks();

    await loadConfig(FRONTEND_PATH);
    expect(setters.setCollections).not.toHaveBeenCalled();
    expect(setters.setPlugins).not.toHaveBeenCalled();
    expect(setters.setMenuItems).not.toHaveBeenCalled();
    expect(setters.setSettings).not.toHaveBeenCalled();
    expect(setters.setIsReady).toHaveBeenCalledWith(true);
  });

  it('still applies the storefront theme on top of the admin metadata', async () => {
    const theme = { slug: 'shop-theme', variables: { primary: '#123456' } };
    const { loadConfig, setters } = mountLoader({
      [ADMIN_METADATA_PATH]: adminMetadata,
      [FRONTEND_PATH]: { ...storefrontConfig, activeTheme: theme },
    });

    await loadConfig(ADMIN_METADATA_PATH);
    await loadConfig(FRONTEND_PATH);
    expect(setters.setActiveTheme).toHaveBeenCalledWith(theme);
    expect(setters.setThemeVariables).toHaveBeenCalledWith({ primary: '#123456' });
  });

  it('is the whole config where nothing else loaded one (the storefront)', async () => {
    const { loadConfig, setters } = mountLoader({ [FRONTEND_PATH]: storefrontConfig });

    await loadConfig(FRONTEND_PATH);
    expect(setters.setPlugins).toHaveBeenCalledWith([{ slug: 'cms' }]);
    expect(setters.setCollections).toHaveBeenCalledWith([]);
    expect(setters.setMenuItems).toHaveBeenCalledWith([{ label: 'Home', path: '/' }]);
    expect(setters.setSettings).toHaveBeenCalledWith({});
  });
});
