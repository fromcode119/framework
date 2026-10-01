import { describe, expect, it } from 'vitest';
import { PushNotificationWorker } from '@core/push/push-notification-worker';

/** A clicked notification opens a page of THIS site, inside the worker's scope — never anywhere else. */
describe('where a clicked notification goes', () => {
  it('resolves a site path inside the console\'s scope', () => {
    expect(PushNotificationWorker.target('/helpdesk?conversation=4', 'https://portal.shop.test/admin/')).toBe('https://portal.shop.test/admin/helpdesk?conversation=4');
    expect(PushNotificationWorker.target('/account/support', 'https://shop.test/')).toBe('https://shop.test/account/support');
  });

  it('sends anything that leaves the site or the scope to the scope itself', () => {
    expect(PushNotificationWorker.target('https://evil.test/phish', 'https://shop.test/')).toBe('https://shop.test/');
    // A protocol-relative link is read as a path of this site, never as another host.
    expect(PushNotificationWorker.target('//evil.test/phish', 'https://shop.test/')).toBe('https://shop.test/evil.test/phish');
    expect(PushNotificationWorker.target('javascript:alert(1)', 'https://shop.test/')).toBe('https://shop.test/');
    expect(PushNotificationWorker.target('', 'https://shop.test/admin/')).toBe('https://shop.test/admin/');
  });
});
