import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';
import type { IPartsLinePart } from '@/components/ui/interfaces/parts-line-part.interface';

/**
 * A whole told as its parts on one quiet line, under the thing it describes: each part named, with an
 * optional short detail, a count (`×n`) and a link, the parts spaced apart. An optional
 * caption says what the parts are. Wraps between parts, never inside one. With no parts it renders
 * nothing, so a caller never prints an empty caption.
 */
export class PartsLine extends PureReactor {
  @prop declare parts: IPartsLinePart[];
  @prop declare caption?: ReactNode;
  @prop declare className?: string;

  private renderPart(part: IPartsLinePart): ReactNode {
    const label = part.href
      ? <a className={AdminClass.of('parts__label')} href={part.href}>{part.label}</a>
      : <span className={AdminClass.of('parts__label')}>{part.label}</span>;
    return (
      <span key={part.key} className={AdminClass.of('parts__item')}>
        {label}
        {part.detail ? <span className={AdminClass.of('parts__detail')}>{part.detail}</span> : null}
        {part.count !== undefined ? <span className={AdminClass.of('parts__count')}>×{part.count}</span> : null}
      </span>
    );
  }

  render(): ReactNode {
    if (!this.parts?.length) return null;
    return (
      <span className={`${AdminClass.of('parts')} ${this.className ?? ''}`}>
        {this.caption ? <span className={AdminClass.of('parts__caption')}>{this.caption}</span> : null}
        {this.parts.map((part) => this.renderPart(part))}
      </span>
    );
  }
}
