import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { EmailAddressCipher } from '@react/email/email-address-cipher';
import { ProtectedEmail } from '@react/email/protected-email';

/**
 * A CDN's email obfuscation rewrites the HTML after the server rendered it, so React hydrates against
 * markup it never produced (#418) and discards the server render. ProtectedEmail must keep the address out
 * of the served HTML AND hydrate cleanly — the second half is the whole reason it exists.
 */
describe('EmailAddressCipher', () => {
  it('round-trips, deterministically', () => {
    for (const address of ['hello@regodue.com', 'a.b+c@mail.example.co.uk', 'имейл@пример.бг']) {
      expect(EmailAddressCipher.decode(EmailAddressCipher.encode(address))).toBe(address);
      expect(EmailAddressCipher.encode(address)).toBe(EmailAddressCipher.encode(address));
    }
  });

  it('decodes nothing it did not encode', () => {
    expect(EmailAddressCipher.decode('zz')).toBe('');
    expect(EmailAddressCipher.decode('0a123')).toBe('');
  });

  it('finds addresses in running text', () => {
    expect('Write to hello@regodue.com or sales@x.co.uk.'.match(EmailAddressCipher.ADDRESS_PATTERN)).toEqual(['hello@regodue.com', 'sales@x.co.uk']);
  });
});

describe('ProtectedEmail', () => {
  const address = 'hello@regodue.com';

  it('keeps the address out of the server markup', () => {
    const html = renderToString(<ProtectedEmail address={address} protect />);
    expect(html).not.toContain(address);
    expect(html).not.toContain('mailto:');
    expect(html).toContain(`data-fc-email="${EmailAddressCipher.encode(address)}"`);
    expect(html).toContain('<bdo dir="rtl">moc.eudoger@olleh</bdo>');
  });

  it('hydrates without a mismatch, then becomes a working mailto link', async () => {
    const markup = renderToString(<ProtectedEmail address={address} target={`${address}?subject=Hi`} protect />);
    const container = document.createElement('div');
    container.innerHTML = markup;
    document.body.appendChild(container);
    const recoverable: unknown[] = [];

    await act(async () => {
      hydrateRoot(container, <ProtectedEmail address={address} target={`${address}?subject=Hi`} protect />, {
        onRecoverableError: (error) => recoverable.push(error),
      });
    });

    expect(recoverable).toEqual([]);
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe(`mailto:${address}?subject=Hi`);
    expect(link?.textContent).toBe(address);
    expect(container.querySelector('[data-fc-email]')).toBeNull();
  });

  it('protects an address in running text and restores it as text', async () => {
    const markup = renderToString(<ProtectedEmail address={address} link={false} protect />);
    expect(markup).not.toContain(address);
    const container = document.createElement('div');
    container.innerHTML = markup;
    await act(async () => {
      hydrateRoot(container, <ProtectedEmail address={address} link={false} protect />);
    });
    expect(container.textContent).toBe(address);
    expect(container.querySelector('a')).toBeNull();
  });

  it('is a plain link when its owner turns protection off', () => {
    expect(renderToString(<ProtectedEmail address={address} protect={false} />)).toBe(`<a href="mailto:${address}">${address}</a>`);
  });
});
