import type { ReactNode } from 'react';
import { prop, ref, bound } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';
import { HexColorPicker } from 'react-colorful';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { Input } from '@/components/ui/view/input.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { ColorPickerUtils } from '@/components/ui/color-picker-utils';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The console's one colour control: a field showing the colour and its value, opening the kit dropdown
 * with a palette, a visual picker and the value as text. Stores what is typed or picked (a hex from the
 * picker); any other colour CSS accepts is shown as it is, and an empty value reads "Not set".
 */
export class ColorField extends AdminComponent {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<ColorField, 'value' | 'onChange' | 'disabled' | 'className'> & { field?: unknown };

  private static readonly PRESETS = [
    '#0f172a', '#475569', '#64748b', '#ef4444', '#f97316', '#f59e0b',
    '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
    '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  ];
  /** Legacy values were colour-utility NAMES ("indigo", "sky"…); each is shown as the hex it stood for. */
  private static readonly NAME_HEX: Record<string, string> = {
    slate: '#64748b', gray: '#6b7280', red: '#ef4444', orange: '#f97316', amber: '#f59e0b', yellow: '#eab308',
    lime: '#84cc16', green: '#22c55e', emerald: '#10b981', teal: '#14b8a6', cyan: '#06b6d4', sky: '#0ea5e9',
    blue: '#3b82f6', indigo: '#6366f1', violet: '#8b5cf6', purple: '#a855f7', fuchsia: '#d946ef', pink: '#ec4899',
    rose: '#f43f5e',
  };

  @prop declare value?: unknown;
  @prop declare onChange: (value: string) => void;
  @prop declare disabled?: boolean;
  @prop declare className?: string;

  @ref declare private dropdown: Ref<Dropdown>;

  private raw(): string { return ColorPickerUtils.coerceColorValue(this.value); }

  /** The colour actually painted for the stored value; '' when it is not a colour. */
  private paint(raw: string): string {
    return ColorField.NAME_HEX[raw.toLowerCase()] || ColorPickerUtils.swatchColor(raw);
  }

  @bound private pick(hex: string): void { this.onChange(hex); }

  @bound private choosePreset(hex: string): void {
    this.onChange(hex);
    if (this.dropdown.current) this.dropdown.current.isOpen = false;
  }

  @bound private type(value: string): void { this.onChange(value); }

  private renderTrigger(raw: string, paint: string, disabled?: boolean): ReactNode {
    return (
      <button type="button" disabled={disabled} className="fc-field fc-color-trigger" aria-label={`${AdminI18n.t('ui.color.choose')}: ${raw || AdminI18n.t('ui.color.notSet')}`}>
        <span className={`fc-color-trigger__swatch${paint ? '' : ' fc-color-trigger__swatch--empty'}`} style={paint ? { backgroundColor: paint } : undefined} />
        <span className={raw ? 'fc-color-trigger__value' : 'fc-color-trigger__value fc-color-trigger__value--empty'}>{raw || AdminI18n.t('ui.color.notSet')}</span>
        <FrameworkIcons.ChevronDown size={15} className="fc-color-trigger__caret" />
      </button>
    );
  }

  private renderPanel(raw: string, paint: string): ReactNode {
    const hex = ColorPickerUtils.normalizeHexColor(paint).toLowerCase();
    return (
      <div className="fc-color-panel">
        <div className="fc-color-panel__presets">
          {ColorField.PRESETS.map((preset) => (
            <button key={preset} type="button" aria-label={preset} aria-pressed={hex === preset} className="fc-color-panel__preset" style={{ backgroundColor: preset }} onClick={() => this.choosePreset(preset)} />
          ))}
        </div>
        <HexColorPicker color={hex || '#000000'} onChange={this.pick} className="fc-color-panel__picker" />
        <Input value={raw} onChange={(event) => this.type(event.target.value)} aria-label={AdminI18n.t('ui.color.hex')} className="fc-color-panel__value" />
      </div>
    );
  }

  render(): ReactNode {
    const raw = this.raw();
    const paint = this.paint(raw);
    const className = `fc-color-field ${this.className ?? ''}`;
    if (this.disabled) return <div className={className}>{this.renderTrigger(raw, paint, true)}</div>;
    return (
      <div className={className}>
        <Dropdown ref={this.dropdown} block align={HorizontalAlign.LEFT} items={[]} trigger={this.renderTrigger(raw, paint)} panel={this.renderPanel(raw, paint)} />
      </div>
    );
  }
}
