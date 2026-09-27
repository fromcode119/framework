import { AssistantPreviewUtils } from '@ai/assistant-preview-utils';

describe('assistant preview path normalization', () => {
  it('rejects local filesystem paths', () => {
    expect(AssistantPreviewUtils.normalizePreviewPath('/home/dev/project/src/components/Blocks.jsx')).toBeUndefined();
    expect(AssistantPreviewUtils.normalizePreviewPath('/home/user/project/dist/bundle.js')).toBeUndefined();
    expect(AssistantPreviewUtils.normalizePreviewPath('C:\\repo\\project\\src\\index.tsx')).toBeUndefined();
  });

  it('accepts web urls and site-relative paths', () => {
    expect(AssistantPreviewUtils.normalizePreviewPath('https://example.com/about')).toBe('https://example.com/about');
    expect(AssistantPreviewUtils.normalizePreviewPath('/about')).toBe('/about');
    expect(AssistantPreviewUtils.normalizePreviewPath('contact')).toBe('/contact');
  });

  it('rejects web urls that actually point at local filesystem paths', () => {
    expect(
      AssistantPreviewUtils.normalizePreviewPath(
        'http://localhost:3000/home/dev/workspace/test/my-app/dist/bundle.js',
      ),
    ).toBeUndefined();
  });
});
