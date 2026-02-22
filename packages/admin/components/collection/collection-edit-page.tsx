"use client";

import React, { useEffect, useState, use, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Slot, usePlugins } from '@fromcode/react';
import { useTheme } from '@/components/theme-context';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TagField } from '@/components/ui/tag-field';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { ColorPicker } from '@/components/ui/color-picker';
import { CodeEditor } from '@/components/ui/code-editor';
import { PermalinkInput } from '@/components/ui/permalink-input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PromptDialog } from '@/components/ui/prompt-dialog';
import { ArrayField } from '@/components/ui/array-field';
import { FieldRenderer } from '@/components/collection/field-renderer';
import { FrameworkIcons } from '@/lib/icons';
import Cookies from 'js-cookie';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { resolveCollection, generatePreviewUrl } from '@/lib/collection-utils';
import { useCollectionForm } from '@/components/collection/hooks/use-collection-form';
import { useSlugGeneration } from '@/components/collection/hooks/use-slug-generation';
import { useSlugValidation } from '@/components/collection/hooks/use-slug-validation';
import { normalizeLocaleCode, resolveLocalizedText, evaluateCondition } from '@/lib/utils';
import { RecordInfo } from '@/components/collection/record-info';
import { EditHeader } from './edit/edit-header';
import { RevisionModal } from './edit/revision-modal';
import { EditFooter } from './edit/edit-footer';
import { SidebarVersions } from './edit/sidebar-versions';

function reviveSerializedRevisionValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map((item) => reviveSerializedRevisionValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, reviveSerializedRevisionValue(nested)])
    );
  }

  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  const isStructuredJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'));

  if (!isStructuredJson) return value;

  try {
    const parsed = JSON.parse(trimmed);
    return reviveSerializedRevisionValue(parsed);
  } catch {
    return value;
  }
}

export default function CollectionEditPage({ params }: { params: Promise<{ pluginSlug: string; slug: string; id: string }> }) {
  const { pluginSlug, slug, id } = use(params);
  const router = useRouter();
  const { theme } = useTheme();
  const { collections, settings } = usePlugins();

  const frontendUrl = (settings?.frontend_url || '').replace(/\/$/, '');
  const [pluginSettings, setPluginSettings] = useState<Record<string, any>>({});
  
  const isNew = id === 'new';
  const collection = resolveCollection(collections, pluginSlug, slug);
  const resolvedSlug = collection?.slug || slug;

  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [readOnlyOverrideFields, setReadOnlyOverrideFields] = useState<Record<string, true>>({});
  const [readOnlyOverridePassword, setReadOnlyOverridePassword] = useState('');
  const [readOnlyOverrideTarget, setReadOnlyOverrideTarget] = useState<{ name: string; label: string } | null>(null);
  const [readOnlyOverridePasswordTarget, setReadOnlyOverridePasswordTarget] = useState<{ name: string; label: string } | null>(null);
  const [readOnlyOverrideVerifying, setReadOnlyOverrideVerifying] = useState(false);

  const getReadOnlyOverrideSubmitMetadata = useCallback(() => {
    const fields = Object.keys(readOnlyOverrideFields || {}).filter(Boolean);
    if (!fields.length || !readOnlyOverridePassword) return {};
    return {
      _readOnlyOverride: {
        fields,
        password: readOnlyOverridePassword
      }
    };
  }, [readOnlyOverrideFields, readOnlyOverridePassword]);
  
  const {
    formData,
    setFormData,
    setFieldValue,
    handleSubmit,
    isSubmitting: saving,
  } = useCollectionForm({
    collectionSlug: resolvedSlug,
    isNew,
    onSuccess: (result) => {
      setReadOnlyOverrideFields({});
      setReadOnlyOverridePassword('');
      setStatus({ type: 'success', message: `Entry ${isNew ? 'created' : 'updated'} successfully` });
      if (!isNew) fetchRevisions(1);
      if (isNew) router.push(`/${pluginSlug}/${slug}/${result.id}`);
    },
    onError: (err) => setStatus({ type: 'error', message: err.message || 'Operation failed' }),
    getSubmitMetadata: getReadOnlyOverrideSubmitMetadata
  });

  const formDataRef = React.useRef(formData);
  formDataRef.current = formData;

  const sourceField = collection?.admin?.useAsTitle || (collection?.fields.find(f => f.name === 'name' || f.name === 'title')?.name);
  const preferredLocale = normalizeLocaleCode(
    Cookies.get('fc_locale')
      || formData?.locale
      || settings?.default_locale
      || settings?.defaultLocale
      || settings?.system_default_locale
      || ''
  );
  const resolvedTitleValue = (collection?.admin?.useAsTitle
    ? resolveLocalizedText(formData[collection.admin.useAsTitle], preferredLocale)
    : '')
    || resolveLocalizedText(formData.title, preferredLocale)
    || resolveLocalizedText(formData.name, preferredLocale);
  
  const onSlugGenerate = useCallback((newSlugValue: string) => {
    setFieldValue('slug', newSlugValue);
    if (!formDataRef.current.customPermalink || formDataRef.current.customPermalink === formDataRef.current.slug) {
      setFieldValue('customPermalink', newSlugValue);
    }
  }, [setFieldValue]);

  const { manuallyEdited: slugManuallyEdited, setManuallyEdited: setSlugManuallyEdited } = useSlugGeneration({
    sourceValue: sourceField ? resolveLocalizedText(formData[sourceField], preferredLocale) : '',
    isNew,
    manuallyEdited: false,
    onSlugGenerate
  });

  const { warning: slugWarning } = useSlugValidation({
    slug: formData.slug,
    collectionSlug: resolvedSlug,
    currentId: id,
    isNew
  });

  const [activeTab, setActiveTab] = useState(collection?.admin?.tabs?.[0]?.name || 'general');

  const [selectedRevision, setSelectedRevision] = useState<any | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<number | null>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [hasMoreRevisions, setHasMoreRevisions] = useState(false);
  const [revisionPage, setRevisionPage] = useState(1);
  const [showOnlyChanges, setShowOnlyChanges] = useState(true);
  const [restoringPermanently, setRestoringPermanently] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');

  // Keyboard shortcut for saving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSubmit(new Event('submit') as any, changeSummary);
        setChangeSummary('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData, saving, changeSummary]);

  const currentRevIndex = selectedRevision ? revisions.findIndex(r => r.id === selectedRevision.id) : -1;

  async function fetchRevisions(page: number) {
    setRevisionsLoading(true);
    try {
      // Use the new dedicated versioning API
      const result = await api.get(`${ENDPOINTS.VERSIONS.BASE}/${resolvedSlug}/${id}?limit=20&page=${page}`);
      
      const mapped = (result.docs || []).map((v: any) => ({
        id: v.id,
        version: v.version || 1,
        date: new Date(v.created_at || v.createdAt),
        user: v.updated_by || v.updatedBy || 'System',
        action: v.change_summary || 'Update',
        changes: reviveSerializedRevisionValue(v.version_data || {})
      }));

      if (page === 1) {
        setRevisions(mapped);
      } else {
        setRevisions(prev => [...prev, ...mapped]);
      }
      
      setHasMoreRevisions(result.hasNextPage || (result.docs?.length === 10));
    } catch (err) {
      console.error("Failed to fetch revisions:", err);
    } finally {
      setRevisionsLoading(false);
    }
  }

  const loadMoreRevisions = () => {
    const nextPage = revisionPage + 1;
    setRevisionPage(nextPage);
    fetchRevisions(nextPage);
  };

  const handleHardRestore = async (version: number) => {
    if (!confirm(`Are you sure you want to PERMANENTLY restore the live record to version ${version}? This will update the database immediately.`)) return;
    
    setRestoringPermanently(true);
    try {
      const response = await api.post(ENDPOINTS.VERSIONS.RESTORE(resolvedSlug, id, version), {});
      setFormData(response.data);
      setStatus({ type: 'success', message: `Record permanently restored to version ${version}` });
      setSelectedRevision(null);
      fetchRevisions(1);
    } catch (err: any) {
      console.error("Hard restore failed:", err);
      setStatus({ type: 'error', message: err.message || 'Failed to restore record' });
    } finally {
      setRestoringPermanently(false);
    }
  };

  const getPreviewUrl = () => {
    if (!collection) return '#';
    return generatePreviewUrl(
      settings?.frontend_url || '', 
      formData, 
      collection, 
      settings?.permalink_structure,
      pluginSettings
    );
  };

  useEffect(() => {
    if (isNew || !collection) return;

    async function fetchData() {
      try {
        const entryData = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/${id}?locale_mode=raw`);

        setFormData(entryData);
        if (entryData.slug) setSlugManuallyEdited(true);

        // Fetch revisions with pagination
        fetchRevisions(1);

      } catch (err: any) {
        console.error("Failed to fetch entry:", err);
        setStatus({ type: 'error', message: 'Failed to load entry' });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [resolvedSlug, id, isNew, collection]);

  useEffect(() => {
    setReadOnlyOverrideFields({});
    setReadOnlyOverridePassword('');
    setReadOnlyOverrideTarget(null);
    setReadOnlyOverridePasswordTarget(null);
  }, [id, isNew, resolvedSlug]);

  // Load plugin settings if the collection belongs to a plugin
  useEffect(() => {
    if (collection?.pluginSlug) {
      api.get(`${ENDPOINTS.PLUGINS.BASE}/${collection.pluginSlug}/settings`)
        .then(res => {
          const normalized = res?.settings?.settings ?? res?.settings ?? res ?? {};
          setPluginSettings(normalized);
        })
        .catch(err => console.error('Failed to load plugin settings:', err));
    }
  }, [collection?.pluginSlug]);

  if (!collection) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in zoom-in-95 duration-700">
        <div className={`p-8 rounded-[40px] mb-8 relative group ${theme === 'dark' ? 'bg-slate-900 shadow-2xl shadow-black/50' : 'bg-white shadow-2xl shadow-slate-200'}`}>
           <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
           <FrameworkIcons.Search size={64} className="text-indigo-500 relative z-10" strokeWidth={1} />
        </div>
        
        <h2 className={`text-4xl font-bold tracking-tighter uppercase mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          Collection Not Found
        </h2>
        
        <p className="text-slate-500 font-bold text-center max-w-sm leading-relaxed mb-10 px-6">
          The collection <span className="text-indigo-500">"{slug}"</span> doesn't seem to be part of the <span className="text-indigo-500 uppercase tracking-wide text-[10px] ml-1">{pluginSlug}</span> plugin marketplace.
        </p>

        <div className="flex items-center gap-4">
          <Button 
            variant="ghost"
            onClick={() => window.history.back()}
            className="rounded-2xl px-8 font-bold uppercase tracking-wide text-[10px] text-slate-400"
          >
            Go Back
          </Button>
          <Button 
            variant="primary"
            as={Link}
            href="/"
            className="rounded-2xl px-10 py-5 font-bold uppercase tracking-wide text-[10px] shadow-2xl shadow-indigo-500/30"
            icon={<FrameworkIcons.Layout size={18} />}
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const handleInputChange = (name: string, value: any) => {
    // If the value actually changed, clear active version highlight
    if (formData[name] !== value) {
      setActiveVersionId(null);
    }

    if (name === 'slug') setSlugManuallyEdited(true);
    setFieldValue(name, value);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/${id}`);
      router.push(`/${pluginSlug}/${slug}`);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleReadOnlyOverrideRequest = (target: { name: string; label: string }) => {
    setReadOnlyOverrideTarget(target);
  };

  const openReadOnlyOverridePasswordPrompt = () => {
    if (!readOnlyOverrideTarget) return;
    setReadOnlyOverridePasswordTarget(readOnlyOverrideTarget);
    setReadOnlyOverrideTarget(null);
  };

  const handleReadOnlyOverridePasswordConfirm = async (password: string) => {
    if (!readOnlyOverridePasswordTarget) return;
    setReadOnlyOverrideVerifying(true);
    try {
      await api.post(ENDPOINTS.AUTH.VERIFY_PASSWORD, {
        password,
        purpose: 'read_only_override',
        collectionSlug: resolvedSlug,
        field: readOnlyOverridePasswordTarget.name,
        recordId: isNew ? null : id
      });

      setReadOnlyOverridePassword(password);
      setReadOnlyOverrideFields((prev) => ({
        ...prev,
        [readOnlyOverridePasswordTarget.name]: true
      }));
      setStatus({
        type: 'success',
        message: `${readOnlyOverridePasswordTarget.label} unlocked for manual override.`
      });
      setReadOnlyOverridePasswordTarget(null);
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.message || 'Password verification failed' });
    } finally {
      setReadOnlyOverrideVerifying(false);
    }
  };

  const hasSlug = collection?.fields.some(f => f.name === 'slug');
  const showPreview = (collection?.admin as any)?.preview !== false && !isNew;
  const showPermalink = (collection?.admin as any)?.preview !== false && hasSlug;
  const isFullWidth = (collection?.admin as any)?.fullWidth === true;
  const hasSidebarFields = collection?.fields.some(f => f.admin?.position === 'sidebar' && !f.admin?.hidden) || false;
  const renderSidebar = !isFullWidth;
  const hasBuiltInSidebarContent = showPermalink || hasSidebarFields || !isNew;
  const statusField = collection?.fields.find((field: any) => field?.name === 'status' && field?.type === 'select') as any;
  const statusOptions = Array.isArray(statusField?.options)
    ? statusField.options
        .map((option: any) => ({
          label: String(option?.label || option?.value || '').trim(),
          value: String(option?.value || '').trim()
        }))
        .filter((option: any) => option.value)
    : [];
  const currentStatusValue = String(formData?.status || '').trim();

  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
      <EditHeader 
        collection={collection}
        pluginSlug={pluginSlug}
        slug={slug}
        id={id}
        isNew={isNew}
        theme={theme}
        resolvedTitleValue={resolvedTitleValue}
        changeSummary={changeSummary}
        setChangeSummary={setChangeSummary}
        formData={formData}
        getPreviewUrl={getPreviewUrl}
        showPreview={showPreview}
        statusOptions={statusOptions}
        currentStatusValue={currentStatusValue}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        saving={saving}
        setShowDeleteConfirm={setShowDeleteConfirm}
      />

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 lg:px-8 py-12">
        <div className="max-w-7xl mx-auto">
          {status && (
            <div className={`mb-8 p-4 rounded-2xl flex items-start gap-4 border animate-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
              <div className={`p-2 rounded-xl ${status.type === 'success' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'}`}>
                {status.type === 'success' ? <FrameworkIcons.Check size={20} /> : <FrameworkIcons.Alert size={20} />}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{status.type === 'success' ? 'Success' : 'Error'}</p>
                <p className="text-sm opacity-90">{status.message}</p>
              </div>
              <button onClick={() => setStatus(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <FrameworkIcons.Close size={18} />
              </button>
            </div>
          )}

          <Slot name={`admin.collection.${slug}.edit.top`} props={{ formData, setFormData, isNew }} />

          {collection.admin?.tabs && collection.admin.tabs.length > 0 && (
            <div className={`flex items-center gap-2 mb-8 p-1.5 rounded-2xl w-fit ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
              {collection.admin.tabs.map((tab: any) => (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name)}
                  className={`px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${
                    activeTab === tab.name 
                      ? (theme === 'dark' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white text-indigo-600 shadow-sm') 
                      : (theme === 'dark' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className={`grid grid-cols-1 ${renderSidebar ? 'lg:grid-cols-3' : ''} gap-8 pb-32`}>
            <div className={`${renderSidebar ? 'lg:col-span-2' : 'lg:col-span-1'} space-y-6`}>
              <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
                  {collection.fields
                    .filter(f => {
                      if (f.admin?.hidden || f.admin?.position === 'sidebar') return false;
                      if (!evaluateCondition(f.admin?.condition, formData, f.name)) return false;
                      
                      // Tab filtering
                      if (collection.admin?.tabs && collection.admin.tabs.length > 0) {
                         const fieldTab = f.admin?.tab || collection.admin.tabs[0].name;
                         return fieldTab === activeTab;
                      }
                      
                      return true;
                    })
                    .map((field) => (
                      <FieldRenderer 
                        key={field.name}
                        field={field}
                        value={formData[field.name]}
                        onChange={(val) => handleInputChange(field.name, val)}
                        theme={theme}
                        collectionSlug={resolvedSlug}
                        pluginSettings={pluginSettings}
                        disabled={saving}
                        isNew={isNew}
                        slugWarning={field.name === 'slug' ? slugWarning : undefined}
                        slugManuallyEdited={field.name === 'slug' ? slugManuallyEdited : undefined}
                        readOnlyOverrideGranted={Boolean(readOnlyOverrideFields[field.name])}
                        onReadOnlyOverrideRequest={handleReadOnlyOverrideRequest}
                      />
                    ))}
                </div>
              </Card>
            </div>

            {renderSidebar && (
              <div className="space-y-6">
                <Slot name={`admin.collection.${slug}.edit.sidebar`} props={{ formData, setFormData, isNew }} />
                <Slot name="admin.collection.edit.sidebar" props={{ formData, setFormData, isNew }} />
                
                {showPermalink && (
                  <Card title="Preview & Permalink">
                    <PermalinkInput
                        value={formData.customPermalink}
                        onChange={(val) => handleInputChange('customPermalink', val)}
                        disabled={saving}
                        id={isNew ? undefined : id}
                        slug={formData.slug}
                        collection={collection}
                        pluginSettings={pluginSettings}
                      />
                      <p className="mt-3 text-[11px] text-slate-400 font-medium leading-relaxed">
                        Click the path component to override the automatically generated slug.
                      </p>
                  </Card>
                )}

                {hasSidebarFields && (
                  <Card title="Settings">
                    <div className="space-y-6">
                      {collection.fields
                        .filter(f => f.admin?.position === 'sidebar' && !f.admin?.hidden && f.name !== 'customPermalink' && evaluateCondition(f.admin?.condition, formData, f.name))
                        .map((field) => (
                          <FieldRenderer 
                            key={field.name}
                            field={field}
                            value={formData[field.name]}
                            onChange={(val) => handleInputChange(field.name, val)}
                            theme={theme}
                            collectionSlug={resolvedSlug}
                            pluginSettings={pluginSettings}
                            disabled={saving}
                            isNew={isNew}
                            readOnlyOverrideGranted={Boolean(readOnlyOverrideFields[field.name])}
                            onReadOnlyOverrideRequest={handleReadOnlyOverrideRequest}
                          />
                        ))}
                    </div>
                  </Card>
                )}

                {!isNew && (
                  <RecordInfo 
                    id={id}
                    createdAt={formData.createdAt}
                    updatedAt={formData.updatedAt}
                  />
                )}

                {!isNew && (
                  <SidebarVersions 
                    revisions={revisions}
                    revisionsLoading={revisionsLoading}
                    activeVersionId={activeVersionId}
                    setSelectedRevision={setSelectedRevision}
                    setFormData={setFormData}
                    setActiveVersionId={setActiveVersionId}
                    loadMoreRevisions={loadMoreRevisions}
                    hasMoreRevisions={hasMoreRevisions}
                    formData={formData}
                  />
                )}

                {!hasBuiltInSidebarContent && (
                  <Card title="Settings">
                    <p className="text-sm text-slate-500 leading-relaxed">
                      No sidebar fields are configured for this collection yet.
                    </p>
                  </Card>
                )}
              </div>
            )}
          </div>
          
          <Slot name={`admin.collection.${slug}.edit.bottom`} props={{ formData, setFormData, isNew }} />
        </div>
      </div>

      <RevisionModal 
        selectedRevision={selectedRevision}
        setSelectedRevision={setSelectedRevision}
        showOnlyChanges={showOnlyChanges}
        setShowOnlyChanges={setShowOnlyChanges}
        formData={formData}
        setFormData={setFormData}
        theme={theme}
        currentRevIndex={currentRevIndex}
        revisions={revisions}
        restoringPermanently={restoringPermanently}
        handleHardRestore={handleHardRestore}
        setActiveVersionId={setActiveVersionId}
        setStatus={setStatus}
      />

      <EditFooter 
        collection={collection}
        theme={theme}
        isNew={isNew}
        discardHref={`/${pluginSlug}/${slug}`}
        handleSubmit={handleSubmit}
        changeSummary={changeSummary}
        setChangeSummary={setChangeSummary}
        saving={saving}
      />

      <ConfirmDialog 
        isOpen={Boolean(readOnlyOverrideTarget)}
        onClose={() => setReadOnlyOverrideTarget(null)}
        onConfirm={openReadOnlyOverridePasswordPrompt}
        title="Override Generated Value?"
        description={`"${readOnlyOverrideTarget?.label || 'This field'}" is read-only because it is generated automatically. Continue to unlock manual override?`}
        confirmLabel="Continue"
        cancelLabel="Cancel"
        variant="primary"
      />

      <PromptDialog
        isOpen={Boolean(readOnlyOverridePasswordTarget)}
        onClose={() => setReadOnlyOverridePasswordTarget(null)}
        onConfirm={handleReadOnlyOverridePasswordConfirm}
        isLoading={readOnlyOverrideVerifying}
        title="Confirm With Password"
        description={`Enter your account password to unlock "${readOnlyOverridePasswordTarget?.label || 'this field'}".`}
        placeholder="Current password"
        confirmLabel="Unlock Field"
        cancelLabel="Cancel"
        inputType="password"
      />

      <ConfirmDialog 
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        isLoading={deleting}
        title="Delete Record"
        description="Are you sure you want to delete this record? This action is permanent and cannot be undone."
        confirmLabel="Delete Permanently"
      />
    </div>
  );
}
