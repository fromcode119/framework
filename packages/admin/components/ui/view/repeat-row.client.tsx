import type { CSSProperties, DragEventHandler, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { IRepeatRowField } from '@/components/ui/interfaces/repeat-row-field.interface';

/**
 * One row of a repeating group whose rows hold several fields: a raised card with each field's words
 * on the left of its control, and the row's tools (reorder, remove) in a column on the right.
 */
export class RepeatRow extends PureReactor {
  @prop declare fields: IRepeatRowField[];
  @prop declare tools?: ReactNode;
  /** How many levels the row is nested (a menu item under another); 0 by default. */
  @prop declare depth?: number;
  @prop declare dragging?: boolean;
  @prop declare draggable?: boolean;
  @prop declare onDragStart?: DragEventHandler<HTMLLIElement>;
  @prop declare onDragOver?: DragEventHandler<HTMLLIElement>;
  @prop declare onDragEnd?: DragEventHandler<HTMLLIElement>;

  render(): ReactNode {
    const style = this.depth ? ({ '--fc-repeat-depth': this.depth } as CSSProperties) : undefined;
    return (
      <li
        className={`fc-repeat__row${this.dragging ? ' fc-repeat__row--dragging' : ''}`}
        style={style}
        draggable={this.draggable}
        onDragStart={this.onDragStart}
        onDragOver={this.onDragOver}
        onDragEnd={this.onDragEnd}
      >
        {this.fields.some((field) => field.label) ? (
          <div className="fc-repeat__fields">
            {this.fields.map((field) => [
              <span key={`${field.key}-label`} className="fc-repeat__label">{field.label}</span>,
              <div key={`${field.key}-control`} className="fc-repeat__control">{field.control}</div>,
            ])}
          </div>
        ) : (
          // A row whose fields need no words (one line of text, a pair the group heading already names)
          // puts its controls side by side.
          <div className="fc-repeat__fields fc-repeat__fields--bare">
            {this.fields.map((field) => <div key={field.key} className="fc-repeat__control">{field.control}</div>)}
          </div>
        )}
        {this.tools ? <div className="fc-repeat__tools">{this.tools}</div> : null}
      </li>
    );
  }
}
