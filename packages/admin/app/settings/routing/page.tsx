"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/components/theme-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { FrameworkIcons } from '@/lib/icons';
import { api } from '@/lib/api';
import { useNotification } from '@/components/notification-context';
import { usePlugins } from '@fromcode/react';
import { ENDPOINTS } from '@/lib/constants';
import { Loader } from '@/components/ui/loader';

const PLACEHOLDERS = [
  { label: ':slug', description: 'The sanitized post title (recommended)', example: 'hello-world' },
  { label: ':id', description: 'The unique numeric ID of the content', example: '123' },
  { label: ':year', description: 'The 4-digit year of publication', example: '2026' },
  { label: ':month', description: 'The 2-digit month of publication', example: '01' },
  { label: ':day', description: 'The 2-digit day of publication', example: '31' },
  { label: ':category', description: 'The primary category slug', example: 'news' },
  { label: ':author', description: 'The author username', example: 'admin' },
];

const PRESETS = [
  { label: 'Plain', value: '/:slug' },
  { label: 'Day and name', value: '/:year/:month/:day/:slug' },
  { label: 'Month and name', value: '/:year/:month/:slug' },
  { label: 'Numeric', value: '/:id' },
  { label: 'Category and name', value: '/:category/:slug' },
];

const PRIMARY_TITLE_KEYS = ['title', 'name', 'label', 'slug', 'path', 'customPermalink', 'permalink'];
const SKIP_STRING_KEYS = new Set([
  'id', 'createdAt', 'updatedAt', '_status', '_locale', '_meta', '__v'
]);

function getRecordDisplayTitle(doc: any, collectionLabel: string) {
  for (const key of PRIMARY_TITLE_KEYS) {
    const value = doc?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  for (const [key, value] of Object.entries(doc || {})) {
    if (SKIP_STRING_KEYS.has(key)) continue;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return `${collectionLabel} #${doc?.id ?? 'unknown'}`;
}

function getCollectionSourceTag(pluginLabel: string, collectionLabel: string) {
  const plugin = (pluginLabel || 'System').trim();
  const section = (collectionLabel || 'record').trim();
  return `${plugin}/${section}`;
}

function getFieldNames(collection: any): Set<string> {
  const fields = Array.isArray(collection?.fields) ? collection.fields : [];
  return new Set(fields.map((f: any) => String(f?.name || '').trim()).filter(Boolean));
}

function getAutoCollectionPriority(collection: any): number {
  const fields = getFieldNames(collection);
  let score = 100;

  if (fields.has('content')) score -= 30;
  if (fields.has('themeLayout')) score -= 20;
  if (fields.has('customPermalink') || fields.has('path')) score -= 20;
  if (fields.has('title') || fields.has('name')) score -= 10;

  return score;
}

function detectAutoFallbackLayout(frontendMeta: any): string | null {
  const rawLayouts = frontendMeta?.activeTheme?.layouts;
  const layoutKeys = Array.isArray(rawLayouts)
    ? rawLayouts.map((layout: any) => String(layout?.slug || layout?.name || layout?.key || layout?.id || '')).filter(Boolean)
    : Object.keys(rawLayouts || {});

  const fallbackPriority = ['DefaultLayout', 'Home', 'Main'];
  const matched = fallbackPriority.find((name) => layoutKeys.includes(name));
  return matched || null;
}

export default function RoutingPage() {
  const { theme } = useTheme();
  const { addNotification } = useNotification();
  const { registerSettings, collections } = usePlugins();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [structure, setStructure] = useState('/:slug');
  const [homeTarget, setHomeTarget] = useState('auto');
  const [searchTerm, setSearchTerm] = useState('');
  const [frontendMeta, setFrontendMeta] = useState<any>(null);
  const [autoResolvedSource, setAutoResolvedSource] = useState<string | null>(null);
  const [availableCollections, setAvailableCollections] = useState<any[]>([]);
  const [homeOptions, setHomeOptions] = useState<{ label: string; value: string; group?: string; section?: string; sourceKind?: string }[]>([
    { value: 'auto', label: 'Auto detect', group: 'System' }
  ]);
  const optionsRequestRef = useRef(0);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [settingsResponse, frontendMeta, collectionStats] = await Promise.all([
          api.get(`${ENDPOINTS.COLLECTIONS.BASE}/settings`),
          api.get(ENDPOINTS.SYSTEM.FRONTEND).catch(() => null),
          api.get(ENDPOINTS.SYSTEM.STATS.COLLECTIONS).catch(() => [])
        ]);

        const docs = settingsResponse.docs || [];
        const foundPermalink = docs.find((s: any) => s.key === 'permalink_structure');
        const foundHomeTarget = docs.find((s: any) => s.key === 'routing_home_target');

        if (foundPermalink?.value) setStructure(foundPermalink.value);
        if (foundHomeTarget?.value) setHomeTarget(String(foundHomeTarget.value));
        setFrontendMeta(frontendMeta);
        setAvailableCollections(Array.isArray(collectionStats) ? collectionStats : []);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [api]);

  useEffect(() => {
    if (!frontendMeta) return;
    const requestId = ++optionsRequestRef.current;
    const query = searchTerm.trim().toLowerCase();
    const timeout = setTimeout(async () => {
      const options: { label: string; value: string; group?: string; section?: string; sourceKind?: string }[] = [{ value: 'auto', label: 'Auto detect', group: 'System', sourceKind: 'Auto' }];
      const optionSet = new Set(options.map((o) => o.value));
      const availableCollectionSet = new Set(
        (availableCollections || [])
          .flatMap((c: any) => [String(c?.shortSlug || ''), String(c?.slug || '')])
          .filter(Boolean)
      );

      const rawLayouts = frontendMeta?.activeTheme?.layouts;
      const themeLayoutEntries = Array.isArray(rawLayouts)
        ? rawLayouts.map((layout: any, idx: number) => {
            if (typeof layout === 'string') return { key: layout, label: layout };
            const key = String(layout?.slug || layout?.name || layout?.key || layout?.id || `layout-${idx + 1}`);
            const label = String(layout?.title || layout?.label || layout?.name || layout?.slug || key);
            return { key, label };
          })
        : Object.entries(rawLayouts || {}).map(([key, layout]: [string, any]) => {
            if (typeof layout === 'string') return { key, label: layout };
            const label = String(layout?.title || layout?.label || layout?.name || layout?.slug || key);
            return { key, label };
          });

      themeLayoutEntries.forEach(({ key, label }) => {
        const value = `layout:${key}`;
        if (optionSet.has(value)) return;
        if (query && !label.toLowerCase().includes(query)) return;
        optionSet.add(value);
        options.push({
          value,
          label,
          group: 'Theme Layouts',
          sourceKind: 'Layout'
        });
      });

      const collectionCandidates = (collections || []).filter((c: any) => {
        if (!c || c.system) return false;
        if (availableCollectionSet.size > 0) {
          const shortSlug = String(c.shortSlug || c.slug || '');
          const fullSlug = String(c.slug || '');
          if (!availableCollectionSet.has(shortSlug) && !availableCollectionSet.has(fullSlug)) return false;
        } else {
          // If system collection stats are unavailable, avoid probing unknown collection routes.
          return false;
        }
        const fields = Array.isArray(c.fields) ? c.fields : [];
        return fields.some((f: any) => f.name === 'slug');
      });

      const docsResponses = await Promise.all(
        collectionCandidates.map(async (c: any) => {
          const collectionSlug = c.shortSlug || c.slug;
          const limit = query ? 150 : 50;
          try {
            const response = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${collectionSlug}?limit=${limit}&sort=title`);
            return { collection: c, collectionSlug, docs: response?.docs || [] };
          } catch {
            return { collection: c, collectionSlug, docs: [] };
          }
        })
      );

      docsResponses.forEach(({ collection, collectionSlug, docs }) => {
        docs.forEach((doc: any) => {
          if (!doc || doc.id === undefined || doc.id === null) return;
          const value = `collection:${collectionSlug}:${doc.id}`;
          if (optionSet.has(value)) return;

          const collectionLabel = collection.label || collection.name || collection.shortSlug || collectionSlug;
          const title = getRecordDisplayTitle(doc, collectionLabel);
          const permalink = doc.customPermalink || doc.slug || '';
          const permalinkLabel = permalink ? `/${String(permalink).replace(/^\/+/, '')}` : '/';
          const searchableText = `${title} ${permalinkLabel} ${collectionLabel}`.toLowerCase();
          if (query && !searchableText.includes(query)) return;

          const pluginSlug = collection.pluginSlug || 'System';
          const pluginLabel = pluginSlug.charAt(0).toUpperCase() + pluginSlug.slice(1);
          const groupLabel = `Collection Records · ${pluginLabel}`;
          const sourceTag = getCollectionSourceTag(pluginSlug, collectionLabel);

          optionSet.add(value);
          options.push({
            value,
            label: `${title} (${permalinkLabel})`,
            group: groupLabel,
            section: collectionLabel,
            sourceKind: sourceTag
          });
        });
      });

      const groupOrder = new Map<string, number>([
        ['System', 0],
        ['Theme Layouts', 1]
      ]);
      const sortedOptions = [...options].sort((a, b) => {
        const aGroup = a.group || 'Options';
        const bGroup = b.group || 'Options';
        const aSection = a.section || '';
        const bSection = b.section || '';
        const aRank = groupOrder.has(aGroup) ? groupOrder.get(aGroup)! : 2;
        const bRank = groupOrder.has(bGroup) ? groupOrder.get(bGroup)! : 2;
        if (aRank !== bRank) return aRank - bRank;
        if (aGroup !== bGroup) return aGroup.localeCompare(bGroup);
        if (aSection !== bSection) return aSection.localeCompare(bSection);
        return a.label.localeCompare(b.label);
      });

      if (requestId === optionsRequestRef.current) {
        setHomeOptions(sortedOptions);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [api, availableCollections, collections, frontendMeta, searchTerm]);

  useEffect(() => {
    let cancelled = false;
    const detectAutoSource = async () => {
      if (homeTarget !== 'auto') {
        setAutoResolvedSource(null);
        return;
      }
      const availableCollectionSet = new Set(
        (availableCollections || [])
          .flatMap((c: any) => [String(c?.shortSlug || ''), String(c?.slug || '')])
          .filter(Boolean)
      );
      const candidateCollections = (collections || [])
        .filter((c: any) => {
          if (!c || c.system) return false;
          if (availableCollectionSet.size > 0) {
            const shortSlug = String(c.shortSlug || c.slug || '');
            const fullSlug = String(c.slug || '');
            if (!availableCollectionSet.has(shortSlug) && !availableCollectionSet.has(fullSlug)) return false;
          } else {
            // Skip probing collections when admin stats endpoint is unavailable.
            return false;
          }
          return getFieldNames(c).has('slug');
        })
        .map((c: any) => ({
          collectionSlug: c.shortSlug || c.slug,
          collectionLabel: c.label || c.name || c.shortSlug || c.slug,
          priority: getAutoCollectionPriority(c)
        }))
        .sort((a: any, b: any) => a.priority - b.priority || a.collectionSlug.localeCompare(b.collectionSlug));

      const queries = [
        { label: '"/"', query: 'customPermalink=%2F' },
        { label: '"/"', query: 'path=%2F' },
        { label: '"home"', query: 'slug=home' },
      ];

      for (const { label, query } of queries) {
        for (const candidate of candidateCollections) {
          try {
            const result = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${encodeURIComponent(candidate.collectionSlug)}?${query}&limit=1`);
            const doc = Array.isArray(result) ? result[0] : result?.docs?.[0];
            if (doc) {
              const title = getRecordDisplayTitle(doc, candidate.collectionLabel);
              if (!cancelled) {
                setAutoResolvedSource(`Matched ${label} -> ${title} (${candidate.collectionLabel})`);
              }
              return;
            }
          } catch {
            // Candidate collection unavailable or no access; continue.
          }
        }
      }
      if (!cancelled) {
        setAutoResolvedSource('No content match for "/" or "home" (using theme fallback).');
      }
    };

    detectAutoSource();
    return () => {
      cancelled = true;
    };
  }, [api, availableCollections, collections, homeTarget]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        api.put(`${ENDPOINTS.COLLECTIONS.BASE}/settings/permalink_structure`, {
          value: structure
        }),
        api.put(`${ENDPOINTS.COLLECTIONS.BASE}/settings/routing_home_target`, {
          value: homeTarget
        })
      ]);

      registerSettings({
        permalink_structure: structure,
        routing_home_target: homeTarget
      });

      addNotification({
        title: 'Routing Updated',
        message: 'Routing configuration has been synced.',
        type: 'success'
      });
    } catch (err: any) {
      addNotification({
        title: 'Update Failed',
        message: err.message || 'Failed to save routing settings.',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <Loader label="Loading Routing Protocols..." />
      </div>
    );
  }

  const selectedHomeOption = homeOptions.find((opt) => opt.value === homeTarget);
  const autoFallbackLayout = detectAutoFallbackLayout(frontendMeta);
  const resolvedSourceLabel = homeTarget === 'auto'
    ? `${autoResolvedSource || 'Auto mode: checking "/" and "home"...'}${autoFallbackLayout ? ` Theme fallback: ${autoFallbackLayout}.` : ''}`
    : selectedHomeOption
    ? `${selectedHomeOption.sourceKind || selectedHomeOption.group || 'Source'} · ${selectedHomeOption.label}`
    : `Custom target · ${homeTarget}`;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className={`sticky top-0 z-30 border-b backdrop-blur-md px-8 py-6 flex items-center justify-between ${
        theme === 'dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-white/50 border-slate-100'
      }`}>
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Routing
          </h1>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide opacity-60">
            Homepage Target & Permalink Configuration
          </p>
        </div>
        <Button
          icon={<FrameworkIcons.Save size={14} strokeWidth={3} />}
          onClick={handleSave}
          isLoading={isSaving}
          className="px-6 rounded-xl shadow-lg shadow-indigo-600/10"
        >
          Apply Routing
        </Button>
      </div>

      <div className="p-8 lg:p-12 max-w-5xl space-y-8">
        <Card title="Homepage Target">
          <div className="space-y-5 py-2">
            <div>
              <label className={`block text-[11px] font-semibold uppercase tracking-wide mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                Root Route (`/`)
              </label>
              <Select
                value={homeTarget}
                onChange={setHomeTarget}
                options={homeOptions}
                placeholder="Select homepage target"
                theme={theme}
                searchable
                onSearchChange={setSearchTerm}
              />
              <p className="mt-3 text-[11px] text-slate-500 font-medium italic">
                Targets are discovered from available theme layouts and public collections.
              </p>
              <div className={`mt-3 rounded-xl border px-3 py-2 text-[11px] ${
                theme === 'dark' ? 'border-slate-800 bg-slate-900/50 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}>
                <span className="font-semibold uppercase tracking-wide text-[10px] opacity-70">Resolved Homepage Source</span>
                <div className="mt-1 font-semibold">{resolvedSourceLabel}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Permalink Structure">
          <div className="space-y-8 py-4">
            <div>
              <label className={`block text-[11px] font-semibold uppercase tracking-wide mb-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                Common Structures
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setStructure(preset.value)}
                    className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                      structure === preset.value
                        ? 'border-indigo-600 bg-indigo-600/5 ring-1 ring-indigo-600'
                        : theme === 'dark'
                          ? 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                          : 'border-slate-200 bg-white hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${
                        structure === preset.value ? 'text-indigo-400' : 'text-slate-500'
                      }`}>
                        {preset.label}
                      </span>
                      <code className={`text-sm ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                        {preset.value}
                      </code>
                    </div>
                    {structure === preset.value && <FrameworkIcons.Check size={20} className="text-indigo-600" />}
                  </button>
                ))}
              </div>
            </div>

            <div className={`p-6 rounded-2xl border-2 border-dashed ${
              theme === 'dark' ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/50'
            }`}>
              <label className={`block text-[11px] font-semibold uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                Custom Structure
              </label>
              <div className="flex gap-3">
                <div className={`flex-1 flex items-center px-4 rounded-xl border transition-all focus-within:ring-4 focus-within:ring-indigo-600/10 focus-within:border-indigo-600 ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <span className="text-slate-400 font-mono text-sm border-r pr-3 mr-3 py-2.5">https://yourdomain.com</span>
                  <input
                    value={structure}
                    onChange={(e) => setStructure(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-sm font-medium py-2.5"
                    placeholder="/:year/:slug"
                  />
                </div>
                <Button onClick={handleSave} isLoading={isSaving} className="px-8 rounded-xl">
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Available Placeholders">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-4">
            {PLACEHOLDERS.map((tag) => (
              <button
                key={tag.label}
                onClick={() => {
                  if (!structure.includes(tag.label)) {
                    setStructure((prev) => prev.endsWith('/') ? `${prev}${tag.label}` : `${prev}/${tag.label}`);
                  }
                }}
                className={`p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] group ${
                  theme === 'dark'
                    ? 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/60'
                    : 'border-slate-100 bg-white hover:shadow-xl hover:shadow-indigo-600/5'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <code className="text-indigo-500 font-semibold text-sm px-2 py-1 bg-indigo-500/10 rounded-lg">
                    {tag.label}
                  </code>
                  <FrameworkIcons.Plus size={14} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                </div>
                <p className={`text-[12px] font-bold mb-1 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                  {tag.description}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  Example: <span className="italic">{tag.example}</span>
                </p>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
