import React from 'react';
import { SystemConstants } from '@fromcode119/core/client';
import type { ICollectionMetadata } from '@react/interfaces/collection-metadata.interface';
import type { IMenuItem } from '@react/interfaces/menu-item.interface';
import type { ISecondaryPanelState } from '@react/interfaces/secondary-panel-state.interface';
import type { ISlotComponent } from '@react/interfaces/slot-component.interface';
import { ContextProviderStateService } from '@react/context/context-provider-state-service';
import { FrontendI18nService } from '@react/context/frontend-i18n-service';

export class ContextProviderI18nHooks {
  static useI18nRuntime(args: {
    api: any;
    locale: string;
    translations: Record<string, any>;
    registeredTranslations: Record<string, Record<string, any>>;
    loadedConfigPathsRef: React.MutableRefObject<Set<string>>;
    setTranslations: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setRefreshVersion: React.Dispatch<React.SetStateAction<number>>;
    setSlots: React.Dispatch<React.SetStateAction<Record<string, ISlotComponent[]>>>;
    setOverrides: React.Dispatch<React.SetStateAction<Record<string, ISlotComponent>>>;
    setMenuItems: React.Dispatch<React.SetStateAction<IMenuItem[]>>;
    setSecondaryPanel: React.Dispatch<React.SetStateAction<ISecondaryPanelState>>;
    setCollections: React.Dispatch<React.SetStateAction<ICollectionMetadata[]>>;
  }) {
    const {
      api,
      locale,
      translations,
      registeredTranslations,
      loadedConfigPathsRef,
      setTranslations,
      setRefreshVersion,
      setSlots,
      setOverrides,
      setMenuItems,
      setSecondaryPanel,
      setCollections,
    } = args;

    const loadTranslations = React.useCallback(async (newLocale: string) => {
      try {
        const encodedLocale = encodeURIComponent(String(newLocale || '').trim() || 'en');
        const data = await api.get(`${SystemConstants.API_PATH.SYSTEM.I18N}?locale=${encodedLocale}`, { silent: true });
        // Replace: this holds ONLY the server (active-locale) translations. Plugin/theme UI
        // translations registered via registerTranslations live in `registeredTranslations` (per
        // locale) and are layered on in `effectiveTranslations`, so they survive a (re)load here and
        // a locale switch no longer leaves stale keys from the previous language.
        setTranslations(data && typeof data === 'object' ? data : {});
      } catch (error) {
        console.warn('[I18n] Failed to load translations from:', error);
      }
    }, [api, setTranslations]);

    const triggerRefresh = React.useCallback(() => {
      setRefreshVersion((value) => value + 1);
      setSlots({});
      setOverrides({});
      setMenuItems([]);
      setSecondaryPanel(ContextProviderStateService.createEmptySecondaryPanelState());
      setCollections([]);
      loadedConfigPathsRef.current.delete(ContextProviderStateService.getFrontendConfigPath());
      loadTranslations(locale);
    }, [locale, loadTranslations, loadedConfigPathsRef, setRefreshVersion, setSlots, setOverrides, setMenuItems, setSecondaryPanel, setCollections]);

    // Server translations (active-locale, from /system/i18n) + plugin/theme registrations for the
    // active locale. Recomputes when the locale changes — no plugin re-registration needed.
    const effectiveTranslations = React.useMemo(
      () => FrontendI18nService.resolveEffective(translations, registeredTranslations, locale),
      [translations, registeredTranslations, locale],
    );

    // Lookup lives in FrontendI18nService so the server-side pre-render of a theme resolves keys
    // through the SAME code — a second copy would drift, and drift here reads as text changing
    // between the server paint and hydration.
    const t = React.useCallback(
      (key: string, params: Record<string, any> = {}, defaultValue?: string) =>
        FrontendI18nService.translate(effectiveTranslations, key, params, defaultValue),
      [effectiveTranslations],
    );

    React.useEffect(() => {
      loadTranslations(locale);
    }, [locale, loadTranslations]);

    return { loadTranslations, triggerRefresh, effectiveTranslations, t };
  }
}
