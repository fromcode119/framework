import type { AssistantViewport } from '@ai/enums/assistant-viewport.enum';
import type { SidebarOverlay } from '@ai/enums/sidebar-overlay.enum';

export interface IAssistantLayoutState {
  viewport: AssistantViewport;
  leftOpen: boolean;
  rightOpen: boolean;
  overlay: SidebarOverlay;
}
