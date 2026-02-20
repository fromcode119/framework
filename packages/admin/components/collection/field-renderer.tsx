import React from 'react';
import { Slot, usePlugins } from '@fromcode/react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TextArea } from '@/components/ui/text-area';
import { TagField } from '@/components/ui/tag-field';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { ColorPicker } from '@/components/ui/color-picker';
import { CodeEditor } from '@/components/ui/code-editor';
import { ArrayField } from '@/components/ui/array-field';
import { FrameworkIcons } from '@/lib/icons';
import { normalizeLocaleCode, isLocaleLikeKey } from '@/lib/utils';
import { parseLocaleRegistry } from '@/lib/locale-utils';
import { TagFieldLocal } from './tag-field-local';
import { MediaRelationField } from './media-relation-field';
import { UI_TEXT } from '@/lib/ui';

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
    handlesLocalization?: boolean;
    readOnly?: boolean;
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
  const isFieldReadOnly = Boolean(disabled || field.admin?.readOnly);
  const isLocalizedField = Boolean(field.localized);
  const componentHandlesLocalization = isLocalizedField && Boolean(field.admin?.handlesLocalization);

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

  const currentValue = componentHandlesLocalization
    ? value
    : isLocalizedField
      ? (localizedMap?.[activeLocale] ?? '')
      : value;

  const updateValue = (nextValue: any) => {
    if (isFieldReadOnly) return;

    if (componentHandlesLocalization) {
      onChange(nextValue);
      return;
    }

    if (!isLocalizedField) {
      onChange(nextValue);
      return;
    }

    const nextMap = { ...(localizedMap || {}) };
    nextMap[activeLocale] = nextValue;
    onChange(nextMap);
  };
  
  const activeLocaleMeta = localeRegistry.find((item) => item.code === activeLocale) || localeRegistry[0];
  const shouldInlineLocaleSwitcher =
    isLocalizedField &&
    !componentHandlesLocalization &&
    !(
      field.type === 'relationship' ||
      field.type === 'select' ||
      field.type === 'boolean' ||
      field.type === 'array' ||
      field.type === 'date' ||
      field.type === 'datetime' ||
      field.type === 'color' ||
      field.type === 'code' ||
      Boolean(field.admin?.component)
    );

  const localeSwitcher = (compact: boolean = false) => (
    <div className="relative" ref={localeMenuRef}>
      <button
        type="button"
        onClick={() => setIsLocaleMenuOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 rounded-lg border font-semibold tracking-wide transition-all ${
          compact ? 'h-7 px-2 text-[10px]' : 'px-2.5 py-1 text-[10px]'
        } ${
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
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
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
  );

  return (
    <div className={`w-full ${
      field.type === 'textarea' || 
      field.type === 'richText' || 
      field.type === 'array' ||
      field.type === 'json' ||
      field.admin?.width === 'full' ||
      field.admin?.component === 'TagField' || 
      field.admin?.component === 'Tags' 
        ? 'col-span-full' : ''
    } ${
      isFieldReadOnly
        ? theme === 'dark'
          ? 'rounded-xl border border-slate-800/80 bg-slate-900/20 p-2.5'
          : 'rounded-xl border border-slate-200 bg-slate-50/70 p-2.5'
        : ''
    }`}>
      <div className="flex items-center justify-between gap-3 mb-1 min-h-[22px]">
        <label className={UI_TEXT.LABEL}>
          {label}
          {field.required && <span className="text-rose-500 ml-1 font-semibold font-sans">*</span>}
        </label>

        <div className="flex items-center gap-2">
          {isFieldReadOnly && (
            <span
              className={`inline-flex items-center gap-1 h-6 px-2 rounded-lg text-[9px] font-semibold tracking-wide border ${
                theme === 'dark'
                  ? 'bg-slate-900 border-slate-700 text-slate-300'
                  : 'bg-white border-slate-200 text-slate-500'
              }`}
            >
              <FrameworkIcons.Lock size={10} />
              Read only
            </span>
          )}
          {isLocalizedField && !componentHandlesLocalization && !shouldInlineLocaleSwitcher && localeSwitcher(false)}
        </div>
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
      ) : field.admin?.component && field.admin?.component !== 'ColorPicker' && field.admin?.component !== 'CodeEditor' ? (() => {
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
              disabled={isFieldReadOnly}
            />
          );
        }

        return (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 text-xs font-medium tracking-wide flex items-center gap-2">
             <FrameworkIcons.Alert size={12} />
             Component "{componentName}" not registered by any plugin.
          </div>
        );
      })() : (field.type === 'textarea' || field.type === 'richText') ? (
        <div className="relative">
          <TextArea 
            value={currentValue || ''}
            onChange={(e) => updateValue(e.target.value)}
            disabled={isFieldReadOnly}
            placeholder={`Enter ${label}...`}
            error={errors?.[0]}
            inputClassName={isLocalizedField && shouldInlineLocaleSwitcher ? 'pr-16' : ''}
          />
          {isLocalizedField && shouldInlineLocaleSwitcher && (
            <div className="absolute right-2 top-2 z-20">{localeSwitcher(true)}</div>
          )}
        </div>
      ) : field.type === 'json' ? (
        <div className="relative">
          <TextArea 
            value={typeof currentValue === 'object' ? JSON.stringify(currentValue, null, 2) : currentValue || ''}
            onChange={(e) => {
              try {
                const val = JSON.parse(e.target.value);
                updateValue(val);
              } catch (err) {
                updateValue(e.target.value);
              }
            }}
            disabled={isFieldReadOnly}
            inputClassName={`font-mono text-[12px] ${isLocalizedField && shouldInlineLocaleSwitcher ? 'pr-16' : ''}`}
          />
          {isLocalizedField && shouldInlineLocaleSwitcher && (
            <div className="absolute right-2 top-2 z-20">{localeSwitcher(true)}</div>
          )}
        </div>
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
        <div className="relative">
          <Input 
            type="password"
            value={currentValue || ''}
            onChange={(e) => updateValue(e.target.value)}
            placeholder="••••••••"
            disabled={isFieldReadOnly}
            inputClassName={isLocalizedField && shouldInlineLocaleSwitcher ? 'pr-16' : ''}
          />
          {isLocalizedField && shouldInlineLocaleSwitcher && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20">{localeSwitcher(true)}</div>
          )}
        </div>
      ) : field.type === 'select' ? (
        <Select
          value={currentValue || field.defaultValue || ''}
          options={field.options || []}
          onChange={updateValue}
          disabled={isFieldReadOnly}
          theme={theme}
        />
      ) : field.type === 'boolean' ? (
        <Select
          value={currentValue?.toString() || field.defaultValue?.toString() || 'false'}
          options={[{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }]}
          onChange={(val) => updateValue(val === 'true')}
          disabled={isFieldReadOnly}
          theme={theme}
        />
      ) : (field.type === 'date' || field.type === 'datetime') ? (
        <DateTimePicker 
          value={currentValue}
          onChange={updateValue}
          showTime={field.type === 'datetime'}
          disabled={isFieldReadOnly}
        />
      ) : (field.type === 'color' || field.admin?.component === 'ColorPicker') ? (
        <ColorPicker 
          value={currentValue}
          onChange={updateValue}
          disabled={isFieldReadOnly}
        />
      ) : (field.type === 'code' || field.admin?.component === 'CodeEditor') ? (
        <CodeEditor 
          value={currentValue}
          onChange={updateValue}
          language={field.admin?.language || 'javascript'}
          disabled={isFieldReadOnly}
        />
      ) : (
      <div className="relative">
        <Input 
          type={field.type === 'number' ? 'number' : 'text'}
          value={currentValue || ''}
          onChange={(e) => updateValue(e.target.value)}
          placeholder={`Enter ${label}...`}
          disabled={isFieldReadOnly}
          inputClassName={`${field.name === 'slug' && slugWarning ? 'border-amber-400 focus:ring-amber-400/20 ' : ''}${isLocalizedField && shouldInlineLocaleSwitcher ? 'pr-16' : ''}`}
        />
        {isLocalizedField && shouldInlineLocaleSwitcher && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20">{localeSwitcher(true)}</div>
        )}
        {field.name === 'slug' && slugWarning && (
          <div className="absolute top-full left-0 mt-2 flex items-center gap-2 text-xs font-medium text-amber-500 animate-in fade-in slide-in-from-top-1 px-1">
             <FrameworkIcons.Alert size={12} />
             <span>{slugWarning}</span>
          </div>
        )}
        {field.name === 'slug' && !slugManuallyEdited && isNew && currentValue && (
           <div className="absolute top-1/2 -translate-y-1/2 right-4 flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 text-indigo-500 rounded-md text-[10px] font-semibold tracking-wide animate-pulse border border-indigo-500/20 pointer-events-none">
              <FrameworkIcons.Refresh size={8} />
              Auto
           </div>
        )}
      </div>
    )}
    {field.admin?.description && (
      <p className={UI_TEXT.SUBTEXT}>{field.admin.description}</p>
    )}
    {errors && errors.length > 0 && (
      <p className={UI_TEXT.ERROR}>{errors[0]}</p>
    )}
  </div>
  );
};
