"use client";

import React, { useEffect, useMemo, useState, use, useRef, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Slot, usePlugins } from '@fromcode119/react';
import { useTheme } from '@/components/theme-context';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@/lib/icons';
import Cookies from 'js-cookie';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { resolveCollection, generatePreviewUrl } from '@/lib/collection-utils';
import { FieldRenderer } from '@/components/collection/field-renderer';
import { CollectionNotFound } from '@/components/collection/collection-not-found';
import { CollectionQuickEditCard } from '@/components/collection/collection-quick-edit-card';

import { CollectionListHeader } from './list/list-header';
import { FilterBar } from './list/filter-bar';
import { BulkActions } from './list/bulk-actions';
import { ListFooter } from './list/list-footer';

import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const RELATIONSHIP_LABEL_CACHE = new Map<string, string>();

const parsePageQueryValue = (value: string | null): number => {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

function resolveRelationDisplayLabel(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return '';
  if (typeof value === 'object') {
    return String(value.title || value.name || value.label || value.slug || value.email || value.username || value.id || '').trim();
  }
  return '';
}

function resolveRelationScalar(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (typeof value === 'boolean') return '';
  if (typeof value === 'object') {
    return String(value.id ?? value._id ?? value.value ?? value.slug ?? '').trim();
  }
  return String(value).trim();
}

const RelationshipCellValue: React.FC<{ relationTo?: string; raw: any }> = ({ relationTo, raw }) => {
  const [resolved, setResolved] = useState<Record<string, string>>({});

  const tokens = useMemo(() => {
    const entries = Array.isArray(raw) ? raw : [raw];
    return entries
      .map((entry) => {
        const value = resolveRelationScalar(entry);
        const directLabel = resolveRelationDisplayLabel(entry);
        return { value, directLabel };
      })
      .filter((entry) => entry.value || entry.directLabel);
  }, [raw]);

  useEffect(() => {
    let disposed = false;
    if (!relationTo) return () => { disposed = true; };

    const run = async () => {
      const pending = tokens
        .filter((entry) => {
          if (!entry.value) return false;
          if (entry.directLabel && entry.directLabel !== entry.value) return false;
          const key = `${relationTo}:${entry.value}`;
          return !RELATIONSHIP_LABEL_CACHE.has(key) && !resolved[key];
        })
        .slice(0, 8);

      if (!pending.length) return;

      const updates: Record<string, string> = {};

      await Promise.all(
        pending.map(async (entry) => {
          const key = `${relationTo}:${entry.value}`;
          try {
            const byId = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${encodeURIComponent(relationTo)}/${encodeURIComponent(entry.value)}`);
            const label = resolveRelationDisplayLabel(byId) || entry.value;
            updates[key] = label;
            RELATIONSHIP_LABEL_CACHE.set(key, label);
            return;
          } catch {
            try {
              const bySlug = await api.get(
                `${ENDPOINTS.COLLECTIONS.BASE}/${encodeURIComponent(relationTo)}?slug=${encodeURIComponent(entry.value)}&limit=1`
              );
              const doc = Array.isArray(bySlug) ? bySlug[0] : bySlug?.docs?.[0];
              const label = resolveRelationDisplayLabel(doc) || entry.value;
              updates[key] = label;
              RELATIONSHIP_LABEL_CACHE.set(key, label);
            } catch {
              updates[key] = entry.value;
              RELATIONSHIP_LABEL_CACHE.set(key, entry.value);
            }
          }
        })
      );

      if (!disposed && Object.keys(updates).length) {
        setResolved((prev) => ({ ...prev, ...updates }));
      }
    };

    run();
    return () => {
      disposed = true;
    };
  }, [relationTo, resolved, tokens]);

  if (!tokens.length) return <>-</>;

  const labels = tokens.map((entry) => {
    if (entry.directLabel && entry.directLabel !== entry.value) return entry.directLabel;
    const key = relationTo && entry.value ? `${relationTo}:${entry.value}` : '';
    return (key && (resolved[key] || RELATIONSHIP_LABEL_CACHE.get(key))) || entry.directLabel || entry.value;
  });

  const visible = labels.slice(0, 3).join(', ');
  return <>{visible}{labels.length > 3 ? '…' : ''}</>;
};

export default function CollectionListPage({ params }: { params: Promise<{ pluginSlug: string; slug: string }> }) {
  const { pluginSlug, slug } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { collections, settings } = usePlugins();
  const { theme } = useTheme();
  const [data, setData] = useState<any[]>([]);
  const [pluginSettings, setPluginSettings] = useState<Record<string, any>>({});

  const frontendUrl = (settings?.frontend_url || '').replace(/\/$/, '');
  
  // Find the collection by matching the short slug and the explicit pluginSlug
  const collection = resolveCollection(collections, pluginSlug, slug);

  // Redirect if it's a global/singleton collection
  useEffect(() => {
    if (collection?.type === 'global') {
      router.replace(`/${pluginSlug}/${slug}/settings`);
    }
  }, [collection, pluginSlug, slug, router]);

  // Basic search state
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    return parsePageQueryValue(new URLSearchParams(window.location.search).get('page'));
  });
  const [sort, setSort] = useState('-createdAt');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({});
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>([]);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [quickEditExpandedId, setQuickEditExpandedId] = useState<string | null>(null);
  const [quickEditLoadingId, setQuickEditLoadingId] = useState<string | null>(null);
  const [quickEditSavingId, setQuickEditSavingId] = useState<string | null>(null);
  const [quickEditData, setQuickEditData] = useState<Record<string, any>>({});
  const [quickEditInitialData, setQuickEditInitialData] = useState<Record<string, any>>({});
  const [quickEditStatus, setQuickEditStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteDialogState, setDeleteDialogState] = useState<{ mode: 'single'; id: string } | { mode: 'bulk'; ids: string[] } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement>(null);

  const resolvedSlug = collection?.slug || slug;
  const pageSize = 10;

  useEffect(() => {
    const pageFromUrl = parsePageQueryValue(searchParams.get('page'));
    setPage((prev) => (prev === pageFromUrl ? prev : pageFromUrl));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (page <= 1) nextParams.delete('page');
    else nextParams.set('page', String(page));

    const nextQuery = nextParams.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) return;

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [page, pathname, router, searchParams]);

  const statusField = useMemo(() => {
    if (!collection) return null;
    return collection.fields.find((field: any) => field?.name === 'status' && field?.type === 'select') || null;
  }, [collection]);

  const statusOptions = useMemo(() => {
    const options = Array.isArray((statusField as any)?.options) ? (statusField as any).options : [];
    return options
      .map((option: any) => ({
        label: String(option?.label || option?.value || '').trim(),
        value: String(option?.value || '').trim()
      }))
      .filter((option: any) => option.value);
  }, [statusField]);

  const prettifyColumnName = (value: string) =>
    value
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (str) => str.toUpperCase());

  const formatCellValue = (raw: any): React.ReactNode => {
    if (raw === null || raw === undefined || raw === '') return '-';
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
    if (Array.isArray(raw)) {
      if (!raw.length) return '-';
      const sample = raw.slice(0, 3).map((item) => {
        if (typeof item === 'string' || typeof item === 'number') return String(item);
        if (item && typeof item === 'object') {
          return String(item.title || item.name || item.label || item.slug || item.id || '[item]');
        }
        return String(item);
      });
      return sample.join(', ') + (raw.length > 3 ? '…' : '');
    }
    if (typeof raw === 'object') {
      return String(raw.title || raw.name || raw.label || raw.slug || raw.id || '[Object]');
    }
    return String(raw);
  };

  const allColumns = useMemo(() => {
    if (!collection) return [];
    const hiddenFieldNames = new Set(
      collection.fields
        .filter((field: any) => field?.hidden || field?.admin?.hidden)
        .map((field: any) => field.name)
    );

    const defaultCols = Array.isArray(collection.admin?.defaultColumns) ? collection.admin.defaultColumns : [];
    const fieldCols = collection.fields
      .filter((field: any) => field?.name && !hiddenFieldNames.has(field.name))
      .map((field: any) => field.name);
    const columnNames = Array.from(new Set(['id', ...defaultCols, ...fieldCols, 'createdAt']));

    return columnNames.map((columnName) => {
      const field = collection.fields.find((item: any) => item.name === columnName);
      const header = field?.label || prettifyColumnName(columnName);

      return {
        id: columnName,
        header,
        sortable: true,
        accessor: (row: any) => {
          const raw = row[columnName];
          if (columnName === 'status') {
            const value = String(raw || '').trim();
            if (!value) return '-';
            const lower = value.toLowerCase();
            const variant =
              lower === 'published' || lower === 'read'
                ? 'success'
                : lower === 'draft' || lower === 'unread' || lower === 'new'
                  ? 'warning'
                  : lower === 'archived'
                    ? 'rose'
                    : 'default';
            return <Badge variant={variant as any}>{value}</Badge>;
          }

          if (field?.type === 'relationship') {
            return <RelationshipCellValue relationTo={field.relationTo} raw={raw} />;
          }

          if (columnName === 'createdAt' || columnName === 'updatedAt' || field?.type === 'date' || field?.type === 'datetime') {
            const date = raw ? new Date(raw) : null;
            if (!date || Number.isNaN(date.getTime())) return '-';
            return date.toLocaleString();
          }

          return formatCellValue(raw);
        }
      };
    });
  }, [collection]);

  const columnsStorageKey = useMemo(() => `fc_columns_${pluginSlug}_${resolvedSlug}`, [pluginSlug, resolvedSlug]);

  const selectFilterFields = useMemo(() => {
    if (!collection) return [];
    return collection.fields.filter((field: any) => {
      if (!field?.name) return false;
      if (field.hidden || field.admin?.hidden) return false;
      if (field.name === 'status') return false;
      return field.type === 'select' && Array.isArray(field.options) && field.options.length > 0;
    });
  }, [collection]);

  const quickEditFields = useMemo(() => {
    if (!collection) return [];
    return collection.fields.filter((field: any) => {
      if (!field?.name) return false;
      if (field.hidden || field.admin?.hidden) return false;
      if (field.admin?.readOnly) return false;
      if (['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at'].includes(field.name)) return false;
      if (field.type === 'ui') return false;
      if (['json', 'array', 'richText', 'code', 'upload'].includes(field.type)) return false;
      if (field.type === 'textarea') return false;
      return true;
    });
  }, [collection]);

  useEffect(() => {
    if (!allColumns.length) return;
    const availableIds = new Set(allColumns.map((column) => column.id));
    
    // Calculate smart defaults if not provided in admin config
    let defaults = collection?.admin?.defaultColumns;
    if (!Array.isArray(defaults) || !defaults.length) {
      // Find semantic "name" fields
      const semanticDefaults = ['id', 'title', 'name', 'label', 'slug', 'status', 'createdAt']
        .filter(id => availableIds.has(id));
      
      // If none of those found, take first 4
      defaults = semanticDefaults.length ? semanticDefaults : allColumns.slice(0, 4).map(c => c.id);
    } else {
      // Use user defined but ensured id is there
      defaults = defaults.filter((id: string) => availableIds.has(id));
      if (availableIds.has('id') && !defaults.includes('id')) {
        defaults = ['id', ...defaults];
      }
      if (availableIds.has('createdAt') && !defaults.includes('createdAt')) {
        defaults = [...defaults, 'createdAt'];
      }
    }

    const uniqueDefaults = Array.from(new Set(defaults));

    let next = uniqueDefaults;
    try {
      const raw = localStorage.getItem(columnsStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((id: string) => availableIds.has(id));
          if (valid.length) next = valid;
        }
      }
    } catch {
      // no-op
    }

    if (uniqueDefaults.includes('id') && availableIds.has('id') && !next.includes('id')) {
      next = ['id', ...next];
    }

    if (!next.length) next = allColumns.slice(0, 4).map((column) => column.id);
    setVisibleColumnIds(next);
  }, [allColumns, collection?.admin?.defaultColumns, columnsStorageKey]);

  useEffect(() => {
    if (!showColumnsMenu) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!columnsMenuRef.current) return;
      if (!columnsMenuRef.current.contains(event.target as Node)) {
        setShowColumnsMenu(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showColumnsMenu]);

  useEffect(() => {
    if (!selectFilterFields.length) {
      setFieldFilters({});
      return;
    }
    const next: Record<string, string> = {};
    selectFilterFields.forEach((field: any) => {
      next[field.name] = 'all';
    });
    setFieldFilters(next);
  }, [resolvedSlug, selectFilterFields]);

  const columns = useMemo(() => {
    if (!allColumns.length) return [];
    const selected = new Set(visibleColumnIds);
    const filtered = allColumns.filter((column) => selected.has(column.id));
    return filtered.length ? filtered : allColumns.slice(0, 1);
  }, [allColumns, visibleColumnIds]);

  const toggleColumn = (columnId: string) => {
    setVisibleColumnIds((prev) => {
      let next: string[];
      if (prev.includes(columnId)) {
        next = prev.filter((id) => id !== columnId);
        if (!next.length) return prev;
      } else {
        next = [...prev, columnId];
      }
      localStorage.setItem(columnsStorageKey, JSON.stringify(next));
      return next;
    });
  };

  // Load plugin settings if the collection belongs to a plugin
  useEffect(() => {
    if (collection?.pluginSlug) {
      api.get(`${ENDPOINTS.PLUGINS.BASE}/${collection.pluginSlug}/settings`)
        .then(res => setPluginSettings(res || {}))
        .catch(err => console.error('Failed to load plugin settings:', err));
    }
  }, [collection?.pluginSlug]);

  // Simple debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = useCallback(async (targetPage = page) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('page', String(targetPage));
      queryParams.append('limit', String(pageSize));
      if (debouncedSearch) queryParams.append('search', debouncedSearch);
      if (sort) queryParams.append('sort', sort);
      if (statusFilter !== 'all') queryParams.append('status', statusFilter);
      Object.entries(fieldFilters).forEach(([key, value]) => {
        if (value && value !== 'all') queryParams.append(key, value);
      });

      const result = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}?${queryParams.toString()}`);

      if (result.docs) {
        setData(result.docs);
        setTotal(result.totalDocs);
      } else {
        setData([]);
        setTotal(0);
      }
    } catch (err) {
      console.error("Failed to fetch collection data:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, fieldFilters, page, pageSize, resolvedSlug, sort, statusFilter]);

  useEffect(() => {
    fetchData(page);
  }, [fetchData, page]);

  const handleExport = async (format: 'json' | 'csv', ids?: string[]) => {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('format', format);
      queryParams.append('token', Cookies.get('fromcode_token') || '');
      if (ids && ids.length > 0) {
        queryParams.append('ids', ids.join(','));
      }
      window.open(`${api.getBaseUrl()}${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/export?${queryParams.toString()}`, '_blank');
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        const result = await api.post(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/import`, data);
        alert(`Imported ${result.success} records successfully. ${result.errors.length} errors.`);
        window.location.reload();
      } catch (error: any) {
        alert('Import failed: ' + error.message);
      }
    };
    reader.readAsText(file);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeleteDialogState({ mode: 'bulk', ids: [...selectedIds] });
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    try {
      await api.post(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/bulk-update`, { 
        ids: selectedIds, 
        data: { status: newStatus } 
      });
      setSelectedIds([]);
      await fetchData(page);
    } catch (error) {
      alert('Error updating status');
    } finally {
      setLoading(false);
    }
  };

  if (!collection) {
    return <CollectionNotFound theme={theme as any} slug={slug} pluginSlug={pluginSlug} />;
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteDialogState({ mode: 'single', id: String(id) });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialogState) return;
    setDeleteLoading(true);
    try {
      let removedCount = 0;

      if (deleteDialogState.mode === 'single') {
        await api.delete(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/${deleteDialogState.id}`);
        removedCount = 1;
        setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== deleteDialogState.id));
        if (quickEditExpandedId === deleteDialogState.id) {
          setQuickEditExpandedId(null);
          setQuickEditStatus(null);
        }
      } else {
        const ids = deleteDialogState.ids;
        if (!ids.length) {
          setDeleteDialogState(null);
          return;
        }
        await api.post(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/bulk-delete`, { ids });
        removedCount = ids.length;
        setSelectedIds([]);
      }

      const totalAfterDelete = Math.max(total - removedCount, 0);
      const maxValidPage = Math.max(1, Math.ceil(totalAfterDelete / pageSize));
      const targetPage = Math.min(page, maxValidPage);
      if (targetPage !== page) setPage(targetPage);
      await fetchData(targetPage);
    } catch (error) {
      alert(deleteDialogState.mode === 'single' ? 'Error deleting record' : 'Error performing bulk delete');
    } finally {
      setDeleteLoading(false);
      setDeleteDialogState(null);
    }
  };

  const handleQuickEditOpen = async (row: any, event: React.MouseEvent) => {
    event.stopPropagation();
    const rowId = String(row.id);

    if (quickEditExpandedId === rowId) {
      setQuickEditExpandedId(null);
      setQuickEditStatus(null);
      return;
    }

    setQuickEditStatus(null);
    setQuickEditExpandedId(rowId);
    setQuickEditLoadingId(rowId);
    try {
      const record = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/${row.id}?locale_mode=raw`);
      setQuickEditData(record || {});
      setQuickEditInitialData(record || {});
    } catch (error: any) {
      setQuickEditStatus({ type: 'error', message: error?.message || 'Failed to load record for quick edit.' });
      setQuickEditData(row || {});
      setQuickEditInitialData(row || {});
    } finally {
      setQuickEditLoadingId(null);
    }
  };

  const handleQuickEditSave = async () => {
    if (!quickEditExpandedId) return;
    setQuickEditSavingId(quickEditExpandedId);
    setQuickEditStatus(null);
    try {
      const changedEntries = Object.entries(quickEditData).filter(([key, value]) => {
        return JSON.stringify(value) !== JSON.stringify((quickEditInitialData as any)?.[key]);
      });
      const payload = Object.fromEntries(changedEntries);

      if (!Object.keys(payload).length) {
        setQuickEditStatus({ type: 'success', message: 'No changes to save.' });
        return;
      }

      await api.put(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/${quickEditExpandedId}`, payload);
      setQuickEditStatus({ type: 'success', message: 'Record updated successfully.' });
      setQuickEditInitialData({ ...quickEditData });
      await fetchData(page);
    } catch (error: any) {
      setQuickEditStatus({ type: 'error', message: error?.message || 'Failed to save quick edits.' });
    } finally {
      setQuickEditSavingId(null);
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
      <CollectionListHeader 
        collection={collection}
        pluginSlug={pluginSlug}
        slug={slug}
        theme={theme}
      />

      <div className="flex-1 w-full px-6 lg:px-12 py-12 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <FilterBar 
            slug={slug}
            theme={theme}
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            statusOptions={statusOptions}
            setPage={setPage}
            showColumnsMenu={showColumnsMenu}
            setShowColumnsMenu={setShowColumnsMenu}
            columnsMenuRef={columnsMenuRef}
            allColumns={allColumns}
            visibleColumnIds={visibleColumnIds}
            toggleColumn={toggleColumn}
            selectFilterFields={selectFilterFields}
            fieldFilters={fieldFilters}
            setFieldFilters={setFieldFilters}
            prettifyColumnName={prettifyColumnName}
          />

          <BulkActions 
            theme={theme}
            selectedIds={selectedIds}
            statusOptions={statusOptions}
            handleBulkStatusChange={handleBulkStatusChange}
            handleExport={handleExport}
            handleBulkDelete={handleBulkDelete}
            setSelectedIds={setSelectedIds}
          />
        </div>

        <div className={`rounded-3xl border overflow-hidden shadow-2xl shadow-slate-200/40 dark:shadow-none transition-all duration-300 ${
          theme === 'dark' ? 'bg-slate-900/40 border-slate-800/50 backdrop-blur-sm' : 'bg-white border-white shadow-xl'
        }`}>
          <DataTable
            columns={columns}
            data={data || []}
            loading={loading}
            totalDocs={total}
            limit={10}
            page={page}
            onPageChange={setPage}
            onSort={setSort}
            currentSort={sort}
            onRowClick={(row) => {
              router.push(`/${pluginSlug}/${slug}/${row.id}`);
            }}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            expandedRowId={quickEditExpandedId}
            actions={(row) => {
              const getRowPreviewUrl = () => {
                if (!collection) return '#';
                return generatePreviewUrl(
                  settings?.frontend_url || '', 
                  row, 
                  collection, 
                  settings?.permalink_structure,
                  pluginSettings
                );
              };
              const canPreview = Boolean(collection && (collection.admin as any)?.preview !== false);

              return (
                <div className="flex items-center justify-end gap-2">
                  {canPreview && (
                    <a 
                      href={getRowPreviewUrl()}
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                      className={`p-2.5 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}
                    >
                      <FrameworkIcons.Eye size={16} />
                    </a>
                  )}
                  <Link 
                    href={`/${pluginSlug}/${slug}/${row.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className={`p-2.5 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}
                  >
                    <FrameworkIcons.Edit size={16} />
                  </Link>
                  <button
                    onClick={(e) => handleQuickEditOpen(row, e)}
                    className={`p-2.5 rounded-xl transition-all ${
                      quickEditExpandedId === String(row.id)
                        ? theme === 'dark'
                          ? 'bg-indigo-500/15 text-indigo-300'
                          : 'bg-indigo-50 text-indigo-600'
                        : theme === 'dark'
                          ? 'hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400'
                          : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'
                    }`}
                    title={quickEditExpandedId === String(row.id) ? 'Close quick edit' : 'Quick edit inline'}
                  >
                    <FrameworkIcons.Down
                      size={16}
                      className={`${quickEditExpandedId === String(row.id) ? 'rotate-180' : ''} transition-transform`}
                    />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(row.id, e)}
                    className={`p-2.5 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-rose-500/10 text-slate-500 hover:text-rose-400' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'}`}
                  >
                    <FrameworkIcons.Trash size={16} />
                  </button>
                </div>
              );
            }}
            renderExpandedRow={(row) => {
              const rowId = String(row.id);
              if (quickEditExpandedId !== rowId) return null;
              const isLoadingRow = quickEditLoadingId === rowId;
              const isSavingRow = quickEditSavingId === rowId;

              return (
                <CollectionQuickEditCard
                  row={row}
                  collection={collection}
                  resolvedSlug={resolvedSlug}
                  quickEditFields={quickEditFields}
                  quickEditData={quickEditData}
                  setQuickEditData={setQuickEditData}
                  quickEditStatus={quickEditStatus}
                  isLoadingRow={isLoadingRow}
                  isSavingRow={isSavingRow}
                  onSave={handleQuickEditSave}
                  onClose={() => setQuickEditExpandedId(null)}
                  theme={theme}
                  pluginSettings={pluginSettings}
                />
              );
            }}
          />
        </div>
      </div>

      <ListFooter 
        theme={theme}
        slug={slug}
        total={total}
        resolvedSlug={resolvedSlug}
        handleExport={handleExport}
        handleImport={handleImport}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteDialogState)}
        onClose={() => {
          if (deleteLoading) return;
          setDeleteDialogState(null);
        }}
        onConfirm={handleDeleteConfirm}
        isLoading={deleteLoading}
        title={
          deleteDialogState?.mode === 'bulk'
            ? `Delete ${deleteDialogState.ids.length} records`
            : 'Delete record'
        }
        description={
          deleteDialogState?.mode === 'bulk'
            ? `Are you sure you want to delete ${deleteDialogState.ids.length} selected records? This action is permanent and cannot be undone.`
            : 'Are you sure you want to delete this record? This action is permanent and cannot be undone.'
        }
        confirmLabel={deleteDialogState?.mode === 'bulk' ? 'Delete Records' : 'Delete Record'}
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  );
}
