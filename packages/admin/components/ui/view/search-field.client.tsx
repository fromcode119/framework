import type { ChangeEvent, ReactNode } from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ScanDialog } from '@/components/ui/view/scan-dialog.client';
import { UiFieldUtils } from '@/lib/ui';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The console's search field: the glass inside the field, the words after it. Every screen that
 * searches uses this one — six screens had each placed an icon over an `Input` and opened room for it
 * with a padding utility that the field's own padding overrode, so the glass sat on the words.
 *
 * Given `onScan`, the field ends in a scan button: it opens {@link ScanDialog}, and the code read
 * becomes the field's value and is handed to `onScan`. A keyboard scanner needs no button — it types
 * into the field like a keyboard.
 */
export class SearchField extends PureReactor {
  @prop declare value: string;
  @prop declare onChange: (value: string) => void;
  @prop declare placeholder?: string;
  @prop declare className?: string;
  @prop declare autoFocus?: boolean;
  /** Turns on the scan button; called with the code read, after `onChange`. */
  @prop declare onScan?: (code: string) => void;

  @state scanning = false;

  @bound private change(event: ChangeEvent<HTMLInputElement>): void {
    this.onChange(event.target.value);
  }

  @bound private openScan(): void {
    this.scanning = true;
  }

  @bound private closeScan(): void {
    this.scanning = false;
  }

  @bound private scanned(code: string): void {
    this.scanning = false;
    this.onChange(code);
    this.onScan?.(code);
  }

  render(): ReactNode {
    const name = AdminClass.of('search');
    const scan = Boolean(this.onScan);
    return (
      <div className={`${name} ${scan ? `${name}--scan` : ''} ${this.className ?? ''}`}>
        <div className={`${name}__icon`}><FrameworkIcons.Search size={15} /></div>
        <input
          type="text"
          autoFocus={this.autoFocus}
          placeholder={this.placeholder}
          aria-label={this.placeholder}
          value={this.value}
          onChange={this.change}
          className={UiFieldUtils.getFieldClasses(FieldSize.MD, `${name}-field text-ellipsis`)}
        />
        {scan ? (
          <>
            <button type="button" className={`${name}__scan`} onClick={this.openScan} aria-label={AdminI18n.t('ui.scan.open')} title={AdminI18n.t('ui.scan.open')}>
              <FrameworkIcons.ScanLine size={15} />
            </button>
            <ScanDialog isOpen={this.scanning} onClose={this.closeScan} onResult={this.scanned} />
          </>
        ) : null}
      </div>
    );
  }
}
