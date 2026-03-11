import { RuntimeBridge } from '@fromcode119/sdk';

export class ContextBridge {
  private static getBridge(): any {
    return RuntimeBridge.getBridge();
  }

  static registerSlotComponent(...args: any[]): any {
    return ContextBridge.getBridge().registerSlotComponent?.(...args);
  }

  static registerFieldComponent(...args: any[]): any {
    return ContextBridge.getBridge().registerFieldComponent?.(...args);
  }

  static registerOverride(...args: any[]): any {
    return ContextBridge.getBridge().registerOverride?.(...args);
  }

  static registerMenuItem(...args: any[]): any {
    return ContextBridge.getBridge().registerMenuItem?.(...args);
  }

  static registerCollection(...args: any[]): any {
    return ContextBridge.getBridge().registerCollection?.(...args);
  }

  static registerPlugins(...args: any[]): any {
    return ContextBridge.getBridge().registerPlugins?.(...args);
  }

  static registerTheme(...args: any[]): any {
    return ContextBridge.getBridge().registerTheme?.(...args);
  }

  static registerSettings(...args: any[]): any {
    return ContextBridge.getBridge().registerSettings?.(...args);
  }

  static registerAPI(...args: any[]): any {
    return ContextBridge.getBridge().registerAPI?.(...args);
  }

  static getAPI(...args: any[]): any {
    return ContextBridge.getBridge().getAPI?.(...args);
  }

  static setPluginState(...args: any[]): any {
    return ContextBridge.getBridge().setPluginState?.(...args);
  }

  static loadConfig(...args: any[]): any {
    return ContextBridge.getBridge().loadConfig?.(...args);
  }

  static getFrontendMetadata(...args: any[]): any {
    return ContextBridge.getBridge().getFrontendMetadata?.(...args);
  }

  static resolveContent(...args: any[]): any {
    return ContextBridge.getBridge().resolveContent?.(...args);
  }

  static emit(...args: any[]): any {
    return ContextBridge.getBridge().emit?.(...args);
  }

  static on(...args: any[]): any {
    return ContextBridge.getBridge().on?.(...args);
  }

  static t(...args: any[]): any {
    return ContextBridge.getBridge().t?.(...args);
  }

  static locale(): string | undefined {
    return ContextBridge.getBridge().locale?.() as string | undefined;
  }

  static setLocale(...args: any[]): any {
    return ContextBridge.getBridge().setLocale?.(...args);
  }

  static readonly api = new Proxy(
    {},
    {
      get: (_, prop) => {
        const bridge = ContextBridge.getBridge();
        return bridge.api?.[prop as any];
      },
    },
  ) as any;
}