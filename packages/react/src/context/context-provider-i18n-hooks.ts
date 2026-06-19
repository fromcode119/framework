import React from 'react';
import { SystemConstants } from '@fromcode119/core/client';
import type { CollectionMetadata, MenuItem, SecondaryPanelState, SlotComponent } from '../context.interfaces';
import { ContextProviderStateService } from './context-provider-state-service';
import { FrontendI18nService } from './frontend-i18n-service';

export class ContextProviderI18nHooks {
  static useI18nRuntime(args: {
    api: any;
    locale: string;
    translations: Record<string, any>;
    registeredTranslations: Record<string, Record<string, any>>;
    loadedConfigPathsRef: React.MutableRefObject<Set<string>>;
    setTranslations: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setRefreshVersion: React.Dispatch<React.SetStateAction<number>>;
    setSlots: React.Dispatch<React.SetStateAction<Record<string, SlotComponent[]>>>;
    setOverrides: React.Dispatch<React.SetStateAction<Record<string, SlotComponent>>>;
    setMenuItems: React.Dispatch<React.SetStateAction<MenuItem[]>>;
    setSecondaryPanel: React.Dispatch<React.SetStateAction<SecondaryPanelState>>;
    setCollections: React.Dispatch<React.SetStateAction<CollectionMetadata[]>>;
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

    const t = React.useCallback((key: string, params: Record<string, any> = {}, defaultValue?: string) => {
      let value: any = effectiveTranslations;
      const parts = key.split('.');
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          return defaultValue || key;
        }
      }

      if (typeof value !== 'string') {
        return defaultValue || key;
      }

      return value.replace(/\{\{(.+?)\}\}/g, (_, match) => {
        const paramKey = match.trim();
        return params[paramKey] !== undefined ? String(params[paramKey]) : `{{${paramKey}}}`;
      });
    }, [effectiveTranslations]);

    React.useEffect(() => {
      loadTranslations(locale);
    }, [locale, loadTranslations]);

    return { loadTranslations, triggerRefresh, effectiveTranslations, t };
  }
}
