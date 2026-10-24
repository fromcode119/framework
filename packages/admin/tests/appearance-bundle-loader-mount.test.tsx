import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsoleMountConstants } from '@fromcode119/core/constants/console-mount.constants';
import { GlobalReadinessService } from '@/lib/global-readiness-service';
import { AppearanceBundleLoaderService } from '@/app/services/appearance-bundle-loader-service';

describe('an appearance on a console served at a site path', () => {
  afterEach(() => {
    document.documentElement.removeAttribute(ConsoleMountConstants.ATTRIBUTE);
    document.head.replaceChildren();
    vi.restoreAllMocks();
  });

  it('fetches its stylesheet under the mount, where the gateway serves it', async () => {
    document.documentElement.setAttribute(ConsoleMountConstants.ATTRIBUTE, '/admin');
    vi.spyOn(GlobalReadinessService, 'waitForReady').mockResolvedValue(undefined as never);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await AppearanceBundleLoaderService.ensureLoaded('mounted-look');

    const link = document.getElementById('fc-appearance-css-mounted-look') as HTMLLinkElement;
    expect(new URL(link.href).pathname).toBe('/admin/appearances/mounted-look/ui/appearance.css');
  });

  it('leaves the address alone on a console that is not mounted', async () => {
    vi.spyOn(GlobalReadinessService, 'waitForReady').mockResolvedValue(undefined as never);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await AppearanceBundleLoaderService.ensureLoaded('plain-look');

    const link = document.getElementById('fc-appearance-css-plain-look') as HTMLLinkElement;
    expect(new URL(link.href).pathname).toBe('/appearances/plain-look/ui/appearance.css');
  });
});
