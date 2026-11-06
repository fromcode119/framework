import { RuntimeConstants } from '@fromcode119/core/client';
import { ContextBridge } from '@react/context-bridge';
import type { IPluginUiRegistrarContext } from '@react/interfaces/plugin-ui-registrar-context.interface';

/**
 * Registers a single arbitrary module export as a plugin-UI component — IF it is one.
 *
 * The plugin-UI entry templates glob EVERY export of every storefront/admin file. Those exports are
 * arbitrary: a component class, an erased type, a plain const, a JSON default. Deciding which are
 * registerable, and wiring each to the right registry, is this class's ONE responsibility — so the
 * reflection lives in a single named, tested place instead of being inlined (and duplicated) in the two
 * generated build-entry blobs.
 *
 * A registerable component is a class (i.e. a `function`) carrying one or more registration statics:
 * `slots`, `fieldName`, `override` / `overrides`, `block` (+ its `definition`), `contentTransformer`,
 * `pluginClient`, `onMount`. These reads are value discriminators over an unknown export declaring what it
 * wants registered — NOT defensive guards against a guaranteed framework contract.
 */
export class PluginUiRegistrar {
  /**
   * `exportId` is the export's source address (`./file.tsx#ExportName`), stamped on the class as
   * `registrationId`. The slot registry folds a re-registration of the same component into its existing
   * entry, and without this it could only match by class NAME — which minification shortens, so two
   * different panels of one plugin both named `i` replaced each other and one section vanished.
   */
  static register(value: unknown, ctx: IPluginUiRegistrarContext, exportId?: string): void {
    if (typeof value !== 'function') return;
    const c = value as any;
    if (exportId && !Object.prototype.hasOwnProperty.call(c, 'registrationId')) {
      Object.defineProperty(c, 'registrationId', { value: exportId, configurable: true });
    }
    if (Array.isArray(c.slots)) {
      for (const slot of c.slots) ContextBridge.registerSlotComponent(slot, c, ctx.pluginSlug, c.priority ?? 1);
    }
    if (typeof c.fieldName === 'string') ContextBridge.registerFieldComponent(c.fieldName, c);
    if (typeof c.override === 'string') ContextBridge.registerOverride(c.override, c, ctx.pluginSlug, c.priority ?? 1);
    if (Array.isArray(c.overrides)) {
      for (const o of c.overrides) {
        if (!o.scope || o.scope === 'both' || o.scope === ctx.uiBundle) {
          ContextBridge.registerOverride(o.name, c, ctx.pluginSlug, o.priority ?? 1);
        }
      }
    }
    // Block definitions register into the FRAMEWORK-owned block-definitions slot (see
    // RuntimeConstants.SLOTS) — never a plugin-named slot. The block registry is framework-owned.
    if (c.block === true) {
      ContextBridge.registerSlotComponent(RuntimeConstants.SLOTS.BLOCK_DEFINITIONS, c.definition, ctx.pluginSlug, c.priority ?? 1);
    }
    if (typeof c.contentTransformer === 'string') {
      ContextBridge.registerContentTransformer(c.contentTransformer, c.transform, c.priority ?? 1);
    }
    if (c.pluginClient) {
      ContextBridge.registerPluginClient(
        ctx.namespace,
        typeof c.pluginClient === 'string' ? c.pluginClient : ctx.pluginSlug,
        (api: unknown, bp: unknown) => new c(api, bp),
      );
    }
    if (typeof c.onMount === 'function') c.onMount();
  }
}
