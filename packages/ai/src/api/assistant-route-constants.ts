export class AssistantRouteConstants {
  static readonly SEGMENTS = {
    ADMIN_ASSISTANT_CHAT: '/admin/assistant/chat',
    ADMIN_ASSISTANT_SESSIONS: '/admin/assistant/sessions',
    ADMIN_ASSISTANT_SESSIONS_ID: '/admin/assistant/sessions/:id',
    ADMIN_ASSISTANT_SESSIONS_ID_FORK: '/admin/assistant/sessions/:id/fork',
    ADMIN_ASSISTANT_SESSIONS_ID_CONTINUE: '/admin/assistant/sessions/:id/continue',
    ADMIN_ASSISTANT_SKILLS: '/admin/assistant/skills',
    ADMIN_ASSISTANT_TOOLS: '/admin/assistant/tools',
    ADMIN_ASSISTANT_MODELS: '/admin/assistant/models',
    ADMIN_ASSISTANT_ACTIONS_EXECUTE: '/admin/assistant/actions/execute',
    ADMIN_ASSISTANT_EXECUTE_LEGACY: '/admin/assistant/execute',
  } as const;
}
