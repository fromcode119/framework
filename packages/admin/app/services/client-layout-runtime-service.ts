import { Platform } from '@fromcode119/react-class-components';
import { RuntimeConstants } from '@fromcode119/core/client';

export class ClientLayoutRuntimeService {
  static buildAdminRuntimeModule(source: Record<string, unknown>): Record<string, unknown> {
    /**
     * NOTHING may be added here that `source` does not actually export.
     *
     * The catch-all loop below already copies every real key off `source`, so a name listed here can
     * only ever change the outcome in one direction: if it is NOT on `source`, the first loop writes
     * `bridge[key] = undefined` and the registry then advertises an export that does not exist. A
     * plugin or theme bundle importing it gets `undefined` — for a component that means React error
     * #306 and a dead panel, and the failure surfaces in the consumer, nowhere near this file.
     *
     * `'NotificationContext'` sat here doing exactly that: no such value is exported anywhere in the
     * framework (only the admin-internal `INotificationContextType` and `NotificationContextStore`),
     * so all four admin aliases carried `NotificationContext: undefined`. It was harmless only because
     * nothing had imported it yet.
     *
     * This list is also the SECOND copy of `RuntimeConstants.ADMIN_RUNTIME_EXPORT_KEYS`; the two drift
     * independently. Verify a change by reading `window.__fromcodeRuntimeModules` in the browser and
     * checking that no advertised key is `undefined` — a green build proves nothing here.
     */
    const requiredExports = [
      'PluginPageHeader',
      'PluginOverviewCard',
      'PluginStatsList',
      'PluginTrendChart',
      'PluginChartCard',
      'PluginEmptyState',
      'MediaPicker',
      'Button',
      'Input',
      'TextArea',
      'Select',
      'TagField',
      'Loader',
      'Switch',
      'Card',
      'Badge',
      'ConfirmDialog',
      'PromptDialog',
      'DateTimePicker',
      'ColorPicker',
      'CodeEditor',
      'VisualMenuField',
      'PageHeading',
      'StatCard',
      'DataTable',
      'Icon',
      'ThemeProvider',
      'ThemeContext',
      'AdminServices',
    ];
    const bridge: Record<string, unknown> = {};

    requiredExports.forEach((key) => {
      bridge[key] = source[key];
    });

    Object.keys(source).forEach((key) => {
      if (!(key in bridge)) {
        bridge[key] = source[key];
      }
    });

    return bridge;
  }

  static buildRuntimeModules(source: Record<string, unknown>, reactorModule?: Record<string, unknown>): Record<string, Record<string, unknown>> {
    const adminRuntimeModule = ClientLayoutRuntimeService.buildAdminRuntimeModule(source);
    return {
      '@fromcode119/admin': adminRuntimeModule,
      '@fromcode119/admin/components': adminRuntimeModule,
      // `@fromcode119/sdk/admin` re-exports AdminServices from this sub-path; plugins (e.g. privacy
      // banner/policy editors) crash with `AdminServices is undefined` if it isn't registered.
      '@fromcode119/admin/services': adminRuntimeModule,
      // THEME and plugin bundles externalise `@fromcode119/sdk/admin` and resolve it through THIS
      // registry, not the import map. Without the key their dynamic import yields an empty module and
      // every admin component read off it is `undefined` — a media field then handed React an undefined
      // lazy type and took down the whole block-settings panel. The console works either way because a
      // console `import()` goes through the import map, which DOES define it.
      '@fromcode119/sdk/admin': adminRuntimeModule,
      // reactor as ONE shared runtime instance — externalized appearance bundles resolve their `@state`/
      // `@watch` decorators + `Reactor` base from here, so they register on the SAME `ReactiveMetadata`.
      ...(reactorModule ? { '@fromcode119/react-class-components': reactorModule } : {}),
    };
  }

  static seedWindowRuntimeModules(runtimeModule: Record<string, unknown>, reactorModule?: Record<string, unknown>): void {
    if (!Platform.isBrowser) {
      return;
    }

    const runtimeRegistry = (((window as any)[RuntimeConstants.GLOBALS.MODULES] ||= {}) as Record<string, unknown>);
    runtimeRegistry[RuntimeConstants.MODULE_NAMES.ADMIN] = runtimeModule;
    runtimeRegistry[RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS] = runtimeModule;
    // The SDK re-exports AdminServices from `@fromcode119/admin/services`; register it so dynamic
    // plugin imports resolve it instead of crashing on `undefined.getInstance()`.
    runtimeRegistry['@fromcode119/admin/services'] = runtimeModule;
    // Same reason as the map above: this is the key theme/plugin bundles actually look up.
    runtimeRegistry['@fromcode119/sdk/admin'] = runtimeModule;
    if (reactorModule) runtimeRegistry['@fromcode119/react-class-components'] = reactorModule;
  }
}
