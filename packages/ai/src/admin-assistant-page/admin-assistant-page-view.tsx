'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { HistoryPanel, ToolsOverlay } from '../admin-assistant-panels';
import {
  AssistantComposer,
  AssistantConversation,
  AssistantActionCard,
  AssistantSimpleTopBar,
  AssistantSettingsDrawer,
} from '../components';
import { GlassMorphism } from '../ui/glass-morphism';
import { AssistantFormatUtils } from '../assistant-format-utils';
import { AssistantProviderUtils } from '../assistant-provider-utils';
import type { AdminAssistantPageViewProps } from './admin-assistant-page-view.interfaces';

export function AdminAssistantPageView(props: AdminAssistantPageViewProps) {
  const isMobileViewport = props.layoutState.viewport === 'mobile';
  const actionDockOffset = 16;
  const viewportBottomPadding = props.activeBatchEntry ? 220 : props.hasConversation ? 48 : 140;

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
          presentation={isMobileViewport ? 'overlay' : 'docked'}
          showHistory={props.showHistory}
          historySource={props.historySource}
          historyLoading={props.historyLoading}
          historySessions={props.historySessions}
          activeSessionId={props.activeSessionId}
          onRequestClose={props.closeHistoryPanel}
          startNewSession={props.startNewSession}
          openHistorySession={props.openHistorySession}
          removeHistorySession={props.removeHistorySession}
        />
        <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg)]">
          <AssistantSimpleTopBar
            sessionTitle="Forge AI"
            historyCount={props.historySessions.length}
            onBackToAdmin={props.openAdvancedWorkspace}
            onHistoryToggle={props.toggleHistoryPanel}
            onSettingsOpen={props.toggleSettingsPanel}
            onThemeToggle={props.toggleThemeMode}
            themeMode={props.themeMode}
          />
          <section className="relative min-h-0 flex-1 overflow-hidden">
            <AssistantActionCard
              batch={props.activeBatchEntry?.actionBatch}
              actions={props.activeBatchEntry?.actions || []}
              selectedIndexes={props.selectedActionIndexes}
              onToggleAction={props.toggleActionIndex}
              onSelectAll={props.selectAllActions}
              onDeselectAll={props.clearSelectedActions}
              onPreview={props.runPreview}
              onApply={props.runApply}
              isRunning={props.executing}
              executionSummary={props.activeBatchSummary}
              mode={props.conversationMode}
              placement="bottom"
              bottomOffset={actionDockOffset}
            />
            <AssistantConversation
              viewportRef={props.viewportRef}
              viewportBottomPadding={viewportBottomPadding}
              hasConversation={props.hasConversation}
              visibleMessages={props.visibleMessages}
              forkFromVisibleMessage={props.forkFromVisibleMessage}
              setChatMode={props.setChatMode}
              loading={props.loading}
              scrollAnchorRef={props.scrollAnchorRef}
              chatMode={props.chatMode}
              loadingPhaseIndex={props.loadingPhaseIndex}
              showTechnicalDetails={props.showTechnicalDetails}
            />
          </section>
          <footer className="relative z-20">
            <AssistantComposer
              composerRef={props.composerRef}
              hasConversation={props.hasConversation}
              mode={props.conversationMode}
              setMode={(mode) => props.setChatMode(AssistantProviderUtils.conversationModeToChatMode(mode))}
              promptUsage={props.promptUsage}
              fileInputRef={props.fileInputRef}
              onFilesSelected={props.onFilesSelected}
              attachments={props.attachments}
              removeAttachment={props.removeAttachment}
              openFilePicker={props.openFilePicker}
              uploadingAttachments={props.uploadingAttachments}
              textareaRef={props.textareaRef}
              prompt={props.prompt}
              setPrompt={props.setPrompt}
              onComposerKeyDown={props.onComposerKeyDown}
              onQuickFix={props.onQuickFix}
              sendPrompt={props.sendPrompt}
              loading={props.loading}
              checkingIntegration={props.checkingIntegration}
              integrationConfigured={props.integrationConfigured}
              quickPrompts={props.quickPrompts}
              toolsButtonRef={props.toolsButtonRef}
              showTools={props.showTools}
              setShowTools={props.setShowTools}
              activeTools={props.activeTools}
              totalTools={props.totalTools}
              developerMode={props.showTechnicalDetails}
            />
          </footer>
        </main>
        <AssistantSettingsDrawer
          presentation={isMobileViewport ? 'overlay' : 'docked'}
          isOpen={props.showGateway}
          onClose={props.closeSettingsPanel}
          onRequestClose={props.closeSettingsPanel}
          provider={props.provider}
          onProviderChange={props.switchProvider}
          providerOptions={props.providerOptions}
          model={props.model}
          onModelChange={props.setModel}
          modelOptions={props.modelOptions}
          loadingModels={props.loadingProviderModels}
          modelsError={props.providerModelsError}
          skillId={props.skillId}
          onSkillIdChange={props.setSkillId}
          skillOptions={props.skillOptions}
          apiKey={props.apiKey}
          onApiKeyChange={props.setApiKey}
          hasSavedSecret={props.hasSavedSecret}
          baseUrl={props.baseUrl}
          onBaseUrlChange={props.setBaseUrl}
          onSave={props.saveIntegration}
          isSaving={props.integrationSaving}
          autoApprove={props.autoApprove}
          onAutoApproveChange={props.setAutoApprove}
          showTechnicalDetails={props.showTechnicalDetails}
          onShowTechnicalDetailsChange={props.setShowTechnicalDetails}
          verboseLogging={props.verboseLogging}
          onVerboseLoggingChange={props.setVerboseLogging}
        />
      </div>
      <ToolsOverlay
        showTools={props.showTechnicalDetails && props.showTools}
        toolsMenuStyle={props.toolsMenuStyle}
        toolsDropdownRef={props.toolsDropdownRef}
        availableTools={props.availableTools}
        selectedTools={props.selectedTools}
        setSelectedTools={props.setSelectedTools}
        toggleTool={props.toggleTool}
        getToolHelp={AssistantFormatUtils.getToolHelp}
      />
      {props.notice ? (
        <div className="fixed left-1/2 top-5 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-100/92 px-3 py-2 text-xs font-semibold text-emerald-900 shadow-lg backdrop-blur-xl dark:border-emerald-300/45 dark:bg-emerald-300/16 dark:text-emerald-100">
          <span>{props.notice}</span>
          <button type="button" onClick={props.clearNotice} className="inline-flex h-5 w-5 items-center justify-center rounded-md hover:bg-white/10" aria-label="Dismiss notice"><FrameworkIcons.X size={12} /></button>
        </div>
      ) : null}
      {props.error ? (
        <div className="fixed left-1/2 top-5 z-[95] flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-xl border border-rose-300/70 bg-rose-100/92 px-3 py-2 text-xs font-semibold text-rose-900 shadow-lg backdrop-blur-xl dark:border-rose-300/45 dark:bg-rose-300/18 dark:text-rose-100">
          <span className="break-all">{props.error}</span>
          <button type="button" onClick={props.clearError} className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md hover:bg-white/10" aria-label="Dismiss error"><FrameworkIcons.X size={12} /></button>
        </div>
      ) : null}
    </div>
  );
}
