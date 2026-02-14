import HomeClient from './home-client';
import { serverFetchJson } from '../lib/server-api';
import { cookies } from 'next/headers';
import { cache } from 'react';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;

type HomePageProps = {
  searchParams?: MaybePromise<SearchParams>;
};

function normalizeLocaleCode(value: any): string {
  return String(value || '').trim().toLowerCase().replace(/_/g, '-');
}

async function readSettingValue(key: string): Promise<string> {
  const map = await readSettingsMap();
  return String(map.get(key) || '').trim();
}

const readSettingsMap = cache(async () => {
  const result = await serverFetchJson('/collections/settings?limit=500');
  const docs = Array.isArray(result?.docs)
    ? result.docs
    : Array.isArray(result)
      ? result
      : [];

  const map = new Map<string, string>();
  for (const doc of docs) {
    const key = String(doc?.key || '').trim();
    if (!key) continue;
    map.set(key, String(doc?.value ?? '').trim());
  }
  return map;
});

async function getLocaleUrlStrategy(): Promise<'query' | 'path' | 'none'> {
  const value = (await readSettingValue('locale_url_strategy')).toLowerCase();
  if (value === 'path' || value === 'none') return value;
  return 'query';
}

async function resolveSearchParams(searchParams?: MaybePromise<SearchParams>): Promise<SearchParams | undefined> {
  if (!searchParams) return undefined;
  return await searchParams;
}

function readSearchValue(searchParams: SearchParams | undefined, key: string): string {
  const value = searchParams?.[key];
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

async function resolveLocale(searchParams: SearchParams | undefined, strategy: 'query' | 'path' | 'none') {
  if (strategy === 'query') {
    const fromQuery = normalizeLocaleCode(readSearchValue(searchParams, 'locale') || readSearchValue(searchParams, 'lang'));
    if (fromQuery) return fromQuery;
  }
  const cookieStore = await cookies();
  const fromCookie = normalizeLocaleCode(cookieStore.get('fc_locale')?.value || '');
  return fromCookie || '';
}

async function resolveBySlug(slug: string, locale: string, fallbackLocale: string) {
  const query = new URLSearchParams();
  query.set('slug', slug);
  if (locale) query.set('locale', locale);
  if (fallbackLocale) query.set('fallback_locale', fallbackLocale);
  const result = await serverFetchJson(`/system/resolve?${query.toString()}`);
  return result?.doc || null;
}

async function resolveHomeTarget(locale: string, fallbackLocale: string) {
  const target = (await readSettingValue('routing_home_target')) || 'auto';

  if (target.startsWith('layout:')) {
    const forcedLayout = target.slice('layout:'.length).trim();
    return { content: null, forcedLayout: forcedLayout || null };
  }

  if (target.startsWith('collection:')) {
    const parts = target.split(':');
    const collectionSlug = parts[1];
    const recordId = parts.slice(2).join(':');
    if (collectionSlug && recordId) {
      const result = await serverFetchJson(`/collections/${encodeURIComponent(collectionSlug)}?id=${encodeURIComponent(recordId)}&limit=1`);
      const doc = Array.isArray(result) ? result[0] : result?.docs?.[0];
      if (doc) return { content: doc, forcedLayout: null };
    }
  }

  // Auto mode: prefer root path, then "home".
  const byRoot = await resolveBySlug('/', locale, fallbackLocale);
  if (byRoot) return { content: byRoot, forcedLayout: null };

  const byHome = await resolveBySlug('home', locale, fallbackLocale);
  if (byHome) return { content: byHome, forcedLayout: null };

  return { content: null, forcedLayout: null };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const localeStrategy = await getLocaleUrlStrategy();
  const locale = await resolveLocale(resolvedSearchParams, localeStrategy);
  const fallbackLocale = normalizeLocaleCode(readSearchValue(resolvedSearchParams, 'fallback_locale'));
  const { content, forcedLayout } = await resolveHomeTarget(locale, fallbackLocale);
  return <HomeClient initialContent={content} forcedLayout={forcedLayout} />;
}
