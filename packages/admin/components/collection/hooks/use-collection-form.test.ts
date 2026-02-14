import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCollectionForm } from './use-collection-form';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
    put: vi.fn(),
  }
}));

describe('./use-collection-form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with initialData', () => {
    const initialData = { title: 'Test' };
    const { result } = renderHook(() => useCollectionForm({
      collectionSlug: 'posts',
      isNew: true,
      initialData
    }));

    expect(result.current.formData).toEqual(initialData);
  });

  it('should update field value and set dirty state', () => {
    const { result } = renderHook(() => useCollectionForm({
      collectionSlug: 'posts',
      isNew: true
    }));

    act(() => {
      result.current.setFieldValue('title', 'New Title');
    });

    expect(result.current.formData.title).toBe('New Title');
    expect(result.current.isDirty).toBe(true);
  });

  it('should call api.post on submit when isNew is true', async () => {
    const mockResult = { id: 1, title: 'Test' };
    (api.post as any).mockResolvedValue(mockResult);

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useCollectionForm({
      collectionSlug: 'posts',
      isNew: true,
      onSuccess
    }));

    act(() => {
      result.current.setFieldValue('title', 'Test');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(api.post).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(mockResult);
    expect(result.current.isDirty).toBe(false);
  });

  it('should call api.put on submit when isNew is false', async () => {
    const mockResult = { id: 1, title: 'Updated' };
    (api.put as any).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useCollectionForm({
      collectionSlug: 'posts',
      isNew: false,
      initialData: { id: 1, title: 'Test' }
    }));

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(api.put).toHaveBeenCalled();
  });
});
