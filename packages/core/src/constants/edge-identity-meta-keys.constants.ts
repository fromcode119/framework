/**
 * Settings → Security → Edges: how long an edge's identity lasts, and
 * where edges reach the control channel. Part of `SystemConstants.META_KEY`,
 * spread into `SystemMetaKeys.ALL` and split out only for size. What each one means is declared in
 * `EdgeIdentitySettingDescriptors`.
 */
export class EdgeIdentityMetaKeys {
  static readonly ALL = {
    EDGE_ENROLLMENT_TOKEN_MINUTES: 'edge_enrollment_token_minutes',
    EDGE_CERTIFICATE_HOURS: 'edge_certificate_hours',
    EDGE_CA_INTERMEDIATE_DAYS: 'edge_ca_intermediate_days',
    EDGE_CONTROL_ADDRESS: 'edge_control_address',
    EDGE_CONTROL_PORT: 'edge_control_port',
  } as const;
}
