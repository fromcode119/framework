import { DocumentContactMarkers } from '@/lib/contact/document-contact-markers';
import { ContactCodec } from '@/lib/contact/contact-codec';
import { ContactPatterns } from '@/lib/contact/contact-patterns';

/**
 * Takes every email address and phone number out of a storefront document's HTML, so a harvester reading
 * the page finds none — the site's "Hide email addresses and phone numbers from harvesters" setting.
 * Nothing has to opt in: it runs on the finished document, whatever theme or plugin rendered the detail.
 *
 * - Body text: each detail becomes a placeholder `<span data-fc-c="…">` holding it encoded, shown reversed
 *   inside `<bdo dir="rtl">` so a reader without script still sees it the right way round. The whole text
 *   of a `tel:` link is protected, whatever format the number is written in.
 * - Body attributes (a `mailto:`/`tel:` link, a `title`, a data attribute): the attribute is taken off and
 *   kept, encoded, in `data-fc-ca`.
 * - Script contents (the page data the browser hydrates from, JSON-LD): an email's `@` is written as its
 *   Unicode escape in every JavaScript or JSON script, a phone's `+` only in JSON, where a number can never
 *   begin with one. Both read back identically, so the application sees the same data while the raw HTML
 *   carries neither. These are most of a page's details; a CDN's obfuscation never touched them.
 *
 * `DocumentContactRestore` undoes the first two in the browser BEFORE hydration, so React finds exactly
 * the markup it rendered. The head (title, meta) and raw-text elements are left as they are.
 */
export class DocumentContactProtection {
  private static readonly TAG = /<!--[\s\S]*?-->|<![^>]*>|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/g;
  private static readonly ATTRIBUTE = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  private static readonly HREF = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
  /** A cheap first look: every contact detail needs one of these, so a tag without any is left untouched. */
  private static readonly MAYBE_DETAIL = /@|\+\d|tel:/i;
  private static readonly TYPE = /(?:^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
  /** Elements whose content is raw text: never parsed as markup, so never given a placeholder. */
  private static readonly RAW_TEXT = new Set(['script', 'style', 'textarea', 'title', 'noscript', 'template', 'xmp']);
  /** Script types whose content is JavaScript or JSON, where the escaped `@` reads back as `@`. */
  private static readonly CODE_SCRIPT = /^(|module|text\/javascript|application\/javascript|application\/json|application\/ld\+json|importmap)$/i;
  /** Script types whose content is JSON only, where no number begins with `+` — so escaping one is safe. */
  private static readonly JSON_SCRIPT = /^(application\/json|application\/ld\+json|importmap)$/i;

  static protect(html: string): string {
    const source = String(html ?? '');
    if (!ContactPatterns.contains(source)) return source;
    let out = '';
    let cursor = 0;
    let inBody = false;
    // An `<option>` holds text only: the parser would drop a placeholder `<span>` inside it.
    let inOption = false;
    let inTelLink = false;
    const tags = new RegExp(DocumentContactProtection.TAG.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = tags.exec(source))) {
      const text = source.slice(cursor, match.index);
      out += inBody && !inOption ? DocumentContactProtection.protectText(text, inTelLink) : text;
      const [whole, closing, rawName = '', attributes = '', selfClosing] = match;
      const name = rawName.toLowerCase();
      if (name === 'body' && !closing) inBody = true;
      if (name === 'option') inOption = !closing;
      if (name === 'a') inTelLink = !closing && ContactPatterns.isTelTarget(DocumentContactProtection.attributeValue(attributes, DocumentContactProtection.HREF));
      out += inBody && name && !closing ? DocumentContactProtection.protectTag(whole, name, attributes, selfClosing) : whole;
      cursor = match.index + whole.length;
      if (name && !closing && !selfClosing && DocumentContactProtection.RAW_TEXT.has(name)) {
        const end = DocumentContactProtection.closingIndex(source, name, cursor);
        const content = source.slice(cursor, end);
        out += name === 'script' ? DocumentContactProtection.escapeScript(content, attributes) : content;
        cursor = end;
        tags.lastIndex = end;
      }
    }
    const rest = source.slice(cursor);
    return out + (inBody ? DocumentContactProtection.protectText(rest, false) : rest);
  }

  /** Inside a `tel:` link the visible text is the number, whatever its format — so all of it is protected. */
  private static protectText(text: string, wholeText: boolean): string {
    if (!text) return text;
    if (wholeText) {
      const core = text.trim();
      if (!core) return text;
      const at = text.indexOf(core);
      return text.slice(0, at) + DocumentContactProtection.placeholder(core) + text.slice(at + core.length);
    }
    if (!ContactPatterns.contains(text)) return text;
    return text.replace(ContactPatterns.details(), (detail) =>
      ContactPatterns.isDetail(detail) ? DocumentContactProtection.placeholder(detail) : detail);
  }

  private static placeholder(value: string): string {
    return `<span ${DocumentContactMarkers.TEXT}="${ContactCodec.encode(value)}"><bdo dir="rtl">${ContactCodec.reversed(value)}</bdo></span>`;
  }

  /** The tag with every attribute holding a contact detail moved into the encoded marker. */
  private static protectTag(whole: string, name: string, attributes: string, selfClosing: string): string {
    if (!attributes || !DocumentContactProtection.MAYBE_DETAIL.test(DocumentContactProtection.decodeEntities(attributes))) return whole;
    const kept: string[] = [];
    const taken: string[] = [];
    for (const attribute of attributes.matchAll(new RegExp(DocumentContactProtection.ATTRIBUTE.source, 'g'))) {
      const raw = attribute[2] ?? attribute[3] ?? attribute[4];
      const value = raw === undefined ? '' : DocumentContactProtection.decodeEntities(raw);
      if (raw !== undefined && ContactPatterns.contains(value)) {
        taken.push(`${attribute[1]}${DocumentContactMarkers.NAME_SEPARATOR}${ContactCodec.encode(value)}`);
      } else {
        kept.push(attribute[0]);
      }
    }
    if (!taken.length) return whole;
    kept.push(`${DocumentContactMarkers.ATTRIBUTES}="${taken.join(DocumentContactMarkers.PAIR_SEPARATOR)}"`);
    return `<${name} ${kept.join(' ')}${selfClosing ? ' /' : ''}>`;
  }

  private static escapeScript(content: string, attributes: string): string {
    const type = DocumentContactProtection.attributeValue(attributes, DocumentContactProtection.TYPE).trim();
    if (!DocumentContactProtection.CODE_SCRIPT.test(type)) return content;
    let escaped = content.replace(ContactPatterns.emails(), (address) => address.replace('@', '\\u0040'));
    if (DocumentContactProtection.JSON_SCRIPT.test(type)) {
      escaped = escaped.replace(ContactPatterns.phones(), (phone) => (ContactPatterns.isPhone(phone) ? phone.replace('+', '\\u002b') : phone));
    }
    return escaped;
  }

  private static attributeValue(attributes: string, pattern: RegExp): string {
    const found = pattern.exec(attributes);
    return found ? DocumentContactProtection.decodeEntities(found[1] ?? found[2] ?? found[3] ?? '') : '';
  }

  /** Where the raw-text element opened before `from` closes; the end of the document if it never does. */
  private static closingIndex(source: string, name: string, from: number): number {
    // A case-insensitive search, not `toLowerCase().indexOf`: lowering can change the string's length
    // (a dotted capital I becomes two code units), which would shift every index after it.
    const closing = new RegExp(`</${name}`, 'gi');
    closing.lastIndex = from;
    const found = closing.exec(source);
    return found ? found.index : source.length;
  }

  /** Attribute values as the browser will read them, so an encoded value restores exactly. */
  private static decodeEntities(value: string): string {
    return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, body: string) => {
      const lower = body.toLowerCase();
      if (lower[0] === '#') {
        const code = lower[1] === 'x' ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
      }
      return ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: String.fromCharCode(0xa0) } as Record<string, string>)[lower] ?? entity;
    });
  }
}
