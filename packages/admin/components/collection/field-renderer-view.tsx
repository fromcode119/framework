import React from 'react';
import { AdminServices } from '@/lib/admin-services';
import { FieldRendererUtils } from './field-renderer-utils';
import { FieldLocaleSwitcher } from './field-locale-switcher';
import { FieldRendererHeader } from './field-renderer-header';
import { FieldControlRenderer } from './field-control-renderer';
import { FieldRendererFooter } from './field-renderer-footer';
import type { FieldRendererViewProps, FieldRendererViewState } from './field-renderer-view.interfaces';

/**
 * Hook-free class body of {@link FieldRenderer}. The thin functional shim reads
 * `ContextHooks.usePlugins()` and passes the registry in as `plugins`; this class holds the
 * locale-menu state, the outside-click ref, and the two former `React.useEffect` blocks
 * (reproduced as componentDidMount/componentDidUpdate/componentWillUnmount with change-guards).
 */
export class FieldRendererView extends React.Component<FieldRendererViewProps, FieldRendererViewState> {
  private localeMenuRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement>;
  private outsideClickAttached = false;
  private boundOnClickOutside: (event: MouseEvent) => void;

  constructor(props: FieldRendererViewProps) {
    super(props);
    this.state = {
      activeLocale: this.computeDefaultLocale(props),
      isLocaleMenuOpen: false,
    };
    this.boundOnClickOutside = this.onClickOutside.bind(this);
    this.updateValue = this.updateValue.bind(this);
    this.requestReadOnlyOverride = this.requestReadOnlyOverride.bind(this);
    this.wrapWithReadOnlyOverride = this.wrapWithReadOnlyOverride.bind(this);
    this.localeSwitcher = this.localeSwitcher.bind(this);
  }

  private get localization() {
    return AdminServices.getInstance().localization;
  }

  private getSettings(props: FieldRendererViewProps = this.props): Record<string, any> {
    return (props.plugins as any)?.settings || {};
  }

  private computeLocaleRegistry(props: FieldRendererViewProps = this.props): Array<{ code: string; label: string }> {
    return this.localization.parseLocaleRegistry(this.getSettings(props));
  }

  private computeDefaultLocale(props: FieldRendererViewProps = this.props): string {
    return this.localization.resolveAdminLocale(this.getSettings(props), this.computeLocaleRegistry(props));
  }

  private computeIsLocalizedField(props: FieldRendererViewProps = this.props): boolean {
    return Boolean(props.field.localized);
  }

  // Effect 1: reset activeLocale to defaultLocale when the current locale is not in the registry.
  // Original deps: [activeLocale, defaultLocale, isLocalizedField, localeRegistry].
  private syncActiveLocale(): void {
    const isLocalizedField = this.computeIsLocalizedField();
    if (!isLocalizedField) return;
    const localeRegistry = this.computeLocaleRegistry();
    const exists = localeRegistry.some((item) => item.code === this.state.activeLocale);
    if (!exists) this.setState({ activeLocale: this.computeDefaultLocale() });
  }

  // Effect 2: outside-click listener, gated on [isLocalizedField, isLocaleMenuOpen].
  private syncOutsideClickListener(): void {
    const shouldListen = this.computeIsLocalizedField() && this.state.isLocaleMenuOpen;
    if (shouldListen && !this.outsideClickAttached) {
      document.addEventListener('mousedown', this.boundOnClickOutside);
      this.outsideClickAttached = true;
    } else if (!shouldListen && this.outsideClickAttached) {
      document.removeEventListener('mousedown', this.boundOnClickOutside);
      this.outsideClickAttached = false;
    }
  }

  private onClickOutside(event: MouseEvent): void {
    if (!this.localeMenuRef.current) return;
    if (!this.localeMenuRef.current.contains(event.target as Node)) {
      this.setState({ isLocaleMenuOpen: false });
    }
  }

  componentDidMount(): void {
    this.syncActiveLocale();
    this.syncOutsideClickListener();
  }

  componentDidUpdate(prevProps: FieldRendererViewProps, prevState: FieldRendererViewState): void {
    // Effect 1 re-runs when any of its deps change.
    const isLocalizedField = this.computeIsLocalizedField();
    const prevIsLocalizedField = this.computeIsLocalizedField(prevProps);
    const defaultLocale = this.computeDefaultLocale();
    const prevDefaultLocale = this.computeDefaultLocale(prevProps);
    const localeRegistry = this.computeLocaleRegistry();
    const prevLocaleRegistry = this.computeLocaleRegistry(prevProps);
    const registryChanged =
      localeRegistry.length !== prevLocaleRegistry.length ||
      localeRegistry.some((item, i) => item.code !== prevLocaleRegistry[i]?.code);
    if (
      this.state.activeLocale !== prevState.activeLocale ||
      defaultLocale !== prevDefaultLocale ||
      isLocalizedField !== prevIsLocalizedField ||
      registryChanged
    ) {
      this.syncActiveLocale();
    }

    // Effect 2 re-runs when [isLocalizedField, isLocaleMenuOpen] change.
    if (
      isLocalizedField !== prevIsLocalizedField ||
      this.state.isLocaleMenuOpen !== prevState.isLocaleMenuOpen
    ) {
      this.syncOutsideClickListener();
    }
  }

  componentWillUnmount(): void {
    if (this.outsideClickAttached) {
      document.removeEventListener('mousedown', this.boundOnClickOutside);
      this.outsideClickAttached = false;
    }
  }

  private get label(): string {
    const { field } = this.props;
    return field.label || field.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  }

  private get fieldMarkedReadOnly(): boolean {
    return Boolean(this.props.field.admin?.readOnly);
  }

  private get readOnlyOverrideDisabled(): boolean {
    const { field } = this.props;
    return (
      field.admin?.readOnlyOverride === false ||
      field.admin?.readOnlyOverride === 'never' ||
      field.admin?.allowReadOnlyOverride === false
    );
  }

  private get supportsReadOnlyOverride(): boolean {
    return this.fieldMarkedReadOnly && !this.readOnlyOverrideDisabled;
  }

  private get isFieldReadOnly(): boolean {
    const { disabled = false, readOnlyOverrideGranted = false } = this.props;
    return Boolean(disabled || (this.fieldMarkedReadOnly && !readOnlyOverrideGranted));
  }

  private get canRequestReadOnlyOverride(): boolean {
    const { disabled = false, onReadOnlyOverrideRequest } = this.props;
    return Boolean(!disabled && this.supportsReadOnlyOverride && this.isFieldReadOnly && onReadOnlyOverrideRequest);
  }

  private get componentHandlesLocalization(): boolean {
    return this.computeIsLocalizedField() && Boolean(this.props.field.admin?.handlesLocalization);
  }

  private get localizedMap(): Record<string, any> | null {
    if (!this.computeIsLocalizedField()) return null;
    return this.localization.toLocaleMap(this.props.value, this.computeDefaultLocale());
  }

  private get currentValue(): any {
    const { value } = this.props;
    if (this.componentHandlesLocalization) return value;
    if (this.computeIsLocalizedField()) return this.localizedMap?.[this.state.activeLocale] ?? '';
    return value;
  }

  private updateValue(nextValue: any): void {
    if (this.isFieldReadOnly) return;

    if (this.componentHandlesLocalization) {
      this.props.onChange(nextValue);
      return;
    }

    if (!this.computeIsLocalizedField()) {
      this.props.onChange(nextValue);
      return;
    }

    const nextMap = { ...(this.localizedMap || {}) };
    nextMap[this.state.activeLocale] = nextValue;
    this.props.onChange(nextMap);
  }

  private requestReadOnlyOverride(): void {
    const { onReadOnlyOverrideRequest, field } = this.props;
    if (!this.canRequestReadOnlyOverride || !onReadOnlyOverrideRequest) return;
    onReadOnlyOverrideRequest({ name: field.name, label: this.label });
  }

  private wrapWithReadOnlyOverride(node: React.ReactNode, roundedClass: string = 'rounded-lg'): React.ReactNode {
    if (!this.canRequestReadOnlyOverride) return node;
    return (
      <div className="relative">
        {node}
        <button
          type="button"
          onClick={this.requestReadOnlyOverride}
          className={`absolute inset-0 z-20 ${roundedClass} border border-indigo-400/50 bg-indigo-500/[0.03] hover:bg-indigo-500/[0.06] transition-colors`}
          title={`Override read-only field "${this.label}"`}
          aria-label={`Override read-only field ${this.label}`}
        />
      </div>
    );
  }

  private get shouldInlineLocaleSwitcher(): boolean {
    const { field } = this.props;
    return (
      this.computeIsLocalizedField() &&
      !this.componentHandlesLocalization &&
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
      )
    );
  }

  private localeSwitcher(compact: boolean = false): React.ReactNode {
    const { theme } = this.props;
    const localeRegistry = this.computeLocaleRegistry();
    const activeLocaleMeta = localeRegistry.find((item) => item.code === this.state.activeLocale) || localeRegistry[0];
    return (
      <FieldLocaleSwitcher
        compact={compact}
        theme={theme}
        activeLocale={this.state.activeLocale}
        activeLocaleCode={activeLocaleMeta?.code || this.state.activeLocale || 'en'}
        localeRegistry={localeRegistry}
        isOpen={this.state.isLocaleMenuOpen}
        onToggle={() => this.setState((prev) => ({ isLocaleMenuOpen: !prev.isLocaleMenuOpen }))}
        onSelect={(code) => {
          this.setState({ activeLocale: code, isLocaleMenuOpen: false });
        }}
        menuRef={this.localeMenuRef}
      />
    );
  }

  render(): React.ReactElement {
    const {
      field, theme, collectionSlug, pluginSettings, isNew = false, errors,
      slugWarning, slugManuallyEdited, readOnlyOverrideGranted = false, record, onPatch, plugins,
    } = this.props;

    const fieldComponents = (plugins as any).fieldComponents || {};
    const isLocalizedField = this.computeIsLocalizedField();
    const defaultLocale = this.computeDefaultLocale();
    const currentValue = this.currentValue;
    const label = this.label;

    const resolvedCurrentText = FieldRendererUtils.resolveRenderableText(currentValue, this.state.activeLocale || defaultLocale);
    const resolvedFieldDescription = FieldRendererUtils.resolveRenderableText(field.admin?.description, this.state.activeLocale || defaultLocale);

    return (
      <div className={FieldRendererUtils.wrapperClassName(field, this.isFieldReadOnly, theme)}>
        <FieldRendererHeader
          field={field}
          label={label}
          theme={theme}
          isFieldReadOnly={this.isFieldReadOnly}
          supportsReadOnlyOverride={this.supportsReadOnlyOverride}
          readOnlyOverrideGranted={readOnlyOverrideGranted}
          canRequestReadOnlyOverride={this.canRequestReadOnlyOverride}
          isLocalizedField={isLocalizedField}
          componentHandlesLocalization={this.componentHandlesLocalization}
          shouldInlineLocaleSwitcher={this.shouldInlineLocaleSwitcher}
          onRequestReadOnlyOverride={this.requestReadOnlyOverride}
          localeSwitcher={this.localeSwitcher}
        />

        <FieldControlRenderer
          field={field}
          currentValue={currentValue}
          resolvedCurrentText={resolvedCurrentText}
          updateValue={this.updateValue}
          wrapWithReadOnlyOverride={this.wrapWithReadOnlyOverride}
          theme={theme}
          collectionSlug={collectionSlug}
          pluginSettings={pluginSettings}
          globalSettings={this.props.globalSettings}
          fieldComponents={fieldComponents}
          isFieldReadOnly={this.isFieldReadOnly}
          isNew={isNew}
          errors={errors}
          label={label}
          slugWarning={slugWarning}
          slugManuallyEdited={slugManuallyEdited}
          isLocalizedField={isLocalizedField}
          shouldInlineLocaleSwitcher={this.shouldInlineLocaleSwitcher}
          localeSwitcher={this.localeSwitcher}
          record={record}
          onPatch={onPatch}
        />

        <FieldRendererFooter
          field={field}
          resolvedFieldDescription={resolvedFieldDescription}
          errors={errors}
        />
      </div>
    );
  }
}
