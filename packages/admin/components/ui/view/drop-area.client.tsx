import type { DragEvent, ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminClass } from '@/lib/admin-class';

/**
 * A place files are dropped on, for a page that takes several at once: what to do, a line about what
 * is taken, and a button for those who would rather pick. The page handles the drop; this is the
 * surface, the same one `FileDropzone` shows for a single file.
 */
export class DropArea extends PureReactor {
  @prop declare title: ReactNode;
  @prop declare hint?: ReactNode;
  /** A file is being held over it. */
  @prop declare over?: boolean;
  @prop declare action?: ReactNode;
  @prop declare onDragEnter?: (event: DragEvent<HTMLDivElement>) => void;
  @prop declare onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  @prop declare onDragLeave?: (event: DragEvent<HTMLDivElement>) => void;
  @prop declare onDrop?: (event: DragEvent<HTMLDivElement>) => void;

  render(): ReactNode {
    const name = AdminClass.of('dropzone');
    return (
      <div className={`${name}${this.over ? ` ${name}--over` : ''} ${name}--area`}
        onDragEnter={this.onDragEnter} onDragOver={this.onDragOver} onDragLeave={this.onDragLeave} onDrop={this.onDrop}>
        <span className={`${name}__icon`} aria-hidden="true"><FrameworkIcons.Upload size={15} /></span>
        <span className={`${name}__file`}>
          <span className={`${name}__name`}>{this.title}</span>
          {this.hint ? <span className={`${name}__meta`}>{this.hint}</span> : null}
        </span>
        {this.action ? <span className={`${name}__action`}>{this.action}</span> : null}
      </div>
    );
  }
}
