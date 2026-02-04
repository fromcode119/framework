import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useSlugGeneration } from './useSlugGeneration';

describe('useSlugGeneration', () => {
  it('should auto-generate slug when isNew and not manually edited', () => {
    const onSlugGenerate = vi.fn();
    renderHook(() => useSlugGeneration({
      sourceValue: 'Hello World',
      isNew: true,
      manuallyEdited: false,
      onSlugGenerate
    }));

    expect(onSlugGenerate).toHaveBeenCalledWith('hello-world');
  });

  it('should not auto-generate if already manually edited', () => {
    const onSlugGenerate = vi.fn();
    const { result } = renderHook(() => useSlugGeneration({
      sourceValue: 'Hello World',
      isNew: true,
      manuallyEdited: true,
      onSlugGenerate
    }));

    expect(onSlugGenerate).not.toHaveBeenCalled();
    expect(result.current.manuallyEdited).toBe(true);
  });

  it('should update manuallyEdited state when setManuallyEdited is called', () => {
    const onSlugGenerate = vi.fn();
    const { result } = renderHook(() => useSlugGeneration({
      sourceValue: 'Hello World',
      isNew: true,
      manuallyEdited: false,
      onSlugGenerate
    }));

    act(() => {
      result.current.setManuallyEdited(true);
    });

    expect(result.current.manuallyEdited).toBe(true);
  });
});
