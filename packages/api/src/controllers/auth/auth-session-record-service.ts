export class AuthSessionRecordService {
  static isActive(session: any, now = new Date()): boolean {
    const expiresAt = new Date(AuthSessionRecordService.getExpiresAt(session));
    return !Number.isNaN(expiresAt.getTime()) && expiresAt > now;
  }

  static sortByCreatedAtDesc(rows: any[]): any[] {
    return [...rows].sort((left: any, right: any) => {
      const leftTime = new Date(AuthSessionRecordService.getCreatedAt(left)).getTime();
      const rightTime = new Date(AuthSessionRecordService.getCreatedAt(right)).getTime();
      return rightTime - leftTime;
    });
  }

  static normalize(session: any, currentJti = ''): any {
    const tokenId = AuthSessionRecordService.getTokenId(session);

    return {
      ...session,
      id: AuthSessionRecordService.getId(session),
      tokenId,
      userId: AuthSessionRecordService.getUserId(session),
      userAgent: AuthSessionRecordService.getUserAgent(session),
      ipAddress: AuthSessionRecordService.getIpAddress(session),
      isRevoked: AuthSessionRecordService.isRevoked(session),
      expiresAt: AuthSessionRecordService.getExpiresAt(session),
      createdAt: AuthSessionRecordService.getCreatedAt(session),
      updatedAt: AuthSessionRecordService.getUpdatedAt(session),
      isCurrent: tokenId !== '' && tokenId === String(currentJti || ''),
    };
  }

  private static getId(session: any): string {
    return String(session?.id || session?.tokenId || session?.token_id || '').trim();
  }

  private static getUserId(session: any): number | null {
    const value = Number(session?.userId ?? session?.user_id ?? 0);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  private static getTokenId(session: any): string {
    return String(session?.tokenId || session?.token_id || '').trim();
  }

  private static getUserAgent(session: any): string {
    return String(session?.userAgent || session?.user_agent || '').trim();
  }

  private static getIpAddress(session: any): string {
    return String(session?.ipAddress || session?.ip_address || '').trim();
  }

  private static isRevoked(session: any): boolean {
    return Boolean(session?.isRevoked ?? session?.is_revoked);
  }

  private static getExpiresAt(session: any): string {
    return String(session?.expiresAt || session?.expires_at || '').trim();
  }

  private static getCreatedAt(session: any): string {
    return String(session?.createdAt || session?.created_at || '').trim();
  }

  private static getUpdatedAt(session: any): string {
    return String(session?.updatedAt || session?.updated_at || '').trim();
  }
}
