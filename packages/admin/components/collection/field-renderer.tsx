import React from 'react';
import { Slot, ContextHooks } from '@fromcode119/react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TextArea } from '@/components/ui/text-area';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { ColorPicker } from '@/components/ui/color-picker';
import { CodeEditor } from '@/components/ui/code-editor';
import { ArrayField } from '@/components/ui/array-field';
import { FrameworkIcons } from '@/lib/icons';
import { AdminServices } from '@/lib/admin-services';
import { LocaleRegistryUtils } from '@/lib/locale-utils';
import { TagFieldLocal } from './tag-field-local';
import { RelationshipSelectLocal } from './relationship-select-local';
import { MediaRelationField } from './media-relation-field';
import { CustomFieldErrorBoundary } from './custom-field-error-boundary';
import { UiFieldUtils } from '@/lib/ui';
import { FieldRendererUtils } from './field-renderer-utils';
import { PermalinkField } from '@/components/ui/permalink-field';

interface CollectionField {
  name: string;
  label?: string;
  type: string;
  localized?: boolean;
  required?: boolean;
  defaultValue?: any;
  options?: { label: string; value: any }[];
  relationTo?: string | string[];
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
  readOnlyOverrideGranted?: boolean;
  onReadOnlyOverrideRequest?: (field: { name: string; label: string }) => void;
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
  slugManuallyEdited,
  readOnlyOverrideGranted = false,
  onReadOnlyOverrideRequest
}) => {
  const plugins = ContextHooks.usePlugins();
  const fieldComponents = (plugins as any).fieldComponents || {};
  const settings = (plugins as any)?.settings || {};
  const fieldMarkedReadOnly = Boolean(field.admin?.readOnly);
  const supportsReadOnlyOverride =
    fieldMarkedReadOnly &&
    Boolean(field.admin?.readOnlyOverride === 'password' || field.admin?.allowReadOnlyOverride === true);
  const isFieldReadOnly = Boolean(disabled || (fieldMarkedReadOnly && !readOnlyOverrideGranted));
  const canRequestReadOnlyOverride = Boolean(!disabled && supportsReadOnlyOverride && isFieldReadOnly && onReadOnlyOverrideRequest);
  const isLocalizedField = Boolean(field.localized);
  const componentHandlesLocalization = isLocalizedField && Boolean(field.admin?.handlesLocalization);

  const label = field.label || field.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  const localeRegistry = React.useMemo(() => LocaleRegistryUtils.parseLocaleRegistry(settings), [settings]);
  const defaultLocale = React.useMemo(
    () => AdminServices.getInstance().localization.normalizeLocaleCode(settings?.default_locale || settings?.admin_default_locale || localeRegistry[0]?.code || 'en') || 'en',
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
    const loc = AdminServices.getInstance().localization;
    if (!isLocalizedField) return null;
    if (value && typeof value === 'object' && !Array.isArray(value) && loc.isLocaleMap(value)) {
      const entries = Object.entries(value);
      const normalized: Record<string, any> = {};
      entries.forEach(([localeKey, localeValue]) => {
        const code = loc.normalizeLocaleCode(localeKey);
        if (code) normalized[code] = localeValue;
      });
      return normalized;
    }
    if (typeof value === 'string') {
      const parsed = loc.tryParseLocaleJson(value);
      if (parsed && loc.isLocaleMap(parsed)) {
        const normalized: Record<string, any> = {};
        Object.entries(parsed).forEach(([localeKey, localeValue]) => {
          const code = loc.normalizeLocaleCode(localeKey);
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

  const requestReadOnlyOverride = React.useCallback(() => {
    if (!canRequestReadOnlyOverride || !onReadOnlyOverrideRequest) return;
    onReadOnlyOverrideRequest({ name: field.name, label });
  }, [canRequestReadOnlyOverride, field.name, label, onReadOnlyOverrideRequest]);

  const wrapWithReadOnlyOverride = (node: React.ReactNode, roundedClass: string = 'rounded-lg') => {
    if (!canRequestReadOnlyOverride) return node;
    return (
      <div className="relative">
        {node}
        <button
          type="button"
          onClick={requestReadOnlyOverride}
          className={`absolute inset-0 z-20 ${roundedClass} border border-indigo-400/50 bg-indigo-500/[0.03] hover:bg-indigo-500/[0.06] transition-colors`}
          title={`Override read-only field "${label}"`}
          aria-label={`Override read-only field ${label}`}
        />
      </div>
    );
  };
  
  const activeLocaleMeta = localeRegistry.find((item) => item.code === activeLocale) || localeRegistry[0];
  const resolvedCurrentText = React.useMemo(
    () => FieldRendererUtils.resolveRenderableText(currentValue, activeLocale || defaultLocale),
    [activeLocale, currentValue, defaultLocale]
  );
  const resolvedFieldDescription = React.useMemo(
    () => FieldRendererUtils.resolveRenderableText(field.admin?.description, activeLocale || defaultLocale),
    [activeLocale, defaultLocale, field.admin?.description]
  );
  const shouldInlineLocaleSwitcher =
    isLocalizedField &&
    !componentHandlesLocalization &&
    !(
      field.type === 'relationship' ||
      field.type === 'select' ||
      field.type === 'boolean' ||
      field.type === 'checkbox' ||
      field.type === 'array' ||
      field.type === 'date' ||
      field.type === 'datetime' ||
      field.type === 'color' ||
      field.type === 'code' ||
      field.type === 'permalink' ||
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
      (field.type === 'relationship' && field.hasMany) ||
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
        <label className={UiFieldUtils.TEXT.LABEL}>
          {label}
          {field.required && <span className="text-rose-500 ml-1 font-semibold font-sans">*</span>}
        </label>

        <div className="flex items-center gap-2">
          {!isFieldReadOnly && supportsReadOnlyOverride && readOnlyOverrideGranted && (
            <span
              className={`inline-flex items-center gap-1 h-6 px-2 rounded-lg text-[9px] font-semibold tracking-wide border ${
                theme === 'dark'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-600'
              }`}
            >
              <FrameworkIcons.Check size={10} />
              Override unlocked
            </span>
          )}
          {isFieldReadOnly && (
            <span
              title={canRequestReadOnlyOverride ? `Click field to override "${label}"` : undefined}
              className={`inline-flex items-center gap-1 rounded-lg font-semibold border ${
                canRequestReadOnlyOverride ? 'h-5 px-1.5 text-[8px] tracking-normal' : 'h-6 px-2 text-[9px] tracking-wide'
              } ${
                theme === 'dark'
                  ? 'bg-slate-900 border-slate-700 text-slate-300'
                  : 'bg-white border-slate-200 text-slate-500'
              }`}
            >
              <FrameworkIcons.Lock size={10} />
              {canRequestReadOnlyOverride ? 'Read only' : 'Read only'}
            </span>
          )}
          {isLocalizedField && !componentHandlesLocalization && !shouldInlineLocaleSwitcher && localeSwitcher(false)}
        </div>
      </div>
      
      {field.type === 'relationship' && field.relationTo === 'media' ? (
        wrapWithReadOnlyOverride(
          <MediaRelationField value={currentValue} onChange={updateValue} theme={theme} hasMany={Boolean(field.hasMany)} />
        )
      ) : field.type === 'relationship' &&
        field.admin?.component !== 'TagField' &&
        field.admin?.component !== 'Tags' &&
        !field.hasMany ? (
        wrapWithReadOnlyOverride(
          <RelationshipSelectLocal
            field={field}
            value={currentValue}
            onChange={updateValue}
            theme={theme}
          />
        )
      ) : field.type === 'relationship' || field.admin?.component === 'TagField' || field.admin?.component === 'Tags' ? (
        wrapWithReadOnlyOverride(
          <TagFieldLocal 
            field={field} 
            value={currentValue} 
            onChange={updateValue}
            theme={theme}
            collectionSlug={collectionSlug}
          />
        )
      ) : field.admin?.component && field.admin?.component !== 'ColorPicker' && field.admin?.component !== 'CodeEditor' ? (() => {
        const componentName = field.admin.component;
        const registeredComponent = fieldComponents[componentName];
        let CustomComponent: any = registeredComponent;

        if (registeredComponent && typeof registeredComponent === 'object' && !registeredComponent.$$typeof) {
          CustomComponent =
            registeredComponent.component ||
            registeredComponent.Component ||
            registeredComponent.render ||
            registeredComponent.default ||
            registeredComponent;
        }

        const canRenderComponent =
          Boolean(CustomComponent) &&
          (typeof CustomComponent === 'function' || typeof CustomComponent === 'string');

        if (canRenderComponent) {
          try {
            const customNode = React.createElement(CustomComponent, {
              value: currentValue,
              onChange: updateValue,
              theme,
              field,
              collectionSlug,
              pluginSettings,
              disabled: isFieldReadOnly,
            });

            return wrapWithReadOnlyOverride(
              <CustomFieldErrorBoundary componentName={componentName}>
                {customNode}
              </CustomFieldErrorBoundary>
            );
          } catch (error) {
            console.error(`[FieldRenderer] Failed to render custom component "${componentName}"`, error);
          }
        }

        return (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 text-xs font-medium tracking-wide flex items-center gap-2">
             <FrameworkIcons.Alert size={12} />
             Component "{componentName}" not registered by any plugin.
          </div>
        );
      })() : (field.type === 'textarea' || field.type === 'richText') ? (
        wrapWithReadOnlyOverride(
          <div className="relative">
            <TextArea 
              value={typeof currentValue === 'string' ? currentValue : resolvedCurrentText}
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
        )
      ) : field.type === 'json' ? (
        wrapWithReadOnlyOverride(
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
        )
      ) : field.type === 'array' ? (
        wrapWithReadOnlyOverride(
          <ArrayField 
            field={field}
            value={currentValue}
            onChange={updateValue}
            theme={theme}
            collectionSlug={collectionSlug}
            pluginSettings={pluginSettings}
          />
        )
      ) : field.type === 'password' || (field.name === 'password' && isNew) ? (
        wrapWithReadOnlyOverride(
          <div className="relative">
            <Input 
              type="password"
              value={typeof currentValue === 'string' ? currentValue : resolvedCurrentText}
              onChange={(e) => updateValue(e.target.value)}
              placeholder="••••••••"
              disabled={isFieldReadOnly}
              inputClassName={isLocalizedField && shouldInlineLocaleSwitcher ? 'pr-16' : ''}
            />
            {isLocalizedField && shouldInlineLocaleSwitcher && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20">{localeSwitcher(true)}</div>
            )}
          </div>
        )
      ) : field.type === 'select' ? (
        (() => {
          const options = (field.options || []).map((option: any) => ({
            label: String(option?.label ?? option?.value ?? ''),
            value: option?.value
          }));
          const isMultiSelect = Boolean(field.admin?.multiple || (field as any).multiple);

          if (!isMultiSelect) {
            return wrapWithReadOnlyOverride(
              <Select
                value={currentValue || field.defaultValue || ''}
                options={options}
                onChange={updateValue}
                disabled={isFieldReadOnly}
                theme={theme}
              />
            );
          }

          const selectedValues = Array.isArray(currentValue)
            ? currentValue.map((item: any) => String(item)).filter(Boolean)
            : (typeof currentValue === 'string'
              ? currentValue.split(',').map((item) => item.trim()).filter(Boolean)
              : []);
          const selectedSet = new Set(selectedValues);
          const optionValueToRaw = new Map(options.map((option) => [String(option.value), option.value]));
          const optionValueToLabel = new Map(options.map((option) => [String(option.value), option.label]));
          const availableOptions = options.filter((option) => !selectedSet.has(String(option.value)));

          const persistSelected = (values: string[]) => {
            const rawValues = values.map((item) => optionValueToRaw.get(item) ?? item);
            updateValue(rawValues);
          };

          return wrapWithReadOnlyOverride(
            <div className="space-y-2">
              {selectedValues.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedValues.map((selected) => (
                    <span
                      key={selected}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                        theme === 'dark'
                          ? 'bg-slate-900 border-slate-700 text-slate-200'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>{optionValueToLabel.get(selected) || selected}</span>
                      {!isFieldReadOnly && (
                        <button
                          type="button"
                          onClick={() => persistSelected(selectedValues.filter((item) => item !== selected))}
                          className="opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <FrameworkIcons.Close size={12} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}

              <Select
                value=""
                options={availableOptions}
                onChange={(value) => {
                  const selected = String(value || '').trim();
                  if (!selected || selectedSet.has(selected)) return;
                  persistSelected([...selectedValues, selected]);
                }}
                disabled={isFieldReadOnly || availableOptions.length === 0}
                placeholder={availableOptions.length ? 'Select an option...' : 'All options selected'}
                theme={theme}
              />
            </div>
          );
        })()
      ) : (field.type === 'boolean' || field.type === 'checkbox') ? (
        wrapWithReadOnlyOverride(
          <Select
            value={currentValue?.toString() || field.defaultValue?.toString() || 'false'}
            options={[{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }]}
            onChange={(val) => updateValue(val === 'true')}
            disabled={isFieldReadOnly}
            theme={theme}
          />
        )
      ) : (field.type === 'date' || field.type === 'datetime') ? (
        wrapWithReadOnlyOverride(
          <DateTimePicker 
            value={currentValue}
            onChange={updateValue}
            showTime={field.type === 'datetime'}
            disabled={isFieldReadOnly}
          />
        )
      ) : (field.type === 'color' || field.admin?.component === 'ColorPicker') ? (
        wrapWithReadOnlyOverride(
          <ColorPicker 
            value={currentValue}
            onChange={updateValue}
            disabled={isFieldReadOnly}
          />
        )
      ) : (field.type === 'code' || field.admin?.component === 'CodeEditor') ? (
        wrapWithReadOnlyOverride(
          <CodeEditor 
            value={currentValue}
            onChange={updateValue}
            language={field.admin?.language || 'javascript'}
            disabled={isFieldReadOnly}
          />
        )
      ) : field.type === 'permalink' ? (
        wrapWithReadOnlyOverride(
          <PermalinkField
            value={currentValue}
            onChange={updateValue}
            theme={theme}
            disabled={isFieldReadOnly}
          />
        )
      ) : (
      wrapWithReadOnlyOverride(
        <div className="relative">
          <Input 
            type={field.type === 'number' ? 'number' : 'text'}
            value={field.type === 'number' ? (typeof currentValue === 'number' || typeof currentValue === 'string' ? currentValue : '') : (typeof currentValue === 'string' ? currentValue : resolvedCurrentText)}
            onChange={(e) => {
              if (field.type === 'number') {
                const raw = e.target.value;
                if (raw === '') {
                  updateValue('');
                  return;
                }
                const parsed = Number(raw);
                updateValue(Number.isFinite(parsed) ? parsed : raw);
                return;
              }
              updateValue(e.target.value);
            }}
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
      )
    )}
    {resolvedFieldDescription && (
      <p className={UiFieldUtils.TEXT.SUBTEXT}>{resolvedFieldDescription}</p>
    )}
    {errors && errors.length > 0 && (
      <p className={UiFieldUtils.TEXT.ERROR}>{errors[0]}</p>
    )}
  </div>
  );
};
