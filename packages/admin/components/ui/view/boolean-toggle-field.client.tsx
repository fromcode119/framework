import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Switch } from '@/components/ui/view/switch.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Standard presentation for a boolean collection field: a full-width bordered row that fills its
 * grid cell (so the toggle never floats lonely under its label), showing the current Yes/No state
 * on the left and the {@link Switch} on the right. Used by both the top-level FieldRenderer and the
 * ArrayField sub-field renderer so every boolean looks identical and intentional.
 */
export class BooleanToggleField extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<BooleanToggleField, 'checked' | 'onChange' | 'disabled' | 'theme'>;

  @prop declare checked: boolean;
  @prop declare onChange: (checked: boolean) => void;
  @prop declare disabled?: boolean;
  @prop declare theme?: ThemeMode;

  render(): ReactNode {
    const { checked, onChange, disabled } = this;
    return (
      <div
        className={`flex h-[var(--fc-field-h)] w-full items-center justify-between gap-3 rounded-lg border px-3 transition-colors ${
          'fc-tone-line fc-tone-surface'
        } ${disabled ? 'opacity-70' : ''}`}
      >
        <span className={`text-xs font-medium ${checked ? 'fc-tone-brand' : 'fc-tone-muted'}`}>
          {AdminI18n.t(checked ? 'common.yes' : 'common.no')}
        </span>
        <Switch checked={checked} onChange={onChange} disabled={disabled} />
      </div>
    );
  }
}
