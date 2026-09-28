import React from 'react';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A console sentence that carries inline markup — a `<code>` host name, a `<strong>` lead-in — in the
 * console's language.
 *
 * The dictionary holds the WHOLE sentence with its tags, so a translation can move the marked words
 * where its own grammar puts them; splitting the sentence into keyed fragments around each tag would
 * freeze English word order into every language. Only the tags below are recognised, never with
 * attributes; anything else, and all text, renders as text — a dictionary cannot inject HTML.
 */
export class AdminRichText extends PureReactor {
  @prop declare k: string;
  @prop declare vars?: Record<string, unknown>;

  private static readonly TAGS: Record<string, string> = { code: 'code', strong: 'strong', em: 'em', b: 'strong' };
  private static readonly PATTERN = /<(code|strong|em|b)>([\s\S]*?)<\/\1>/g;

  static parts(text: string): ReactNode[] {
    const out: ReactNode[] = [];
    let last = 0;
    for (const match of text.matchAll(AdminRichText.PATTERN)) {
      const at = match.index ?? 0;
      if (at > last) out.push(text.slice(last, at));
      out.push(React.createElement(AdminRichText.TAGS[match[1]], { key: out.length }, match[2]));
      last = at + match[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }

  render(): ReactNode {
    return <>{AdminRichText.parts(AdminI18n.t(this.k, this.vars))}</>;
  }
}
