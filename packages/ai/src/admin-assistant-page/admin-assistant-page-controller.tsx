import { ChatMode } from '@ai/enums/chat-mode.enum';
import type { ReactNode } from 'react';
import { watch } from '@fromcode119/react-class-components';
import { AdminAssistantPageView } from '@ai/admin-assistant-page/admin-assistant-page-view';
import { AdminAssistantPageConversation } from '@ai/admin-assistant-page/admin-assistant-page-conversation';

/**
 * The admin-assistant page — the reactive "model" behind the presentational view.
 *
 * The top of the chain: it owns the lifecycle. `componentDidMount` starts every effect once, the
 * `@watch` methods re-run the ones a given field invalidates, and `render()` hands `this` to
 * `AdminAssistantPageView`. Class-based (reactor): `@state` fields, getters for derived values,
 * `@bound` handlers and lifecycle-folded effects — no hooks.
 *
 * What the page can DO lives in the links below; see `AdminAssistantPageState` for the chain.
 */
export class AdminAssistantPageController extends AdminAssistantPageConversation {

  // ==================================================================================================
  //  Lifecycle — the former *-effects components folded into mount/watch/unmount.
  // ==================================================================================================
  componentDidMount(): void {
    this.onUnmount(() => {
      this.cancelled = true;
      this.pinCleanup?.();
      this.layoutPinCleanup?.();
      this.historyPinCleanup?.();
      this.toolsMenuCleanup?.();
      this.mobileEscCleanup?.();
      if (this.providerModelsTimer !== undefined) window.clearTimeout(this.providerModelsTimer);
    });

    // Layout effects
    this.autoResizeTextArea();
    this.syncViewport();
    this.listen(window, 'resize', this.syncViewport);
    this.attachScrollListener();
    this.runPinEffect();
    this.runLayoutPinEffect();
    this.runHistoryPinEffect();
    this.applyToolsMenuEffect();
    this.applyMobileEscapeEffect();

    // Data effects
    void this.loadIntegration();
    void this.loadTools();
    void this.loadSkills();

    // History effects
    this.applyThemeMode();
    void this.hydrateHistory();
    this.persistHistory();
    this.loadUiPrefs();
    this.writeUiPrefs();
  }

  render(): ReactNode {
    return <AdminAssistantPageView model={this} />;
  }

  // --- layout watchers ---
  @watch('prompt')
  protected onPromptChanged(): void {
    this.autoResizeTextArea();
  }

  @watch('loading')
  protected onLoadingChanged(loading: boolean): void {
    if (loading) {
      this.followLatest = true;
      this.loadingPhaseIndex = 0;
    } else {
      this.loadingPhaseIndex = 0;
    }
    if (this.chatMode !== ChatMode.AUTO && loading) this.loadingPhaseIndex = 0;
    this.runPinEffect();
    this.runLayoutPinEffect();
  }

  @watch('chatMode')
  protected onChatModeChanged(): void {
    if (this.chatMode !== ChatMode.AUTO && this.loading) this.loadingPhaseIndex = 0;
    this.writeUiPrefs();
  }

  @watch('messages')
  protected onMessagesChanged(): void {
    this.runPinEffect();
    this.runLayoutPinEffect();
    this.runHistoryPinEffect();
    this.syncLocalHistory();
  }

  @watch('messages')
  protected onActiveBatchChanged(): void {
    const nextIndexes = this.activeBatchId ? this.lastActions.map((_, index) => index) : [];
    const prev = this.selectedActionIndexes;
    if (prev.length === nextIndexes.length && prev.every((value, index) => value === nextIndexes[index])) return;
    this.selectedActionIndexes = nextIndexes;
  }

  @watch('showTools')
  protected onShowToolsChanged(): void {
    this.applyToolsMenuEffect();
  }

  @watch('showTechnicalDetails')
  protected onShowTechnicalDetailsChanged(): void {
    if (!this.showTechnicalDetails && this.showTools) this.showTools = false;
  }

  @watch('layoutState')
  protected onLayoutStateChanged(): void {
    this.applyMobileEscapeEffect();
    this.runLayoutPinEffect();
    this.writeUiPrefs();
  }

  @watch('historyHydrated')
  protected onHistoryHydratedChanged(): void {
    this.runHistoryPinEffect();
    this.persistHistory();
  }

  @watch('activeSessionId')
  protected onActiveSessionChanged(): void {
    this.runHistoryPinEffect();
    this.persistHistory();
  }

  @watch('themeMode')
  protected onThemeModeChanged(): void {
    this.applyThemeMode();
  }

  @watch('historySessions')
  protected onHistorySessionsChanged(): void {
    this.persistHistory();
  }

  @watch('historySource')
  protected onHistorySourceChanged(): void {
    this.persistHistory();
    this.syncLocalHistory();
  }

  @watch('checkingIntegration')
  protected onCheckingIntegrationChanged(): void {
    this.loadUiPrefs();
    this.scheduleProviderModels();
  }

  @watch('uiPrefsHydrated')
  protected onUiPrefsHydratedChanged(): void {
    this.scheduleProviderModels();
  }

  @watch('apiKey')
  protected onApiKeyChanged(): void {
    this.scheduleProviderModels();
  }

  @watch('hasSavedSecret')
  protected onHasSavedSecretChanged(): void {
    this.scheduleProviderModels();
  }

  @watch('provider')
  protected onProviderChanged(): void {
    this.scheduleProviderModels();
    this.writeUiPrefs();
    this.normalizeBaseUrl();
    this.syncLocalHistory();
  }

  @watch('model')
  protected onModelChanged(): void {
    this.scheduleProviderModels();
    this.writeUiPrefs();
    this.syncLocalHistory();
  }

  @watch('baseUrl')
  protected onBaseUrlChanged(): void {
    this.scheduleProviderModels();
    this.writeUiPrefs();
    this.normalizeBaseUrl();
  }

  @watch('skillId')
  protected onSkillIdChanged(): void {
    this.writeUiPrefs();
    this.syncLocalHistory();
  }

  @watch('sandboxMode')
  protected onSandboxModeChanged(): void {
    this.writeUiPrefs();
    this.syncLocalHistory();
  }
}
