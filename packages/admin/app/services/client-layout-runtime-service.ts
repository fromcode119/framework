import { RuntimeConstants } from '@fromcode119/core/client';

export class ClientLayoutRuntimeService {
  static buildAdminRuntimeModule(source: Record<string, unknown>): Record<string, unknown> {
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
      'NotificationContext',
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

  static buildRuntimeModules(source: Record<string, unknown>): Record<string, Record<string, unknown>> {
    const adminRuntimeModule = ClientLayoutRuntimeService.buildAdminRuntimeModule(source);
    return {
      '@fromcode119/admin': adminRuntimeModule,
      '@fromcode119/admin/components': adminRuntimeModule,
      // `@fromcode119/sdk/admin` re-exports AdminServices from this sub-path; plugins (e.g. privacy
      // banner/policy editors) crash with `AdminServices is undefined` if it isn't registered.
      '@fromcode119/admin/services': adminRuntimeModule,
    };
  }

  static seedWindowRuntimeModules(runtimeModule: Record<string, unknown>): void {
    if (typeof window === 'undefined') {
      return;
    }

    const runtimeRegistry = (((window as any)[RuntimeConstants.GLOBALS.MODULES] ||= {}) as Record<string, unknown>);
    runtimeRegistry[RuntimeConstants.MODULE_NAMES.ADMIN] = runtimeModule;
    runtimeRegistry[RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS] = runtimeModule;
    // The SDK re-exports AdminServices from `@fromcode119/admin/services`; register it so dynamic
    // plugin imports resolve it instead of crashing on `undefined.getInstance()`.
    runtimeRegistry['@fromcode119/admin/services'] = runtimeModule;
  }
}
