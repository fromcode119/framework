import { describe, expect, it } from 'vitest';
import { ThemeHeadModel } from '@/lib/document/theme-head-model';

describe('ThemeHeadModel warm-up script', () => {
  const model = (entry: string, chunks: string[] = []) => Object.assign(Object.create(ThemeHeadModel.prototype), {
    versionedEntryUrl: entry, modulePreloadUrls: chunks, externalStylesheets: [],
  }) as ThemeHeadModel;

  it('fetches the entry and chunks without parsing them as modules', () => {
    const script = model('https://a.test/ui/bundle.js?v=1', ['https://a.test/ui/vendor.js']).warmupScript;
    expect(script).toContain("l.rel='preload'");
    expect(script).toContain("l.as='script'");
    expect(script).not.toContain('modulepreload');
    expect(script).toContain('https://a.test/ui/vendor.js');
  });

  it('cannot close its own script element', () => {
    const script = model('https://a.test/x.js?</script><script>alert(1)</script>').warmupScript;
    expect(script).not.toContain('</script>');
    expect(script).not.toContain('<');
  });
});
