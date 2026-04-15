import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { ProjectPaths } from '@fromcode119/core';
import { GET } from '../app/favicon.ico/route';
import { ServerApiUtils } from '../lib/server-api';

describe('favicon route', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('serves the active theme favicon from theme public assets', async () => {
    vi.spyOn(ServerApiUtils, 'buildSystemFrontendPath').mockReturnValue('/api/v1/system/frontend');
    vi.spyOn(ServerApiUtils, 'serverFetchJson').mockResolvedValue({
      activeTheme: { slug: 'vselenskiportal88' },
    });
    vi.spyOn(ProjectPaths, 'getThemesDir').mockReturnValue('/repo/themes');
    vi.mocked(existsSync).mockImplementation((candidate) => String(candidate) === '/repo/themes/vselenskiportal88/public/favicon.ico');
    vi.mocked(readFile).mockResolvedValue(Buffer.from('ico'));

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/x-icon');
    expect(readFile).toHaveBeenCalledWith('/repo/themes/vselenskiportal88/public/favicon.ico');
  });

  it('returns 404 when the active theme has no favicon asset', async () => {
    vi.spyOn(ServerApiUtils, 'buildSystemFrontendPath').mockReturnValue('/api/v1/system/frontend');
    vi.spyOn(ServerApiUtils, 'serverFetchJson').mockResolvedValue({
      activeTheme: { slug: 'snapbilt-theme' },
    });
    vi.spyOn(ProjectPaths, 'getThemesDir').mockReturnValue('/repo/themes');
    vi.spyOn(ProjectPaths, 'getPackagesDir').mockReturnValue('/repo/packages');
    vi.mocked(existsSync).mockImplementation((candidate) => String(candidate) === '/repo/packages/frontend/public/brand/atlantis-mark-indigo.png');
    vi.mocked(readFile).mockResolvedValue(Buffer.from('fallback'));

    const response = await GET();

    expect(response.status).toBe(200);
    expect(readFile).toHaveBeenCalledWith('/repo/packages/frontend/public/brand/atlantis-mark-indigo.png');
  });

  it('returns 204 when no theme or framework favicon is available', async () => {
    vi.spyOn(ServerApiUtils, 'buildSystemFrontendPath').mockReturnValue('/api/v1/system/frontend');
    vi.spyOn(ServerApiUtils, 'serverFetchJson').mockResolvedValue({
      activeTheme: { slug: 'snapbilt-theme' },
    });
    vi.spyOn(ProjectPaths, 'getThemesDir').mockReturnValue('/repo/themes');
    vi.spyOn(ProjectPaths, 'getPackagesDir').mockReturnValue('/repo/packages');
    vi.mocked(existsSync).mockReturnValue(false);

    const response = await GET();

    expect(response.status).toBe(204);
    expect(readFile).not.toHaveBeenCalled();
  });

  it('falls back to the framework favicon when theme resolution throws', async () => {
    vi.spyOn(ServerApiUtils, 'buildSystemFrontendPath').mockReturnValue('/api/v1/system/frontend');
    vi.spyOn(ServerApiUtils, 'serverFetchJson').mockRejectedValue(new Error('metadata unavailable'));
    vi.spyOn(ProjectPaths, 'getPackagesDir').mockReturnValue('/repo/packages');
    vi.mocked(existsSync).mockImplementation((candidate) => String(candidate) === '/repo/packages/frontend/public/brand/atlantis-mark-indigo.png');
    vi.mocked(readFile).mockResolvedValue(Buffer.from('fallback'));

    const response = await GET();

    expect(response.status).toBe(200);
    expect(readFile).toHaveBeenCalledWith('/repo/packages/frontend/public/brand/atlantis-mark-indigo.png');
  });
});