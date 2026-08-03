import { ConversationMode } from '@ai/enums/conversation-mode.enum';
import { AssistantViewport } from '@ai/enums/assistant-viewport.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { HistoryPanel } from '@ai/panels/history-panel';
import { ToolsOverlay } from '@ai/panels/tools-overlay';
import { AssistantComposer, AssistantConversation, AssistantActionCard, AssistantSimpleTopBar, AssistantSettingsDrawer } from '@ai/components';
import { GlassMorphism } from '@ai/ui/glass-morphism';
import { AssistantFormatUtils } from '@ai/assistant-format-utils';
import { AssistantProviderUtils } from '@ai/assistant-provider-utils';
import type { AdminAssistantPageController } from '@ai/admin-assistant-page/admin-assistant-page-controller';

/**
 * Root layout for the admin assistant page (history rail, conversation, composer, settings drawer, overlays).
 * Presentational → `PureReactor`; the sole prop is the controller model (read `this.model.*`), markup split
 * into private render methods, the single composer-mode adapter is a `@bound` method — no hooks, no raw React.
 */
export class AdminAssistantPageView extends PureReactor {
  private static readonly ACTION_DOCK_OFFSET = 16;

  @prop declare model: AdminAssistantPageController;

  private get isMobileViewport(): boolean {
    return this.model.layoutState.viewport === AssistantViewport.MOBILE;
  }

  private get viewportBottomPadding(): number {
    if (this.model.activeBatchEntry) return 220;
    return this.model.hasConversation ? 48 : 140;
  }

  @bound
  protected onComposerModeChange(mode: ConversationMode): void {
    this.model.setChatMode(AssistantProviderUtils.conversationModeToChatMode(mode));
  }

  private renderMain(): ReactNode {
    return (
      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg)]">
        <AssistantSimpleTopBar
          sessionTitle="Atlantis Intelligence"
          historyCount={this.model.historySessions.length}
          onBackToAdmin={this.model.openAdvancedWorkspace}
          onHistoryToggle={this.model.toggleHistoryPanel}
          onSettingsOpen={this.model.toggleSettingsPanel}
          onThemeToggle={this.model.toggleThemeMode}
          themeMode={this.model.themeMode}
        />
        <section className="relative min-h-0 flex-1 overflow-hidden">
          <AssistantActionCard
            batch={this.model.activeBatchEntry?.actionBatch}
            actions={this.model.activeBatchEntry?.actions || []}
            selectedIndexes={this.model.selectedActionIndexes}
            onToggleAction={this.model.toggleActionIndex}
            onSelectAll={this.model.selectAllActions}
            onDeselectAll={this.model.clearSelectedActions}
            onPreview={this.model.runPreview}
            onApply={this.model.runApply}
            isRunning={this.model.executing}
            executionSummary={this.model.activeBatchSummary}
            mode={this.model.conversationMode}
            placement="bottom"
            bottomOffset={AdminAssistantPageView.ACTION_DOCK_OFFSET}
          />
          <AssistantConversation
            viewportRef={this.model.viewportRef}
            viewportBottomPadding={this.viewportBottomPadding}
            hasConversation={this.model.hasConversation}
            visibleMessages={this.model.visibleMessages}
            forkFromVisibleMessage={this.model.forkFromVisibleMessage}
            setChatMode={this.model.setChatMode}
            loading={this.model.loading}
            scrollAnchorRef={this.model.scrollAnchorRef}
            chatMode={this.model.chatMode}
            loadingPhaseIndex={this.model.loadingPhaseIndex}
            showTechnicalDetails={this.model.showTechnicalDetails}
          />
        </section>
        <footer className="relative z-20">
          <AssistantComposer
            composerRef={this.model.composerRef}
            hasConversation={this.model.hasConversation}
            mode={this.model.conversationMode}
            setMode={this.onComposerModeChange}
            promptUsage={this.model.promptUsage}
            fileInputRef={this.model.fileInputRef}
            onFilesSelected={this.model.onFilesSelected}
            attachments={this.model.attachments}
            removeAttachment={this.model.removeAttachment}
            openFilePicker={this.model.openFilePicker}
            uploadingAttachments={this.model.uploadingAttachments}
            textareaRef={this.model.textareaRef}
            prompt={this.model.prompt}
            setPrompt={this.model.setPrompt}
            onComposerKeyDown={this.model.onComposerKeyDown}
            onQuickFix={this.model.onQuickFix}
            sendPrompt={this.model.sendPrompt}
            loading={this.model.loading}
            checkingIntegration={this.model.checkingIntegration}
            integrationConfigured={this.model.integrationConfigured}
            quickPrompts={this.model.quickPrompts}
            toolsButtonRef={this.model.toolsButtonRef}
            showTools={this.model.showTools}
            setShowTools={this.model.setShowTools}
            activeTools={this.model.activeTools}
            totalTools={this.model.totalTools}
            developerMode={this.model.showTechnicalDetails}
          />
        </footer>
      </main>
    );
  }

  private renderSettingsDrawer(): ReactNode {
    return (
      <AssistantSettingsDrawer
        presentation={this.isMobileViewport ? 'overlay' : 'docked'}
        isOpen={this.model.showGateway}
        onClose={this.model.closeSettingsPanel}
        onRequestClose={this.model.closeSettingsPanel}
        provider={this.model.provider}
        onProviderChange={this.model.switchProvider}
        providerOptions={this.model.providerOptions}
        model={this.model.model}
        onModelChange={this.model.setModel}
        modelOptions={this.model.modelOptions}
        loadingModels={this.model.loadingProviderModels}
        modelsError={this.model.providerModelsError}
        skillId={this.model.skillId}
        onSkillIdChange={this.model.setSkillId}
        skillOptions={this.model.skillOptions}
        apiKey={this.model.apiKey}
        onApiKeyChange={this.model.setApiKey}
        hasSavedSecret={this.model.hasSavedSecret}
        baseUrl={this.model.baseUrl}
        onBaseUrlChange={this.model.setBaseUrl}
        onSave={this.model.saveIntegration}
        isSaving={this.model.integrationSaving}
        autoApprove={this.model.autoApprove}
        onAutoApproveChange={this.model.setAutoApprove}
        showTechnicalDetails={this.model.showTechnicalDetails}
        onShowTechnicalDetailsChange={this.model.setShowTechnicalDetails}
        verboseLogging={this.model.verboseLogging}
        onVerboseLoggingChange={this.model.setVerboseLogging}
      />
    );
  }

  private renderNotices(): ReactNode {
    return (
      <>
        {this.model.notice ? (
          <div className="fixed left-1/2 top-5 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-100/92 px-3 py-2 text-xs font-semibold text-emerald-900 shadow-lg backdrop-blur-xl dark:border-emerald-300/45 dark:bg-emerald-300/16 dark:text-emerald-100">
            <span>{this.model.notice}</span>
            <button type="button" onClick={this.model.clearNotice} className="inline-flex h-5 w-5 items-center justify-center rounded-md hover:bg-white/10" aria-label="Dismiss notice"><FrameworkIcons.X size={12} /></button>
          </div>
        ) : null}
        {this.model.error ? (
          <div className="fixed left-1/2 top-5 z-[95] flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-xl border border-rose-300/70 bg-rose-100/92 px-3 py-2 text-xs font-semibold text-rose-900 shadow-lg backdrop-blur-xl dark:border-rose-300/45 dark:bg-rose-300/18 dark:text-rose-100">
            <span className="break-all">{this.model.error}</span>
            <button type="button" onClick={this.model.clearError} className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md hover:bg-white/10" aria-label="Dismiss error"><FrameworkIcons.X size={12} /></button>
          </div>
        ) : null}
      </>
    );
  }

  render(): ReactNode {
    return (
      <div className={GlassMorphism.GLASS_APP_BG} style={{ fontFamily: "'Plus Jakarta Sans', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif" }}>
        <style>{`${GlassMorphism.GLASS_FONT_IMPORT}
          @keyframes forge-think-sweep { 0% { transform: translateX(-120%); } 100% { transform: translateX(130%); } }
          @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }`}
        </style>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_4%,rgba(255,255,255,0.05),transparent_45%)] dark:bg-[radial-gradient(circle_at_50%_4%,rgba(255,255,255,0.03),transparent_45%)]" />
        <div className="relative flex h-screen min-h-screen w-full">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.03))] dark:bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.2))]" />
          <HistoryPanel
            presentation={this.isMobileViewport ? 'overlay' : 'docked'}
            showHistory={this.model.showHistory}
            historySource={this.model.historySource}
            historyLoading={this.model.historyLoading}
            historySessions={this.model.historySessions}
            activeSessionId={this.model.activeSessionId}
            onRequestClose={this.model.closeHistoryPanel}
            startNewSession={this.model.startNewSession}
            openHistorySession={this.model.openHistorySession}
            removeHistorySession={this.model.removeHistorySession}
          />
          {this.renderMain()}
          {this.renderSettingsDrawer()}
        </div>
        <ToolsOverlay
          showTools={this.model.showTechnicalDetails && this.model.showTools}
          toolsMenuStyle={this.model.toolsMenuStyle}
          toolsDropdownRef={this.model.toolsDropdownRef}
          availableTools={this.model.availableTools}
          selectedTools={this.model.selectedTools}
          setSelectedTools={this.model.setSelectedTools}
          toggleTool={this.model.toggleTool}
          getToolHelp={AssistantFormatUtils.getToolHelp}
        />
        {this.renderNotices()}
      </div>
    );
  }
}
