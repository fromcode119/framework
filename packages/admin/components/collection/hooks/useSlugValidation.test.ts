import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSlugValidation } from './useSlugValidation';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  }
}));

describe('useSlugValidation', () => {
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
});
