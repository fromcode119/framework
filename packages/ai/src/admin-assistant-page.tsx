'use client';

import React, { useMemo, useState } from 'react';
import { FrameworkIcons, usePlugins } from '@fromcode119/react';
import { GatewayPanel, HistoryPanel, ToolsOverlay } from './admin-assistant-panels';
import { ForgeComposer, ForgeConversation, ForgeTopBar } from './components';
import {
  SURFACE_NAME,
  AI_INTEGRATION_ENDPOINT,
  AI_CHAT_ENDPOINT,
  AI_MODELS_ENDPOINT,
  AI_TOOLS_ENDPOINT,
  AI_SKILLS_ENDPOINT,
  AI_SESSIONS_ENDPOINT,
  AI_EXECUTE_ENDPOINT,
  AI_CONTINUE_ENDPOINT_PREFIX,
  MAX_PROMPT_LENGTH,
  FORGE_HISTORY_STORAGE_KEY,
  FORGE_ACTIVE_SESSION_KEY,
  FORGE_UI_PREFS_STORAGE_KEY,
  PROVIDER_PRESETS,
  PROVIDER_OPTIONS,
  sanitizeTraceToolCalls,
  getToolHelp,
  serializeAttachmentsForModel,
  stripReadyMessage,
  summarizeSessionTitle,
  isApprovalPrompt,
  hasPlanningIntent,
  normalizeAssistantBodyText,
  resolveExecutionKind,
} from './admin-assistant-core';
import type {
  AssistantAction,
  AssistantMessage,
  AssistantSkill,
  AssistantToolOption,
  AssistantTrace,
  UploadedAttachment,
  ForgeHistorySession,
} from './admin-assistant-core';

export function AdminAssistantPage() {
  const { api } = usePlugins();
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { role: 'system', content: `${SURFACE_NAME} ready. Ask for changes and approve actions.` },
  ]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showGateway, setShowGateway] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return 'light';
    const saved = String(localStorage.getItem('theme') || '').trim().toLowerCase();
    if (saved === 'dark' || saved === 'light') return saved;
    if (document.documentElement.classList.contains('dark')) return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [chatMode, setChatMode] = useState<'auto' | 'plan' | 'agent'>('auto');
  const [sandboxMode, setSandboxMode] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [historySessions, setHistorySessions] = useState<ForgeHistorySession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const [historySource, setHistorySource] = useState<'server' | 'local'>('server');
  const [historyLoading, setHistoryLoading] = useState(false);

  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(PROVIDER_PRESETS.openai[0].value);
  const [baseUrl, setBaseUrl] = useState('');
  const [skills, setSkills] = useState<AssistantSkill[]>([{ id: 'general', label: 'General' }]);
  const [skillId, setSkillId] = useState('general');
  const [checkingIntegration, setCheckingIntegration] = useState(true);
  const [integrationConfigured, setIntegrationConfigured] = useState(false);
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [hasSavedSecret, setHasSavedSecret] = useState(false);
  const [providerModels, setProviderModels] = useState<Array<{ value: string; label: string }>>([]);
  const [loadingProviderModels, setLoadingProviderModels] = useState(false);
  const [providerModelsError, setProviderModelsError] = useState('');
  const [availableTools, setAvailableTools] = useState<AssistantToolOption[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [showTools, setShowTools] = useState(false);
  const [showComposerControls, setShowComposerControls] = useState(false);
  const [selectedActionIndexes, setSelectedActionIndexes] = useState<number[]>([]);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [composerHeight, setComposerHeight] = useState(260);
  const [loadingPhaseIndex, setLoadingPhaseIndex] = useState(0);

  const viewportRef = React.useRef<HTMLDivElement>(null);
  const scrollAnchorRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const toolsMenuRef = React.useRef<HTMLDivElement>(null);
  const toolsButtonRef = React.useRef<HTMLButtonElement>(null);
  const toolsDropdownRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const composerRef = React.useRef<HTMLDivElement>(null);
  const prefsLoadedRef = React.useRef(false);
  const followLatestRef = React.useRef(true);
  const [toolsMenuStyle, setToolsMenuStyle] = useState<{ left: number; top: number; width: number } | null>(null);

  const modelOptions = useMemo(() => {
    if (providerModels.length > 0) return providerModels;
    return (PROVIDER_PRESETS[provider] || []).map((item) => ({ value: item.value, label: item.label }));
  }, [provider, providerModels]);
  const skillOptions = useMemo(
    () => skills.map((entry) => ({ value: entry.id, label: entry.label || entry.id })),
    [skills],
  );

  const promptUsage = `${prompt.length}/${MAX_PROMPT_LENGTH}`;
  const totalTools = availableTools.length;
  const activeTools = selectedTools.length;
  const loadingPhases =
    chatMode === 'agent'
      ? ['Analyzing request', 'Selecting tools', 'Running checks', 'Drafting response']
      : chatMode === 'plan'
        ? ['Analyzing request', 'Scanning data', 'Staging safe steps', 'Drafting plan']
        : ['Thinking', 'Selecting best approach', 'Drafting response'];
  const loadingPhaseLabel = loadingPhases[loadingPhaseIndex % loadingPhases.length];

  const lastActions = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (Array.isArray(messages[i].actions) && messages[i].actions!.length > 0) {
        return messages[i].actions!;
      }
    }
    return [] as AssistantAction[];
  }, [messages]);
  const selectedActionCount = selectedActionIndexes.filter((index) => index >= 0 && index < lastActions.length).length;
  const followDistanceThreshold = Math.max(140, composerHeight + 80);

  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = 'auto', force: boolean = false) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (!force && !followLatestRef.current) return;
    const top = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    // Use direct scrollTop assignment as fallback because smooth scroll can be interrupted by layout changes.
    if (behavior === 'auto') {
      viewport.scrollTop = top;
    } else {
      viewport.scrollTo({ top, behavior });
    }
    if (Math.abs(viewport.scrollTop - top) > 2) {
      viewport.scrollTop = top;
    }
    followLatestRef.current = true;
  }, []);

  const pinToBottom = React.useCallback(
    (preferredBehavior: ScrollBehavior = 'auto') => {
      scrollToBottom(preferredBehavior, true);
      if (typeof window === 'undefined') return () => {};
      const rafA = window.requestAnimationFrame(() => scrollToBottom('auto', true));
      const rafB = window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => scrollToBottom('auto', true)),
      );
      const t1 = window.setTimeout(() => scrollToBottom('auto', true), 80);
      const t2 = window.setTimeout(() => scrollToBottom('auto', true), 220);
      const t3 = window.setTimeout(() => scrollToBottom('auto', true), 420);
      return () => {
        window.cancelAnimationFrame(rafA);
        window.cancelAnimationFrame(rafB);
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        window.clearTimeout(t3);
      };
    },
    [scrollToBottom],
  );

  const autoResizeTextArea = React.useCallback(() => {
    const area = textareaRef.current;
    if (!area) return;
    area.style.height = '0px';
    area.style.height = `${Math.min(Math.max(area.scrollHeight, 56), 180)}px`;
  }, []);

  React.useEffect(() => {
    autoResizeTextArea();
  }, [prompt, autoResizeTextArea]);

  React.useEffect(() => {
    const cleanup = pinToBottom(messages.length > 1 ? 'smooth' : 'auto');
    return cleanup;
  }, [messages.length, loading, pinToBottom]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onScroll = () => {
      const distanceToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      followLatestRef.current = distanceToBottom <= followDistanceThreshold;
    };
    onScroll();
    viewport.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      viewport.removeEventListener('scroll', onScroll);
    };
  }, [messages.length, followDistanceThreshold]);

  React.useEffect(() => {
    if (!loading) {
      setLoadingPhaseIndex(0);
      return;
    }
    followLatestRef.current = true;
    setLoadingPhaseIndex(0);
    const id = window.setInterval(() => {
      setLoadingPhaseIndex((prev) => prev + 1);
    }, 1050);
    return () => window.clearInterval(id);
  }, [loading, chatMode]);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setCheckingIntegration(true);
      try {
        const integration = await api.get(AI_INTEGRATION_ENDPOINT);
        if (cancelled) return;

        const storedProviders = Array.isArray(integration?.storedProviders) ? integration.storedProviders : [];
        const activeProvider = String(integration?.active?.provider || '').trim().toLowerCase();
        const firstEnabled = storedProviders.find((item: any) => item && item.enabled !== false) || null;
        const providerKey = activeProvider || String(firstEnabled?.providerKey || '').trim().toLowerCase() || 'openai';

        const providerConfig =
          storedProviders.find((item: any) => String(item?.providerKey || '').trim().toLowerCase() === providerKey)?.config ||
          integration?.active?.config ||
          {};

        const modelValue = String(providerConfig?.model || '').trim();
        const baseUrlValue = String(providerConfig?.baseUrl || '').trim();
        const hasSecret =
          providerKey === 'openai'
            ? String(providerConfig?.apiKey || '').trim().length > 0
            : true;

        setProvider(providerKey || 'openai');
        setModel(modelValue || (PROVIDER_PRESETS[providerKey]?.[0]?.value || PROVIDER_PRESETS.openai[0].value));
        setBaseUrl(baseUrlValue);
        setIntegrationConfigured(!!firstEnabled || !!integration?.active);
        setHasSavedSecret(hasSecret);
      } catch {
        if (!cancelled) {
          setIntegrationConfigured(false);
          setHasSavedSecret(false);
        }
      } finally {
        if (!cancelled) setCheckingIntegration(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const fetchProviderModels = React.useCallback(async () => {
    if (provider === 'openai' && !apiKey.trim() && !hasSavedSecret) {
      setProviderModels([]);
      setProviderModelsError('Add an OpenAI API key to load models.');
      return;
    }

    setLoadingProviderModels(true);
    setProviderModelsError('');
    try {
      const config: Record<string, any> = {};
      const trimmedBaseUrl = baseUrl.trim();
      if (trimmedBaseUrl) config.baseUrl = trimmedBaseUrl;
      if (provider === 'openai' && apiKey.trim()) {
        config.apiKey = apiKey.trim();
      }

      const response = await api.post(AI_MODELS_ENDPOINT, {
        provider,
        config,
      });

      const models = Array.isArray(response?.models)
        ? response.models
            .map((item: any) => ({
              value: String(item?.value || '').trim(),
              label: String(item?.label || item?.value || '').trim(),
            }))
            .filter((item: { value: string; label: string }) => !!item.value)
        : [];

      setProviderModels(models);

      if (models.length > 0 && !models.some((item) => item.value === model)) {
        setModel(models[0].value);
      }
      if (models.length === 0) {
        setProviderModelsError('No models returned by this provider.');
      }
    } catch (e: any) {
      setProviderModels([]);
      setProviderModelsError(String(e?.message || 'Failed to fetch models.'));
    } finally {
      setLoadingProviderModels(false);
    }
  }, [api, apiKey, baseUrl, hasSavedSecret, model, provider]);

  React.useEffect(() => {
    if (checkingIntegration) return;
    const timer = window.setTimeout(() => {
      void fetchProviderModels();
    }, 320);
    return () => window.clearTimeout(timer);
  }, [checkingIntegration, fetchProviderModels]);

  React.useEffect(() => {
    let cancelled = false;
    const loadTools = async () => {
      try {
        const response = await api.get(AI_TOOLS_ENDPOINT);
        if (cancelled) return;
        const tools = Array.isArray(response?.tools)
          ? response.tools
              .map((entry: any) => ({
                tool: String(entry?.tool || '').trim(),
                description: entry?.description ? String(entry.description) : undefined,
                readOnly: entry?.readOnly === true,
              }))
              .filter((entry: AssistantToolOption) => !!entry.tool)
          : [];
        setAvailableTools(tools);
        setSelectedTools((prev) => {
          const next = prev.filter((tool) => tools.some((entry) => entry.tool === tool));
          return next.length > 0 ? next : tools.map((entry) => entry.tool);
        });
      } catch {
        if (!cancelled) {
          setAvailableTools([]);
          setSelectedTools([]);
        }
      }
    };
    loadTools();
    return () => {
      cancelled = true;
    };
  }, [api]);

  React.useEffect(() => {
    let cancelled = false;
    const loadSkills = async () => {
      try {
        const response = await api.get(AI_SKILLS_ENDPOINT);
        if (cancelled) return;
        const list = Array.isArray(response?.skills)
          ? response.skills
              .map((entry: any) => ({
                id: String(entry?.id || '').trim().toLowerCase(),
                label: String(entry?.label || entry?.id || '').trim(),
                description: entry?.description ? String(entry.description) : undefined,
                defaultMode: entry?.defaultMode ? String(entry.defaultMode).trim().toLowerCase() : undefined,
                riskPolicy: entry?.riskPolicy ? String(entry.riskPolicy).trim().toLowerCase() : undefined,
              }))
              .filter((entry: AssistantSkill) => !!entry.id)
          : [];
        const fallback = list.some((entry: AssistantSkill) => entry.id === 'general')
          ? list
          : [{ id: 'general', label: 'General' }, ...list];
        setSkills(fallback);
        setSkillId((prev) => {
          if (fallback.some((entry: AssistantSkill) => entry.id === prev)) return prev;
          return fallback[0]?.id || 'general';
        });
      } catch {
        if (!cancelled) {
          setSkills([{ id: 'general', label: 'General' }]);
          setSkillId((prev) => prev || 'general');
        }
      }
    };
    loadSkills();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const mapHistorySession = React.useCallback((item: any): ForgeHistorySession | null => {
    const id = String(item?.id || '').trim();
    if (!id) return null;
    const providerValue = String(item?.provider || provider || 'openai').trim().toLowerCase() || 'openai';
    const modeRaw = String(item?.chatMode || '').trim().toLowerCase();
    const mappedMode: 'auto' | 'plan' | 'agent' =
      modeRaw === 'plan' || modeRaw === 'agent'
        ? modeRaw
        : String(item?.agentMode || '').trim().toLowerCase() === 'advanced'
          ? 'plan'
          : 'auto';
    const messages = Array.isArray(item?.messages)
      ? item.messages
          .map((entry: any) => ({
            role:
              entry?.role === 'assistant' || entry?.role === 'system' || entry?.role === 'user'
                ? entry.role
                : 'assistant',
            content: String(entry?.content || '').trim(),
          }))
          .filter((entry: AssistantMessage) => !!entry.content)
      : [];

    return {
      id,
      title: String(item?.title || summarizeSessionTitle(messages)).trim() || 'Untitled session',
      updatedAt: Number(item?.updatedAt || Date.now()) || Date.now(),
      provider: providerValue,
      model: String(item?.model || '').trim(),
      skillId: String(item?.skillId || 'general').trim().toLowerCase() || 'general',
      chatMode: mappedMode,
      sandboxMode: item?.sandboxMode !== false,
      messages,
      messageCount: Number(item?.messageCount || messages.length || 0),
    };
  }, [provider]);

  const loadHistoryFromLocal = React.useCallback((): ForgeHistorySession[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(FORGE_HISTORY_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const sessions = Array.isArray(parsed)
        ? parsed
            .map((item: any) => mapHistorySession(item))
            .filter((item: ForgeHistorySession | null): item is ForgeHistorySession => !!item && item.messages.length > 0)
        : [];
      return sessions;
    } catch {
      return [];
    }
  }, [mapHistorySession]);

  const refreshServerHistory = React.useCallback(
    async (options?: { silent?: boolean; includeMessages?: boolean }): Promise<boolean> => {
      try {
        if (!options?.silent) setHistoryLoading(true);
        const response = await api.get(
          `${AI_SESSIONS_ENDPOINT}?limit=60${options?.includeMessages ? '&includeMessages=true' : ''}`,
        );
        const sessions = Array.isArray(response?.sessions)
          ? response.sessions
              .map((item: any) => mapHistorySession(item))
              .filter((item: ForgeHistorySession | null): item is ForgeHistorySession => !!item)
          : [];
        setHistorySessions(sessions);
        setHistorySource('server');
        return true;
      } catch {
        return false;
      } finally {
        if (!options?.silent) setHistoryLoading(false);
      }
    },
    [api, mapHistorySession],
  );

  const fetchSessionFromServer = React.useCallback(
    async (sessionId: string): Promise<ForgeHistorySession | null> => {
      const normalized = String(sessionId || '').trim();
      if (!normalized) return null;
      const response = await api.get(`${AI_SESSIONS_ENDPOINT}/${encodeURIComponent(normalized)}`);
      const session = mapHistorySession(response?.session);
      return session;
    },
    [api, mapHistorySession],
  );

  const refreshHistoryIfServer = React.useCallback(() => {
    if (historySource !== 'server') return;
    void refreshServerHistory({ silent: true });
  }, [historySource, refreshServerHistory]);

  const updateToolsMenuPosition = React.useCallback(() => {
    if (!showTools || !toolsButtonRef.current || typeof window === 'undefined') return;
    const rect = toolsButtonRef.current.getBoundingClientRect();
    const menuWidth = Math.min(340, Math.max(280, Math.round(rect.width + 52)));
    const viewportPadding = 8;
    const measuredHeight = toolsDropdownRef.current?.offsetHeight || 340;
    let top = rect.bottom + 8;
    if (top + measuredHeight > window.innerHeight - viewportPadding) {
      top = Math.max(viewportPadding, rect.top - measuredHeight - 8);
    }
    const left = Math.min(
      Math.max(viewportPadding, rect.right - menuWidth),
      Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding),
    );
    setToolsMenuStyle({ left, top, width: menuWidth });
  }, [showTools]);

  React.useEffect(() => {
    if (!showTools) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideTrigger = !!(toolsMenuRef.current && toolsMenuRef.current.contains(target));
      const insideMenu = !!(toolsDropdownRef.current && toolsDropdownRef.current.contains(target));
      if (!insideTrigger && !insideMenu) {
        setShowTools(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowTools(false);
    };
    const onLayout = () => updateToolsMenuPosition();

    updateToolsMenuPosition();
    const rafId = window.requestAnimationFrame(updateToolsMenuPosition);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
    };
  }, [showTools, updateToolsMenuPosition]);

  React.useEffect(() => {
    if (!showTools) {
      setToolsMenuStyle(null);
    }
  }, [showTools]);

  React.useEffect(() => {
    setSelectedActionIndexes(lastActions.map((_, index) => index));
  }, [lastActions]);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(themeMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', themeMode);
    }
  }, [themeMode]);

  React.useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const savedActive = typeof window !== 'undefined' ? String(localStorage.getItem(FORGE_ACTIVE_SESSION_KEY) || '').trim() : '';
      let serverLoaded = await refreshServerHistory({ silent: true });
      let localSessions: ForgeHistorySession[] = [];

      if (!serverLoaded) {
        localSessions = loadHistoryFromLocal();
        if (cancelled) return;
        setHistorySessions(localSessions);
        setHistorySource('local');
      }

      if (savedActive) {
        try {
          if (serverLoaded) {
            const detailed = await fetchSessionFromServer(savedActive);
            if (cancelled) return;
            if (detailed) {
              setHistorySessions((prev) => {
                const next = prev.filter((item) => item.id !== detailed.id);
                return [detailed, ...next];
              });
              setActiveSessionId(detailed.id);
              setMessages(detailed.messages.length ? detailed.messages : [{ role: 'system', content: `${SURFACE_NAME} ready. Ask for changes and approve actions.` }]);
              setProvider(detailed.provider || 'openai');
              if (detailed.model) setModel(detailed.model);
              if (detailed.skillId) setSkillId(detailed.skillId);
              setChatMode(detailed.chatMode || 'auto');
              setSandboxMode(detailed.sandboxMode !== false);
            }
          } else {
            const active = localSessions.find((item) => item.id === savedActive);
            if (active) {
              setActiveSessionId(active.id);
              setMessages(active.messages);
              setProvider(active.provider || 'openai');
              if (active.model) setModel(active.model);
              if (active.skillId) setSkillId(active.skillId);
              setChatMode(active.chatMode || 'auto');
              setSandboxMode(active.sandboxMode !== false);
            }
          }
        } catch {
          // ignore hydrate fetch failures
        }
      }

      if (!cancelled) setHistoryHydrated(true);
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [fetchSessionFromServer, loadHistoryFromLocal, refreshServerHistory]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !historyHydrated) return;
    try {
      if (historySource === 'local') {
        localStorage.setItem(FORGE_HISTORY_STORAGE_KEY, JSON.stringify(historySessions.slice(0, 40)));
      }
      if (activeSessionId) {
        localStorage.setItem(FORGE_ACTIVE_SESSION_KEY, activeSessionId);
      }
    } catch {
      // ignore storage quota errors
    }
  }, [historySessions, activeSessionId, historyHydrated, historySource]);

  React.useEffect(() => {
    if (checkingIntegration || prefsLoadedRef.current || typeof window === 'undefined') return;
    prefsLoadedRef.current = true;
    try {
      const raw = localStorage.getItem(FORGE_UI_PREFS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw || '{}');
      const prefProvider = String(parsed?.provider || '').trim().toLowerCase();
      const prefModel = String(parsed?.model || '').trim();
      const prefBaseUrl = String(parsed?.baseUrl || '').trim();
      const prefSkillId = String(parsed?.skillId || '').trim().toLowerCase();
      const prefMode = parsed?.chatMode === 'plan' || parsed?.chatMode === 'agent' || parsed?.chatMode === 'auto' ? parsed.chatMode : null;
      if (prefProvider && PROVIDER_OPTIONS.some((item) => item.value === prefProvider)) setProvider(prefProvider);
      if (prefModel) setModel(prefModel);
      if (prefBaseUrl) setBaseUrl(prefBaseUrl);
      if (prefSkillId) setSkillId(prefSkillId);
      if (prefMode) setChatMode(prefMode);
      if (typeof parsed?.sandboxMode === 'boolean') setSandboxMode(parsed.sandboxMode);
    } catch {
      // ignore invalid local storage payload
    }
  }, [checkingIntegration]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        FORGE_UI_PREFS_STORAGE_KEY,
        JSON.stringify({
          provider,
          model,
          skillId,
          baseUrl,
          chatMode,
          sandboxMode,
        }),
      );
    } catch {
      // ignore storage quota errors
    }
  }, [provider, model, skillId, baseUrl, chatMode, sandboxMode]);

  React.useEffect(() => {
    if (historySource !== 'local') return;
    const normalizedMessages = stripReadyMessage(messages);
    if (!normalizedMessages.length) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = `session-${Date.now()}`;
      setActiveSessionId(sessionId);
    }

    const session: ForgeHistorySession = {
      id: sessionId,
      title: summarizeSessionTitle(normalizedMessages),
      updatedAt: Date.now(),
      provider,
      model,
      skillId,
      chatMode,
      sandboxMode,
      messages,
      messageCount: normalizedMessages.length,
    };

    setHistorySessions((prev) => {
      const next = prev.filter((item) => item.id !== sessionId);
      return [session, ...next].slice(0, 40);
    });
  }, [messages, provider, model, skillId, chatMode, sandboxMode, activeSessionId, historySource]);

  const switchProvider = (nextProvider: string) => {
    const normalized = String(nextProvider || '').trim().toLowerCase();
    if (!normalized || normalized === provider) return;
    const fallbackModel = PROVIDER_PRESETS[normalized]?.[0]?.value || '';
    setProvider(normalized);
    setModel(fallbackModel);
    setProviderModels([]);
    setProviderModelsError('');
    setApiKey('');
    setNotice('');
    setError('');
  };

  const openAdvancedWorkspace = () => {
    if (typeof window === 'undefined') return;
    const isAdminScoped = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');
    const prefix = isAdminScoped ? '/admin' : '';
    window.location.assign(prefix || '/');
  };

  const toggleThemeMode = () => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const openAdvancedAiSettings = () => {
    if (typeof window === 'undefined') return;
    const isAdminScoped = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');
    const prefix = isAdminScoped ? '/admin' : '';
    window.location.assign(`${prefix}/settings/integrations?type=ai`);
  };

  const startNewSession = () => {
    followLatestRef.current = true;
    setMessages([{ role: 'system', content: `${SURFACE_NAME} ready. Ask for changes and approve actions.` }]);
    setPrompt('');
    setAttachments([]);
    setSelectedActionIndexes([]);
    setActiveSessionId(`session-${Date.now()}`);
    setShowHistory(false);
    setNotice('');
    setError('');
  };

  const openHistorySession = async (sessionId: string) => {
    const localSession = historySessions.find((item) => item.id === sessionId);
    if (!localSession) return;

    try {
      if (historySource === 'server') {
        const remoteSession = await fetchSessionFromServer(sessionId);
        if (remoteSession) {
          setHistorySessions((prev) => {
            const next = prev.filter((item) => item.id !== remoteSession.id);
            return [remoteSession, ...next];
          });
          setActiveSessionId(remoteSession.id);
          setMessages(remoteSession.messages.length ? remoteSession.messages : [{ role: 'system', content: `${SURFACE_NAME} ready. Ask for changes and approve actions.` }]);
          setProvider(remoteSession.provider || 'openai');
          if (remoteSession.model) setModel(remoteSession.model);
          if (remoteSession.skillId) setSkillId(remoteSession.skillId);
          setChatMode(remoteSession.chatMode || 'auto');
          setSandboxMode(remoteSession.sandboxMode !== false);
          setShowHistory(false);
          followLatestRef.current = true;
          return;
        }
      }
    } catch {
      // fall back to locally cached summary below
    }

    setActiveSessionId(localSession.id);
    setMessages(localSession.messages.length ? localSession.messages : [{ role: 'system', content: `${SURFACE_NAME} ready. Ask for changes and approve actions.` }]);
    setProvider(localSession.provider || 'openai');
    if (localSession.model) setModel(localSession.model);
    if (localSession.skillId) setSkillId(localSession.skillId);
    setChatMode(localSession.chatMode || 'auto');
    setSandboxMode(localSession.sandboxMode !== false);
    setShowHistory(false);
    followLatestRef.current = true;
  };

  const removeHistorySession = (sessionId: string) => {
    const normalized = String(sessionId || '').trim();
    if (!normalized) return;
    if (historySource === 'server') {
      void (async () => {
        try {
          await api.delete(`${AI_SESSIONS_ENDPOINT}/${encodeURIComponent(normalized)}`);
        } catch {
          // ignore delete errors and still update local list state
        } finally {
          setHistorySessions((prev) => prev.filter((item) => item.id !== normalized));
          if (activeSessionId === normalized) {
            startNewSession();
          }
        }
      })();
      return;
    }
    setHistorySessions((prev) => prev.filter((item) => item.id !== normalized));
    if (activeSessionId === normalized) {
      startNewSession();
    }
  };

  const forkFromVisibleMessage = (visibleIndex: number) => {
    const branch = visibleMessages.slice(0, visibleIndex + 1);
    if (!branch.length) return;
    const sourceSessionId = String(activeSessionId || '').trim();

    const localFallback = () => {
      const nextSessionId = `session-${Date.now()}`;
      const forkedMessages: AssistantMessage[] = [
        { role: 'system', content: `${SURFACE_NAME} ready. Ask for changes and approve actions.` },
        ...branch.map((entry) => ({ ...entry })),
      ];
      setActiveSessionId(nextSessionId);
      setMessages(forkedMessages);
      setShowHistory(false);
      setNotice('Forked to a new session from this message.');
      setError('');
    };

    if (historySource !== 'server' || !sourceSessionId) {
      localFallback();
      return;
    }

    void (async () => {
      try {
        const response = await api.post(`${AI_SESSIONS_ENDPOINT}/${encodeURIComponent(sourceSessionId)}/fork`, {
          fromMessageIndex: Math.max(0, visibleIndex),
        });
        const forked = mapHistorySession(response?.session);
        if (!forked) {
          localFallback();
          return;
        }
        setHistorySessions((prev) => [forked, ...prev.filter((item) => item.id !== forked.id)]);
        setActiveSessionId(forked.id);
        setMessages(forked.messages.length ? forked.messages : [{ role: 'system', content: `${SURFACE_NAME} ready. Ask for changes and approve actions.` }]);
        if (forked.provider) setProvider(forked.provider);
        if (forked.model) setModel(forked.model);
        if (forked.skillId) setSkillId(forked.skillId);
        setChatMode(forked.chatMode || 'auto');
        setSandboxMode(forked.sandboxMode !== false);
        setShowHistory(false);
        setNotice('Forked to a new session from this message.');
        setError('');
      } catch {
        localFallback();
      }
    })();
  };

  const saveIntegration = async () => {
    setNotice('');
    setError('');

    const trimmedApiKey = apiKey.trim();
    const trimmedModel = model.trim();
    const trimmedBaseUrl = baseUrl.trim();

    if (provider === 'openai' && !trimmedApiKey && !hasSavedSecret) {
      setError('OpenAI API key is required.');
      return;
    }

    const config: Record<string, any> = {
      model: trimmedModel || undefined,
      baseUrl: trimmedBaseUrl || undefined,
    };

    if (provider === 'openai') {
      if (trimmedApiKey) config.apiKey = trimmedApiKey;
    }

    setIntegrationSaving(true);
    try {
      await api.put(AI_INTEGRATION_ENDPOINT, {
        provider,
        config,
        enabled: true,
        makeActive: true,
      });

      setIntegrationConfigured(true);
      setHasSavedSecret(hasSavedSecret || Boolean(trimmedApiKey));
      setApiKey('');
      setNotice('Gateway saved.');
      setMessages((prev) => [...prev, { role: 'system', content: `Gateway updated (${provider}).` }]);
      void fetchProviderModels();
    } catch (e: any) {
      setError(String(e?.message || 'Failed to save gateway configuration.'));
    } finally {
      setIntegrationSaving(false);
    }
  };

  const buildAssistantMessageFromResult = React.useCallback(
    (result: any): AssistantMessage => {
      const plan = result?.plan && typeof result.plan === 'object' ? result.plan : undefined;
      const ui = result?.ui && typeof result.ui === 'object' ? result.ui : undefined;
      const actions = Array.isArray(result?.actions) ? result.actions : [];
      const planStatus = String((plan as any)?.status || '').trim().toLowerCase();
      const suppressPrimaryText =
        !!plan &&
        (actions.length > 0 ||
          ui?.canContinue ||
          ui?.requiresApproval ||
          ['searching', 'staged', 'paused', 'ready_for_preview', 'ready_for_apply', 'failed'].includes(planStatus));
      const normalizedMessage = normalizeAssistantBodyText(String(result?.message || '').trim());
      const fallbackMessage =
        suppressPrimaryText ? '' : normalizedMessage || 'I finished this step. Tell me what you want to do next.';
      return {
        role: 'assistant',
        content: fallbackMessage,
        actions,
        traces: Array.isArray(result?.traces)
          ? result.traces.map((trace: any, index: number) => ({
              iteration: Number(trace?.iteration || index + 1),
              message: trace?.message ? String(trace.message) : undefined,
              toolCalls: sanitizeTraceToolCalls(trace?.toolCalls),
            }))
          : undefined,
        plan,
        ui,
        skill: result?.skill && typeof result.skill === 'object' ? result.skill : undefined,
        sessionId: result?.sessionId ? String(result.sessionId) : undefined,
        checkpoint: result?.checkpoint && typeof result.checkpoint === 'object' ? result.checkpoint : undefined,
        done: result?.done === true,
        iterations: Number.isFinite(Number(result?.iterations)) ? Number(result.iterations) : undefined,
        loopCapReached: result?.loopCapReached === true,
        model: result?.model ? String(result.model) : model,
        provider: result?.provider ? String(result.provider) : provider,
      };
    },
    [model, provider],
  );

  const continuePlanning = React.useCallback(async () => {
    const sessionId = String(activeSessionId || '').trim();
    if (!sessionId) {
      setNotice('Start a request first, then continue planning from that session.');
      return;
    }
    setError('');
    setNotice('');
    followLatestRef.current = true;
    setLoading(true);
    try {
      const response = await api.post(`${AI_CONTINUE_ENDPOINT_PREFIX}/${encodeURIComponent(sessionId)}/continue`, {
        provider,
        config: {
          model: model.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
        },
        tools: availableTools.length > 0 ? selectedTools : undefined,
        skillId,
        agentMode: 'advanced',
      });
      const assistantMessage = buildAssistantMessageFromResult(response);
      setMessages((prev) => [...prev, assistantMessage]);
      if (assistantMessage.actions && assistantMessage.actions.length > 0) {
        setNotice('Plan updated with staged actions.');
      }
      refreshHistoryIfServer();
    } catch (e: any) {
      const requestError = String(e?.message || 'Continue planning failed');
      setError(requestError);
      setMessages((prev) => [...prev, { role: 'system', content: `Continue failed: ${requestError}` }]);
    } finally {
      setLoading(false);
    }
  }, [activeSessionId, api, availableTools, baseUrl, buildAssistantMessageFromResult, model, provider, refreshHistoryIfServer, selectedTools, skillId]);

  const sendPrompt = async (forcedPrompt?: string) => {
    const content = String(forcedPrompt ?? prompt).trim();
    if (!content || loading) return;
    if (!integrationConfigured) {
      setError('Configure gateway first.');
      return;
    }

    if (isApprovalPrompt(content) && lastActions.length > 0 && selectedActionCount > 0 && !executing) {
      setMessages((prev) => [...prev, { role: 'user', content }]);
      if (!forcedPrompt) setPrompt('');
      await runActions({ dryRun: sandboxMode, invokedByApproval: true });
      return;
    }

    setError('');
    setNotice('');
    followLatestRef.current = true;

    const currentAttachments = attachments.map((item) => ({ ...item }));
    const attachmentContext = serializeAttachmentsForModel(currentAttachments);
    const contentForModel = attachmentContext ? `${content}\n\n${attachmentContext}` : content;
    const userMessage: AssistantMessage = {
      role: 'user',
      content,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    };
    setMessages((prev) => [...prev, userMessage]);
    if (!forcedPrompt) setPrompt('');
    setLoading(true);

    try {
      const sessionId = String(activeSessionId || '').trim() || `session-${Date.now()}`;
      if (!activeSessionId) setActiveSessionId(sessionId);
      const history = messages
        .filter((entry) => entry.role !== 'system')
        .map((entry) => {
          if (entry.role === 'user' && Array.isArray(entry.attachments) && entry.attachments.length > 0) {
            const serialized = serializeAttachmentsForModel(entry.attachments);
            return {
              role: entry.role,
              content: serialized ? `${entry.content}\n\n${serialized}` : entry.content,
            };
          }
          return { role: entry.role, content: entry.content };
        });

      const requestedAgentMode =
        chatMode === 'plan' || chatMode === 'agent'
          ? 'advanced'
          : hasPlanningIntent(contentForModel)
            ? 'advanced'
            : 'basic';
      const requestedMaxIterations = requestedAgentMode === 'advanced' ? (chatMode === 'agent' ? 12 : 8) : 1;
      const requestedMaxDurationMs = requestedAgentMode === 'advanced' ? (chatMode === 'agent' ? 35000 : 26000) : 12000;

      const result = await api.post(AI_CHAT_ENDPOINT, {
        message: contentForModel,
        history,
        sessionId,
        provider,
        config: {
          model: model.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
        },
        tools: availableTools.length > 0 ? selectedTools : undefined,
        skillId,
        agentMode: requestedAgentMode,
        maxIterations: requestedMaxIterations,
        maxDurationMs: requestedMaxDurationMs,
      });
      const assistantMessage = buildAssistantMessageFromResult(result);
      if (assistantMessage.sessionId) {
        setActiveSessionId(String(assistantMessage.sessionId));
      }

      setMessages((prev) => [...prev, assistantMessage]);
      setAttachments([]);
      refreshHistoryIfServer();
      if (chatMode === 'auto' && assistantMessage.ui?.suggestedMode === 'agent') {
        setNotice('Auto mode used agent loop for this request.');
      } else if (chatMode === 'auto' && assistantMessage.ui?.suggestedMode === 'plan') {
        setNotice('Auto mode used planning for this request.');
      }
      if (assistantMessage.actions && assistantMessage.actions.length > 0) {
        setNotice(sandboxMode ? 'Plan staged. Review actions, then run Preview Changes.' : 'Plan staged. Review actions, then run Apply Changes.');
      } else if (assistantMessage.ui?.canContinue) {
        setNotice('Planning paused before staging final actions. Use Continue Planning.');
      } else if (requestedAgentMode === 'advanced' && assistantMessage.loopCapReached && (!assistantMessage.actions || assistantMessage.actions.length === 0)) {
        setNotice('No safe executable plan was generated yet. Try a more specific target (collection + id/slug + exact field).');
      }
    } catch (e: any) {
      const requestError = String(e?.message || 'Request failed');
      setError(requestError);
      setMessages((prev) => [...prev, { role: 'system', content: `Request failed: ${requestError}` }]);
    } finally {
      setLoading(false);
    }
  };

  const runActions = async (options?: { dryRun?: boolean; invokedByApproval?: boolean }) => {
    if (!lastActions.length || executing) return;
    const actionsToRun =
      selectedActionCount > 0
        ? selectedActionIndexes
            .filter((index) => index >= 0 && index < lastActions.length)
            .map((index) => lastActions[index])
        : [];
    if (!actionsToRun.length) {
      setError('Select at least one staged action to approve.');
      return;
    }
    setExecuting(true);
    setError('');
    setNotice('');
    followLatestRef.current = true;
    try {
      const dryRun = options?.dryRun ?? sandboxMode;
      const result = await api.post(AI_EXECUTE_ENDPOINT, {
        actions: actionsToRun,
        dryRun,
        sessionId: activeSessionId || undefined,
      });
      const executionItems = Array.isArray(result?.results) ? result.results : [];
      const okCount = executionItems.filter((item: any) => resolveExecutionKind(item) === 'ok').length;
      const skippedCount = executionItems.filter((item: any) => resolveExecutionKind(item) === 'skipped').length;
      const failedCount = executionItems.filter((item: any) => resolveExecutionKind(item) === 'failed').length;
      setMessages((prev) => [
        ...prev,
        {
          role: 'system',
          content: dryRun
            ? `Preview completed: ${okCount} ready, ${skippedCount} unchanged, ${failedCount} failed.`
            : `Execution completed: ${okCount} applied, ${skippedCount} unchanged, ${failedCount} failed.`,
          execution: result,
        },
      ]);
      if (options?.invokedByApproval) {
        setNotice(dryRun ? 'Approved and previewed selected actions.' : 'Approved and applied selected actions.');
      }
      refreshHistoryIfServer();
    } catch (e: any) {
      setError(String(e?.message || 'Execution failed'));
    } finally {
      setExecuting(false);
    }
  };

  const onComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendPrompt();
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const onFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setError('');
    setNotice('');
    setUploadingAttachments(true);

    try {
      const uploadedItems: UploadedAttachment[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        const response = await api.post('/media/upload', form);
        uploadedItems.push({
          id: response?.id !== undefined ? String(response.id) : undefined,
          name: String(response?.originalName || response?.filename || file.name),
          url: response?.url ? String(response.url) : undefined,
          path: response?.path ? String(response.path) : undefined,
          mimeType: response?.mimeType ? String(response.mimeType) : file.type,
          size: Number(response?.fileSize || file.size || 0) || undefined,
          width: Number(response?.width || 0) || undefined,
          height: Number(response?.height || 0) || undefined,
        });
      }
      setAttachments((prev) => [...prev, ...uploadedItems]);
      setNotice(`${uploadedItems.length} asset${uploadedItems.length > 1 ? 's' : ''} uploaded.`);
    } catch (e: any) {
      setError(String(e?.message || 'Failed to upload attachment.'));
    } finally {
      setUploadingAttachments(false);
      if (event.target) event.target.value = '';
    }
  };

  const toggleTool = (toolName: string) => {
    const value = String(toolName || '').trim();
    if (!value) return;
    setSelectedTools((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  };

  const toggleActionIndex = (actionIndex: number) => {
    setSelectedActionIndexes((prev) =>
      prev.includes(actionIndex) ? prev.filter((item) => item !== actionIndex) : [...prev, actionIndex],
    );
  };

  const visibleMessages = useMemo(() => {
    return stripReadyMessage(messages);
  }, [messages]);

  const hasConversation = visibleMessages.length > 0;
  const dockWidth = 'min(360px, 92vw)';
  const leftDockOffset = showHistory ? dockWidth : '0px';
  const rightDockOffset = showGateway ? dockWidth : '0px';
  const viewportBottomPadding = Math.max(composerHeight + (hasConversation ? 44 : 110), 280);
  const controlsVisible = showComposerControls || !hasConversation;
  const quickPrompts = [
    'Find and replace "Slow Websites" with "Better Sites" everywhere.',
    'List installed plugins, active theme, and editable collections.',
    'Create a homepage draft with hero, proof, CTA, and FAQ.',
  ];

  React.useLayoutEffect(() => {
    if (!hasConversation) return;
    // Re-pin after render commits when message/layout height changes but count stays the same.
    const cleanup = pinToBottom('auto');
    return cleanup;
  }, [
    hasConversation,
    pinToBottom,
    loading,
    composerHeight,
    showHistory,
    showGateway,
    viewportBottomPadding,
    messages,
  ]);

  React.useEffect(() => {
    const composer = composerRef.current;
    if (!composer || typeof window === 'undefined') return;
    const update = () => {
      const nextHeight = Math.ceil(composer.getBoundingClientRect().height);
      if (nextHeight > 0) setComposerHeight(nextHeight);
    };
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(composer);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [hasConversation]);

  React.useEffect(() => {
    if (!hasConversation) return;
    const cleanup = pinToBottom('auto');
    return cleanup;
  }, [composerHeight, hasConversation, pinToBottom]);

  React.useEffect(() => {
    if (!historyHydrated || !hasConversation) return;
    const cleanup = pinToBottom('auto');
    return cleanup;
  }, [historyHydrated, activeSessionId, hasConversation, pinToBottom]);

  React.useEffect(() => {
    setShowComposerControls(!hasConversation);
  }, [hasConversation]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-slate-900 dark:bg-[#22252f] dark:text-slate-100">
      <style>{`
        @keyframes forge-think-sweep {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(130%); }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(88,112,169,0.16),transparent_46%)] dark:bg-[radial-gradient(circle_at_50%_18%,rgba(88,112,169,0.32),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_85%,rgba(15,23,42,0.08),transparent_56%)] dark:bg-[radial-gradient(circle_at_50%_85%,rgba(15,23,42,0.45),transparent_56%)]" />

      <div className="relative flex h-screen min-h-screen w-full flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.26),rgba(255,255,255,0.06)_24%,rgba(255,255,255,0)_50%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01)_20%,rgba(255,255,255,0)_42%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(99,102,241,0.07),transparent_44%)] dark:bg-[radial-gradient(circle_at_50%_16%,rgba(99,102,241,0.14),transparent_44%)]" />

        <ForgeTopBar
          provider={provider}
          model={model}
          chatMode={chatMode}
          sandboxMode={sandboxMode}
          showComposerControls={showComposerControls}
          setShowComposerControls={setShowComposerControls}
          openAdvancedWorkspace={openAdvancedWorkspace}
          toggleThemeMode={toggleThemeMode}
          themeMode={themeMode}
          showGateway={showGateway}
          setShowGateway={setShowGateway}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
        />

        <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
            <section className="relative min-h-0 flex-1 overflow-hidden">
              <ForgeConversation
                viewportRef={viewportRef}
                viewportBottomPadding={viewportBottomPadding}
                hasConversation={hasConversation}
                visibleMessages={visibleMessages}
                lastActions={lastActions}
                forkFromVisibleMessage={forkFromVisibleMessage}
                setChatMode={setChatMode}
                continuePlanning={continuePlanning}
                runActions={runActions}
                sandboxMode={sandboxMode}
                executing={executing}
                selectedActionCount={selectedActionCount}
                selectedActionIndexes={selectedActionIndexes}
                setSelectedActionIndexes={setSelectedActionIndexes}
                toggleActionIndex={toggleActionIndex}
                loading={loading}
                loadingPhaseLabel={loadingPhaseLabel}
                scrollAnchorRef={scrollAnchorRef}
              />

              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-slate-100 via-slate-100/88 to-transparent dark:from-[#060b14] dark:via-[#060b14]/88" />

              <ForgeComposer
                composerRef={composerRef}
                hasConversation={hasConversation}
                leftDockOffset={leftDockOffset}
                rightDockOffset={rightDockOffset}
                controlsVisible={controlsVisible}
                provider={provider}
                switchProvider={switchProvider}
                model={model}
                setModel={setModel}
                modelOptions={modelOptions}
                skillId={skillId}
                setSkillId={setSkillId}
                skillOptions={skillOptions}
                chatMode={chatMode}
                setChatMode={setChatMode}
                sandboxMode={sandboxMode}
                setSandboxMode={setSandboxMode}
                runActions={runActions}
                lastActions={lastActions}
                selectedActionCount={selectedActionCount}
                executing={executing}
                promptUsage={promptUsage}
                loadingProviderModels={loadingProviderModels}
                providerModelsError={providerModelsError}
                fileInputRef={fileInputRef}
                onFilesSelected={onFilesSelected}
                attachments={attachments}
                removeAttachment={removeAttachment}
                openFilePicker={openFilePicker}
                uploadingAttachments={uploadingAttachments}
                textareaRef={textareaRef}
                prompt={prompt}
                setPrompt={setPrompt}
                onComposerKeyDown={onComposerKeyDown}
                sendPrompt={sendPrompt}
                loading={loading}
                checkingIntegration={checkingIntegration}
                integrationConfigured={integrationConfigured}
                quickPrompts={quickPrompts}
                toolsMenuRef={toolsMenuRef}
                toolsButtonRef={toolsButtonRef}
                showTools={showTools}
                setShowTools={setShowTools}
                activeTools={activeTools}
                totalTools={totalTools}
              />
            </section>
            <HistoryPanel
              showHistory={showHistory}
              historySource={historySource}
              historyLoading={historyLoading}
              historySessions={historySessions}
              activeSessionId={activeSessionId}
              setShowHistory={setShowHistory}
              startNewSession={startNewSession}
              openHistorySession={openHistorySession}
              removeHistorySession={removeHistorySession}
            />

            <GatewayPanel
              showGateway={showGateway}
              setShowGateway={setShowGateway}
              provider={provider}
              switchProvider={switchProvider}
              providerOptions={PROVIDER_OPTIONS}
              model={model}
              setModel={setModel}
              modelOptions={modelOptions}
              loadingProviderModels={loadingProviderModels}
              providerModelsError={providerModelsError}
              hasSavedSecret={hasSavedSecret}
              apiKey={apiKey}
              setApiKey={setApiKey}
              baseUrl={baseUrl}
              setBaseUrl={setBaseUrl}
              integrationSaving={integrationSaving}
              saveIntegration={saveIntegration}
              openAdvancedAiSettings={openAdvancedAiSettings}
            />
        </div>
      </div>
      <ToolsOverlay
        showTools={showTools}
        toolsMenuStyle={toolsMenuStyle}
        toolsDropdownRef={toolsDropdownRef}
        availableTools={availableTools}
        selectedTools={selectedTools}
        setSelectedTools={setSelectedTools}
        toggleTool={toggleTool}
        getToolHelp={getToolHelp}
      />

      {notice ? (
        <div className="fixed left-1/2 top-5 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-900 shadow-lg backdrop-blur dark:border-emerald-300/45 dark:bg-emerald-300/14 dark:text-emerald-100">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="inline-flex h-5 w-5 items-center justify-center rounded-md hover:bg-white/10"
            aria-label="Dismiss notice"
          >
            <FrameworkIcons.X size={12} />
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="fixed left-1/2 top-5 z-[95] flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-xl border border-rose-300/70 bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-900 shadow-lg backdrop-blur dark:border-rose-300/45 dark:bg-rose-300/16 dark:text-rose-100">
          <span className="break-all">{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md hover:bg-white/10"
            aria-label="Dismiss error"
          >
            <FrameworkIcons.X size={12} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
