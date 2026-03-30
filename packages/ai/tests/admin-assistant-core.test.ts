import { AssistantPreviewUtils } from '../src/admin-assistant-core';

describe('assistant preview path normalization', () => {
  it('rejects local filesystem paths', () => {
    expect(AssistantPreviewUtils.normalizePreviewPath('/Users/kristian/project/src/components/Blocks.jsx')).toBeUndefined();
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
        'http://localhost:3000/Users/kristian/Work/Clients/Fromcode%20119/Domains/fromcode.com/Source/test/my-app/dist/bundle.js',
      ),
    ).toBeUndefined();
  });
});
