import type { ReactNode } from 'react';
import { PureReactor, prop, state } from '@fromcode119/react-class-components';

/**
 * The line under a spinner, changed every few seconds so a wait does not look frozen.
 *
 * A single fixed sentence makes a slow screen feel stuck — there is nothing to tell you the page is
 * still working rather than hung. Rotating the wording is the cheapest honest signal that something
 * is still happening, and it costs one timer.
 *
 * The phrases deliberately promise NOTHING about progress. "Almost there" and "Nearly done" are the
 * obvious things to write here and both are claims this component cannot know are true; a loader
 * that lies about how far along it is teaches people to distrust it.
 */
export class LoadingMessage extends PureReactor {
  /** How long each line stays up. Long enough to read, short enough to notice it changed. */
  private static readonly INTERVAL_MS = 2600;

  private static readonly PHRASES = [
    'Just a moment',
    'Getting things ready',
    'Still working',
    'Putting the pieces together',
  ];

  @prop declare className?: string;

  @state private index = 0;

  private intervalId: number | null = null;

  componentDidMount(): void {
    // Someone who asked for less motion gets the first line and no rotation — the text changing IS
    // the motion here, so honouring the preference means not starting the timer at all.
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    this.intervalId = window.setInterval(() => {
      this.index = (this.index + 1) % LoadingMessage.PHRASES.length;
    }, LoadingMessage.INTERVAL_MS);
  }

  componentWillUnmount(): void {
    if (this.intervalId !== null) window.clearInterval(this.intervalId);
  }

  render(): ReactNode {
    // Keyed on the phrase so React replaces the node and the fade-in plays on every change.
    const phrase = LoadingMessage.PHRASES[this.index];
    return (
      <p
        key={phrase}
        className={`animate-in fade-in duration-500 text-[11px] font-medium tracking-tight ${this.className ?? 'text-slate-500 dark:text-slate-400'}`}
      >
        {phrase}
      </p>
    );
  }
}
