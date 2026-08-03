import { SystemConstants } from '@fromcode119/core/client';
import type { ISecondaryPanelState } from '@react/interfaces/secondary-panel-state.interface';

export class ContextProviderStateService {
  static readonly inFlightGetRequests = new Map<string, Promise<any>>();

  static readonly cachedGetResponses = new Map<string, { expiresAt: number; data: any }>();

  static readonly cachedGetErrors = new Map<string, { expiresAt: number; error: any }>();

  static readonly GET_RESPONSE_TTL_MS = 5000;

  static readonly GET_ERROR_TTL_MS = 15000;

  static createEmptySecondaryPanelState(): ISecondaryPanelState {
    return {
      version: 1,
      contexts: {},
      itemsByContext: {},
      globalItems: [],
      policy: {
        allowlistKey: 'admin.secondaryPanel.allowlist.v1',
        allowlistEntries: 0,
        evaluatedAt: new Date(0).toISOString(),
      },
      precedence: {
        scopeOrder: ['self', 'plugin-target', 'global'],
        tieBreakOrder: ['priority-asc', 'canonicalId-asc'],
      },
    };
  }

  static resolveNextSecondaryPanelState(previous: ISecondaryPanelState, next: unknown): ISecondaryPanelState {
    if (next && typeof next === 'object') {
      return next as ISecondaryPanelState;
    }

    return ContextProviderStateService.isEmptySecondaryPanelState(previous)
      ? previous
      : ContextProviderStateService.createEmptySecondaryPanelState();
  }

  static isEmptySecondaryPanelState(state: ISecondaryPanelState): boolean {
    if (!state) {
      return false;
    }

    return Object.keys(state.contexts || {}).length === 0
      && Object.keys(state.itemsByContext || {}).length === 0
      && (state.globalItems || []).length === 0;
  }

  static getFrontendConfigPath(): string {
    const path = SystemConstants?.API_PATH?.SYSTEM?.FRONTEND;
    if (!path) {
      throw new Error('[Fromcode API] Missing SYSTEM.FRONTEND path constant');
    }

    return path;
  }

  static getPluginApiRegistryKey(namespace: string, slug: string): string {
    const normalizedNamespace = String(namespace || '').trim().toLowerCase();
    const normalizedSlug = String(slug || '').trim().toLowerCase();
    return `${normalizedNamespace}:${normalizedSlug}`;
  }
}
