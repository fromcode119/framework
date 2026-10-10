import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Switch } from '@/components/ui/view/switch.client';

/**
 * A yes/no field as one line: its label and description on the left and a toggle on the right — the way
 * settings screens present a setting ("Free shipping", "Show reviews").
 *
 * It replaced a label above a bordered box that printed "Yes"/"No" next to the switch: three elements and
 * two lines of height for one decision, and the state written out in words the switch already showed.
 * The label is clickable too.
 */
export class FieldBooleanRow extends PureReactor {
  declare props: Pick<FieldBooleanRow, 'label' | 'description' | 'checked' | 'onChange' | 'disabled' | 'required'>;

  @prop declare label: ReactNode;
  @prop declare description?: string;
  @prop declare checked: boolean;
  @prop declare onChange: (checked: boolean) => void;
  @prop declare disabled?: boolean;
  @prop declare required?: boolean;

  @bound private toggle(): void {
    if (!this.disabled) this.onChange(!this.checked);
  }

  render(): ReactNode {
    return (
      <div className="flex items-center justify-between gap-4 py-0.5">
        <div className="min-w-0">
          <span
            onClick={this.toggle}
            className={`block text-[13px] font-medium text-slate-800 dark:text-slate-100 ${this.disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer select-none'}`}
          >
            {this.label}
            {this.required ? <span className="ml-0.5 text-rose-500">*</span> : null}
          </span>
          {this.description ? <p className="mt-0.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400">{this.description}</p> : null}
        </div>
        <Switch checked={this.checked} onChange={this.onChange} disabled={this.disabled} className="shrink-0" />
      </div>
    );
  }
}
