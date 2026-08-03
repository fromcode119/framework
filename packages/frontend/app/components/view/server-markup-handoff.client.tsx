import type { ReactNode } from 'react';
import { Reactor, prop, state } from '@fromcode119/reactor';
import { ThemeSsrShell } from '@/app/components/view/theme-ssr-shell.client';

/**
 * Hands the page over from the SERVER-rendered markup to the live theme tree without a blank frame.
 *
 * The old rule was "swap as soon as the theme layouts (and the content slot) are registered". That is
 * the moment the live components can MOUNT, not the moment they can SHOW anything: they mount with empty
 * state and fetch their own data, so the page went server-content → blank → content. Invisible on a fast
 * connection, several hundred ms of blank on a throttled one.
 *
 * So both are rendered during the handover: the live tree in the flow (hidden, so it still lays out and
 * its effects run) with the server markup overlaid on top. The moment the live tree has actually painted
 * comparable content, the overlay is dropped and the live tree is revealed. A mutation-quiet window
 * covers trees that fill in over several ticks, and a hard deadline guarantees the handover always
 * completes even if a component never settles.
 */
export class ServerMarkupHandoff extends Reactor {
  @prop declare html: string;

  @prop declare children: ReactNode;

  @state private handedOver = false;

  private readonly liveRef = this.ref<HTMLDivElement>();

  private observer: MutationObserver | null = null;

  private quietTimer = 0;

  private deadlineTimer = 0;

  /** The live tree counts as ready at this share of the server text — it need not match exactly. */
  private static readonly CONTENT_RATIO = 0.6;

  /** No mutations for this long means the tree has settled. */
  private static readonly QUIET_MS = 120;

  /** The handover always completes, even if something never stops mutating. */
  private static readonly DEADLINE_MS = 4000;

  componentDidMount(): void {
    this.deadlineTimer = window.setTimeout(() => this.finish(), ServerMarkupHandoff.DEADLINE_MS);
    this.watch();
    this.evaluate();
  }

  componentWillUnmount(): void {
    this.stop();
  }

  private watch(): void {
    const node = this.liveRef.current;
    if (!node) return;
    this.observer = new MutationObserver(() => this.evaluate());
    this.observer.observe(node, { childList: true, subtree: true, characterData: true });
  }

  /** Ready when the live tree carries a comparable amount of text to the markup it is replacing. */
  private evaluate(): void {
    if (this.handedOver) return;
    const node = this.liveRef.current;
    if (!node) return;
    const live = (node.textContent || '').replace(/\s+/g, ' ').trim().length;
    const target = ServerMarkupHandoff.textLengthOf(this.html) * ServerMarkupHandoff.CONTENT_RATIO;
    if (live < target) return;
    window.clearTimeout(this.quietTimer);
    this.quietTimer = window.setTimeout(() => this.finish(), ServerMarkupHandoff.QUIET_MS);
  }

  private finish(): void {
    if (this.handedOver) return;
    this.stop();
    this.handedOver = true;
  }

  private stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    window.clearTimeout(this.quietTimer);
    window.clearTimeout(this.deadlineTimer);
  }

  /** Text length of the server markup, without parsing it into a document. */
  private static textLengthOf(html: string): number {
    return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().length;
  }

  render(): ReactNode {
    if (this.handedOver) return this.children;
    return (
      <div style={{ position: 'relative' }}>
        {/* In the flow so it lays out and its effects run — just not visible yet. */}
        <div ref={this.liveRef} style={{ visibility: 'hidden' }} aria-hidden="true">{this.children}</div>
        <div style={{ position: 'absolute', inset: '0 0 auto 0' }}>
          <ThemeSsrShell html={this.html} />
        </div>
      </div>
    );
  }
}
