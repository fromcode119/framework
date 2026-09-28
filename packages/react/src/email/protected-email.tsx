import type { ReactNode } from 'react';
import { Reactor, prop, state } from '@fromcode119/react-class-components';
import { EmailAddressCipher } from '@react/email/email-address-cipher';

/**
 * An email address a harvester reading the page's HTML cannot collect, and a visitor can still use.
 *
 * What a CDN's email obfuscation does, done where it cannot break the page. A CDN rewrites the HTML at the
 * edge, after the server rendered it, so React hydrates against markup it never produced (#418) and throws
 * the server render away. Here the server render and the browser's FIRST render are the same protected
 * markup — the address encoded into `data-fc-email`, shown reversed inside `<bdo dir="rtl">` so a reader
 * without script still sees it the right way round — and the real `mailto:` link appears only after
 * hydration, from `componentDidMount`.
 *
 * `protect` is the owner's decision, passed in: a plugin reads its own setting, a theme its own variable.
 * With `protect` off this is simply the link (or the text).
 *
 * `target` is everything after `mailto:` (address plus any `?subject=`), `address` the address alone.
 * `link={false}` protects an address in running text and restores it as text, not as a link. `children`
 * replaces the visible label — pass it only when the label is not the address itself, since a label is
 * rendered as given.
 */
export class ProtectedEmail extends Reactor {
  @prop declare address: string;
  @prop declare target?: string;
  @prop declare protect?: boolean;
  @prop declare link?: boolean;
  @prop declare className?: string;
  @prop declare children?: ReactNode;

  static readonly ATTRIBUTE = 'data-fc-email';

  @state private revealed = false;

  componentDidMount(): void {
    if (this.protect !== false) this.revealed = true;
  }

  private get href(): string {
    return `mailto:${this.target || this.address}`;
  }

  private get isLink(): boolean {
    return this.link !== false;
  }

  render(): ReactNode {
    const label = this.children ?? this.address;
    if (this.protect === false || this.revealed) {
      return this.isLink
        ? <a className={this.className} href={this.href}>{label}</a>
        : <span className={this.className}>{label}</span>;
    }

    const attributes = { [ProtectedEmail.ATTRIBUTE]: EmailAddressCipher.encode(this.target || this.address) };
    const shown = this.children ?? <bdo dir="rtl">{EmailAddressCipher.reversed(this.address)}</bdo>;
    return this.isLink
      ? <a className={this.className} {...attributes}>{shown}</a>
      : <span className={this.className} {...attributes}>{shown}</span>;
  }
}
