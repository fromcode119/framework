import { DocumentContactMarkers } from '@/lib/contact/document-contact-markers';
import { ContactCodec } from '@/lib/contact/contact-codec';

/**
 * Puts back, in the browser, every email address and phone number `DocumentContactProtection` took out of
 * the served HTML — BEFORE React hydrates, so React finds exactly the markup it rendered on the server.
 *
 * That ordering is the whole difference from a CDN's email obfuscation: the CDN rewrites HTML React
 * produced and restores it on its own schedule, so React hydrates against markup it never made (#418) and
 * throws the server render away. Here the page is the server's markup again when hydration starts.
 *
 * A placeholder becomes a text node, and its parent is normalized so the detail merges back into the
 * single text node the server rendered — the parser split it only because a placeholder sat in between.
 */
export class DocumentContactRestore {
  static restore(root: ParentNode): number {
    let restored = 0;
    for (const element of Array.from(root.querySelectorAll(`[${DocumentContactMarkers.ATTRIBUTES}]`))) {
      restored += DocumentContactRestore.restoreAttributes(element);
    }
    const parents = new Set<Node>();
    for (const placeholder of Array.from(root.querySelectorAll(`[${DocumentContactMarkers.TEXT}]`))) {
      const text = ContactCodec.decode(placeholder.getAttribute(DocumentContactMarkers.TEXT) || '');
      const parent = placeholder.parentNode;
      if (!text || !parent) continue;
      parent.replaceChild(placeholder.ownerDocument.createTextNode(text), placeholder);
      parents.add(parent);
      restored += 1;
    }
    parents.forEach((parent) => parent.normalize());
    return restored;
  }

  private static restoreAttributes(element: Element): number {
    const pairs = String(element.getAttribute(DocumentContactMarkers.ATTRIBUTES) || '').split(DocumentContactMarkers.PAIR_SEPARATOR);
    element.removeAttribute(DocumentContactMarkers.ATTRIBUTES);
    let restored = 0;
    for (const pair of pairs) {
      // The last separator: an attribute name may itself contain one (`xlink:href`), an encoding never does.
      const at = pair.lastIndexOf(DocumentContactMarkers.NAME_SEPARATOR);
      if (at <= 0) continue;
      element.setAttribute(pair.slice(0, at), ContactCodec.decode(pair.slice(at + 1)));
      restored += 1;
    }
    return restored;
  }
}
