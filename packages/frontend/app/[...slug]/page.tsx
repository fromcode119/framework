import { notFound } from 'next/navigation';
import DynamicContentClient from '../dynamic-content-client';
import { serverFetchJson, serverFetchResponse } from '../../lib/serverApi';
import { cookies } from 'next/headers';
import { cache } from 'react';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
type MaybePromise<T> = T | Promise<T>;

type DynamicPageProps = {
  params: MaybePromise<{ slug?: string[] }>;
  searchParams?: MaybePromise<SearchParams>;
};

const RESERVED_ROOT_SEGMENTS = new Set([
  'api',
  '_next',
  'plugins',
  'themes',
  'media',
  'uploads'
]);


const STATIC_FILE_EXT_RE = /\.(?:map|js|mjs|cjs|css|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|eot|json|txt|xml|webm|mp4|mov|pdf)$/i;

function normalizeLocaleCode(value: any): string {
  return String(value || '').trim().toLowerCase().replace(/_/g, '-');
}

function shouldBypassDynamicRouting(segments: string[]) {
  if (!segments.length) return false;
  const first = String(segments[0] || '').trim().toLowerCase();
  if (RESERVED_ROOT_SEGMENTS.has(first)) return true;
  const last = String(segments[segments.length - 1] || '').trim().toLowerCase();
  return STATIC_FILE_EXT_RE.test(last);
}

function firstDoc(result: any): any {
  if (Array.isArray(result)) return result[0] || null;
  if (Array.isArray(result?.docs)) return result.docs[0] || null;
  return result?.doc || result || null;
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

async function getLocaleRoutingConfig() {
  const [strategyValue, enabledLocalesValue, localizationLocalesValue] = await Promise.all([
    readSettingValue('locale_url_strategy'),
    readSettingValue('enabled_locales'),
    readSettingValue('localization_locales')
  ]);

  const strategy = (['query', 'path', 'none'] as const).includes(strategyValue as any)
    ? (strategyValue as 'query' | 'path' | 'none')
    : 'query';

  const enabledLocales = new Set<string>();
  String(enabledLocalesValue || '')
    .split(',')
    .map((item) => normalizeLocaleCode(item))
    .filter(Boolean)
    .forEach((code) => enabledLocales.add(code));

  if (localizationLocalesValue) {
    try {
      const parsed = JSON.parse(localizationLocalesValue);
      if (Array.isArray(parsed)) {
        parsed.forEach((entry: any) => {
          const code = normalizeLocaleCode(entry?.code || entry?.isoCode || entry?.locale);
          if (!code) return;
          if (entry?.enabled === false) return;
          enabledLocales.add(code);
        });
      }
    } catch {
      // no-op
    }
  }

  if (!enabledLocales.size) enabledLocales.add('en');
  return { strategy, enabledLocales };
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

async function resolveLocale(
  searchParams: SearchParams | undefined,
  pathLocale: string | undefined,
  strategy: 'query' | 'path' | 'none'
) {
  const normalizedPathLocale = normalizeLocaleCode(pathLocale || '');
  if (normalizedPathLocale) return normalizedPathLocale;
  if (strategy === 'query') {
    const fromQuery = normalizeLocaleCode(
      readSearchValue(searchParams, 'locale') || readSearchValue(searchParams, 'lang')
    );
    if (fromQuery) return fromQuery;
  }
  const cookieStore = await cookies();
  const fromCookie = normalizeLocaleCode(cookieStore.get('fc_locale')?.value || '');
  return fromCookie || '';
}

async function resolveDoc(
  slug: string,
  searchParams: SearchParams | undefined,
  localeOverride: string | undefined,
  strategy: 'query' | 'path' | 'none'
) {
  const query = new URLSearchParams();
  query.set('slug', slug);
  const locale = await resolveLocale(searchParams, localeOverride, strategy);
  const fallbackLocale = normalizeLocaleCode(readSearchValue(searchParams, 'fallback_locale'));
  if (locale) query.set('locale', locale);
  if (fallbackLocale) query.set('fallback_locale', fallbackLocale);

  const preview = searchParams?.preview;
  const draft = searchParams?.draft;
  if (preview === '1' || (Array.isArray(preview) && preview.includes('1'))) {
    query.set('preview', '1');
  }
  if (draft === '1' || (Array.isArray(draft) && draft.includes('1'))) {
    query.set('draft', '1');
  }

  const response = await serverFetchResponse(`/system/resolve?${query.toString()}`);
  if (!response) return null;

  if (!response.ok) {
    return null;
  }

  const result = await response.json();
  return result?.doc || null;
}

async function resolveDocWithPermalinkFallback(
  slug: string,
  searchParams: SearchParams | undefined,
  localeOverride: string | undefined,
  strategy: 'query' | 'path' | 'none'
) {
  const cleanSlug = String(slug || '').trim().replace(/^\/+/, '');
  if (!cleanSlug) return null;

  // Try standard version (no lead slash)
  const doc = await resolveDoc(cleanSlug, searchParams, localeOverride, strategy);
  if (doc) return doc;

  // Lead-slash fallback: try with leading slash if standard failed
  // This helps matching records where the permalink was stored WITH a slash.
  return await resolveDoc(`/${cleanSlug}`, searchParams, localeOverride, strategy);
}

async function resolveBySlug(slug: string, locale: string, fallbackLocale: string, searchParams?: SearchParams) {
  const query = new URLSearchParams();
  query.set('slug', slug);
  if (locale) query.set('locale', locale);
  if (fallbackLocale) query.set('fallback_locale', fallbackLocale);

  const preview = searchParams?.preview;
  const draft = searchParams?.draft;
  if (preview === '1' || (Array.isArray(preview) && preview.includes('1'))) {
    query.set('preview', '1');
  }
  if (draft === '1' || (Array.isArray(draft) && draft.includes('1'))) {
    query.set('draft', '1');
  }

  const result = await serverFetchJson(`/system/resolve?${query.toString()}`);
  return result?.doc || null;
}

async function resolveHomeTarget(locale: string, fallbackLocale: string, searchParams?: SearchParams) {
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
      const doc = firstDoc(result);
      if (doc) return { content: doc, forcedLayout: null };
    }
  }

  const byRoot = await resolveBySlug('/', locale, fallbackLocale, searchParams);
  if (byRoot) return { content: byRoot, forcedLayout: null };

  const byHome = await resolveBySlug('home', locale, fallbackLocale, searchParams);
  if (byHome) return { content: byHome, forcedLayout: null };

  return { content: null, forcedLayout: null };
}

export default async function DynamicContentPage({ params, searchParams }: DynamicPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const slugArray = Array.isArray(resolvedParams?.slug) ? resolvedParams.slug : [];

  if (shouldBypassDynamicRouting(slugArray)) {
    notFound();
  }

  const routingConfig = await getLocaleRoutingConfig();

  let pathLocale = '';
  let normalizedSegments = slugArray.map((part) => String(part || '').trim()).filter(Boolean);
  if (routingConfig.strategy === 'path' && normalizedSegments.length) {
    const firstSegmentLocale = normalizeLocaleCode(normalizedSegments[0]);
    if (routingConfig.enabledLocales.has(firstSegmentLocale)) {
      pathLocale = firstSegmentLocale;
      normalizedSegments = normalizedSegments.slice(1);
    }
  }

  if (shouldBypassDynamicRouting(normalizedSegments)) {
    notFound();
  }

  const slug = normalizedSegments.join('/').trim();
  const locale = await resolveLocale(resolvedSearchParams, pathLocale, routingConfig.strategy);
  const fallbackLocale = normalizeLocaleCode(readSearchValue(resolvedSearchParams, 'fallback_locale'));

  if (!slug) {
    const { content } = await resolveHomeTarget(locale, fallbackLocale, resolvedSearchParams);
    if (!content) notFound();
    return <DynamicContentClient content={content} />;
  }

  const content = await resolveDocWithPermalinkFallback(slug, resolvedSearchParams, locale, routingConfig.strategy);
  if (!content) {
    notFound();
  }

  return <DynamicContentClient content={content} />;
}
