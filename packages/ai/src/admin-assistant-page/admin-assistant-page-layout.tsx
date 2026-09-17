import { ThemeMode } from '@fromcode119/core/client';
import { SidebarOverlay } from '@ai/enums/sidebar-overlay.enum';
import { AssistantViewport } from '@ai/enums/assistant-viewport.enum';
import { bound, Platform } from '@fromcode119/react-class-components';
import { AdminAssistantPageStorage } from '@ai/admin-assistant-page/admin-assistant-page-storage';

/**
 * Where things sit and how the view scrolls.
 *
 * "Pinned to the bottom" is not one scroll: content arrives asynchronously (markdown, images, a
 * growing stream), so each pin schedules several passes and hands back a canceller. That is why every
 * pin effect stores its cleanup — starting a second without cancelling the first leaves two sets of
 * timers fighting over the scroll position.
 *
 * `followLatest` is what makes it stop being annoying: scroll up and the page stops chasing.
 */
export class AdminAssistantPageLayout extends AdminAssistantPageStorage {

  // --- layout / scroll helpers ---
  @bound
  protected autoResizeTextArea(): void {
    const area = this.textareaRef.current;
    if (!area) return;
    area.style.height = '0px';
    area.style.height = `${Math.min(Math.max(area.scrollHeight, 56), 180)}px`;
  }

  protected scrollToBottom(behavior: ScrollBehavior = 'auto', force = false): void {
    const viewport = this.viewportRef.current;
    if (!viewport || (!force && !this.followLatest)) return;
    const top = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    if (behavior === 'auto') viewport.scrollTop = top;
    else viewport.scrollTo({ top, behavior });
    if (Math.abs(viewport.scrollTop - top) > 2) viewport.scrollTop = top;
    this.followLatest = true;
  }

  protected pinToBottom(preferredBehavior: ScrollBehavior = 'auto'): () => void {
    this.scrollToBottom(preferredBehavior, true);
    if (!Platform.isBrowser) return () => {};
    const rafA = window.requestAnimationFrame(() => this.scrollToBottom('auto', true));
    const rafB = window.requestAnimationFrame(() => window.requestAnimationFrame(() => this.scrollToBottom('auto', true)));
    const t1 = window.setTimeout(() => this.scrollToBottom('auto', true), 80);
    const t2 = window.setTimeout(() => this.scrollToBottom('auto', true), 220);
    const t3 = window.setTimeout(() => this.scrollToBottom('auto', true), 420);
    return () => {
      window.cancelAnimationFrame(rafA);
      window.cancelAnimationFrame(rafB);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }

  @bound
  protected updateToolsMenuPosition(): void {
    if (!this.showTools || !this.toolsButtonRef.current || !Platform.isBrowser) return;
    const rect = this.toolsButtonRef.current.getBoundingClientRect();
    const menuWidth = Math.min(340, Math.max(280, Math.round(rect.width + 52)));
    const viewportPadding = 8;
    const measuredHeight = this.toolsDropdownRef.current?.offsetHeight || 340;
    let top = rect.bottom + 8;
    if (top + measuredHeight > window.innerHeight - viewportPadding) top = Math.max(viewportPadding, rect.top - measuredHeight - 8);
    const left = Math.min(Math.max(viewportPadding, rect.right - menuWidth), Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding));
    this.toolsMenuStyle = { left, top, width: menuWidth };
  }

  @bound
  protected syncViewport(): void {
    if (!Platform.isBrowser) return;
    const nextViewport = window.innerWidth <= 900 ? AssistantViewport.MOBILE : AssistantViewport.DESKTOP;
    if (this.layoutState.viewport === nextViewport) return;
    this.layoutState = { ...this.layoutState, viewport: nextViewport, overlay: SidebarOverlay.NONE };
  }

  // --- panel toggles ---
  @bound toggleHistoryPanel(): void { this.layoutState = this.layoutState.viewport === AssistantViewport.MOBILE ? { ...this.layoutState, overlay: this.layoutState.overlay === SidebarOverlay.LEFT ? SidebarOverlay.NONE : SidebarOverlay.LEFT } : { ...this.layoutState, leftOpen: !this.layoutState.leftOpen }; }
  @bound toggleSettingsPanel(): void { this.layoutState = this.layoutState.viewport === AssistantViewport.MOBILE ? { ...this.layoutState, overlay: this.layoutState.overlay === SidebarOverlay.RIGHT ? SidebarOverlay.NONE : SidebarOverlay.RIGHT } : { ...this.layoutState, rightOpen: !this.layoutState.rightOpen }; }
  @bound closeHistoryPanel(): void { this.layoutState = this.layoutState.viewport === AssistantViewport.MOBILE ? { ...this.layoutState, overlay: this.layoutState.overlay === SidebarOverlay.LEFT ? SidebarOverlay.NONE : this.layoutState.overlay } : { ...this.layoutState, leftOpen: false }; }
  @bound closeSettingsPanel(): void { this.layoutState = this.layoutState.viewport === AssistantViewport.MOBILE ? { ...this.layoutState, overlay: this.layoutState.overlay === SidebarOverlay.RIGHT ? SidebarOverlay.NONE : this.layoutState.overlay } : { ...this.layoutState, rightOpen: false }; }
  @bound toggleThemeMode(): void { this.themeMode = this.themeMode === ThemeMode.DARK ? ThemeMode.LIGHT : ThemeMode.DARK; }

  // --- layout effect implementations ---
  protected attachScrollListener(): void {
    const viewport = this.viewportRef.current;
    if (!viewport) return;
    const onScroll = () => {
      const distanceToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      this.followLatest = distanceToBottom <= this.followDistanceThreshold;
    };
    onScroll();
    this.listen(viewport, 'scroll', onScroll, { passive: true });
  }

  protected runPinEffect(): void {
    this.pinCleanup?.();
    this.pinCleanup = undefined;
    if (this.messages.length <= 0) return;
    this.pinCleanup = this.pinToBottom(this.messages.length > 1 ? 'smooth' : 'auto');
  }

  protected runLayoutPinEffect(): void {
    this.layoutPinCleanup?.();
    this.layoutPinCleanup = undefined;
    if (!this.hasConversation) return;
    this.layoutPinCleanup = this.pinToBottom('auto');
  }

  protected runHistoryPinEffect(): void {
    this.historyPinCleanup?.();
    this.historyPinCleanup = undefined;
    if (!this.historyHydrated || !this.hasConversation) return;
    this.historyPinCleanup = this.pinToBottom('auto');
  }

  protected applyToolsMenuEffect(): void {
    this.toolsMenuCleanup?.();
    this.toolsMenuCleanup = undefined;
    if (!this.showTools) { this.toolsMenuStyle = null; return; }
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideTrigger = !!(this.toolsMenuRef.current && this.toolsMenuRef.current.contains(target));
      const insideMenu = !!(this.toolsDropdownRef.current && this.toolsDropdownRef.current.contains(target));
      if (!insideTrigger && !insideMenu) this.showTools = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.showTools = false;
    };
    this.updateToolsMenuPosition();
    const rafId = window.requestAnimationFrame(this.updateToolsMenuPosition);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', this.updateToolsMenuPosition);
    window.addEventListener('scroll', this.updateToolsMenuPosition, true);
    this.toolsMenuCleanup = () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', this.updateToolsMenuPosition);
      window.removeEventListener('scroll', this.updateToolsMenuPosition, true);
    };
  }

  protected applyMobileEscapeEffect(): void {
    this.mobileEscCleanup?.();
    this.mobileEscCleanup = undefined;
    if (this.layoutState.viewport !== AssistantViewport.MOBILE) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.layoutState = { ...this.layoutState, overlay: SidebarOverlay.NONE };
    };
    window.addEventListener('keydown', onKeyDown);
    this.mobileEscCleanup = () => window.removeEventListener('keydown', onKeyDown);
  }
}
