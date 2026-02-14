import React from 'react';
import { Slot, usePlugins } from '@fromcode/react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TagField } from '@/components/ui/TagField';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { CodeEditor } from '@/components/ui/CodeEditor';
import { ArrayField } from '@/components/ui/ArrayField';
import { FrameworkIcons } from '@/lib/icons';
import { MediaPicker } from '@/components/media/MediaPicker';
import { normalizeLocaleCode, isLocaleLikeKey } from '@/lib/utils';

interface CollectionField {
  name: string;
  label?: string;
  type: string;
  localized?: boolean;
  required?: boolean;
  defaultValue?: any;
  options?: { label: string; value: any }[];
  relationTo?: string;
  hasMany?: boolean;
  admin?: {
    component?: string;
    hidden?: boolean;
    position?: 'sidebar' | 'main';
    description?: string;
    sourceCollection?: string;
    sourceField?: string;
    language?: 'javascript' | 'css' | 'html' | 'json' | 'typescript';
    [key: string]: any;
  };
}

interface FieldRendererProps {
  field: CollectionField;
  value: any;
  onChange: (value: any) => void;
  theme: 'light' | 'dark';
  collectionSlug: string;
  pluginSettings?: Record<string, any>;
  disabled?: boolean;
  isNew?: boolean;
  errors?: string[];
  slugWarning?: string | null;
  slugManuallyEdited?: boolean;
}

function parseLocaleRegistry(settings: Record<string, any> | undefined) {
  const parsed: Array<{ code: string; label: string }> = [];
  const raw = settings?.localization_locales;

  const ingestItems = (items: any[]) => {
    items.forEach((item: any) => {
      const code = normalizeLocaleCode(item?.code || item?.isoCode || item?.locale);
      if (!code) return;
      if (item?.enabled === false) return;
      parsed.push({
        code,
        label: String(item?.name || code)
      });
    });
  };

  if (Array.isArray(raw)) {
    ingestItems(raw);
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const items = JSON.parse(raw);
      if (Array.isArray(items)) ingestItems(items);
    } catch {
      // no-op
    }
  } else if (raw && typeof raw === 'object') {
    const values = Object.values(raw);
    if (values.length && values.every((item) => item && typeof item === 'object')) {
      ingestItems(values as any[]);
    }
  }

  if (!parsed.length) {
    String(settings?.enabled_locales || 'en')
      .split(',')
      .map((value) => normalizeLocaleCode(value))
      .filter(Boolean)
      .forEach((code) => parsed.push({ code, label: code.toUpperCase() }));
  }

  if (!parsed.length) parsed.push({ code: 'en', label: 'English' });
  return parsed;
}

const TagFieldLocal = ({ field, value, onChange, theme, collectionSlug }: { field: any, value: any, onChange: (val: any) => void, theme: string, collectionSlug: string }) => {
  const { collections } = usePlugins();
  const sourceCollectionSlug = field.admin?.sourceCollection || field.relationTo;
  const sourceCollection = collections.find(c => c.slug === sourceCollectionSlug);
  
  const targetField = field.admin?.sourceField || 
                     sourceCollection?.admin?.useAsTitle || 
                     (sourceCollectionSlug === 'users' ? 'username' : 
                      sourceCollectionSlug === 'media' ? 'filename' : 'slug');

  // Ensure relationship values that might be raw objects or slugs are handled correctly
  const safeValue = React.useMemo(() => {
    if (!value) return field.hasMany ? [] : '';
    
    // If it's single-select and we have a string, it's already a slug/ID
    if (!field.hasMany && typeof value === 'string') return value;
    
    // If it's an object with a label, it's from the Select/TagField UI or API
    // We want the underlying ID/slug for the input/logic
    if (!field.hasMany && typeof value === 'object' && value !== null) {
      return value.value || value.slug || value.id || value;
    }

    if (field.hasMany && Array.isArray(value)) {
       return value.map(item => {
          if (typeof item === 'object' && item !== null) {
             return item.value || item.slug || item.id || item;
          }
          return item;
       });
    }

    return value;
  }, [value, field.hasMany]);

  return (
    <TagField 
      collectionSlug={collectionSlug}
      fieldName={field.name}
      value={safeValue}
      onChange={onChange}
      theme={theme}
      sourceCollection={sourceCollectionSlug}
      sourceField={targetField}
      hasMany={field.hasMany !== undefined ? field.hasMany : (field.admin?.component === 'TagField' || field.admin?.component === 'Tags')}
      allowCreate={sourceCollectionSlug !== 'users' && sourceCollectionSlug !== 'media'}
      placeholder={sourceCollectionSlug ? 'Search and select…' : undefined}
    />
  );
};

const MediaRelationField: React.FC<{ value: any; onChange: (val: any) => void; theme: string; }> = ({ value, onChange, theme }) => {
  const [open, setOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<{ url?: string; filename?: string } | null>(null);

  const handleSelect = (item: any) => {
    onChange(item?.id || item?._id || item);
    setPreview({ url: item.url, filename: item.filename });
  };

  return (
    <div className="space-y-3">
      {preview?.url ? (
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <img src={preview.url} alt={preview.filename || 'Selected media'} className="w-full h-full object-cover" />
        </div>
      ) : value ? (
        <div className={`px-3 py-2 rounded-xl text-xs font-bold ${theme === 'dark' ? 'bg-slate-900/50 text-slate-200 border border-slate-800' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
          Selected media ID: {String(value)}
        </div>
      ) : (
        <div className={`px-3 py-2 rounded-xl text-xs font-bold ${theme === 'dark' ? 'bg-slate-900/30 text-slate-500 border border-dashed border-slate-800' : 'bg-slate-50 text-slate-400 border border-dashed border-slate-200'}`}>
          No media selected
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest shadow-sm hover:shadow-md active:scale-[0.99] transition-all"
      >
        <FrameworkIcons.Image size={14} />
        Select Media
      </button>

      {open && (
        <MediaPicker
          onSelect={(item) => {
            handleSelect(item);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
};

export const FieldRenderer: React.FC<FieldRendererProps> = ({
  field,
  value,
  onChange,
  theme,
  collectionSlug,
  pluginSettings,
  disabled = false,
  isNew = false,
  errors,
  slugWarning,
  slugManuallyEdited
}) => {
  const plugins = usePlugins();
  const fieldComponents = (plugins as any).fieldComponents || {};
  const settings = (plugins as any)?.settings || {};
  const isLocalizedField = Boolean(field.localized);

  const label = field.label || field.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  const localeRegistry = React.useMemo(() => parseLocaleRegistry(settings), [settings]);
  const defaultLocale = React.useMemo(
    () => normalizeLocaleCode(settings?.default_locale || settings?.admin_default_locale || localeRegistry[0]?.code || 'en') || 'en',
    [localeRegistry, settings]
  );
  const [activeLocale, setActiveLocale] = React.useState(defaultLocale);
  const [isLocaleMenuOpen, setIsLocaleMenuOpen] = React.useState(false);
  const localeMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isLocalizedField) return;
    const exists = localeRegistry.some((item) => item.code === activeLocale);
    if (!exists) setActiveLocale(defaultLocale);
  }, [activeLocale, defaultLocale, isLocalizedField, localeRegistry]);

  React.useEffect(() => {
    if (!isLocalizedField || !isLocaleMenuOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!localeMenuRef.current) return;
      if (!localeMenuRef.current.contains(event.target as Node)) {
        setIsLocaleMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isLocalizedField, isLocaleMenuOpen]);

  const localizedMap = React.useMemo(() => {
    if (!isLocalizedField) return null;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const entries = Object.entries(value);
      if (entries.every(([key]) => isLocaleLikeKey(key))) {
        const normalized: Record<string, any> = {};
        entries.forEach(([localeKey, localeValue]) => {
          const code = normalizeLocaleCode(localeKey);
          if (code) normalized[code] = localeValue;
        });
        return normalized;
      }
    }
    return { [defaultLocale]: value };
  }, [defaultLocale, isLocalizedField, value]);

  const currentValue = isLocalizedField
    ? (localizedMap?.[activeLocale] ?? '')
    : value;

  const updateValue = (nextValue: any) => {
    if (!isLocalizedField) {
      onChange(nextValue);
      return;
    }

    const nextMap = { ...(localizedMap || {}) };
    nextMap[activeLocale] = nextValue;
    onChange(nextMap);
  };
  
  const activeLocaleMeta = localeRegistry.find((item) => item.code === activeLocale) || localeRegistry[0];

  return (
    <div className={`${field.type === 'textarea' || field.type === 'richText' || field.admin?.component === 'TagField' || field.admin?.component === 'Tags' || field.type === 'json' ? 'md:col-span-2' : ''}`}>
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <label className={`block text-[11px] font-bold pl-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          {label}
          {field.required && <span className="text-rose-500 ml-1 font-bold font-sans">*</span>}
        </label>

        {isLocalizedField && (
          <div className="relative" ref={localeMenuRef}>
            <button
              type="button"
              onClick={() => setIsLocaleMenuOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${
                theme === 'dark'
                  ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-indigo-500/60'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400'
              }`}
            >
              <FrameworkIcons.Globe size={11} />
              <span>{(activeLocaleMeta?.code || activeLocale || 'en').toUpperCase()}</span>
              <FrameworkIcons.Down size={11} className={`${isLocaleMenuOpen ? 'rotate-180' : ''} transition-transform`} />
            </button>

            {isLocaleMenuOpen && (
              <div
                className={`absolute right-0 mt-2 min-w-[220px] rounded-xl border shadow-xl z-30 p-1.5 ${
                  theme === 'dark'
                    ? 'bg-slate-950 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                {localeRegistry.map((locale) => {
                  const isActive = locale.code === activeLocale;
                  return (
                    <button
                      key={locale.code}
                      type="button"
                      onClick={() => {
                        setActiveLocale(locale.code);
                        setIsLocaleMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-between ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : theme === 'dark'
                            ? 'text-slate-200 hover:bg-slate-800'
                            : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{locale.label}</span>
                      <span className={`ml-2 ${isActive ? 'text-indigo-100' : 'opacity-70'}`}>{locale.code.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      
      {field.type === 'relationship' && field.relationTo === 'media' ? (
        <MediaRelationField value={currentValue} onChange={updateValue} theme={theme} />
      ) : field.type === 'relationship' || field.admin?.component === 'TagField' || field.admin?.component === 'Tags' ? (
        <TagFieldLocal 
          field={field} 
          value={currentValue} 
          onChange={updateValue}
          theme={theme}
          collectionSlug={collectionSlug}
        />
      ) : field.admin?.component ? (() => {
        const componentName = field.admin.component;
        const CustomComponent = fieldComponents[componentName];
        
        if (CustomComponent) {
          return (
            <CustomComponent 
              value={currentValue}
              onChange={updateValue}
              theme={theme}
              field={field}
              collectionSlug={collectionSlug}
              pluginSettings={pluginSettings}
            />
          );
        }

        return (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
             <FrameworkIcons.Alert size={12} />
             Component "{componentName}" not registered by any plugin.
          </div>
        );
      })() : (field.type === 'textarea' || field.type === 'richText') ? (
        <textarea 
          value={currentValue || ''}
          onChange={(e) => updateValue(e.target.value)}
          disabled={disabled}
          className={`w-full min-h-[160px] rounded-2xl py-3 px-4 outline-none border transition-all text-sm font-bold ${
            theme === 'dark' 
              ? 'bg-slate-900/50 border-slate-800 text-white focus:border-indigo-500/50 focus:bg-slate-900' 
              : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 focus:bg-slate-50 shadow-sm'
          } ${field.required && !currentValue ? 'border-amber-100/50' : ''}`}
          placeholder={`Enter ${label}...`}
        />
      ) : field.type === 'json' ? (
        <textarea 
          value={typeof currentValue === 'object' ? JSON.stringify(currentValue, null, 2) : currentValue || ''}
          onChange={(e) => {
            try {
              const val = JSON.parse(e.target.value);
              updateValue(val);
            } catch (err) {
              updateValue(e.target.value);
            }
          }}
          disabled={disabled}
          className={`w-full min-h-[160px] font-mono rounded-2xl py-3 px-4 outline-none border transition-all text-[12px] font-bold ${
            theme === 'dark' 
              ? 'bg-slate-900/50 border-slate-800 text-indigo-400 focus:border-indigo-500/50 focus:bg-slate-900' 
              : 'bg-white border-slate-200 text-indigo-600 focus:border-indigo-500 focus:bg-slate-50 shadow-sm'
          }`}
        />
      ) : field.type === 'array' ? (
        <ArrayField 
          field={field}
          value={currentValue}
          onChange={updateValue}
          theme={theme}
          collectionSlug={collectionSlug}
          pluginSettings={pluginSettings}
        />
      ) : field.type === 'password' || (field.name === 'password' && isNew) ? (
        <Input 
          type="password"
          value={currentValue || ''}
          onChange={(e) => updateValue(e.target.value)}
          placeholder="••••••••"
          disabled={disabled}
          className="font-bold"
        />
      ) : field.type === 'select' ? (
        <Select
          value={currentValue || field.defaultValue || ''}
          options={field.options || []}
          onChange={updateValue}
          disabled={disabled}
          theme={theme}
        />
      ) : field.type === 'boolean' ? (
        <Select
          value={currentValue?.toString() || field.defaultValue?.toString() || 'false'}
          options={[{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }]}
          onChange={(val) => updateValue(val === 'true')}
          disabled={disabled}
          theme={theme}
        />
      ) : (field.type === 'date' || field.type === 'datetime') ? (
        <DateTimePicker 
          value={currentValue}
          onChange={updateValue}
          showTime={field.type === 'datetime'}
          disabled={disabled}
        />
      ) : field.type === 'color' ? (
        <ColorPicker 
          value={currentValue}
          onChange={updateValue}
          disabled={disabled}
        />
      ) : (field.type === 'code' || field.admin?.component === 'CodeEditor') ? (
        <CodeEditor 
          value={currentValue}
          onChange={updateValue}
          language={field.admin?.language || 'javascript'}
          disabled={disabled}
        />
      ) : (
      <div className="relative">
        <Input 
          type={field.type === 'number' ? 'number' : 'text'}
          value={currentValue || ''}
          onChange={(e) => updateValue(e.target.value)}
          placeholder={`Enter ${label}...`}
          disabled={disabled}
          className={`font-bold ${field.name === 'slug' && slugWarning ? 'border-amber-400 focus:ring-amber-400/20' : ''}`}
        />
        {field.name === 'slug' && slugWarning && (
          <div className="absolute top-full left-0 mt-2 flex items-center gap-2 text-xs font-bold text-amber-500 animate-in fade-in slide-in-from-top-1 px-1">
             <FrameworkIcons.Alert size={12} />
             <span>{slugWarning}</span>
          </div>
        )}
        {field.name === 'slug' && !slugManuallyEdited && isNew && currentValue && (
           <div className="absolute top-1/2 -translate-y-1/2 right-4 flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 text-indigo-500 rounded-lg text-[10px] font-black uppercase tracking-widest animate-pulse border border-indigo-500/20 pointer-events-none">
              <FrameworkIcons.Refresh size={8} />
              Auto
           </div>
        )}
      </div>
    )}
    {field.admin?.description && (
      <p className="mt-2 text-[11px] text-slate-400 font-medium leading-relaxed ml-0.5">{field.admin.description}</p>
    )}
    {errors && errors.length > 0 && (
      <p className="mt-2 text-xs text-rose-500 font-bold">{errors[0]}</p>
    )}
  </div>
  );
};
