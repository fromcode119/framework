/**
 * Thinking Stream Utils
 *
 * Utility helpers for extracting and parsing AI thinking/reasoning content
 * from raw model responses.
 */

export class ThinkingStreamUtils {
  static extractThinkingContent(response: string): { thinking: string; response: string } {
    const thinkingPatterns = [
      /<think>([\s\S]*?)<\/think>/i,
      /\*\*thinking\*\*\n([\s\S]*?)\n\*\*response\*\*\n/i,
      /🤔 thoughts?:?\n([\s\S]*?)\n\n/i,
    ];
    for (const pattern of thinkingPatterns) {
      const match = response.match(pattern);
      if (match) {
        const thinking = match[1];
        const responseWithoutThinking = response.replace(match[0], '').trim();
        return { thinking, response: responseWithoutThinking };
      }
    }
    return { thinking: '', response };
  }
}
