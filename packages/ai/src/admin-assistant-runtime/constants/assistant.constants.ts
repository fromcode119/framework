import { AssistantRole } from '@ai/enums/assistant-role.enum';
import type { IAssistantMessage } from '@ai/interfaces/assistant-message.interface';

export class AssistantConstants {
  static readonly VALID_HISTORY_ROLES = new Set<IAssistantMessage['role']>(AssistantRole.values() as AssistantRole[]);

  static readonly TOOL_LABELS: Record<string, string> = {
    'content.search_text': 'Content Search',
    'content.resolve': 'Content Lookup',
    'content.update': 'Content Update',
    'content.create': 'Content Create',
    'content.list': 'Content List',
    'plugins.settings.search_text': 'Plugin Settings Search',
    'plugins.settings.update': 'Plugin Settings Update',
    'plugins.settings.get': 'Plugin Settings Read',
    'plugins.files.search_text': 'Plugin Files Search',
    'plugins.files.replace_text': 'Plugin Files Replace',
    'themes.config.search_text': 'Theme Config Search',
    'themes.config.update': 'Theme Config Update',
    'themes.config.get': 'Theme Config Read',
    'themes.files.search_text': 'Theme Files Search',
    'themes.files.replace_text': 'Theme Files Replace',
    'settings.get': 'Settings Read',
    'settings.set': 'Settings Update',
    'web.search': 'Web Search',
    'web.fetch': 'Page Fetch',
  };

  static readonly INTERNAL_ASSISTANT_SESSION_KEY_PREFIX = 'assistant.session.';
}
