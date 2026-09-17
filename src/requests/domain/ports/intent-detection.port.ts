import {
  InteractionDirection,
  RequestStatus,
  ResponseIntent,
} from '@prisma/client';

export interface IntentDetectionConversationMessage {
  direction: InteractionDirection;
  /** Outbound message content, or inbound response content. */
  content: string;
  createdAt: Date;
}

export interface IntentDetectionInput {
  messageText: string;
  currentStatus: RequestStatus;
  /** `messageTemplate` of the interaction this message replies to, if known. */
  triggeringTemplate: string | null;
  /** Oldest -> newest, capped by the caller. */
  conversationHistory: IntentDetectionConversationMessage[];
}

export type RequestViabilitySignal = 'ACTIVE' | 'AT_RISK' | 'ABANDONED' | null;

export interface IntentDetectionResult {
  statusIntent: ResponseIntent;
  /** 0..1 — below the configured threshold, the caller downgrades statusIntent to UNKNOWN. */
  confidence: number;
  viability: RequestViabilitySignal;
  optOut: boolean;
  /** Signals this reply needs human/admin attention beyond the normal status flow. */
  escalate: boolean;
}

/**
 * Port for classifying an inbound WhatsApp reply.
 * This abstraction allows swapping implementations (keyword matching, an LLM, ...)
 * without changing domain/application code. Provider-agnostic - no mention of any
 * specific classifier implementation in the interface.
 */
export interface IntentDetectionPort {
  detectIntent(input: IntentDetectionInput): Promise<IntentDetectionResult>;
}

// Token for dependency injection
export const INTENT_DETECTION_PORT = Symbol('IntentDetectionPort');
