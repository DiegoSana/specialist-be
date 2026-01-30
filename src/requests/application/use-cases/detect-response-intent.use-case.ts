import { Injectable } from '@nestjs/common';
import { ResponseIntent } from '@prisma/client';

/**
 * Use case for detecting user intent from WhatsApp message responses.
 * Uses simple keyword matching for MVP. Can be enhanced with NLP later.
 */
@Injectable()
export class DetectResponseIntentUseCase {
  /**
   * Detect intent from a message text.
   * Returns UNKNOWN if no clear intent is detected.
   */
  detectIntent(messageText: string): ResponseIntent {
    if (!messageText) {
      return ResponseIntent.UNKNOWN;
    }

    const normalizedText = messageText.toLowerCase().trim();

    // Keywords for CONFIRMED intent
    const confirmedKeywords = [
      'sí',
      'si',
      'yes',
      'ok',
      'okay',
      'confirmo',
      'confirmado',
      'acepto',
      'aceptado',
      'de acuerdo',
      'perfecto',
      'listo',
      'correcto',
    ];

    // Keywords for STARTED intent
    const startedKeywords = [
      'empecé',
      'empece',
      'empezé',
      'empeze',
      'inicié',
      'inicie',
      'comencé',
      'comence',
      'ya empecé',
      'ya empezé',
      'started',
      'begin',
      'began',
    ];

    // Keywords for COMPLETED intent
    const completedKeywords = [
      'terminé',
      'termine',
      'terminado',
      'finalicé',
      'finalice',
      'finalizado',
      'listo',
      'completado',
      'completé',
      'complete',
      'finished',
      'done',
      'listo',
      'ya terminé',
      'ya termine',
    ];

    // Keywords for CANCELLED intent
    const cancelledKeywords = [
      'cancelar',
      'cancelado',
      'cancelé',
      'cancele',
      'no',
      'no quiero',
      'no puedo',
      'no voy',
      'descartar',
      'descartado',
      'cancel',
      'cancelled',
      'no thanks',
      'no gracias',
    ];

    // Keywords for NEEDS_INFO intent
    const needsInfoKeywords = [
      'información',
      'informacion',
      'info',
      'detalles',
      'más información',
      'mas informacion',
      'pregunta',
      'duda',
      'consultar',
      'information',
      'details',
      'question',
      'doubt',
    ];

    // Check for intents in order of priority
    if (this.containsAny(normalizedText, confirmedKeywords)) {
      return ResponseIntent.CONFIRMED;
    }

    if (this.containsAny(normalizedText, cancelledKeywords)) {
      return ResponseIntent.CANCELLED;
    }

    if (this.containsAny(normalizedText, completedKeywords)) {
      return ResponseIntent.COMPLETED;
    }

    if (this.containsAny(normalizedText, startedKeywords)) {
      return ResponseIntent.STARTED;
    }

    if (this.containsAny(normalizedText, needsInfoKeywords)) {
      return ResponseIntent.NEEDS_INFO;
    }

    return ResponseIntent.UNKNOWN;
  }

  /**
   * Check if text contains any of the keywords.
   */
  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }
}

