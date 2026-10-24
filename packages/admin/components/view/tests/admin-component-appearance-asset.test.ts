// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { ConsoleMountConstants } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';

class MarkProbe extends AdminComponent {
  markSrc(): string {
    return this.appearanceAsset('mark.png');
  }
}

const probe = () => {
  const component = new MarkProbe({});
  (component as unknown as { context: unknown }).context = { activeAppearanceId: 'replybird' };
  return component;
};

describe('AdminComponent.appearanceAsset', () => {
  afterEach(() => document.documentElement.removeAttribute(ConsoleMountConstants.ATTRIBUTE));

  it('addresses a file in the active appearance ui folder', () => {
    expect(probe().markSrc()).toBe('/appearances/replybird/ui/mark.png');
  });

  it('puts it under the console path when the console is mounted at one', () => {
    document.documentElement.setAttribute(ConsoleMountConstants.ATTRIBUTE, '/admin');
    expect(probe().markSrc()).toBe('/admin/appearances/replybird/ui/mark.png');
  });
});
