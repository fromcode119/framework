import type { ReactNode } from 'react';
import { ThemeMode } from '@fromcode119/core/client';
import { PureReactor, prop, state, bound, ref } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';
import { FieldHelpButton } from '@/components/collection/view/field-help-button.client';
import { SettingRowWidth } from '@/components/ui/enums/setting-row-width.enum';

/**
 * One setting: its name and a line saying what it is on the left, the control on the right.
 *
 * Every settings screen draws its rows with this, so the look of all of them lives in one place — the
 * `fc-settings-row` rules of `settings.css`. A row carries no colours, sizes or spacing of its own.
 *
 * What the control DOES (`explanation`) is one press away behind the ⓘ beside the name. The
 * description is always one line under the name; when the line cuts it (measured, so a sentence with a
 * link or code in it is cut like plain text), the ⓘ opens the whole of it: printed in full on every
 * visit, those sentences outweighed the values they describe, and hidden entirely they left the row a
 * bare name.
 */
export class SettingRow extends PureReactor {
  @prop declare title: ReactNode;
  @prop declare description?: ReactNode;
  /** What the control does, per state, with the related control named. See `Explanation`. */
  @prop declare explanation?: ReactNode;
  @prop declare children: ReactNode;
  /** How much room the control takes; `SettingRowWidth.FIELD` when not given. */
  @prop declare width?: SettingRowWidth;
  /** The control spans the row under the text — a list, a sentence, a file with its preview. */
  @prop declare wide?: boolean;
  /** The same as `wide`; the name the general settings rows were written with. */
  @prop declare stacked?: boolean;
  /** Accepted for backward-compat and ignored — the look comes from `settings.css`. */
  @prop declare theme?: ThemeMode;

  /** A field description longer than this reads as an explanation (the field renderer's rows). */
  static readonly LONG_DESCRIPTION = 90;

  @state private helpOpen = false;
  /** The one line under the name does not hold the whole description. */
  @state private cut = false;
  @ref declare descRef: Ref<HTMLParagraphElement>;

  @bound
  private measure(): void {
    const line = this.descRef.current;
    if (!line) return;
    const cut = line.scrollWidth > line.clientWidth + 1;
    if (cut !== this.cut) this.cut = cut;
  }

  componentDidMount(): void {
    this.measure();
    // The text column, not the line itself: the line is unmounted while the ⓘ shows the whole text.
    const column = this.descRef.current?.parentElement;
    if (column && typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(this.measure);
      observer.observe(column);
      this.onUnmount(() => observer.disconnect());
    }
  }

  componentDidUpdate(): void {
    this.measure();
  }

  @bound
  private toggleHelp(): void {
    this.helpOpen = !this.helpOpen;
  }

  private get help(): ReactNode {
    const parts: ReactNode[] = [];
    if (this.cut) parts.push(<p key="d">{this.description}</p>);
    if (this.explanation) parts.push(<div key="e">{this.explanation}</div>);
    return parts.length ? parts : null;
  }

  private get label(): string {
    return typeof this.title === 'string' ? this.title : '';
  }

  render(): ReactNode {
    const help = this.help;
    const wide = Boolean(this.wide || this.stacked);
    const width = this.width ?? SettingRowWidth.FIELD;
    const row = AdminClass.of('settings-row');
    return (
      <div className={`${row}${wide ? ` ${row}--wide` : ''}`}>
        <div className={AdminClass.of('settings-row__text')}>
          <div className={AdminClass.of('settings-row__title')}>
            <h3>{this.title}</h3>
            {help ? <FieldHelpButton label={this.label} open={this.helpOpen} onToggle={this.toggleHelp} /> : null}
          </div>
          {this.description && !(this.cut && this.helpOpen)
            ? <p ref={this.descRef} className={`${AdminClass.of('settings-row__desc')} ${AdminClass.of('setting-desc')} ${AdminClass.of('settings-row__desc--clamp')}`}>{this.description}</p>
            : null}
          {help && this.helpOpen ? <div className={AdminClass.of('settings-row__help')}>{help}</div> : null}
        </div>
        <div className={`${AdminClass.of('settings-row__control')} ${AdminClass.of(`settings-row__control--${width.value}`)}`}>
          {this.children}
        </div>
      </div>
    );
  }
}
