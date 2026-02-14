import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSlugValidation } from './use-slug-validation';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  }
}));

describe('./use-slug-validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not validate if slug or collectionSlug is missing', () => {
    const { result } = renderHook(() => useSlugValidation({
      slug: '',
      collectionSlug: '',
      isNew: true
    }));

    expect(result.current.warning).toBe(null);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('should show warning if slug is taken and it is a new record', async () => {
    (api.get as any).mockResolvedValue({
      docs: [{ id: 1, title: 'Taken', slug: 'test' }]
    });

    const { result } = renderHook(() => useSlugValidation({
      slug: 'test',
      collectionSlug: 'posts',
      isNew: true
    }));

    await waitFor(() => {
      expect(result.current.warning).toContain('already taken');
    }, { timeout: 1000 });
  });

  it('should not show warning if slug is taken by the same record in edit mode', async () => {
    (api.get as any).mockResolvedValue({
      docs: [{ id: 1, title: 'Same Record', slug: 'test' }]
    });

    const { result } = renderHook(() => useSlugValidation({
      slug: 'test',
      collectionSlug: 'posts',
      currentId: '1',
      isNew: false
    }));

    // Wait for the debounce and state update
    await waitFor(() => {
      expect(result.current.warning).toBe(null);
    }, { timeout: 1000 });
  });

  it('should show warning in edit mode when another record has the same slug', async () => {
    (api.get as any).mockResolvedValue({
      docs: [
        { id: 1, title: 'Current Record', slug: 'test' },
        { id: 2, title: 'Strategy', slug: 'test' }
      ]
    });

    const { result } = renderHook(() => useSlugValidation({
      slug: 'test',
      collectionSlug: 'pages',
      currentId: '1',
      isNew: false
    }));

    await waitFor(() => {
      expect(result.current.warning).toContain('Strategy');
    }, { timeout: 1000 });
  });
});
