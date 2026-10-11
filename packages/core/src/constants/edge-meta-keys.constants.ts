/**
 * Settings → Security → Edge protection: what the gateway enforces in front of every site. Part of
 * `SystemConstants.META_KEY` — spread into `SystemMetaKeys.ALL` — and split out only for size. What each
 * one means is declared in `EdgeProtectionSettingDescriptors`.
 */
export class EdgeMetaKeys {
  static readonly ALL = {
    EDGE_UNDER_ATTACK: 'edge_under_attack',
    EDGE_CHALLENGE_CLEARANCE_MINUTES: 'edge_challenge_clearance_minutes',
    EDGE_CHALLENGE_EXEMPT_PATHS: 'edge_challenge_exempt_paths',
    EDGE_CHALLENGE_TITLE: 'edge_challenge_title',
    EDGE_CHALLENGE_MESSAGE: 'edge_challenge_message',
    EDGE_RATE_LIMIT_PER_MINUTE: 'edge_rate_limit_per_minute',
    EDGE_BLOCK_ATTACK_PATTERNS: 'edge_block_attack_patterns',
    EDGE_BLOCKED_PATHS: 'edge_blocked_paths',
    EDGE_BLOCKED_USER_AGENTS: 'edge_blocked_user_agents',
    EDGE_BLOCKED_COUNTRIES: 'edge_blocked_countries',
    EDGE_CHALLENGED_COUNTRIES: 'edge_challenged_countries',
    EDGE_BLOCKED_ADDRESSES: 'edge_blocked_addresses',
  } as const;
}
