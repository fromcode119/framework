import { describe, expect, it } from 'vitest';
import { SecondarySidebarStateService } from '@/app/services/secondary-sidebar-state-service';
import { SecondarySidebarMode } from '@/app/services/enums/secondary-sidebar-mode.enum';

describe('SecondarySidebarStateService', () => {
  const service = new SecondarySidebarStateService();

  it('resolves mobile mode under breakpoint', () => {
    expect(service.resolveMode({ viewportWidth: 500, isMini: false })).toBe(SecondarySidebarMode.MOBILE);
  });

  it('resolves desktop mode for mini sidebar on desktop widths', () => {
    expect(service.resolveMode({ viewportWidth: 1280, isMini: true })).toBe(SecondarySidebarMode.DESKTOP);
  });

  it('resolves desktop mode for full sidebar on desktop widths', () => {
    expect(service.resolveMode({ viewportWidth: 1280, isMini: false })).toBe(SecondarySidebarMode.DESKTOP);
  });

  it('only shows docked panel in desktop mode with items', () => {
    expect(service.shouldShowPanel(SecondarySidebarMode.DESKTOP, true)).toBe(true);
    expect(service.shouldShowPanel(SecondarySidebarMode.DESKTOP, false)).toBe(false);
    expect(service.shouldShowPanel(SecondarySidebarMode.MOBILE, true)).toBe(false);
  });

  it('shows overlay only in non-desktop modes when opened', () => {
    expect(service.shouldShowOverlay(SecondarySidebarMode.MOBILE, true, true)).toBe(false);
    expect(service.shouldShowOverlay(SecondarySidebarMode.MINIMAL, true, true)).toBe(true);
    expect(service.shouldShowOverlay(SecondarySidebarMode.DESKTOP, true, true)).toBe(false);
    expect(service.shouldShowOverlay(SecondarySidebarMode.MOBILE, true, false)).toBe(false);
  });

  it('shows trigger only in minimal mode with items', () => {
    expect(service.shouldShowTrigger(SecondarySidebarMode.MINIMAL, true)).toBe(true);
    expect(service.shouldShowTrigger(SecondarySidebarMode.MOBILE, true)).toBe(false);
    expect(service.shouldShowTrigger(SecondarySidebarMode.DESKTOP, true)).toBe(false);
  });

  it('only closes overlay state on route change for minimal mode', () => {
    expect(service.shouldCloseOnRouteChange(SecondarySidebarMode.MINIMAL)).toBe(true);
    expect(service.shouldCloseOnRouteChange(SecondarySidebarMode.MOBILE)).toBe(false);
    expect(service.shouldCloseOnRouteChange(SecondarySidebarMode.DESKTOP)).toBe(false);
  });
});
