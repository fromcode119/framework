/**
 * Type definitions for chat-responder
 */
export type ChatReply = {
  message: string;
  model: string;
  source: 'quick' | 'model' | 'fallback';
};
