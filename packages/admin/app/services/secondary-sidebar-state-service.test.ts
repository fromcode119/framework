import { describe, expect, it } from 'vitest';
import { SecondarySidebarStateService } from './secondary-sidebar-state-service';

describe('SecondarySidebarStateService', () => {
  const service = new SecondarySidebarStateService();

  it('resolves mobile mode under breakpoint', () => {
    expect(service.resolveMode({ viewportWidth: 500, isMini: false })).toBe('mobile');
  });

  it('resolves desktop mode for mini sidebar on desktop widths', () => {
    expect(service.resolveMode({ viewportWidth: 1280, isMini: true })).toBe('desktop');
  });

  it('resolves desktop mode for full sidebar on desktop widths', () => {
    expect(service.resolveMode({ viewportWidth: 1280, isMini: false })).toBe('desktop');
  });

  it('only shows docked panel in desktop mode with items', () => {
    expect(service.shouldShowPanel('desktop', true)).toBe(true);
    expect(service.shouldShowPanel('desktop', false)).toBe(false);
    expect(service.shouldShowPanel('mobile', true)).toBe(false);
  });

  it('shows overlay only in non-desktop modes when opened', () => {
    expect(service.shouldShowOverlay('mobile', true, true)).toBe(false);
    expect(service.shouldShowOverlay('minimal', true, true)).toBe(true);
    expect(service.shouldShowOverlay('desktop', true, true)).toBe(false);
    expect(service.shouldShowOverlay('mobile', true, false)).toBe(false);
  });

  it('shows trigger only in minimal mode with items', () => {
    expect(service.shouldShowTrigger('minimal', true)).toBe(true);
    expect(service.shouldShowTrigger('mobile', true)).toBe(false);
    expect(service.shouldShowTrigger('desktop', true)).toBe(false);
  });

  it('only closes overlay state on route change for minimal mode', () => {
    expect(service.shouldCloseOnRouteChange('minimal')).toBe(true);
    expect(service.shouldCloseOnRouteChange('mobile')).toBe(false);
    expect(service.shouldCloseOnRouteChange('desktop')).toBe(false);
  });
});
