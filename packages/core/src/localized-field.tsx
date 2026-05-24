import React from 'react';
import { LocalizationUtils } from './localization';
import { PublicSettings } from './public-settings';

interface LocalizedFieldProps {
  label?: string;
  /** Render-prop receiving the currently selected locale code. */
  input: (locale: string) => React.ReactNode;
  /** Defaults to admin scope. Pass 'frontend' for storefront/theme contexts. */
  localeScope?: 'admin' | 'frontend';
  /** Settings record (typically window.Fromcode.getState().settings or similar).
   * If omitted, the component reads from window.Fromcode at render-time. */
  settings?: Record<string, unknown> | null;
  /** Display style: 'inline' (default) renders a chip button absolutely positioned
   * at top-right of the input, matching the admin UI. 'label-row' renders the
   * locale dropdown on its own row above the input. */
  variant?: 'inline' | 'label-row';
}

function mergeWithRuntimeSettings(publicSettings: Record<string, unknown> | null): Record<string, unknown> | null {
  if (typeof window === 'undefined') return publicSettings;
  const fc: any = (window as any).Fromcode;
  const runtimeSettings = (fc?.getState?.()?.settings || fc?.settings) as Record<string, unknown> | undefined;
  if (!publicSettings && !runtimeSettings) return null;
  return { ...(runtimeSettings || {}), ...(publicSettings || {}) };
}

const CHIP_BTN_STYLE: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  height: 22, padding: '0 6px', borderRadius: 6,
  background: '#fff', border: '1px solid #e2e8f0', color: '#475569',
  fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', fontFamily: 'inherit',
  cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap',
  boxShadow: '0 1px 1px rgba(15,23,42,0.04)',
};

const MENU_STYLE: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 20,
  minWidth: 200, padding: 6,
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
  boxShadow: '0 12px 32px rgba(15,23,42,0.16)',
  display: 'flex', flexDirection: 'column', gap: 2,
};

const MENU_ITEM_STYLE = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  width: '100%', padding: '7px 9px', borderRadius: 6,
  background: active ? '#4f46e5' : 'transparent',
  color: active ? '#fff' : '#334155',
  fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
  border: 'none', cursor: 'pointer', textAlign: 'left',
});

function GlobeIcon({ size = 11, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10Z" />
    </svg>
  );
}

function ChevronIcon({ open, size = 9 }: { open: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 8" fill="none" aria-hidden="true"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
      <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function LocaleSwitcher({ registry, active, onChange }: {
  registry: ReadonlyArray<{ code: string; label: string }>;
  active: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen((prev) => !prev)} style={CHIP_BTN_STYLE} title="Switch locale">
        <GlobeIcon size={11} />
        <span>{(active || 'en').toUpperCase()}</span>
        <ChevronIcon open={open} />
      </button>
      {open ? (
        <div style={MENU_STYLE} role="menu">
          {registry.map((locale) => {
            const isActive = locale.code === active;
            return (
              <button key={locale.code} type="button" role="menuitem"
                onClick={() => { onChange(locale.code); setOpen(false); }}
                style={MENU_ITEM_STYLE(isActive)}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{locale.label}</span>
                <span style={{ marginLeft: 8, opacity: isActive ? 0.95 : 0.6, fontSize: 10 }}>{locale.code.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function LocalizedFieldView({ label, input, localeScope = 'admin', settings, variant = 'inline' }: LocalizedFieldProps) {
  const publicSettings = PublicSettings.useSettings();
  const resolvedSettings = settings ?? mergeWithRuntimeSettings(publicSettings);
  const registry = React.useMemo(
    () => LocalizationUtils.parseLocaleRegistry(resolvedSettings),
    [resolvedSettings],
  );
  const defaultLocale = React.useMemo(
    () => (localeScope === 'frontend'
      ? LocalizationUtils.resolveFrontendLocale(resolvedSettings, registry)
      : LocalizationUtils.resolveAdminLocale(resolvedSettings, registry)),
    [resolvedSettings, registry, localeScope],
  );
  const [activeLocale, setActiveLocale] = React.useState(defaultLocale);

  React.useEffect(() => {
    if (!registry.length) { setActiveLocale(defaultLocale); return; }
    if (!registry.some((entry) => entry.code === activeLocale)) setActiveLocale(defaultLocale);
  }, [activeLocale, defaultLocale, registry]);

  const showSwitcher = registry.length > 1;

  if (variant === 'label-row') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(label || showSwitcher) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            {label ? <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{label}</span> : <span />}
            {showSwitcher ? (
              <LocaleSwitcher registry={registry} active={activeLocale} onChange={setActiveLocale} />
            ) : null}
          </div>
        )}
        {input(activeLocale)}
      </div>
    );
  }

  // Inline variant: chip floats over the top-right corner of the input.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label ? (
        <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{label}</span>
      ) : null}
      <div className="fc-localized-field-inline" style={{ position: 'relative' }}>
        {input(activeLocale)}
        {showSwitcher ? (
          <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 5 }}>
            <LocaleSwitcher registry={registry} active={activeLocale} onChange={setActiveLocale} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export class LocalizedField extends React.Component<LocalizedFieldProps> {
  render(): React.ReactElement { return <LocalizedFieldView {...(this.props as any)} />; }
}
