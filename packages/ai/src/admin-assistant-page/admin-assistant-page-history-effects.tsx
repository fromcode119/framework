'use client';

import React from 'react';
import { AssistantConstants } from '../admin-assistant-core';
import { AdminAssistantPageSessionService } from './admin-assistant-page-session-service';
import { AdminAssistantPageUtils } from './admin-assistant-page-utils';
import type { AdminAssistantPageHistoryEffectsProps } from './admin-assistant-page-history-effects.interfaces';

export function AdminAssistantPageHistoryEffects(props: AdminAssistantPageHistoryEffectsProps) {
  const prefsLoadedRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(props.themeMode);
    if (typeof window !== 'undefined') props.browserState.writeThemePreference(props.themeMode);
  }, [props.themeMode, props.browserState]);

  React.useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const savedActive = typeof window !== 'undefined' ? props.browserState.readActiveSessionId() : '';
      let serverLoaded = false;
      let localSessions: ReturnType<typeof AdminAssistantPageSessionService.loadHistoryFromLocal> = [];
      try {
        props.setHistoryLoading(true);
        const sessions = await AdminAssistantPageSessionService.refreshServerHistory(props.api, props.provider);
        if (cancelled) return;
        props.setHistorySessions(sessions);
        props.setHistorySource('server');
        serverLoaded = true;
      } catch {
        localSessions = AdminAssistantPageSessionService.loadHistoryFromLocal(props.browserState, props.provider);
        if (cancelled) return;
        props.setHistorySessions(localSessions);
        props.setHistorySource('local');
      } finally {
        if (!cancelled) props.setHistoryLoading(false);
      }

      if (savedActive) {
        try {
          if (serverLoaded) {
            const detailed = await AdminAssistantPageSessionService.fetchSession(props.api, savedActive, props.provider);
            if (cancelled || !detailed) return;
            props.setHistorySessions((prev) => [detailed, ...prev.filter((item) => item.id !== detailed.id)]);
            props.setActiveSessionId(detailed.id);
            props.setMessages(detailed.messages.length ? detailed.messages : AdminAssistantPageUtils.createReadyConversation());
            props.setProvider(detailed.provider || 'openai');
            if (detailed.model) props.setModel(detailed.model);
            if (detailed.skillId) props.setSkillId(detailed.skillId);
            props.setChatMode(detailed.chatMode || 'auto');
            props.setSandboxMode(detailed.sandboxMode !== false);
          } else {
            const active = localSessions.find((item) => item.id === savedActive);
            if (!active) return;
            props.setActiveSessionId(active.id);
            props.setMessages(active.messages);
            props.setProvider(active.provider || 'openai');
            if (active.model) props.setModel(active.model);
            if (active.skillId) props.setSkillId(active.skillId);
            props.setChatMode(active.chatMode || 'auto');
            props.setSandboxMode(active.sandboxMode !== false);
          }
        } catch {
          return;
        }
      }

      if (!cancelled) props.setHistoryHydrated(true);
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [props.api, props.browserState, props.provider, props.setActiveSessionId, props.setChatMode, props.setHistoryHydrated, props.setHistoryLoading, props.setHistorySessions, props.setHistorySource, props.setMessages, props.setModel, props.setProvider, props.setSandboxMode, props.setSkillId]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !props.historyHydrated) return;
    try {
      if (props.historySource === 'local') props.browserState.writeHistoryEntries(props.historySessions.slice(0, 40));
      props.browserState.writeActiveSessionId(props.activeSessionId);
    } catch {
      return;
    }
  }, [props.activeSessionId, props.browserState, props.historyHydrated, props.historySessions, props.historySource]);

  React.useEffect(() => {
    if (props.checkingIntegration || prefsLoadedRef.current || typeof window === 'undefined') return;
    prefsLoadedRef.current = true;
    try {
      const parsed = props.browserState.readUiPreferences();
      if (!parsed.provider && !parsed.model && !parsed.skillId && !parsed.baseUrl && !parsed.chatMode && parsed.sandboxMode === null && parsed.leftSidebarOpen === null && parsed.rightSidebarOpen === null) {
        props.setUiPrefsHydrated(true);
        return;
      }
      const provider = parsed.provider || props.provider;
      const baseUrl = AdminAssistantPageUtils.sanitizeBaseUrlForProvider(provider, props.browserState.readProviderBaseUrl(provider));
      if (parsed.provider && AssistantConstants.PROVIDER_OPTIONS.some((item) => item.value === parsed.provider)) props.setProvider(parsed.provider);
      if (parsed.model) props.setModel(parsed.model);
      if (baseUrl) props.setBaseUrl(baseUrl);
      else if (provider === 'ollama') props.setBaseUrl(AdminAssistantPageUtils.OLLAMA_DOCKER_BASE_URL);
      if (parsed.skillId) props.setSkillId(parsed.skillId);
      if (parsed.chatMode) props.setChatMode(parsed.chatMode);
      if (typeof parsed.sandboxMode === 'boolean') props.setSandboxMode(parsed.sandboxMode);
      if (parsed.leftSidebarOpen !== null || parsed.rightSidebarOpen !== null) {
        props.setLayoutState((prev) => ({
          ...prev,
          leftOpen: parsed.leftSidebarOpen !== null ? parsed.leftSidebarOpen : prev.leftOpen,
          rightOpen: parsed.rightSidebarOpen !== null ? parsed.rightSidebarOpen : prev.rightOpen,
        }));
      }
    } catch {
      return;
    } finally {
      props.setUiPrefsHydrated(true);
    }
  }, [props.baseUrl, props.browserState, props.checkingIntegration, props.provider, props.setBaseUrl, props.setChatMode, props.setLayoutState, props.setModel, props.setProvider, props.setSandboxMode, props.setSkillId, props.setUiPrefsHydrated]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const persistedPreferences = props.browserState.readUiPreferences();
      const persistedBaseUrls = { ...persistedPreferences.baseUrls };
      const normalizedProvider = String(props.provider || '').trim().toLowerCase();
      const normalizedBaseUrl = String(props.baseUrl || '').trim();
      if (normalizedProvider) {
        if (normalizedBaseUrl) persistedBaseUrls[normalizedProvider] = normalizedBaseUrl;
        else delete persistedBaseUrls[normalizedProvider];
      }
      props.browserState.writeUiPreferences({
        provider: props.provider,
        model: props.model,
        skillId: props.skillId,
        baseUrl: normalizedBaseUrl,
        baseUrls: persistedBaseUrls,
        chatMode: props.chatMode,
        sandboxMode: props.sandboxMode,
        leftSidebarOpen: props.layoutState.leftOpen,
        rightSidebarOpen: props.layoutState.rightOpen,
      });
    } catch {
      return;
    }
  }, [props.baseUrl, props.browserState, props.chatMode, props.layoutState.leftOpen, props.layoutState.rightOpen, props.model, props.provider, props.sandboxMode, props.skillId]);

  React.useEffect(() => {
    const normalizedProvider = String(props.provider || '').trim().toLowerCase();
    const sanitized = AdminAssistantPageUtils.sanitizeBaseUrlForProvider(normalizedProvider, props.baseUrl);
    if (sanitized === props.baseUrl) return;
    props.setBaseUrl(normalizedProvider === 'ollama' ? AdminAssistantPageUtils.OLLAMA_DOCKER_BASE_URL : sanitized);
  }, [props.baseUrl, props.provider, props.setBaseUrl]);

  React.useEffect(() => {
    if (props.historySource !== 'local') return;
    const normalizedMessages = props.messages.filter((entry) => entry.role !== 'system' || entry.content !== AdminAssistantPageUtils.createReadyMessage().content);
    if (!normalizedMessages.length) return;
    const sessionId = props.activeSessionId || AdminAssistantPageUtils.createSessionId();
    if (!props.activeSessionId) props.setActiveSessionId(sessionId);
    const session = AdminAssistantPageSessionService.createLocalSession(
      sessionId,
      props.messages,
      props.provider,
      props.model,
      props.skillId,
      props.chatMode,
      props.sandboxMode,
    );
    props.setHistorySessions((prev) => [session, ...prev.filter((item) => item.id !== sessionId)].slice(0, 40));
  }, [props.activeSessionId, props.chatMode, props.historySource, props.messages, props.model, props.provider, props.sandboxMode, props.setActiveSessionId, props.setHistorySessions, props.skillId]);

  return null;
}
