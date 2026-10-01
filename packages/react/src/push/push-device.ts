import type { IPushDeviceRequests } from '@react/push/interfaces/push-device-requests.interface';

/**
 * THIS browser's push notifications for one surface of the site — on or off.
 *
 * Turning them on asks the browser for permission, registers the surface's service worker, subscribes
 * with the site's public key and tells the api; turning them off undoes both. Whether they are on is
 * read from the browser itself, never remembered separately, so the switch cannot disagree with what
 * the browser will actually show.
 */
export class PushDevice {
  constructor(
    private readonly options: { workerUrl: string; scope: string; surface: string; requests: IPushDeviceRequests },
  ) {}

  /** This browser can receive push at all. (On an iPhone, only once the site is on the Home Screen.) */
  static get supported(): boolean {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  /** The person said no in the browser: only the browser's own site settings can undo that. */
  static get blocked(): boolean {
    return PushDevice.supported && Notification.permission === 'denied';
  }

  async isOn(): Promise<boolean> {
    if (!PushDevice.supported || Notification.permission !== 'granted') return false;
    const registration = await navigator.serviceWorker.getRegistration(this.options.scope);
    return Boolean(await registration?.pushManager.getSubscription());
  }

  /** Returns false when the person declined in the browser's prompt. */
  async turnOn(): Promise<boolean> {
    if (!PushDevice.supported) return false;
    if ((await Notification.requestPermission()) !== 'granted') return false;
    const registration = await navigator.serviceWorker.register(this.options.workerUrl, { scope: this.options.scope });
    await navigator.serviceWorker.ready;
    const applicationServerKey = PushDevice.bytes(await this.options.requests.publicKey());
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    await this.options.requests.save({ surface: this.options.surface, subscription: subscription.toJSON(), label: PushDevice.label() });
    return true;
  }

  async turnOff(): Promise<void> {
    if (!PushDevice.supported) return;
    const registration = await navigator.serviceWorker.getRegistration(this.options.scope);
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await this.options.requests.remove(subscription.endpoint);
    await subscription.unsubscribe();
  }

  /** "Chrome on Mac" — enough for a person to tell their devices apart in a list. */
  static label(): string {
    const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
    const browser = /Edg\//.test(agent) ? 'Edge' : /Firefox\//.test(agent) ? 'Firefox' : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : '';
    const system = /iPhone|iPad/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android' : /Mac OS X/.test(agent) ? 'Mac' : /Windows/.test(agent) ? 'Windows' : /Linux/.test(agent) ? 'Linux' : '';
    return [browser, system].filter(Boolean).join(' · ');
  }

  private static bytes(base64url: string): Uint8Array {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
    return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  }
}
