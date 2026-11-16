import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Rows of declared sub-fields laid out as a TABLE: the sub-fields' names once, in a header, and one
 * line per row instead of a bordered card per row with the names repeated inside it.
 *
 * This is the layout every record page worth copying uses for a list of rows, and the reason a plugin
 * wrote its own component for videos, specifications and prices-per-currency: the field could ask for a
 * list of rows but not for a table, so each of them drew one. A field asks for it with
 * `admin.layout: 'table'` and keeps saying only WHAT it holds.
 *
 * Reordering is not offered here — a table whose order matters keeps the stacked layout, which has the
 * handle and the arrows.
 */
export class ArrayFieldTable extends PureReactor {
  @prop declare field: any;
  @prop declare items: any[];
  @prop declare renderField: (f: any, item: any, index: number) => ReactNode;
  @prop declare onAdd: () => void;
  @prop declare onRemove: (index: number) => void;

  private get columns(): any[] {
    return (this.field?.fields || []).filter((f: any) => !f.admin?.hidden);
  }

  render(): ReactNode {
    const columns = this.columns;
    const items = this.items || [];
    const addLabel = AdminI18n.t('ui.array.addNew', { label: this.field?.label || AdminI18n.t('ui.array.item') });
    return (
      <div className="fc-rows">
        {items.length ? (
          <div className="fc-rows__scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((column: any) => (
                    <th key={column.name}>{column.label || column.name}</th>
                  ))}
                  <th className="fc-rows__tools-head"><span className="sr-only">{AdminI18n.t('ui.table.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, index: number) => (
                  <tr key={index}>
                    {columns.map((column: any) => (
                      <td key={column.name}>{this.renderField(column, item, index)}</td>
                    ))}
                    <td className="fc-rows__tools-cell">
                      <button type="button" className="fc-rows__remove" onClick={() => this.onRemove(index)}
                        title={AdminI18n.t('common.delete')} aria-label={AdminI18n.t('common.delete')}>
                        <FrameworkIcons.Trash size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <Button type="button" variant={ButtonVariant.SECONDARY} size={FieldSize.SM} onClick={this.onAdd}>
          <FrameworkIcons.Plus size={13} className="me-1.5" />{addLabel}
        </Button>
      </div>
    );
  }
}
