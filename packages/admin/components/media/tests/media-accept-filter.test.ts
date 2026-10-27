import { describe, it, expect } from 'vitest';
import { MediaAcceptFilter } from '@/components/media/media-accept-filter';

describe('MediaAcceptFilter', () => {
  it('keeps only well-formed tokens, lowercased and once each', () => {
    const filter = MediaAcceptFilter.from(' Image/* ,application/pdf, image/*, <x>, jpg');
    expect(filter.tokens).toEqual(['image/*', 'application/pdf']);
    expect(filter.query).toBe('image/*,application/pdf');
    expect(filter.uploadAccept).toBe('image/*,application/pdf');
  });

  it('matches a wildcard by prefix and a full type exactly', () => {
    const filter = MediaAcceptFilter.from('image/*,application/pdf');
    expect(filter.matches({ mimeType: 'image/webp' } as any)).toBe(true);
    expect(filter.matches({ mimeType: 'application/pdf' } as any)).toBe(true);
    expect(filter.matches({ mimeType: 'video/mp4' } as any)).toBe(false);
  });

  it('accepts everything and offers the stored formats when nothing is declared', () => {
    const filter = MediaAcceptFilter.from(undefined);
    expect(filter.active).toBe(false);
    expect(filter.query).toBe('');
    expect(filter.uploadAccept).toBe(MediaAcceptFilter.ANY);
    expect(filter.matches({ mimeType: 'video/mp4' } as any)).toBe(true);
  });
});
