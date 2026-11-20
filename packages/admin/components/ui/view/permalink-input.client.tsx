import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { KeyboardEvent, ReactNode } from 'react';
import { prop, state, bound, watch } from '@fromcode119/react-class-components';
import type { ICollection } from '@fromcode119/core/client';
import { Button } from '@/components/ui/view/button.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Switch } from '@/components/ui/view/switch.client';
import { AffixInput } from '@/components/ui/view/affix-input.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { PermalinkInputUtils } from '@/components/ui/permalink-input-utils';
import type { IPermalinkComputed } from '@/components/ui/interfaces/permalink-computed.interface';
import { SiteStorefrontClient } from '@/lib/tenants/site-storefront-client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The record's public address, read as one line and changed in place. Editing writes into the form
 * like any field (the save bar saves it); Cancel puts back what the address was when editing began.
 */
export class PermalinkInput extends AdminComponent {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<PermalinkInput, 'value' | 'onChange' | 'placeholder' | 'disabled' | 'id' | 'slug' | 'collection' | 'pluginSettings'>;

  @prop declare value: string;
  @prop declare onChange: (value: string) => void;
  @prop declare placeholder?: string;
  @prop declare disabled?: boolean;
  @prop declare id?: string;
  @prop declare slug?: string;
  @prop declare collection?: ICollection;
  @prop declare pluginSettings?: Record<string, any>;

  @state private isEditing = false;
  @state private useAbsolutePath = String(this.props.value || '').startsWith('/');
  /** The bound site's own address, so the shown URL is where the page actually lives. */
  @state private siteStorefrontUrl = '';
  /** The value when editing began — what Cancel restores. */
  private valueBeforeEdit = '';

  private compute(): IPermalinkComputed {
    return PermalinkInputUtils.compute(this.props, this.runtime?.globalSettings ?? null, this.siteStorefrontUrl);
  }

  componentDidMount(): void {
    this.syncAbsoluteFromValue();
    SiteStorefrontClient.current().then((url) => { this.siteStorefrontUrl = url; });
  }

  // `@state` mutates `this.state` in place, so React's `prevState` is unreliable for detecting an
  // edge — use `@watch` (which snapshots previous values) to re-sync when the value or edit mode changes.
  @watch('value', 'isEditing')
  private syncAbsoluteFromValue(): void {
    if (this.isEditing) return;
    const isAbsoluteOverride = String(this.value || '').startsWith('/');
    if (this.useAbsolutePath !== isAbsoluteOverride) {
      this.useAbsolutePath = isAbsoluteOverride;
    }
  }

  @bound private startEditing(): void {
    if (this.disabled) return;
    this.valueBeforeEdit = String(this.value || '');
    this.isEditing = true;
  }

  @bound private finish(): void {
    this.isEditing = false;
  }

  @bound private cancel(): void {
    if (String(this.value || '') !== this.valueBeforeEdit) this.onChange(this.valueBeforeEdit);
    this.isEditing = false;
  }

  @bound private revert(): void {
    this.onChange('');
    this.isEditing = false;
  }

  @bound private handleValueChange(nextValue: string): void {
    const normalizedNext = String(nextValue || '').replace(/^\/+/, '');
    this.onChange(this.useAbsolutePath ? `/${normalizedNext}` : normalizedNext);
  }

  @bound private setAbsolute(nextAbsolute: boolean): void {
    this.useAbsolutePath = nextAbsolute;
    const normalizedCurrent = String(this.compute().pathValue || '').replace(/^\/+/, '');
    // No path yet: only the mode changes — the "…" placeholder is never saved as an address.
    if (normalizedCurrent) this.onChange(nextAbsolute ? `/${normalizedCurrent}` : normalizedCurrent);
  }

  @bound private handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') { event.preventDefault(); this.finish(); }
    if (event.key === 'Escape') this.cancel();
  }

  private renderView(computed: IPermalinkComputed): ReactNode {
    const { fullDisplayPrefix, displayValue, suffix, isCustomMode, isAbsoluteOverride } = computed;
    const address = `${fullDisplayPrefix}${displayValue}${suffix}`;
    return (
      <button type="button" className="fc-permalink" onClick={this.startEditing} disabled={this.disabled} title={address} aria-label={`${AdminI18n.t('ui.permalink.edit')}: ${address}`}>
        <span className="fc-permalink__text">
          <span className="fc-permalink__prefix">{fullDisplayPrefix}</span>
          <span className={`fc-permalink__path${isCustomMode ? ' fc-permalink__path--custom' : ''}`}>{displayValue}{suffix}</span>
        </span>
        {isCustomMode ? (
          <Badge variant={BadgeVariant.INFO}>{AdminI18n.t(isAbsoluteOverride ? 'ui.permalink.absolute' : 'ui.permalink.custom')}</Badge>
        ) : null}
        <span className="fc-permalink__edit" aria-hidden="true"><FrameworkIcons.Edit size={14} /></span>
      </button>
    );
  }

  render(): ReactNode {
    const computed = this.compute();
    if (!this.isEditing) return this.renderView(computed);

    const { baseUrl, finalPrefix, pathValue, suffix, isCustomMode } = computed;
    const prefix = this.useAbsolutePath ? '/' : finalPrefix;
    return (
      <div className="fc-permalink-edit">
        <Switch
          checked={this.useAbsolutePath}
          onChange={this.setAbsolute}
          disabled={this.disabled}
          label={AdminI18n.t('ui.permalink.absolute')}
          description={AdminI18n.t(this.useAbsolutePath ? 'ui.permalink.absoluteHint' : 'ui.permalink.relativeHint')}
        />
        <AffixInput
          autoFocus
          label={AdminI18n.t('ui.permalink.edit')}
          leading={prefix}
          value={pathValue}
          onChange={this.handleValueChange}
          onKeyDown={this.handleKeyDown}
          placeholder={this.placeholder}
          disabled={this.disabled}
        />
        <p className="fc-permalink-edit__address">{baseUrl}{prefix}{pathValue || '…'}{suffix}</p>
        <div className="fc-permalink-edit__actions">
          <Button size={FieldSize.SM} onClick={this.finish}>{AdminI18n.t('ui.permalink.save')}</Button>
          <Button size={FieldSize.SM} variant={ButtonVariant.SECONDARY} onClick={this.cancel}>{AdminI18n.t('common.cancel')}</Button>
          {isCustomMode ? (
            <Button size={FieldSize.SM} variant={ButtonVariant.GHOST} icon={<FrameworkIcons.Refresh size={14} />} onClick={this.revert} className="fc-permalink-edit__revert">
              {AdminI18n.t('ui.permalink.revert')}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }
}
