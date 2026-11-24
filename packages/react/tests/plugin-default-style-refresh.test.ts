import { PluginDefaultStyle } from '@react/view/plugin-default-style';

/**
 * A page restored from the browser's cache keeps the server's lifted sheet from an older release while
 * the newer bundle runs: the new markup then painted with the old rules (a player with no button).
 */
describe('PluginDefaultStyle.inject', () => {
  it('refreshes a lifted server copy whose text is older than the running bundle', () => {
    const lifted = document.createElement('style');
    lifted.setAttribute(PluginDefaultStyle.ATTRIBUTE, 'demo-stale');
    lifted.textContent = '.a{color:red}';
    document.head.append(lifted);

    PluginDefaultStyle.inject('demo-stale', '.a{color:red}.b{color:blue}');

    const sheets = document.head.querySelectorAll(`style[${PluginDefaultStyle.ATTRIBUTE}="demo-stale"]`);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].textContent).toBe('.a{color:red}.b{color:blue}');
  });
});
