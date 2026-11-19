import type { ReactNode } from 'react';
import { prop } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { LoadingMessage } from '@/components/ui/view/loading-message.client';

/** Themed loading spinner. Hook-free class: color mode from the admin runtime context. */
export class Loader extends AdminComponent {
  @prop declare label?: string;
  @prop declare className?: string;
  @prop declare fullPage?: boolean;

  render(): ReactNode {
    // A caller with something specific to say passes it ("Signing you in"), and that line stands
    // still — it is telling you WHAT is happening. With nothing specific to say the wording rotates
    // instead, so a slow screen does not look frozen.
    const label = this.label ?? '';
    const className = this.className ?? '';
    const fullPage = this.fullPage ?? false;

    // One small ring and one line, in the console's own ink. It used to be a 64px indigo ring around
    // a pulsing square with three bouncing dots under the words — three animations, in a colour
    // nothing else on the screen uses, for "wait a moment".
    const content = (
      <div className={`fc-loader ${className}`} role="status">
        <span className="fc-loader__ring" aria-hidden="true" />
        {label ? <span className="fc-loader__label">{label}</span> : <LoadingMessage className="fc-loader__label" />}
      </div>
    );

    if (fullPage) return <div className="fc-loader-page">{content}</div>;
    return <div className="fc-loader-block">{content}</div>;
  }
}
