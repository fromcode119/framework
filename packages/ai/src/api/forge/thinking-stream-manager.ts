/**
 * Thinking Stream Manager
 *
 * Captures and streams AI thinking/reasoning content to the frontend for transparent visibility
 * into the AI decision-making process. Handles real-time thinking display during planning and execution.
 */

import type { ThinkingSegment, ThinkingStream } from './thinking-stream-manager.interfaces';

export class ThinkingStreamManager {
  private streams: Map<string, ThinkingStream> = new Map();
  private segmentCallbacks: Map<string, ((segment: ThinkingSegment) => void)[]> = new Map();

  /**
   * Start a new thinking stream for a session
   */
  startStream(sessionId: string): ThinkingStream {
    const stream: ThinkingStream = {
      sessionId,
      startTime: Date.now(),
      segments: [],
      isComplete: false,
      phaseProgress: {
        planning: 0,
        analysis: 0,
        decision: 0,
        action: 0,
        verification: 0,
      },
    };
    this.streams.set(sessionId, stream);
    return stream;
  }

  /**
   * Add thinking segment to stream and notify listeners
   */
  addThinkingSegment(
    sessionId: string,
    phase: ThinkingSegment['phase'],
    content: string,
    metadata?: ThinkingSegment['metadata']
  ): ThinkingSegment {
    const stream = this.streams.get(sessionId);
    if (!stream) {
      throw new Error(`No thinking stream found for session ${sessionId}`);
    }

    const segment: ThinkingSegment = {
      id: `${sessionId}-${stream.segments.length}-${Date.now()}`,
      timestamp: Date.now(),
      phase,
      content,
      metadata,
    };

    stream.segments.push(segment);

    // Update phase progress
    const phaseSegments = stream.segments.filter(s => s.phase === phase).length;
    const totalPhaseSegments = Math.max(1, stream.segments.filter(s => s.phase === phase).length);
    stream.phaseProgress[phase] = Math.min(100, (phaseSegments / totalPhaseSegments) * 100);

    // Notify listeners
    this.notifyListeners(sessionId, segment);

    return segment;
  }

  /**
   * Register callback for thinking segments (for real-time UI updates)
   */
  onThinkingSegment(sessionId: string, callback: (segment: ThinkingSegment) => void): () => void {
    if (!this.segmentCallbacks.has(sessionId)) {
      this.segmentCallbacks.set(sessionId, []);
    }
    this.segmentCallbacks.get(sessionId)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.segmentCallbacks.get(sessionId);
      if (callbacks) {
        const idx = callbacks.indexOf(callback);
        if (idx > -1) {
          callbacks.splice(idx, 1);
        }
      }
    };
  }

  /**
   * Complete a thinking stream
   */
  completeStream(sessionId: string): ThinkingStream | null {
    const stream = this.streams.get(sessionId);
    if (stream) {
      stream.isComplete = true;
      stream.totalDurationMs = Date.now() - stream.startTime;
    }
    return stream || null;
  }

  /**
   * Get thinking stream for session
   */
  getStream(sessionId: string): ThinkingStream | null {
    return this.streams.get(sessionId) || null;
  }

  /**
   * Get formatted thinking display text
   */
  getThinkingDisplayText(sessionId: string): string {
    const stream = this.streams.get(sessionId);
    if (!stream || stream.segments.length === 0) return '';

    return stream.segments
      .map((segment, idx) => {
        const prefix = {
          planning: '🤔 Planning:',
          analysis: '🔍 Analyzing:',
          decision: '⚖️ Deciding:',
          action: '⚡ Acting:',
          verification: '✓ Verifying:',
        }[segment.phase];

        const confTag = segment.metadata?.confidence
          ? ` [${Math.round(segment.metadata.confidence * 100)}%]`
          : '';

        return `${prefix}${confTag} ${segment.content}`;
      })
      .join('\n');
  }

  /**
   * Get thinking summary for logging
   */
  getSummary(sessionId: string): {
    totalSegments: number;
    phaseBreakdown: Record<string, number>;
    durationMs: number;
    averageConfidence: number;
  } | null {
    const stream = this.streams.get(sessionId);
    if (!stream) return null;

    const phaseBreakdown: Record<string, number> = {
      planning: 0,
      analysis: 0,
      decision: 0,
      action: 0,
      verification: 0,
    };

    for (const segment of stream.segments) {
      phaseBreakdown[segment.phase] = (phaseBreakdown[segment.phase] || 0) + 1;
    }

    const confidences = stream.segments
      .filter(s => s.metadata?.confidence)
      .map(s => s.metadata!.confidence!);

    const avgConfidence =
      confidences.length > 0
        ? confidences.reduce((a, b) => a + b) / confidences.length
        : 0;

    return {
      totalSegments: stream.segments.length,
      phaseBreakdown,
      durationMs: stream.totalDurationMs || Date.now() - stream.startTime,
      averageConfidence: avgConfidence,
    };
  }

  /**
   * Clean up stream
   */
  clearStream(sessionId: string): void {
    this.streams.delete(sessionId);
    this.segmentCallbacks.delete(sessionId);
  }

  /**
   * Notify all listeners of new segment
   */
  private notifyListeners(sessionId: string, segment: ThinkingSegment): void {
    const callbacks = this.segmentCallbacks.get(sessionId);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(segment);
        } catch (err) {
          console.error('Error in thinking segment callback:', err);
        }
      });
    }
  }
}
