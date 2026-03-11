'use client';

import React, { useMemo, useState } from 'react';
import { FrameworkIcons, ContextHooks } from '@fromcode119/react';
import { ApiVersionUtils } from '@fromcode119/sdk';
import { HistoryPanel, ToolsOverlay } from './admin-assistant-panels';
import {
  AssistantComposer,
  AssistantConversation,
  AssistantActionCard,
  AssistantSimpleTopBar,
  AssistantSettingsDrawer,
} from './components';
import {
  AssistantConstants,
} from './admin-assistant-core';
import { GlassMorphism } from './ui/glass-morphism';
import { AssistantFormatUtils } from './assistant-format-utils';
import { AssistantIntentUtils } from './assistant-intent-utils';
import { AssistantProviderUtils } from './assistant-provider-utils';
import { AssistantSurfaceUtils } from './assistant-surface-utils';
import { AssistantTextUtils } from './assistant-text-utils';
import type {
  AssistantAction,
  AssistantLayoutState,
  AssistantMessage,
  AssistantSkill,
  AssistantToolOption,
  AssistantTrace,
  UploadedAttachment,
  ForgeHistorySession,
} from './admin-assistant-core';

/**
 * Admin base path - matches ROUTES.ADMIN.BASE from @fromcode119/admin/lib/constants
 */
const DEFAULT_ADMIN_BASE_PATH = '/admin';

const OLLAMA_DOCKER_BASE_URL = 'http://host.docker.internal:11434';

const tryParseHostname = (value: string): string => {
  try {
    return String(new URL(String(value || '').trim()).hostname || '').trim().toLowerCase();
  } catch {
    return '';
  }
};

const sanitizeBaseUrlForProvider = (providerKey: string, candidate: string): string => {
  const normalizedProvider = String(providerKey || '').trim().toLowerCase();
  const raw = String(candidate || '').trim();
  if (!raw) return '';
  const host = tryParseHostname(raw);
  if (!host) return '';

  if (normalizedProvider === 'ollama') {
    if (host.includes('openai.com') || host.includes('anthropic.com') || host.includes('googleapis.com')) return '';
  }
  if (normalizedProvider === 'openai' && (host === '127.0.0.1' || host === 'localhost' || host.endsWith('.local'))) {
    // Avoid accidentally carrying local Ollama/app URLs into OpenAI.
    return '';
  }
  return raw;
};

const parseModeSwitchCommand = (input: string): 'chat' | 'build' | 'quickfix' | null => {
  const normalized = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!normalized) return null;
  const match = normalized.match(/^(switch|change|set|use)\s+(to\s+)?(chat|build|quick\s*fix)(\s+mode)?[.!?]*$/i);
  if (!match) return null;
  const target = String(match[3] || '').replace(/\s+/g, '').toLowerCase();
  if (target === 'chat') return 'chat';
  if (target === 'build') return 'build';
  if (target === 'quickfix') return 'quickfix';
  return null;
};

const E = AssistantConstants.ENDPOINTS;
const SURFACE_NAME = AssistantConstants.SURFACE_NAME;
const MAX_PROMPT_LENGTH = AssistantConstants.MAX_PROMPT_LENGTH;
const PROVIDER_PRESETS = AssistantConstants.PROVIDER_PRESETS;
const PROVIDER_OPTIONS = AssistantConstants.PROVIDER_OPTIONS;
const FORGE_UI_PREFS_STORAGE_KEY = AssistantConstants.STORAGE_KEYS.UI_PREFS;
const FORGE_HISTORY_STORAGE_KEY = AssistantConstants.STORAGE_KEYS.HISTORY;
const FORGE_ACTIVE_SESSION_KEY = AssistantConstants.STORAGE_KEYS.ACTIVE_SESSION;

export function AdminAssistantPage() {
  const { api } = ContextHooks.usePlugins();
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { role: 'system', content: `${SURFACE_NAME} ready. Ask for changes and approve actions.` },
  ]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [layoutState, setLayoutState] = useState<AssistantLayoutState>(() => {
    let leftOpen = true;
    let rightOpen = true;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(FORGE_UI_PREFS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw || '{}');
          const parsedLeft =
            typeof parsed?.leftSidebarOpen === 'boolean'
              ? parsed.leftSidebarOpen
              : typeof parsed?.leftOpen === 'boolean'
              ? parsed.leftOpen
              : undefined;
          const parsedRight =
            typeof parsed?.rightSidebarOpen === 'boolean'
              ? parsed.rightSidebarOpen
              : typeof parsed?.rightOpen === 'boolean'
              ? parsed.rightOpen
              : undefined;
          if (typeof parsedLeft === 'boolean') leftOpen = parsedLeft;
          if (typeof parsedRight === 'boolean') rightOpen = parsedRight;
        }
      } catch {
        // ignore invalid local storage payload
      }
    }
    return {
      viewport: 'desktop',
      leftOpen,
      rightOpen,
      overlay: 'none',
    };
  });
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return 'light';
    const saved = String(localStorage.getItem('theme') || '').trim().toLowerCase();
    if (saved === 'dark' || saved === 'light') return saved;
    if (document.documentElement.classList.contains('dark')) return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [chatMode, setChatMode] = useState<'auto' | 'plan' | 'agent'>('auto');
  const [sandboxMode, setSandboxMode] = useState(true);
  const [batchExecutionSummaries, setBatchExecutionSummaries] = useState<
    Record<string, { ok: number; unchanged: number; failed: number }>
  >({});
  const [historySessions, setHistorySessions] = useState<ForgeHistorySession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const [historySource, setHistorySource] = useState<'server' | 'local'>('server');
  const [historyLoading, setHistoryLoading] = useState(false);

  const [provider, setProvider] = useState(() => {
    if (typeof window === 'undefined') return 'openai';
    try {
      const raw = localStorage.getItem(FORGE_UI_PREFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const prefProvider = String(parsed?.provider || '').trim().toLowerCase();
        if (prefProvider && PROVIDER_OPTIONS.some((item) => item.value === prefProvider)) {
          return prefProvider;
        }
      }
    } catch {
      // ignore
    }
    return 'openai';
  });
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(() => {
    if (typeof window === 'undefined') return PROVIDER_PRESETS.openai[0].value;
    try {
      const raw = localStorage.getItem(FORGE_UI_PREFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const prefModel = String(parsed?.model || '').trim();
        if (prefModel) return prefModel;
        const prefProvider = String(parsed?.provider || '').trim().toLowerCase();
        if (prefProvider && PROVIDER_PRESETS[prefProvider]) {
          return PROVIDER_PRESETS[prefProvider][0].value;
        }
      }
    } catch {
      // ignore
    }
    return PROVIDER_PRESETS.openai[0].value;
  });
  const [baseUrl, setBaseUrl] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const raw = localStorage.getItem(FORGE_UI_PREFS_STORAGE_KEY);
      if (!raw) return '';
      const parsed = JSON.parse(raw || '{}');
      const baseUrls =
        parsed?.baseUrls && typeof parsed.baseUrls === 'object' && !Array.isArray(parsed.baseUrls)
          ? parsed.baseUrls
          : null;
      const byProvider = baseUrls ? String((baseUrls as Record<string, any>)[provider] || '').trim() : '';
      const sanitizedByProvider = sanitizeBaseUrlForProvider(provider, byProvider);
      if (sanitizedByProvider) return sanitizedByProvider;
      if (byProvider) return byProvider;
      const prefProvider = String(parsed?.provider || '').trim().toLowerCase();
      if (prefProvider === provider) {
        const fromLegacy = String(parsed?.baseUrl || '').trim();
        const sanitizedLegacy = sanitizeBaseUrlForProvider(provider, fromLegacy);
        if (sanitizedLegacy) return sanitizedLegacy;
      }
    } catch {
      // ignore invalid local storage payload
    }
    return '';
  });
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
  const [selectedActionIndexes, setSelectedActionIndexes] = useState<number[]>([]);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [loadingPhaseIndex, setLoadingPhaseIndex] = useState(0);
  const [uiPrefsHydrated, setUiPrefsHydrated] = useState(false);
  
  // Settings drawer preferences
  const [autoApprove, setAutoApprove] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [verboseLogging, setVerboseLogging] = useState(false);

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
  const conversationMode = useMemo(() => AssistantProviderUtils.chatModeToConversationMode(chatMode), [chatMode]);
  const isMobileViewport = layoutState.viewport === 'mobile';
  const showHistory = isMobileViewport ? layoutState.overlay === 'left' : layoutState.leftOpen;
  const showGateway = isMobileViewport ? layoutState.overlay === 'right' : layoutState.rightOpen;

  const toggleHistoryPanel = React.useCallback(() => {
    setLayoutState((prev) => {
      if (prev.viewport === 'mobile') {
        return {
          ...prev,
          overlay: prev.overlay === 'left' ? 'none' : 'left',
        };
      }
      return { ...prev, leftOpen: !prev.leftOpen };
    });
  }, []);

  const toggleSettingsPanel = React.useCallback(() => {
    setLayoutState((prev) => {
      if (prev.viewport === 'mobile') {
        return {
          ...prev,
          overlay: prev.overlay === 'right' ? 'none' : 'right',
        };
      }
      return { ...prev, rightOpen: !prev.rightOpen };
    });
  }, []);

  const closeHistoryPanel = React.useCallback(() => {
    setLayoutState((prev) => {
      if (prev.viewport === 'mobile') return { ...prev, overlay: prev.overlay === 'left' ? 'none' : prev.overlay };
      return { ...prev, leftOpen: false };
    });
  }, []);

  const closeSettingsPanel = React.useCallback(() => {
    setLayoutState((prev) => {
      if (prev.viewport === 'mobile') return { ...prev, overlay: prev.overlay === 'right' ? 'none' : prev.overlay };
      return { ...prev, rightOpen: false };
    });
  }, []);

  const promptUsage = `${prompt.length}/${AssistantConstants.MAX_PROMPT_LENGTH}`;
  const totalTools = availableTools.length;
  const activeTools = selectedTools.length;
  const activeBatchEntry = useMemo(() => {
    const candidates = messages
      .map((entry, index) => {
        const actions = Array.isArray(entry.actions) ? entry.actions : [];
        if (!actions.length || !entry.actionBatch) return null;
        return {
          index,
          actions,
          actionBatch: entry.actionBatch,
          ui: entry.ui,
        };
      })
      .filter(Boolean) as Array<{
      index: number;
      actions: AssistantAction[];
      actionBatch: NonNullable<AssistantMessage['actionBatch']>;
      ui?: AssistantMessage['ui'];
    }>;

    if (!candidates.length) return null;
    const source = candidates.some((item) => item.actionBatch.state !== 'stale')
      ? candidates.filter((item) => item.actionBatch.state !== 'stale')
      : candidates;

    return source.sort((a, b) => {
      const byTime = Number(b.actionBatch.createdAt || 0) - Number(a.actionBatch.createdAt || 0);
      if (byTime !== 0) return byTime;
      return b.index - a.index;
    })[0];
  }, [messages]);
  const lastActions = activeBatchEntry?.actions || ([] as AssistantAction[]);
  const activeBatchId = String(activeBatchEntry?.actionBatch?.id || '').trim();
  const selectedActionCount = selectedActionIndexes.filter((index) => index >= 0 && index < lastActions.length).length;
  const followDistanceThreshold = 220;

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
    if (typeof window === 'undefined') return;
    const syncViewport = () => {
      const nextViewport = window.innerWidth <= 900 ? 'mobile' : 'desktop';
      setLayoutState((prev) => {
        if (prev.viewport === nextViewport) return prev;
        return {
          ...prev,
          viewport: nextViewport,
          overlay: 'none',
        };
      });
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  React.useEffect(() => {
    if (layoutState.viewport !== 'mobile') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLayoutState((prev) => ({ ...prev, overlay: 'none' }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [layoutState.viewport]);

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
    return;
  }, [loading, chatMode]);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setCheckingIntegration(true);
      try {
        const integration = await api.get(E.INTEGRATION);
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
        const providerNeedsApiKey = providerKey === 'openai' || providerKey === 'anthropic' || providerKey === 'gemini';
        const hasSecret = providerNeedsApiKey ? String(providerConfig?.apiKey || '').trim().length > 0 : true;

        // Only update provider/model from server if user hasn't set preferences in localStorage
        // This prevents the integration check from overriding user's last selection on page refresh
        const hasLocalPrefs = (() => {
          try {
            const raw = localStorage.getItem(FORGE_UI_PREFS_STORAGE_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              return !!(parsed?.provider || parsed?.model);
            }
          } catch {
            // ignore
          }
          return false;
        })();

        if (!hasLocalPrefs) {
          setProvider(providerKey || 'openai');
          setModel(modelValue || (PROVIDER_PRESETS[providerKey]?.[0]?.value || PROVIDER_PRESETS.openai[0].value));
          setBaseUrl(baseUrlValue);
        }
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
    if ((provider === 'openai' || provider === 'anthropic' || provider === 'gemini') && !apiKey.trim() && !hasSavedSecret) {
      const providerLabel = provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Anthropic' : 'Gemini';
      setProviderModels([]);
      setProviderModelsError(`Add a ${providerLabel} API key to load models.`);
      return;
    }

    let trimmedBaseUrl = baseUrl.trim();
    if (provider === 'ollama' && /(^|:\/\/)(api\.)?openai\.com$/i.test((() => {
      try {
        return new URL(trimmedBaseUrl).hostname || '';
      } catch {
        return '';
      }
    })())) {
      // Ignore stale OpenAI URL when querying Ollama models.
      trimmedBaseUrl = '';
    }
    if (trimmedBaseUrl) {
      try {
        const parsed = new URL(trimmedBaseUrl);
        const currentHost =
          typeof window !== 'undefined' ? String(window.location.hostname || '').trim().toLowerCase() : '';
        const candidateHost = String(parsed.hostname || '').trim().toLowerCase();
        const candidatePath = String(parsed.pathname || '').trim().toLowerCase();
        const apiPrefix = ApiVersionUtils.prefix().toLowerCase();
        const apiBasePrefix = `${apiPrefix.split('/v')[0]}/`.toLowerCase();
        const pointsToForgeApi =
          candidatePath.includes('/forge/admin/assistant') ||
          candidatePath.startsWith(apiPrefix) ||
          candidatePath.startsWith(apiBasePrefix);

        if (pointsToForgeApi && (!currentHost || candidateHost === currentHost)) {
          setProviderModels([]);
          setProviderModelsError(
            `Base URL points to this app API (${trimmedBaseUrl}). Set the provider endpoint instead (for example Ollama: http://host.docker.internal:11434).`,
          );
          return;
        }
      } catch {
        setProviderModels([]);
        setProviderModelsError('Base URL must be a full URL (for example: http://host.docker.internal:11434).');
        return;
      }
    }

    setLoadingProviderModels(true);
    setProviderModelsError('');
    try {
      const config: Record<string, any> = {};
      if (provider === 'ollama') {
        // Always send a provider-scoped baseUrl override so stale stored OpenAI values are not reused.
        config.baseUrl = trimmedBaseUrl;
      } else if (trimmedBaseUrl) {
        config.baseUrl = trimmedBaseUrl;
      }
      if ((provider === 'openai' || provider === 'anthropic' || provider === 'gemini') && apiKey.trim()) {
        config.apiKey = apiKey.trim();
      }

      const response = await api.post(E.MODELS, {
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

      if (models.length > 0 && !models.some((item: any) => item.value === model)) {
        setModel(models[0].value);
      }
      if (models.length === 0) {
        setProviderModelsError('No models returned by this provider.');
      }
    } catch (e: any) {
      setProviderModels([]);
      const rawError = String(e?.message || 'Failed to fetch models.').trim();
      const normalizedError = rawError.toLowerCase();
      if (provider === 'ollama' && (normalizedError.includes('fetch failed') || normalizedError.includes('failed to fetch'))) {
        setProviderModelsError(
          'Could not reach Ollama. If API runs in Docker and Ollama runs on your host, set Base URL to http://host.docker.internal:11434.',
        );
      } else {
        setProviderModelsError(rawError);
      }
    } finally {
      setLoadingProviderModels(false);
    }
  }, [api, apiKey, baseUrl, hasSavedSecret, model, provider]);

  React.useEffect(() => {
    if (checkingIntegration || !uiPrefsHydrated) return;
    const timer = window.setTimeout(() => {
      void fetchProviderModels();
    }, 320);
    return () => window.clearTimeout(timer);
  }, [checkingIntegration, uiPrefsHydrated, fetchProviderModels]);

  React.useEffect(() => {
    let cancelled = false;
    const loadTools = async () => {
      try {
        const response = await api.get(E.TOOLS);
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
          const next = prev.filter((tool) => tools.some((entry: any) => entry.tool === tool));
          return next.length > 0 ? next : tools.map((entry: any) => entry.tool);
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
        const response = await api.get(E.SKILLS);
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
      title: String(item?.title || AssistantTextUtils.summarizeSessionTitle(messages)).trim() || 'Untitled session',
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
      const raw = localStorage.getItem(AssistantConstants.STORAGE_KEYS.HISTORY);
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
          `${E.SESSIONS}?limit=60${options?.includeMessages ? '&includeMessages=true' : ''}`,
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
      const response = await api.get(`${E.SESSIONS}/${encodeURIComponent(normalized)}`);
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
    if (!showTechnicalDetails && showTools) {
      setShowTools(false);
    }
  }, [showTechnicalDetails, showTools]);

  React.useEffect(() => {
    if (!activeBatchId) {
      setSelectedActionIndexes([]);
      return;
    }
    setSelectedActionIndexes(lastActions.map((_, index) => index));
  }, [activeBatchId, lastActions.length]);

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
      const savedActive = typeof window !== 'undefined' ? String(localStorage.getItem(AssistantConstants.STORAGE_KEYS.ACTIVE_SESSION) || '').trim() : '';
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
      const baseUrls =
        parsed?.baseUrls && typeof parsed.baseUrls === 'object' && !Array.isArray(parsed.baseUrls)
          ? parsed.baseUrls
          : null;
      const providerForBaseUrl = prefProvider || provider;
      const prefBaseUrlRaw = String(
        (baseUrls && providerForBaseUrl ? baseUrls[providerForBaseUrl] : undefined) || parsed?.baseUrl || '',
      ).trim();
      const prefBaseUrl = sanitizeBaseUrlForProvider(providerForBaseUrl, prefBaseUrlRaw);
      const prefSkillId = String(parsed?.skillId || '').trim().toLowerCase();
      const prefMode = parsed?.chatMode === 'plan' || parsed?.chatMode === 'agent' || parsed?.chatMode === 'auto' ? parsed.chatMode : null;
      const prefLeftOpen =
        typeof parsed?.leftSidebarOpen === 'boolean'
          ? parsed.leftSidebarOpen
          : typeof parsed?.leftOpen === 'boolean'
          ? parsed.leftOpen
          : null;
      const prefRightOpen =
        typeof parsed?.rightSidebarOpen === 'boolean'
          ? parsed.rightSidebarOpen
          : typeof parsed?.rightOpen === 'boolean'
          ? parsed.rightOpen
          : null;
      if (prefProvider && PROVIDER_OPTIONS.some((item) => item.value === prefProvider)) setProvider(prefProvider);
      if (prefModel) setModel(prefModel);
      if (prefBaseUrl) setBaseUrl(prefBaseUrl);
      else if (providerForBaseUrl === 'ollama') setBaseUrl(OLLAMA_DOCKER_BASE_URL);
      if (prefSkillId) setSkillId(prefSkillId);
      if (prefMode) setChatMode(prefMode);
      if (typeof parsed?.sandboxMode === 'boolean') setSandboxMode(parsed.sandboxMode);
      if (prefLeftOpen !== null || prefRightOpen !== null) {
        setLayoutState((prev) => ({
          ...prev,
          leftOpen: prefLeftOpen !== null ? prefLeftOpen : prev.leftOpen,
          rightOpen: prefRightOpen !== null ? prefRightOpen : prev.rightOpen,
        }));
      }
    } catch {
      // ignore invalid local storage payload
    } finally {
      setUiPrefsHydrated(true);
    }
  }, [checkingIntegration, provider]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      let persistedBaseUrls: Record<string, string> = {};
      try {
        const raw = localStorage.getItem(FORGE_UI_PREFS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw || '{}');
          if (parsed?.baseUrls && typeof parsed.baseUrls === 'object' && !Array.isArray(parsed.baseUrls)) {
            persistedBaseUrls = Object.entries(parsed.baseUrls as Record<string, any>).reduce(
              (acc, [key, value]) => {
                const k = String(key || '').trim().toLowerCase();
                const v = String(value || '').trim();
                if (k && v) acc[k] = v;
                return acc;
              },
              {} as Record<string, string>,
            );
          }
        }
      } catch {
        // ignore invalid local storage payload
      }

      const normalizedProvider = String(provider || '').trim().toLowerCase();
      const normalizedBaseUrl = String(baseUrl || '').trim();
      if (normalizedProvider) {
        if (normalizedBaseUrl) persistedBaseUrls[normalizedProvider] = normalizedBaseUrl;
        else delete persistedBaseUrls[normalizedProvider];
      }

      localStorage.setItem(
        FORGE_UI_PREFS_STORAGE_KEY,
        JSON.stringify({
          provider,
          model,
          skillId,
          baseUrl: normalizedBaseUrl,
          baseUrls: persistedBaseUrls,
          chatMode,
          sandboxMode,
          leftSidebarOpen: layoutState.leftOpen,
          rightSidebarOpen: layoutState.rightOpen,
        }),
      );
    } catch {
      // ignore storage quota errors
    }
  }, [provider, model, skillId, baseUrl, chatMode, sandboxMode, layoutState.leftOpen, layoutState.rightOpen]);

  React.useEffect(() => {
    const normalizedProvider = String(provider || '').trim().toLowerCase();
    const raw = String(baseUrl || '').trim();
    const sanitized = sanitizeBaseUrlForProvider(normalizedProvider, raw);
    if (sanitized === raw) return;
    if (normalizedProvider === 'ollama') {
      setBaseUrl(OLLAMA_DOCKER_BASE_URL);
      return;
    }
    setBaseUrl(sanitized);
  }, [provider, baseUrl]);

  React.useEffect(() => {
    if (historySource !== 'local') return;
    const normalizedMessages = AssistantTextUtils.stripReadyMessage(messages);
    if (!normalizedMessages.length) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = `session-${Date.now()}`;
      setActiveSessionId(sessionId);
    }

    const session: ForgeHistorySession = {
      id: sessionId,
      title: AssistantTextUtils.summarizeSessionTitle(normalizedMessages),
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
    let nextBaseUrl = '';
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(FORGE_UI_PREFS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw || '{}');
          const baseUrls =
            parsed?.baseUrls && typeof parsed.baseUrls === 'object' && !Array.isArray(parsed.baseUrls)
              ? parsed.baseUrls
              : null;
          nextBaseUrl = String((baseUrls && normalized ? baseUrls[normalized] : undefined) || '').trim();
          if (!nextBaseUrl && String(parsed?.provider || '').trim().toLowerCase() === normalized) {
            nextBaseUrl = String(parsed?.baseUrl || '').trim();
          }
        }
      } catch {
        // ignore invalid local storage payload
      }
    }
    nextBaseUrl = sanitizeBaseUrlForProvider(normalized, nextBaseUrl);
    if (!nextBaseUrl && normalized === 'ollama') nextBaseUrl = OLLAMA_DOCKER_BASE_URL;
    setProvider(normalized);
    setModel(fallbackModel);
    setBaseUrl(nextBaseUrl);
    setProviderModels([]);
    setProviderModelsError('');
    setApiKey('');
    setNotice('');
    setError('');
  };

  const openAdvancedWorkspace = () => {
    if (typeof window === 'undefined') return;
    const adminBase = DEFAULT_ADMIN_BASE_PATH;
    const isAdminScoped = window.location.pathname === adminBase || window.location.pathname.startsWith(`${adminBase}/`);
    const prefix = isAdminScoped ? adminBase : '';
    try {
      localStorage.setItem('fc_admin_advanced_mode', 'true');
      window.dispatchEvent(new Event('fc:admin-mode-change'));
    } catch {
      // ignore storage errors and continue navigation
    }
    window.location.assign(`${prefix || ''}/`);
  };

  const toggleThemeMode = () => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const openAdvancedAiSettings = () => {
    if (typeof window === 'undefined') return;
    const adminBase = DEFAULT_ADMIN_BASE_PATH;
    const isAdminScoped = window.location.pathname === adminBase || window.location.pathname.startsWith(`${adminBase}/`);
    const prefix = isAdminScoped ? adminBase : '';
    window.location.assign(`${prefix}/settings/integrations?type=ai`);
  };

  const startNewSession = () => {
    followLatestRef.current = true;
    setMessages([{ role: 'system', content: `${SURFACE_NAME} ready. Ask for changes and approve actions.` }]);
    setPrompt('');
    setAttachments([]);
    setSelectedActionIndexes([]);
    setActiveSessionId(`session-${Date.now()}`);
    setLayoutState((prev) => (prev.viewport === 'mobile' ? { ...prev, overlay: 'none' } : prev));
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
          setLayoutState((prev) => (prev.viewport === 'mobile' ? { ...prev, overlay: 'none' } : prev));
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
    setLayoutState((prev) => (prev.viewport === 'mobile' ? { ...prev, overlay: 'none' } : prev));
    followLatestRef.current = true;
  };

  const removeHistorySession = (sessionId: string) => {
    const normalized = String(sessionId || '').trim();
    if (!normalized) return;
    if (historySource === 'server') {
      void (async () => {
        try {
          await api.delete(`${E.SESSIONS}/${encodeURIComponent(normalized)}`);
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
      setLayoutState((prev) => (prev.viewport === 'mobile' ? { ...prev, overlay: 'none' } : prev));
      setNotice('Forked to a new session from this message.');
      setError('');
    };

    if (historySource !== 'server' || !sourceSessionId) {
      localFallback();
      return;
    }

    void (async () => {
      try {
        const response = await api.post(`${E.SESSIONS}/${encodeURIComponent(sourceSessionId)}/fork`, {
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
        setLayoutState((prev) => (prev.viewport === 'mobile' ? { ...prev, overlay: 'none' } : prev));
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
    const rawBaseUrl = baseUrl.trim();
    let trimmedBaseUrl = sanitizeBaseUrlForProvider(provider, rawBaseUrl);
    if (provider === 'ollama' && !trimmedBaseUrl) {
      trimmedBaseUrl = OLLAMA_DOCKER_BASE_URL;
    }

    const providerNeedsApiKey = provider === 'openai' || provider === 'anthropic' || provider === 'gemini';
    if (providerNeedsApiKey && !trimmedApiKey && !hasSavedSecret) {
      setError(`${provider.charAt(0).toUpperCase()}${provider.slice(1)} API key is required.`);
      return;
    }

    const config: Record<string, any> = {
      model: trimmedModel || undefined,
      baseUrl: trimmedBaseUrl || undefined,
    };

    if (providerNeedsApiKey) {
      if (trimmedApiKey) config.apiKey = trimmedApiKey;
    }

    setIntegrationSaving(true);
    try {
      await api.put(E.INTEGRATION, {
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
      const actionBatch =
        result?.actionBatch && typeof result.actionBatch === 'object'
          ? {
              id: String(result.actionBatch.id || '').trim() || `batch-${Date.now()}`,
              state: (String(result.actionBatch.state || 'staged').trim().toLowerCase() as 'staged' | 'previewed' | 'applied' | 'stale'),
              createdAt: Number(result.actionBatch.createdAt || Date.now()) || Date.now(),
            }
          : actions.length > 0
            ? { id: `batch-${Date.now()}`, state: 'staged' as const, createdAt: Date.now() }
            : undefined;
      const reasoningReport =
        typeof result?.reasoningReport === 'string' && result.reasoningReport.trim()
          ? result.reasoningReport.trim()
          : undefined;
      const planStatus = String((plan as any)?.status || '').trim().toLowerCase();
      const suppressPrimaryText =
        !!plan &&
        (actions.length > 0 ||
          ui?.canContinue ||
          ui?.requiresApproval ||
          ['searching', 'staged', 'paused', 'ready_for_preview', 'ready_for_apply', 'failed'].includes(planStatus));
      const normalizedMessage = AssistantTextUtils.normalizeAssistantBodyText(String(result?.message || '').trim());
      const fallbackMessage =
        suppressPrimaryText ? '' : normalizedMessage || 'I finished this step. Tell me what you want to do next.';
      return {
        role: 'assistant',
        content: fallbackMessage,
        actions,
        actionBatch,
        traces: Array.isArray(result?.traces)
          ? result.traces.map((trace: any, index: number) => ({
              iteration: Number(trace?.iteration || index + 1),
              message: trace?.message ? String(trace.message) : undefined,
              toolCalls: AssistantFormatUtils.sanitizeTraceToolCalls(trace?.toolCalls),
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
        reasoningReport,
      };
    },
    [model, provider],
  );

  const appendAssistantMessage = React.useCallback((assistantMessage: AssistantMessage) => {
    setMessages((prev) => {
      const hasFreshBatch =
        Array.isArray(assistantMessage.actions) &&
        assistantMessage.actions.length > 0 &&
        !!assistantMessage.actionBatch;
      const normalizedPrev = hasFreshBatch
        ? prev.map((entry) => {
            if (!entry.actionBatch) return entry;
            if (entry.actionBatch.state !== 'staged' && entry.actionBatch.state !== 'previewed') return entry;
            return {
              ...entry,
              actionBatch: { ...entry.actionBatch, state: 'stale' as const },
              ui: entry.ui
                ? {
                    ...entry.ui,
                    nextStep: 'none' as const,
                    workflowState: 'stale' as const,
                    primaryAction: 'none' as const,
                    userSummary: 'This batch is stale. Request a fresh batch.',
                    summaryMode: entry.ui.summaryMode || 'concise',
                  }
                : entry.ui,
            };
          })
        : prev;
      return [...normalizedPrev, assistantMessage];
    });
  }, []);

  const sendPrompt = async (forcedPrompt?: string) => {
    const content = String(forcedPrompt ?? prompt).trim();
    if (!content || loading) return;

    const modeSwitchTarget = parseModeSwitchCommand(content);
    if (modeSwitchTarget) {
      const label = modeSwitchTarget === 'quickfix' ? 'Quick Fix' : modeSwitchTarget === 'build' ? 'Build' : 'Chat';
      setError('');
      setNotice(`${label} mode enabled.`);
      setChatMode(AssistantProviderUtils.conversationModeToChatMode(modeSwitchTarget));
      if (!forcedPrompt) setPrompt('');
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }

    if (!integrationConfigured) {
      setError('Configure gateway first.');
      return;
    }

    if (AssistantIntentUtils.isApprovalPrompt(content) && lastActions.length > 0 && selectedActionCount > 0 && !executing) {
      setMessages((prev) => [...prev, { role: 'user', content }]);
      if (!forcedPrompt) setPrompt('');
      const dryRunByState = activeBatchEntry?.actionBatch?.state === 'previewed' ? false : true;
      await runActions({ dryRun: dryRunByState, invokedByApproval: true });
      return;
    }

    setError('');
    setNotice('');
    followLatestRef.current = true;

    const currentAttachments = attachments.map((item) => ({ ...item }));
    const attachmentContext = AssistantTextUtils.serializeAttachmentsForModel(currentAttachments);
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
            const serialized = AssistantTextUtils.serializeAttachmentsForModel(entry.attachments);
            return {
              role: entry.role,
              content: serialized ? `${entry.content}\n\n${serialized}` : entry.content,
            };
          }
          return { role: entry.role, content: entry.content };
        });
      const lastAssistantMessage = [...messages].reverse().find((entry) => entry.role === 'assistant');
      const pendingCheckpoint =
        lastAssistantMessage?.checkpoint &&
        lastAssistantMessage?.ui?.needsClarification
          ? lastAssistantMessage.checkpoint
          : undefined;

      const requestedAgentMode =
        chatMode === 'plan' || chatMode === 'agent'
          ? 'advanced'
          : AssistantIntentUtils.hasPlanningIntent(contentForModel)
            ? 'advanced'
            : 'basic';
      const requestedMaxIterations = requestedAgentMode === 'advanced' ? (chatMode === 'agent' ? 12 : 8) : 1;
      const requestedMaxDurationMs = requestedAgentMode === 'advanced' ? (chatMode === 'agent' ? 35000 : 26000) : 12000;

      const result = await api.post(E.CHAT, {
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
        continueFrom: !!pendingCheckpoint,
        checkpoint: pendingCheckpoint,
      });
      const assistantMessage = buildAssistantMessageFromResult(result);
      if (assistantMessage.sessionId) {
        setActiveSessionId(String(assistantMessage.sessionId));
      }

      appendAssistantMessage(assistantMessage);
      setAttachments([]);
      refreshHistoryIfServer();
      if (chatMode === 'auto' && assistantMessage.ui?.suggestedMode === 'agent') {
        setNotice('Auto mode used agent loop for this request.');
      } else if (chatMode === 'auto' && assistantMessage.ui?.suggestedMode === 'plan') {
        setNotice('Auto mode used planning for this request.');
      }
      if (assistantMessage.actions && assistantMessage.actions.length > 0) {
        setNotice('Changes ready for review.');
      } else if (assistantMessage.ui?.needsClarification) {
        const question = String(assistantMessage.ui?.clarifyingQuestion || '').trim();
        setNotice(question || 'Need one detail to finish staging safely.');
      } else if (assistantMessage.ui?.loopRecoveryMode === 'best_effort') {
        setNotice("Draft generated. Confirm target collection + record to stage actions.");
      } else if (assistantMessage.ui?.canContinue) {
        setNotice('Need another planning pass before staging final actions.');
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
    const targetBatchId = activeBatchId || undefined;
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
      const dryRun = typeof options?.dryRun === 'boolean' ? options.dryRun : true;
      const result = await api.post(E.EXECUTE, {
        actions: actionsToRun,
        dryRun,
        sessionId: activeSessionId || undefined,
        batchId: targetBatchId,
      });
      const executionItems = Array.isArray(result?.results) ? result.results : [];
      const serverSummary =
        result?.executionSummary && typeof result.executionSummary === 'object'
          ? {
              ok: Number(result.executionSummary.ok || 0) || 0,
              unchanged: Number(result.executionSummary.unchanged || 0) || 0,
              failed: Number(result.executionSummary.failed || 0) || 0,
            }
          : null;
      const okCount = serverSummary?.ok ?? executionItems.filter((item: any) => AssistantSurfaceUtils.resolveExecutionKind(item) === 'ok').length;
      const skippedCount = serverSummary?.unchanged ?? executionItems.filter((item: any) => AssistantSurfaceUtils.resolveExecutionKind(item) === 'skipped').length;
      const failedCount = serverSummary?.failed ?? executionItems.filter((item: any) => AssistantSurfaceUtils.resolveExecutionKind(item) === 'failed').length;
      const resolvedBatchId = String(result?.executedBatchId || targetBatchId || '').trim();
      const resolvedBatchState =
        String(result?.batchState || (dryRun ? 'previewed' : 'applied')).trim().toLowerCase() === 'previewed'
          ? ('previewed' as const)
          : ('applied' as const);
      if (resolvedBatchId) {
        setBatchExecutionSummaries((prev) => ({
          ...prev,
          [resolvedBatchId]: { ok: okCount, unchanged: skippedCount, failed: failedCount },
        }));
      }
      const executionSummary = dryRun
        ? `Preview completed: ${okCount} ready, ${skippedCount} unchanged, ${failedCount} failed.`
        : `Execution completed: ${okCount} applied, ${skippedCount} unchanged, ${failedCount} failed.`;
      setMessages((prev) => {
        const fallbackIndex = resolvedBatchId
          ? -1
          : [...prev]
              .map((entry, index) => ({ entry, index }))
              .reverse()
              .find((entry) => entry.entry.actionBatch && entry.entry.actionBatch.state !== 'stale')?.index ?? -1;
        const nextMessages = prev.map((entry, index) => {
          const isCurrentBatch = resolvedBatchId
            ? String(entry.actionBatch?.id || '').trim() === resolvedBatchId
            : index === fallbackIndex;
          if (!isCurrentBatch) return entry;
          if (dryRun) {
            return {
              ...entry,
              actionBatch: entry.actionBatch
                ? { ...entry.actionBatch, state: resolvedBatchState }
                : {
                    id: resolvedBatchId || `batch-${Date.now()}`,
                    state: resolvedBatchState,
                    createdAt: Date.now(),
                  },
              ui: entry.ui
                ? {
                    ...entry.ui,
                    nextStep: 'apply' as const,
                    workflowState: 'previewed' as const,
                    primaryAction: 'apply' as const,
                    userSummary: 'Preview complete. Review and apply when ready.',
                    summaryMode: entry.ui.summaryMode || 'concise',
                  }
                : entry.ui,
            };
          }
          return {
            ...entry,
            actionBatch: entry.actionBatch
              ? { ...entry.actionBatch, state: resolvedBatchState }
              : {
                  id: resolvedBatchId || `batch-${Date.now()}`,
                  state: resolvedBatchState,
                  createdAt: Date.now(),
                },
            ui: entry.ui
              ? {
                  ...entry.ui,
                  requiresApproval: false,
                  canContinue: false,
                  nextStep: 'none' as const,
                  workflowState: 'applied' as const,
                  primaryAction: 'none' as const,
                  userSummary: 'Changes applied.',
                  summaryMode: entry.ui.summaryMode || 'concise',
                }
              : entry.ui,
            plan: entry.plan ? { ...entry.plan, status: 'completed' as const } : entry.plan,
          };
        });
        return [
          ...nextMessages,
          {
            role: 'system',
            content: executionSummary,
            execution: result,
            actionBatch: resolvedBatchId
              ? {
                  id: resolvedBatchId,
                  state: resolvedBatchState,
                  createdAt: Date.now(),
                }
              : nextMessages
                  .slice()
                  .reverse()
                  .find((entry) => entry.actionBatch)?.actionBatch || undefined,
          },
        ];
      });
      if (!dryRun) {
        setSelectedActionIndexes([]);
      }
      if (options?.invokedByApproval) {
        setNotice(dryRun ? 'Approved and previewed selected changes.' : 'Approved and applied selected changes.');
      }
      refreshHistoryIfServer();
    } catch (e: any) {
      setError(String(e?.message || 'Execution failed'));
    } finally {
      setExecuting(false);
    }
  };

  const onComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;
    if (event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void sendPrompt();
  };

  const onQuickFix = React.useCallback(() => {
    setError('');
    setChatMode('agent');
    setNotice('Quick Fix enabled.');
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

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
    return AssistantTextUtils.stripReadyMessage(messages);
  }, [messages]);
  const activeBatchSummary = activeBatchId ? batchExecutionSummaries[activeBatchId] : undefined;
  const actionDockOffset = 16;

  const hasConversation = visibleMessages.length > 0;
  const viewportBottomPadding = activeBatchEntry ? 220 : hasConversation ? 48 : 140;
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
    showHistory,
    showGateway,
    viewportBottomPadding,
    messages,
  ]);

  React.useEffect(() => {
    if (!historyHydrated || !hasConversation) return;
    const cleanup = pinToBottom('auto');
    return cleanup;
  }, [historyHydrated, activeSessionId, hasConversation, pinToBottom]);

  return (
    <div
      className={GlassMorphism.GLASS_APP_BG}
      style={{
        fontFamily:
          "'Plus Jakarta Sans', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      <style>{`
        ${GlassMorphism.GLASS_FONT_IMPORT}
        @keyframes forge-think-sweep {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(130%); }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_4%,rgba(255,255,255,0.05),transparent_45%)] dark:bg-[radial-gradient(circle_at_50%_4%,rgba(255,255,255,0.03),transparent_45%)]" />

      <div className="relative flex h-screen min-h-screen w-full">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.03))] dark:bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.2))]" />
        <HistoryPanel
          presentation={isMobileViewport ? 'overlay' : 'docked'}
          showHistory={showHistory}
          historySource={historySource}
          historyLoading={historyLoading}
          historySessions={historySessions}
          activeSessionId={activeSessionId}
          onRequestClose={closeHistoryPanel}
          startNewSession={startNewSession}
          openHistorySession={openHistorySession}
          removeHistorySession={removeHistorySession}
        />

        <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg)]">
          <AssistantSimpleTopBar
            sessionTitle="Forge AI"
            historyCount={historySessions.length}
            onBackToAdmin={openAdvancedWorkspace}
            onHistoryToggle={toggleHistoryPanel}
            onSettingsOpen={toggleSettingsPanel}
            onThemeToggle={toggleThemeMode}
            themeMode={themeMode}
          />

          <section className="relative min-h-0 flex-1 overflow-hidden">
              <AssistantActionCard
                batch={activeBatchEntry?.actionBatch}
                actions={lastActions}
                selectedIndexes={selectedActionIndexes}
                onToggleAction={toggleActionIndex}
                onSelectAll={() => setSelectedActionIndexes(lastActions.map((_, index) => index))}
                onDeselectAll={() => setSelectedActionIndexes([])}
                onPreview={() => runActions({ dryRun: true })}
                onApply={() => runActions({ dryRun: false })}
                isRunning={executing}
                executionSummary={activeBatchSummary}
                mode={conversationMode}
                placement="bottom"
                bottomOffset={actionDockOffset}
              />
              <AssistantConversation
                viewportRef={viewportRef}
                viewportBottomPadding={viewportBottomPadding}
                hasConversation={hasConversation}
                visibleMessages={visibleMessages}
                forkFromVisibleMessage={forkFromVisibleMessage}
                setChatMode={setChatMode}
                loading={loading}
                scrollAnchorRef={scrollAnchorRef}
                chatMode={chatMode}
                loadingPhaseIndex={loadingPhaseIndex}
                showTechnicalDetails={showTechnicalDetails}
              />
          </section>
          <footer className="relative z-20">
            <AssistantComposer
              composerRef={composerRef}
              hasConversation={hasConversation}
              mode={conversationMode}
              setMode={(mode) => setChatMode(AssistantProviderUtils.conversationModeToChatMode(mode))}
              promptUsage={promptUsage}
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
              onQuickFix={onQuickFix}
              sendPrompt={sendPrompt}
              loading={loading}
              checkingIntegration={checkingIntegration}
              integrationConfigured={integrationConfigured}
              quickPrompts={quickPrompts}
              toolsButtonRef={toolsButtonRef}
              showTools={showTools}
              setShowTools={setShowTools}
              activeTools={activeTools}
              totalTools={totalTools}
              developerMode={showTechnicalDetails}
            />
          </footer>
        </main>

        <AssistantSettingsDrawer
          presentation={isMobileViewport ? 'overlay' : 'docked'}
          isOpen={showGateway}
          onClose={closeSettingsPanel}
          onRequestClose={closeSettingsPanel}
          provider={provider}
          onProviderChange={switchProvider}
          providerOptions={PROVIDER_OPTIONS}
          model={model}
          onModelChange={setModel}
          modelOptions={modelOptions}
          loadingModels={loadingProviderModels}
          modelsError={providerModelsError}
          skillId={skillId}
          onSkillIdChange={setSkillId}
          skillOptions={skillOptions}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          hasSavedSecret={hasSavedSecret}
          baseUrl={baseUrl}
          onBaseUrlChange={setBaseUrl}
          onSave={saveIntegration}
          isSaving={integrationSaving}
          autoApprove={autoApprove}
          onAutoApproveChange={setAutoApprove}
          showTechnicalDetails={showTechnicalDetails}
          onShowTechnicalDetailsChange={setShowTechnicalDetails}
          verboseLogging={verboseLogging}
          onVerboseLoggingChange={setVerboseLogging}
        />
      </div>
      <ToolsOverlay
        showTools={showTechnicalDetails && showTools}
        toolsMenuStyle={toolsMenuStyle}
        toolsDropdownRef={toolsDropdownRef}
        availableTools={availableTools}
        selectedTools={selectedTools}
        setSelectedTools={setSelectedTools}
        toggleTool={toggleTool}
        getToolHelp={AssistantFormatUtils.getToolHelp}
      />

      {notice ? (
        <div className="fixed left-1/2 top-5 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-100/92 px-3 py-2 text-xs font-semibold text-emerald-900 shadow-lg backdrop-blur-xl dark:border-emerald-300/45 dark:bg-emerald-300/16 dark:text-emerald-100">
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
        <div className="fixed left-1/2 top-5 z-[95] flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-xl border border-rose-300/70 bg-rose-100/92 px-3 py-2 text-xs font-semibold text-rose-900 shadow-lg backdrop-blur-xl dark:border-rose-300/45 dark:bg-rose-300/18 dark:text-rose-100">
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
