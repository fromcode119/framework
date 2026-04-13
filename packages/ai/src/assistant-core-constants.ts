export class AssistantConstants {
  static readonly SURFACE_NAME = 'Atlantis Intelligence';
  
  static readonly ENDPOINTS = {
    INTEGRATION: '/system/admin/integrations/ai',
    CHAT: '/forge/admin/assistant/chat',
    MODELS: '/forge/admin/assistant/models',
    TOOLS: '/forge/admin/assistant/tools',
    SKILLS: '/forge/admin/assistant/skills',
    SESSIONS: '/forge/admin/assistant/sessions',
    EXECUTE: '/forge/admin/assistant/actions/execute',
    CONTINUE_PREFIX: '/forge/admin/assistant/sessions',
  } as const;

  static readonly MAX_PROMPT_LENGTH = 2800;

  static readonly STORAGE_KEYS = {
    HISTORY: 'fromcode.forge.history.v1',
    ACTIVE_SESSION: 'fromcode.forge.active-session.v1',
    UI_PREFS: 'fromcode.forge.ui-prefs.v1',
  } as const;

  static readonly PROVIDER_PRESETS: Record<string, Array<{ value: string; label: string }>> = {
  openai: [
    { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
    { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
    { value: 'gpt-4.1', label: 'gpt-4.1' },
  ],
  ollama: [
    { value: 'llama3.1:8b', label: 'llama3.1:8b' },
    { value: 'qwen2.5:7b', label: 'qwen2.5:7b' },
    { value: 'mistral:7b', label: 'mistral:7b' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-latest', label: 'claude-3-5-sonnet-latest' },
    { value: 'claude-3-7-sonnet-latest', label: 'claude-3-7-sonnet-latest' },
  ],
  gemini: [
    { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro' },
    { value: 'gemini-1.5-flash', label: 'gemini-1.5-flash' },
  ],
};

  static readonly PROVIDER_OPTIONS = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'ollama', label: 'Ollama' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'gemini', label: 'Gemini' },
  ];

  static readonly TOOL_DESCRIPTION_FALLBACKS = {
  'content.create': 'Create a content record.',
  'content.update': 'Update a content record.',
  'content.delete': 'Delete a content record.',
  'settings.get': 'Read a system/plugin setting by key.',
  'settings.set': 'Update a system/plugin setting by key.',
  'plugins.list': 'List installed plugins.',
  'plugins.settings.get': 'Read plugin settings.',
  'plugins.files.search_text': 'Search text in plugin source files.',
  'plugins.files.replace_text': 'Replace text in a plugin source file.',
  'plugins.settings.update': 'Update plugin settings.',
  'themes.list': 'List installed themes.',
  'themes.active': 'Get active theme.',
  'themes.config.get': 'Read theme config values.',
  'themes.config.search_text': 'Search text in theme configuration.',
  'themes.files.search_text': 'Search text in theme source files.',
  'themes.files.replace_text': 'Replace text in a theme source file.',
  'themes.config.update': 'Update theme configuration.',
  'media.list': 'List media assets.',
  'media.search_text': 'Search text in media metadata.',
  'media.upload': 'Upload a new media asset.',
  'system.now': 'Return current server time.',
  'system.health': 'Check system health status.',
  } as const;
}


// ─── Types moved to companion file (ARC-006) ────────────────────────────────
