import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { Reactor, prop, bound } from '@fromcode119/reactor';
import { InteractiveCanvasChannel } from '@core/interactive-canvas/interactive-canvas-channel';
import type { IInteractiveCanvasContextValue } from '@core/interactive-canvas/interfaces/interactive-canvas-context-value.interface';

/**
 * Hook-free consumer via `static contextType`; the click handler is a `@bound` method passed by name.
 * Renders a plain div unless the canvas is enabled.
 */
export class InteractiveCanvasWrapper extends Reactor {
  @prop declare id: string;
  @prop declare children: ReactNode;
  @prop declare className?: string;
  @prop declare label?: string;

  static contextType = InteractiveCanvasChannel.context.raw;
  declare context: IInteractiveCanvasContextValue | undefined;

  private static readonly SELECTABLE_STYLE: CSSProperties = { cursor: 'pointer' };

  @bound
  protected onClick(event: ReactMouseEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.stopPropagation();
    this.context?.setTargetId(this.id);
  }

  private get isEnabled(): boolean {
    return Boolean(this.context?.state.isEnabled);
  }

  render(): ReactNode {
    if (!this.isEnabled) return <div className={this.className}>{this.children}</div>;
    return (
      <div className={this.className} style={InteractiveCanvasWrapper.SELECTABLE_STYLE} onClick={this.onClick}>
        {this.children}
      </div>
    );
  }
}
