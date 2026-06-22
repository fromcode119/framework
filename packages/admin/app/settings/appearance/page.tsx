"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RouteConstants, ApiVersionUtils } from '@fromcode119/core/client';
import { AdminApi } from '@/lib/api';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { ActiveAdminAppearanceService } from '@/lib/appearance/active-admin-appearance-service';
import { NotificationHooks } from '@/components/use-notification';
import { ThemeHooks } from '@/components/use-theme';
import { Loader } from '@/components/ui/loader';
import { FrameworkIcons } from '@fromcode119/react';
import { CompactPageHeader } from '@/components/ui/compact-page-header';
import { AppearanceActiveCard } from './appearance-active-card';
import { AppearanceMarketplaceCard } from './appearance-marketplace-card';
import { AppearanceInstallUrlCard } from './appearance-install-url-card';
import type { AppearanceItem } from './appearance-item.interfaces';
import type { AppearanceCatalogItem } from './appearance-catalog-item.interfaces';

const APPEARANCES_BASE = ApiVersionUtils.withVersion(RouteConstants.SEGMENTS.APPEARANCES);
const CATALOG_PATH = `${APPEARANCES_BASE}${RouteConstants.SEGMENTS.APPEARANCES_CATALOG}`;
const INSTALL_PATH = `${APPEARANCES_BASE}${RouteConstants.SEGMENTS.APPEARANCES_INSTALL}`;

export default function AppearanceSettingsPage() {
  const { theme } = ThemeHooks.useTheme();
  const { addNotification } = NotificationHooks.useNotification();
  const [items, setItems] = useState<AppearanceItem[]>([]);
  const [catalog, setCatalog] = useState<AppearanceCatalogItem[]>([]);
  const [active, setActive] = useState<string>('default');
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const dark = theme === 'dark';

  const notify = (type: 'success' | 'error', message: string) => addNotification?.({ type, title: 'Appearance', message });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, cat, settings] = await Promise.all([
        AdminApi.get(APPEARANCES_BASE),
        AdminApi.get(CATALOG_PATH).catch(() => ({ appearances: [] })),
        AdminSystemSettingsClient.getAll(),
      ]);
      setItems(((list as any)?.appearances || []) as AppearanceItem[]);
      setCatalog(((cat as any)?.appearances || []) as AppearanceCatalogItem[]);
      setActive(String((settings as any)?.admin_appearance || 'default').trim() || 'default');
    } catch (e: any) {
      notify('error', e?.message || 'Failed to load appearances');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => { void load(); }, [load]);

  const catalogBySlug = useMemo(
    () => Object.fromEntries(catalog.map((c) => [c.slug, c])) as Record<string, AppearanceCatalogItem>,
    [catalog],
  );
  const notInstalled = useMemo(() => catalog.filter((c) => !c.installed), [catalog]);

  const switchTo = async (slug: string) => {
    setBusy(true);
    try {
      await AdminSystemSettingsClient.update({ admin_appearance: slug === 'default' ? '' : slug });
      ActiveAdminAppearanceService.rememberHint(slug);
      notify('success', `Switched to "${slug}". Reloading…`);
      setTimeout(() => window.location.reload(), 600);
    } catch (e: any) {
      notify('error', e?.message || 'Failed to switch appearance');
      setBusy(false);
    }
  };

  const install = async (payload: { slug?: string; url?: string }, doneMsg: string) => {
    setBusy(true);
    try {
      await AdminApi.post(INSTALL_PATH, payload);
      notify('success', doneMsg);
      if (payload.url) setUrl('');
      await load();
    } catch (e: any) {
      notify('error', e?.message || 'Install failed');
    } finally {
      setBusy(false);
    }
  };

  const updateInstalled = (item: AppearanceItem) => {
    if (catalogBySlug[item.slug]?.updateAvailable) return install({ slug: item.slug }, `Updated "${item.slug}".`);
    if (item.sourceUrl) return install({ url: item.sourceUrl }, `Re-installed "${item.slug}".`);
  };

  const remove = async (slug: string) => {
    setBusy(true);
    try {
      await AdminApi.delete(`${APPEARANCES_BASE}/${encodeURIComponent(slug)}`);
      notify('success', `Removed "${slug}".`);
      await load();
    } catch (e: any) {
      notify('error', e?.message || 'Remove failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-12"><Loader label="Loading appearances…" /></div>;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <CompactPageHeader
        theme={theme}
        icon={<FrameworkIcons.Palette size={18} strokeWidth={2} />}
        title="Appearance"
        subtitle="Admin look & feel — separate from plugins & themes"
      />

      <div className="p-6 w-full space-y-8">
        <AppearanceActiveCard
          items={items}
          catalogBySlug={catalogBySlug}
          active={active}
          busy={busy}
          dark={dark}
          onSwitch={switchTo}
          onUpdate={updateInstalled}
          onRemove={remove}
        />

        <AppearanceMarketplaceCard
          entries={notInstalled}
          busy={busy}
          dark={dark}
          onInstall={(slug) => install({ slug }, `Installed "${slug}".`)}
        />

        <AppearanceInstallUrlCard
          url={url}
          busy={busy}
          onChange={setUrl}
          onInstall={() => install({ url }, 'Appearance installed.')}
        />
      </div>
    </div>
  );
}
