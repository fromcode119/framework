import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Input } from '@/components/ui/view/input.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The search a section carries in its HEAD, beside its name.
 *
 * It lives in the head, not over the table the section draws, because that is where every list in the
 * console carries its search — and what is being searched is the section, whatever it chose to draw.
 * It appears only past the point at which a list stops being read and starts being looked through.
 */
export class RecordSectionSearch extends PureReactor {
  /** How many rows the section's data holds; below the threshold there is nothing to look through. */
  @prop declare rows: number;
  @prop declare value: string;
  @prop declare onChange: (next: string) => void;

  /** Past this many rows a list stops being read and starts being looked THROUGH. */
  private static readonly SEARCHABLE_ROWS = 8;

  render(): ReactNode {
    if ((this.rows ?? 0) <= RecordSectionSearch.SEARCHABLE_ROWS) return null;
    return (
      <Input
        value={this.value}
        onChange={(event: any) => this.onChange(String(event?.target?.value ?? ''))}
        placeholder={AdminI18n.t('ui.structured.filter')}
        className="fc-sro-table__search"
      />
    );
  }
}
