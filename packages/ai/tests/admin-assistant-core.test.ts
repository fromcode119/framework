import { normalizePreviewPath, resolveExecutionPreviewPaths } from '../src/admin-assistant-core';

describe('assistant preview path normalization', () => {
  it('rejects local filesystem paths', () => {
    expect(normalizePreviewPath('/Users/kristian/project/themes/demo/src/components/Blocks.jsx')).toBeUndefined();
    expect(normalizePreviewPath('/home/user/project/dist/bundle.js')).toBeUndefined();
    expect(normalizePreviewPath('C:\\repo\\project\\src\\index.tsx')).toBeUndefined();
  });

  it('accepts web urls and site-relative paths', () => {
    expect(normalizePreviewPath('https://example.com/about')).toBe('https://example.com/about');
    expect(normalizePreviewPath('/about')).toBe('/about');
    expect(normalizePreviewPath('contact')).toBe('/contact');
  });

  it('rejects web urls that actually point at local filesystem paths', () => {
    expect(
      normalizePreviewPath(
        'http://localhost:3000/Users/kristian/Work/Clients/Fromcode%20119/Domains/fromcode.com/Source/test/my-app/themes/snapbilt-bundle-demo/ui/bundle.js',
      ),
    ).toBeUndefined();
  });

  it('does not return preview paths for file replace execution results', () => {
    const result = resolveExecutionPreviewPaths({
      type: 'mcp_call',
      tool: 'themes.files.replace_text',
      input: {
        path: '/Users/kristian/project/themes/demo/src/components/Blocks.jsx',
      },
      output: {},
    });
    expect(result.beforePath).toBeUndefined();
    expect(result.afterPath).toBeUndefined();
    expect(result.currentPath).toBeUndefined();
  });
});
