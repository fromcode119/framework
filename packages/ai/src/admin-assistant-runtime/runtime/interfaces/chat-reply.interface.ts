import { ResponderRoute } from '@ai/admin-assistant-runtime/enums/responder-route.enum';

/**
 * Type definitions for chat-responder
 */
export interface IChatReply {
  message: string;
  model: string;
  source: ResponderRoute | 'clarify';
}
