import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ResponseIntent } from '@prisma/client';
import {
  IntentDetectionInput,
  IntentDetectionPort,
  IntentDetectionResult,
  RequestViabilitySignal,
} from '../../domain/ports/intent-detection.port';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_TIMEOUT_MS = 3500;
const CLASSIFY_TOOL_NAME = 'classify_whatsapp_reply';

const STATUS_INTENT_VALUES = Object.values(ResponseIntent) as string[];
const VIABILITY_VALUES: RequestViabilitySignal[] = [
  'ACTIVE',
  'AT_RISK',
  'ABANDONED',
];

/**
 * Anthropic-backed intent detection adapter.
 *
 * Classifies an inbound WhatsApp reply via forced tool use (never free-text parsing),
 * with a short per-request timeout and no SDK-level retries: this runs inside the
 * synchronous Twilio webhook path, where RequestInteractionService's own
 * Promise.race timeout is only a backstop, not the sole guard against a hung call.
 * All Anthropic SDK errors are wrapped into plain Error before leaving this adapter -
 * the port must stay provider-agnostic, callers should never need to know about the
 * Anthropic SDK's own error types.
 */
@Injectable()
export class AnthropicIntentDetectionAdapter implements IntentDetectionPort {
  private readonly logger = new Logger(AnthropicIntentDetectionAdapter.name);
  private client: Anthropic | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
      if (!apiKey) {
        throw new Error(
          'ANTHROPIC_API_KEY is not configured but INTENT_CLASSIFIER_PROVIDER=anthropic is set',
        );
      }
      this.client = new Anthropic({ apiKey, maxRetries: 0 });
    }
    return this.client;
  }

  async detectIntent(
    input: IntentDetectionInput,
  ): Promise<IntentDetectionResult> {
    const model = this.config.get<string>(
      'ANTHROPIC_INTENT_MODEL',
      DEFAULT_MODEL,
    );
    const timeoutMs = this.config.get<number>(
      'INTENT_CLASSIFIER_TIMEOUT_MS',
      DEFAULT_TIMEOUT_MS,
    );

    try {
      const client = this.getClient();
      const response = await client.messages.create(
        {
          model,
          max_tokens: 512,
          system: this.buildSystemPrompt(),
          messages: [{ role: 'user', content: this.buildUserPrompt(input) }],
          tools: [this.buildClassificationTool()],
          tool_choice: { type: 'tool', name: CLASSIFY_TOOL_NAME },
        },
        { timeout: timeoutMs, maxRetries: 0 },
      );

      return this.parseResponse(response);
    } catch (error: any) {
      this.logger.warn(
        `Anthropic intent classification failed: ${error?.message || error}`,
      );
      throw new Error(
        `Anthropic intent classification failed: ${error?.message || 'unknown error'}`,
      );
    }
  }

  private buildSystemPrompt(): string {
    return [
      'Sos un clasificador de respuestas de WhatsApp para Specialist, un marketplace de',
      'servicios para el hogar en Bariloche, Argentina. Los usuarios escriben en español',
      'rioplatense (es-AR, forma "vos"), a veces con errores de tipeo o sin acentos.',
      '',
      'Tu tarea es clasificar la respuesta más reciente de un usuario a un mensaje de',
      'seguimiento (follow-up) automático, usando el historial de la conversación como',
      'contexto. Siempre llamá a la herramienta de clasificación con tu resultado - nunca',
      'respondas en texto libre.',
      '',
      'Campos a determinar:',
      '- statusIntent: qué quiere decir la respuesta sobre el estado del trabajo/solicitud',
      '  (CONFIRMED: confirma algo, ej. que acepta o que empezó; STARTED: dice que ya',
      '  empezó el trabajo; COMPLETED: dice que terminó; CANCELLED: quiere cancelar o dice',
      '  que no puede/no quiere seguir; NEEDS_INFO: pide información o tiene una duda;',
      '  UNKNOWN: no se puede determinar con confianza).',
      '  El "Template del último mensaje saliente" indica qué pregunta se está respondiendo:',
      '  * question_agreement (¿se pusieron de acuerdo?): CONFIRMED = sí hubo acuerdo o ya',
      '    arrancaron; CANCELLED = no hubo acuerdo / no se concretó.',
      '  * question_progress (¿cómo va el trabajo?): COMPLETED = ya terminó; CANCELLED = tuvo',
      '    que dejarlo / se interrumpió (un "no" suelto o "sigue en curso" NO es CANCELLED,',
      '    usá UNKNOWN); STARTED/CONFIRMED = sigue en curso.',
      '  * question_satisfaction (¿quedaste conforme?): CONFIRMED = conforme; CANCELLED = no',
      '    quedó conforme / objeta el trabajo.',
      '  Si la respuesta no es clara, usá UNKNOWN: el estado no debe cambiar.',
      '- confidence: qué tan seguro estás del statusIntent, de 0 a 1.',
      '- viability: si la respuesta sugiere que la solicitud sigue teniendo chances de',
      '  concretarse (ACTIVE), es ambigua/evasiva y podría estar por abandonarse (AT_RISK),',
      '  o directamente suena abandonada (ABANDONED). Usá null si el mensaje no aporta',
      '  ninguna señal sobre esto (ej. una respuesta clara tipo "sí" o "terminé").',
      '- optOut: true SOLO si el usuario pide, de forma inequívoca, dejar de recibir',
      '  CUALQUIER mensaje de WhatsApp de la plataforma de ahora en adelante (ej. "no me',
      '  escriban más", "sáquenme de la lista", "dejen de mandarme whatsapp"). Esto tiene',
      '  una consecuencia seria: bloquea al usuario para seguir operando en la plataforma,',
      '  así que ante la duda usá false. Pedir hablar con una persona, quejarse de los',
      '  mensajes automáticos/bots, o estar frustrado NO es optOut — eso es escalate. Ej:',
      '  "no doy más con estos mensajes automáticos, quiero hablar con una persona" es',
      '  escalate=true, optOut=false (quiere un humano, no dejar de tener contacto).',
      '- escalate: true si el mensaje necesita que un humano/administrador intervenga',
      '  (un reclamo, una situación confusa que no se resuelve con las opciones normales,',
      '  pide explícitamente hablar con una persona, algo urgente o fuera de lo común).',
    ].join('\n');
  }

  private buildUserPrompt(input: IntentDetectionInput): string {
    // `direction` is who the outbound leg of each interaction was addressed to
    // (TO_CLIENT/TO_PROVIDER), not who authored `content` (content prefers the inbound
    // reply text when one exists) - so each line is labeled by interaction target, not
    // asserted as "system" or "user", to avoid mislabeling replies as outbound copy.
    const historyLines = input.conversationHistory.map(
      (message) =>
        `- [${message.createdAt.toISOString()}] (interacción hacia ${
          message.direction === 'TO_CLIENT' ? 'el cliente' : 'el proveedor'
        }): ${message.content}`,
    );

    return [
      `Estado actual de la solicitud: ${input.currentStatus}`,
      `Template del último mensaje saliente: ${input.triggeringTemplate ?? 'desconocido'}`,
      '',
      'Historial de la conversación (más antiguo primero; cada línea puede ser el mensaje',
      'saliente del sistema o, si ya hubo respuesta, el texto de esa respuesta):',
      historyLines.length > 0
        ? historyLines.join('\n')
        : '(sin historial previo)',
      '',
      `Mensaje nuevo del usuario a clasificar: "${input.messageText}"`,
    ].join('\n');
  }

  private buildClassificationTool(): Anthropic.Tool {
    return {
      name: CLASSIFY_TOOL_NAME,
      description:
        'Clasifica una respuesta de WhatsApp de un usuario según el estado que implica, su viabilidad, si pide opt-out y si necesita escalar a un humano.',
      input_schema: {
        type: 'object',
        properties: {
          statusIntent: {
            type: 'string',
            enum: STATUS_INTENT_VALUES,
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
          },
          viability: {
            type: ['string', 'null'],
            enum: [...VIABILITY_VALUES, null],
          },
          optOut: { type: 'boolean' },
          escalate: { type: 'boolean' },
        },
        required: [
          'statusIntent',
          'confidence',
          'viability',
          'optOut',
          'escalate',
        ],
      },
    };
  }

  private parseResponse(response: Anthropic.Message): IntentDetectionResult {
    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === 'tool_use' && block.name === CLASSIFY_TOOL_NAME,
    );

    if (!toolUse) {
      throw new Error(
        'Anthropic response did not include the expected classify_whatsapp_reply tool call',
      );
    }

    const raw = toolUse.input as Record<string, unknown>;

    const statusIntent = raw.statusIntent as string;
    if (!STATUS_INTENT_VALUES.includes(statusIntent)) {
      throw new Error(
        `Anthropic returned an invalid statusIntent: ${String(statusIntent)}`,
      );
    }

    const viability = raw.viability as RequestViabilitySignal | undefined;
    if (
      viability !== null &&
      viability !== undefined &&
      !VIABILITY_VALUES.includes(viability)
    ) {
      throw new Error(
        `Anthropic returned an invalid viability: ${String(viability)}`,
      );
    }

    const confidence = Number(raw.confidence);
    if (Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
      throw new Error(
        `Anthropic returned an invalid confidence: ${String(raw.confidence)}`,
      );
    }

    return {
      statusIntent: statusIntent as ResponseIntent,
      confidence,
      viability: (viability ?? null) as RequestViabilitySignal,
      optOut: Boolean(raw.optOut),
      escalate: Boolean(raw.escalate),
    };
  }
}
