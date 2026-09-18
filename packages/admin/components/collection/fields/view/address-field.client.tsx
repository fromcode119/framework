import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, ReactNode } from 'react';
import { Reactor, prop, bound } from '@fromcode119/react-class-components';
import { Input } from '@/components/ui/view/input.client';
import { CountryField } from '@/components/collection/fields/view/country-field.client';
import { UiFieldUtils } from '@/lib/ui';

/**
 * Generic, framework-owned postal address editor: recipient name, phone, two address lines,
 * city/region/postal code, and country (via the built-in `CountryField`). Deliberately carries no
 * delivery-type or courier awareness — that belongs to whichever plugin already owns a courier-aware
 * address editor; this field is the plain postal shape any plugin can point a `json`/`group` field at
 * via `admin.component: 'AddressField'`. Any key already on the stored value that this editor does not
 * know about round-trips untouched on every change, so a caller's extra fields survive an edit here.
 */
export class AddressField extends Reactor {
  @prop declare value?: Record<string, unknown>;
  @prop declare onChange?: (value: Record<string, unknown>) => void;
  @prop declare theme?: ThemeMode;
  @prop declare disabled?: boolean;
  @prop declare field?: any;

  private get address(): Record<string, unknown> {
    const value = this.value;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  private get readOnly(): boolean {
    return Boolean(this.field?.admin?.readOnly) || Boolean(this.disabled);
  }

  private setField(key: string, next: string): void {
    this.onChange?.({ ...this.address, [key]: next });
  }

  @bound private onRecipientNameChange(e: ChangeEvent<HTMLInputElement>): void { this.setField('recipientName', e.target.value); }
  @bound private onPhoneChange(e: ChangeEvent<HTMLInputElement>): void { this.setField('phone', e.target.value); }
  @bound private onLine1Change(e: ChangeEvent<HTMLInputElement>): void { this.setField('line1', e.target.value); }
  @bound private onLine2Change(e: ChangeEvent<HTMLInputElement>): void { this.setField('line2', e.target.value); }
  @bound private onCityChange(e: ChangeEvent<HTMLInputElement>): void { this.setField('city', e.target.value); }
  @bound private onRegionChange(e: ChangeEvent<HTMLInputElement>): void { this.setField('region', e.target.value); }
  @bound private onPostalCodeChange(e: ChangeEvent<HTMLInputElement>): void { this.setField('postalCode', e.target.value); }
  @bound private onCountryChange(next: string): void { this.setField('country', next); }

  render(): ReactNode {
    const { theme, address, readOnly } = this;
    const asText = (v: unknown): string => (typeof v === 'string' ? v : '');

    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Recipient name" value={asText(address.recipientName)} onChange={this.onRecipientNameChange} disabled={readOnly} />
        <Input label="Phone" value={asText(address.phone)} onChange={this.onPhoneChange} disabled={readOnly} />
        <Input className="md:col-span-2" label="Address line 1" value={asText(address.line1)} onChange={this.onLine1Change} disabled={readOnly} />
        <Input className="md:col-span-2" label="Address line 2" value={asText(address.line2)} onChange={this.onLine2Change} disabled={readOnly} />
        <Input label="City" value={asText(address.city)} onChange={this.onCityChange} disabled={readOnly} />
        <Input label="Region / state" value={asText(address.region)} onChange={this.onRegionChange} disabled={readOnly} />
        <Input label="Postal code" value={asText(address.postalCode)} onChange={this.onPostalCodeChange} disabled={readOnly} />
        <div className="flex w-full flex-col gap-1">
          <label className={UiFieldUtils.TEXT.LABEL}>Country</label>
          <CountryField value={asText(address.country)} onChange={this.onCountryChange} theme={theme} disabled={readOnly} />
        </div>
      </div>
    );
  }
}
