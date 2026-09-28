// @vitest-environment jsdom
import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { ContactCodec } from '@/lib/contact/contact-codec';
import { ContactPatterns } from '@/lib/contact/contact-patterns';
import { DocumentContactProtection } from '@/lib/contact/document-contact-protection';
import { DocumentContactRestore } from '@/lib/contact/document-contact-restore';

/**
 * The site setting "Hide email addresses and phone numbers from harvesters". The served HTML must carry no
 * contact detail, and the page must still hydrate cleanly — a CDN's edge obfuscation did the first and broke
 * the second (#418), and never touched the page data in scripts, where most addresses actually are.
 */
class Page {
  static readonly DATA = { contact: 'hello@regodue.com', phone: '+61 2 9999 9999', note: 'Order +12345 (5 digits)' };

  static tree() {
    return (
      <main>
        <h1>Contact</h1>
        <p>Write to <a href="mailto:hello@regodue.com?subject=Hi">hello@regodue.com</a> or sales@regodue.com.</p>
        <p>Call <a href="tel:0288887777">(02) 8888 7777</a> or +359 88 123 4567 any time.</p>
        <p title="Owner: owner@regodue.com">Price 1 234 567 AUD on 2026-10-02, ID 20260102123</p>
        <select defaultValue="a"><option value="a">ops@regodue.com</option></select>
      </main>
    );
  }

  static document(markup: string): string {
    return '<html><head><title>Contact us: hello@regodue.com</title><meta name="author" content="hello@regodue.com"></head>'
      + `<body><div id="root">${markup}</div>`
      + `<script type="application/json" id="data">${JSON.stringify(Page.DATA)}</script>`
      + '<script>window.__x = "js@regodue.com"; var n = 1 +44 -1; var p = "+44 20 7946 0958";</script>'
      + '<script type="text/template">tpl@regodue.com</script>'
      + '</body></html>';
  }
}

describe('ContactPatterns', () => {
  it('finds emails and international phone numbers', () => {
    for (const hit of ['hello@regodue.com', '+359 88 123 4567', '+61 (2) 9999-9999', '+44.20.7946.0958']) {
      expect(ContactPatterns.contains(hit)).toBe(true);
    }
  });

  it('leaves prices, dates, IDs and short numbers alone', () => {
    for (const miss of ['1 234 567 AUD', '2026-10-02', '20260102123', 'Order +12345', '0888 123 456', 'a +1 b']) {
      expect(ContactPatterns.contains(miss)).toBe(false);
    }
  });

  it('knows a tel: target whatever its format', () => {
    expect(ContactPatterns.contains('tel:0288887777')).toBe(true);
  });
});

describe('DocumentContactProtection', () => {
  const served = DocumentContactProtection.protect(Page.document(renderToString(Page.tree())));
  const body = served.slice(served.indexOf('<body'));

  it('serves no email address and no phone number in the body markup or page data', () => {
    for (const detail of ['hello@regodue.com', 'sales@regodue.com', 'owner@regodue.com', 'js@regodue.com', '+359 88 123 4567', '(02) 8888 7777', 'tel:', 'mailto:', '+61 2 9999 9999']) {
      expect(body.replace(/<script type="text\/template">[\s\S]*?<\/script>/, '')).not.toContain(detail);
    }
  });

  it('leaves what it must not touch', () => {
    const head = served.slice(0, served.indexOf('<body'));
    expect(head).toContain('<title>Contact us: hello@regodue.com</title>');
    expect(head).toContain('content="hello@regodue.com"');
    expect(body).toContain('>ops@regodue.com</option>');
    expect(body).toContain('<script type="text/template">tpl@regodue.com</script>');
    expect(body).toContain('var n = 1 +44 -1;');
    expect(body).toContain('var p = "+44 20 7946 0958"');
    expect(body).toContain('Price 1 234 567 AUD on 2026-10-02, ID 20260102123');
  });

  it('changes nothing in a document without contact details', () => {
    const plain = '<html><head></head><body><p>Nothing to see: 1 234 567 on 2026-10-02</p></body></html>';
    expect(DocumentContactProtection.protect(plain)).toBe(plain);
  });

  it('round-trips through the codec', () => {
    for (const value of ['hello@regodue.com', 'tel:+61299999999', 'имейл@пример.бг']) {
      expect(ContactCodec.decode(ContactCodec.encode(value))).toBe(value);
    }
  });
});

describe('restore before hydration', () => {
  it('gives React exactly the markup it rendered — no mismatch — with the page data intact', async () => {
    const markup = renderToString(Page.tree());
    document.open();
    document.write(DocumentContactProtection.protect(Page.document(markup)));
    document.close();

    expect(document.getElementById('root')!.innerHTML).not.toBe(markup);
    DocumentContactRestore.restore(document);
    expect(document.getElementById('root')!.innerHTML).toBe(markup);
    expect(JSON.parse(document.getElementById('data')!.textContent || '')).toEqual(Page.DATA);

    const recoverable: unknown[] = [];
    await act(async () => {
      hydrateRoot(document.getElementById('root')!, Page.tree(), { onRecoverableError: (error) => recoverable.push(error) });
    });
    expect(recoverable).toEqual([]);
    const links = Array.from(document.querySelectorAll('#root a')).map((a) => [a.getAttribute('href'), a.textContent]);
    expect(links).toEqual([['mailto:hello@regodue.com?subject=Hi', 'hello@regodue.com'], ['tel:0288887777', '(02) 8888 7777']]);
  });
});
