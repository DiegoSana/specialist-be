# Plan de Implementación: Sistema de Follow-up Automático de Solicitudes vía WhatsApp

**Fecha de creación**: Diciembre 2024  
**Estado**: Planificación  
**Bounded Context**: Requests (con integración a Notifications e Identity)

---

## 1. Objetivo del Sistema

### Problema que resuelve

Actualmente, cuando un cliente crea una solicitud y se asigna un especialista (Professional o Company), el seguimiento del estado de la solicitud depende principalmente de acciones manuales en la aplicación web. No existe un mecanismo proactivo para:

- Recordar a los participantes sobre el estado actual de la solicitud
- Obtener actualizaciones automáticas cuando hay inactividad
- Facilitar la comunicación bidireccional vía WhatsApp (canal preferido en el mercado latinoamericano)
- Registrar la evolución de la relación cliente-especialista de forma estructurada

### Scope del sistema

**Incluye:**
- Seguimiento automatizado del ciclo de vida de una solicitud (`Request`)
- Modelado de interacciones entre cliente y especialista (`RequestInteraction`)
- Envío de mensajes de follow-up vía WhatsApp usando Twilio
- Recepción y procesamiento de respuestas vía webhook de Twilio
- Actualización automática del estado de la solicitud basada en respuestas
- Registro histórico de interacciones para análisis futuro

**NO incluye (por ahora):**
- Chat en tiempo real bidireccional completo (solo follow-ups estructurados)
- Integración con otros canales de mensajería (SMS, Telegram, etc.)
- Machine Learning para personalización de mensajes
- Análisis predictivo de abandono de solicitudes
- Sistema de tickets de soporte

---

## 2. Modelo de Dominio (Conceptual)

### Rol de `Request`

`Request` es el aggregate root existente en el bounded context de Requests. Representa una solicitud de trabajo que puede ser:

- **Directa**: Cliente → Especialista específico (Professional o Company)
- **Pública**: Cliente → Cualquier especialista (mediante `RequestInterest`)

**Estados actuales de `Request`:**
- `PENDING`: Creada, esperando aceptación
- `ACCEPTED`: Aceptada por el especialista
- `IN_PROGRESS`: Trabajo en progreso
- `DONE`: Trabajo completado
- `CANCELLED`: Cancelada

**Responsabilidades de `Request`:**
- Mantener la integridad del ciclo de vida de la solicitud
- Validar transiciones de estado según reglas de negocio
- Autorizar acciones según roles (cliente, especialista, admin)

### Rol de `RequestInteraction`

`RequestInteraction` es un **nuevo aggregate** que representa la evolución de la relación entre cliente y especialista durante el ciclo de vida de una solicitud.

**¿Por qué es un aggregate?**

1. **Límite de consistencia independiente**: Las interacciones tienen reglas de negocio propias (no se pueden crear interacciones duplicadas, deben estar asociadas a un Request válido, etc.)
2. **Ciclo de vida propio**: Una interacción puede tener estados internos (enviada, entregada, respondida, fallida)
3. **Responsabilidades claras**: Gestiona el historial de comunicación y el seguimiento temporal, sin afectar directamente el estado de `Request` (que se actualiza mediante eventos)

**Relación con `Request`:**
- `RequestInteraction` **depende** de `Request` (no puede existir sin un Request válido)
- `Request` puede tener múltiples `RequestInteraction` (historial de seguimientos)
- La relación es **unidireccional**: `RequestInteraction` conoce a `Request`, pero `Request` no conoce directamente a `RequestInteraction` (se accede vía repositorio)

**Campos propuestos de `RequestInteraction`:**

```
RequestInteraction
├── id: UUID
├── requestId: UUID (FK → Request)
├── interactionType: FOLLOW_UP | RESPONSE | STATUS_UPDATE
├── status: PENDING | SENT | DELIVERED | RESPONDED | FAILED
├── direction: TO_CLIENT | TO_PROVIDER
├── channel: WHATSAPP | EMAIL (futuro)
├── messageTemplate: string (identificador del template usado)
├── messageContent: string (contenido del mensaje enviado)
├── responseContent: string | null (respuesta recibida)
├── responseIntent: string | null (intent detectado: CONFIRMED, CANCELLED, NEEDS_INFO, etc.)
├── scheduledFor: DateTime (cuándo se programó enviar)
├── sentAt: DateTime | null
├── deliveredAt: DateTime | null
├── respondedAt: DateTime | null
├── twilioMessageSid: string | null (ID del mensaje en Twilio)
├── twilioStatus: string | null (delivered, read, failed, etc.)
├── metadata: JSON | null (datos adicionales: estado anterior, trigger, etc.)
├── createdAt: DateTime
└── updatedAt: DateTime
```

**Estados de `RequestInteraction`:**

| Estado | Descripción | Transiciones permitidas |
|--------|-------------|------------------------|
| `PENDING` | Interacción programada pero aún no enviada | → `SENT`, `FAILED` |
| `SENT` | Mensaje enviado a Twilio, esperando confirmación | → `DELIVERED`, `FAILED` |
| `DELIVERED` | Twilio confirmó entrega al destinatario | → `RESPONDED`, `FAILED` |
| `RESPONDED` | El destinatario respondió al mensaje | (estado final) |
| `FAILED` | Error en envío o procesamiento | (estado final, puede reintentarse) |

**Tipos de interacción:**

| Tipo | Descripción | Cuándo se crea |
|------|-------------|----------------|
| `FOLLOW_UP` | Mensaje automático de seguimiento | Basado en tiempo sin actividad |
| `RESPONSE` | Respuesta a un mensaje recibido | Cuando se procesa un webhook de Twilio |
| `STATUS_UPDATE` | Notificación de cambio de estado | Cuando `Request` cambia de estado |

### Transiciones de Estado de `Request` basadas en Interacciones

Las respuestas vía WhatsApp pueden disparar cambios de estado en `Request`. Esto se maneja mediante eventos de dominio:

**Flujo propuesto:**

1. `RequestInteraction` recibe respuesta (`RESPONDED`)
2. Se analiza el `responseIntent` (mediante procesamiento de NLP simple o keywords)
3. Se emite evento `RequestInteractionRespondedEvent`
4. Un handler en `RequestService` procesa el evento y actualiza el estado de `Request` si corresponde

**Mapeo de intents a transiciones:**

| Intent detectado | Transición de Request | Condición |
|------------------|----------------------|-----------|
| `CONFIRMED` | `PENDING` → `ACCEPTED` | Si Request está PENDING |
| `STARTED` | `ACCEPTED` → `IN_PROGRESS` | Si Request está ACCEPTED |
| `COMPLETED` | `IN_PROGRESS` → `DONE` | Si Request está IN_PROGRESS |
| `CANCELLED` | Cualquiera → `CANCELLED` | Si no está en estado terminal |
| `NEEDS_INFO` | Sin cambio | Solo se registra la interacción |
| `UNKNOWN` | Sin cambio | Requiere intervención manual |

---

## 3. Responsabilidades por Capa (DDD)

### Domain Layer (`requests/domain/`)

**Responsabilidades:**

1. **Entidades:**
   - `RequestInteraction` (nuevo aggregate)
     - Validar que `requestId` existe y es válido
     - Validar transiciones de estado
     - Validar que `direction` corresponde al tipo de interacción
     - Métodos de negocio: `markAsSent()`, `markAsDelivered()`, `markAsResponded()`, `markAsFailed()`

2. **Value Objects:**
   - `InteractionType` (enum: FOLLOW_UP, RESPONSE, STATUS_UPDATE)
   - `InteractionStatus` (enum: PENDING, SENT, DELIVERED, RESPONDED, FAILED)
   - `InteractionDirection` (enum: TO_CLIENT, TO_PROVIDER)
   - `ResponseIntent` (enum: CONFIRMED, STARTED, COMPLETED, CANCELLED, NEEDS_INFO, UNKNOWN)

3. **Repositories (interfaces):**
   - `RequestInteractionRepository`
     - `findById(id: string): Promise<RequestInteraction | null>`
     - `findByRequestId(requestId: string): Promise<RequestInteraction[]>`
     - `findPendingFollowUps(now: Date): Promise<RequestInteraction[]>`
     - `findByTwilioMessageSid(sid: string): Promise<RequestInteraction | null>`
     - `save(interaction: RequestInteraction): Promise<RequestInteraction>`

4. **Eventos de dominio:**
   - `RequestInteractionCreatedEvent`
   - `RequestInteractionRespondedEvent` (cuando se recibe respuesta)
   - `RequestInteractionFailedEvent` (para retry logic)

**NO debe hacer:**
- Llamadas HTTP a Twilio (eso es infrastructure)
- Procesamiento de webhooks (eso es presentation/infrastructure)
- Scheduling de tareas (eso es application)
- Acceso directo a base de datos (eso es infrastructure)

**Dependencias permitidas:**
- Solo tipos primitivos y otros value objects del mismo bounded context
- Interfaces de repositorios (no implementaciones)

### Application Layer (`requests/application/`)

**Responsabilidades:**

1. **Services:**
   - `RequestInteractionService`
     - `createFollowUp(params): Promise<RequestInteraction>` - Crear follow-up programado
     - `createStatusUpdate(params): Promise<RequestInteraction>` - Crear notificación de cambio de estado
     - `processInboundMessage(params): Promise<RequestInteraction>` - Procesar mensaje recibido
     - `markAsSent(interactionId, twilioSid): Promise<void>`
     - `markAsDelivered(interactionId, twilioStatus): Promise<void>`
     - `processResponse(interactionId, responseText): Promise<void>` - Analizar respuesta y emitir eventos

2. **DTOs:**
   - `CreateFollowUpDto`
   - `ProcessInboundMessageDto`
   - `UpdateInteractionStatusDto`

3. **Use Cases (si se requiere granularidad):**
   - `ScheduleFollowUpUseCase` - Determinar cuándo programar un follow-up
   - `DetectResponseIntentUseCase` - Analizar texto y detectar intent
   - `UpdateRequestFromInteractionUseCase` - Actualizar Request basado en respuesta

4. **Event Handlers:**
   - `RequestStatusChangedHandler` - Crear `RequestInteraction` de tipo STATUS_UPDATE cuando cambia el estado
   - `RequestInteractionRespondedHandler` - Procesar respuesta y actualizar Request si corresponde

**NO debe hacer:**
- Llamadas directas a Twilio API (usar port/adapter)
- Acceso directo a Prisma (usar repositorios)
- Lógica de scheduling compleja (usar cron jobs o queue)

**Dependencias permitidas:**
- Repositorios (inyectados vía DI)
- EventBus (para emitir eventos)
- Services de otros bounded contexts (vía interfaces públicas)
- Ports/Adapters para infraestructura externa (Twilio)

### Infrastructure Layer (`requests/infrastructure/`)

**Responsabilidades:**

1. **Repositories:**
   - `PrismaRequestInteractionRepository` - Implementación de `RequestInteractionRepository`
     - Mapeo Prisma → Domain Entity (`toDomain`)
     - Mapeo Domain Entity → Prisma (`toPersistence`)

2. **Adapters/Ports:**
   - `TwilioWhatsAppPort` (interfaz en domain/ports)
   - `TwilioWhatsAppAdapter` (implementación en infrastructure)
     - `sendMessage(params): Promise<{ messageSid: string }>`
     - `getMessageStatus(messageSid): Promise<{ status: string }>`

3. **Mappers:**
   - `RequestInteractionPrismaMapper` - Conversión entre Prisma y Domain

**NO debe hacer:**
- Lógica de negocio (solo implementaciones técnicas)
- Validaciones de dominio (solo validaciones técnicas: formato, tipos)

**Dependencias permitidas:**
- PrismaService
- Librerías de Twilio SDK
- ConfigService para variables de entorno

### Presentation Layer (`requests/presentation/`)

**Responsabilidades:**

1. **Controllers:**
   - `TwilioWebhookController` (nuevo)
     - `POST /api/webhooks/twilio` - Recibir webhooks de Twilio
     - Validar firma de Twilio (seguridad)
     - Parsear payload del webhook
     - Delegar a `RequestInteractionService.processInboundMessage()`

2. **Guards:**
   - `TwilioWebhookGuard` - Validar que el request viene de Twilio (usar firma)

3. **DTOs de presentación:**
   - `TwilioWebhookDto` - Estructura del payload de Twilio

**NO debe hacer:**
- Lógica de negocio (solo validación de entrada y delegación)
- Persistencia directa (solo servicios de aplicación)

**Dependencias permitidas:**
- Services de aplicación
- Guards y decorators de NestJS
- DTOs de validación

---

## 4. Flujo de WhatsApp (End-to-End)

### 4.1. Flujo de Envío (Outbound)

**Escenario: Follow-up automático después de 3 días sin actividad**

```
1. Cron Job (FollowUpSchedulerJob)
   └─> Ejecuta cada hora
       └─> Busca Requests que cumplen criterios:
           - Estado: ACCEPTED o IN_PROGRESS
           - Última interacción hace > 3 días
           - No hay follow-up pendiente ya programado
       └─> Para cada Request encontrado:
           └─> RequestInteractionService.createFollowUp({
                 requestId,
                 direction: TO_PROVIDER (o TO_CLIENT según regla),
                 scheduledFor: now(),
                 messageTemplate: 'follow_up_3_days'
               })

2. RequestInteractionService.createFollowUp()
   └─> Valida Request existe y está en estado válido
   └─> Obtiene datos del destinatario (cliente o especialista)
   └─> Valida que tiene teléfono verificado
   └─> Crea RequestInteraction con status PENDING
   └─> Guarda en repositorio
   └─> Emite RequestInteractionCreatedEvent

3. Cron Job (WhatsAppDispatchJob) - Ejecuta cada minuto
   └─> Busca RequestInteraction con status PENDING y scheduledFor <= now()
   └─> Para cada interacción:
       └─> RequestInteractionService.sendMessage(interactionId)
           └─> Obtiene template de mensaje
           └─> Personaliza con datos del Request
           └─> Llama a TwilioWhatsAppAdapter.sendMessage()
           └─> Actualiza RequestInteraction:
               - status: SENT
               - sentAt: now()
               - twilioMessageSid: <sid de Twilio>
           └─> Guarda cambios

4. Twilio procesa y entrega el mensaje
   └─> Envía webhook de status update a nuestra API
```

### 4.2. Flujo de Recepción (Inbound)

**Escenario: Cliente responde "Sí, confirmo" a un follow-up**

```
1. Usuario envía mensaje a número de Twilio WhatsApp
   └─> Twilio recibe el mensaje
   └─> Twilio envía webhook POST a /api/webhooks/twilio

2. TwilioWebhookController recibe el request
   └─> TwilioWebhookGuard valida firma de Twilio
   └─> Parsea TwilioWebhookDto
   └─> Identifica tipo de webhook:
       - status update (delivered, read, failed)
       - inbound message (nuevo mensaje)

3a. Si es status update:
    └─> RequestInteractionService.markAsDelivered(messageSid, status)
        └─> Busca RequestInteraction por twilioMessageSid
        └─> Actualiza status y twilioStatus
        └─> Si status = 'delivered' → status: DELIVERED, deliveredAt: now()
        └─> Guarda cambios

3b. Si es inbound message:
    └─> RequestInteractionService.processInboundMessage({
          from: phoneNumber,
          body: messageText,
          messageSid: twilioSid
        })
        └─> Busca RequestInteraction más reciente para ese número y Request
        └─> Si no existe, crea nueva interacción tipo RESPONSE
        └─> Analiza texto con DetectResponseIntentUseCase:
            - Keywords: "sí", "confirmo", "ok" → CONFIRMED
            - Keywords: "empecé", "inicié" → STARTED
            - Keywords: "terminé", "listo" → COMPLETED
            - Keywords: "cancelar", "no" → CANCELLED
            - Por defecto → UNKNOWN
        └─> Actualiza RequestInteraction:
            - status: RESPONDED
            - respondedAt: now()
            - responseContent: messageText
            - responseIntent: <intent detectado>
        └─> Guarda cambios
        └─> Emite RequestInteractionRespondedEvent

4. RequestInteractionRespondedHandler procesa el evento
   └─> Si responseIntent permite cambio de estado:
       └─> RequestService.updateStatus(requestId, newStatus, userId)
           └─> Valida transición permitida
           └─> Actualiza Request
           └─> Emite RequestStatusChangedEvent (ya existe)
   └─> Opcionalmente envía confirmación vía WhatsApp:
       └─> RequestInteractionService.createStatusUpdate({
             requestId,
             direction: TO_CLIENT,
             messageTemplate: 'status_update_confirmed'
           })

5. Notificaciones (sistema existente)
   └─> RequestStatusChangedEvent dispara notificaciones
   └─> Cliente y especialista reciben notificación in-app/email
```

### 4.3. Diagrama de Secuencia Simplificado

```
[Cron Job] → [RequestInteractionService] → [TwilioWhatsAppAdapter] → [Twilio]
                                                      ↓
[Twilio] → [Webhook] → [TwilioWebhookController] → [RequestInteractionService]
                                                      ↓
[EventBus] → [RequestInteractionRespondedHandler] → [RequestService] → [Request Entity]
                                                      ↓
[EventBus] → [Notification Handlers] → [NotificationService]
```

---

## 5. Integración con Twilio

### 5.1. Configuración en Twilio

**Sandbox Mode (Desarrollo/Testing):**

1. **Twilio Console:**
   - Activar WhatsApp Sandbox
   - Obtener número de Sandbox (formato: `whatsapp:+14155238886`)
   - Configurar código de unión (ej: "join <code>")
   - Configurar webhook URL: `https://tu-dominio.com/api/webhooks/twilio`

2. **Variables de entorno necesarias:**
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=tu_auth_token
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
   TWILIO_WEBHOOK_SECRET=tu_webhook_secret (para validar firma)
   ```

3. **Limitaciones del Sandbox:**
   - Solo funciona con números pre-registrados en Twilio Console
   - Máximo 24 horas de validez por número
   - No permite envío a números arbitrarios
   - Ideal para desarrollo y testing

**Production Mode:**

1. **Requisitos:**
   - Cuenta de Twilio aprobada para WhatsApp Business API
   - Número de WhatsApp Business verificado
   - Aprobación de Meta/Facebook para uso de WhatsApp Business API

2. **Configuración:**
   - Usar número de producción en lugar de Sandbox
   - Configurar webhook en producción
   - Implementar rate limiting y manejo de errores robusto

### 5.2. Qué vive en Twilio vs en la App

**En Twilio:**
- Almacenamiento temporal de mensajes (hasta 30 días)
- Estado de entrega (delivered, read, failed)
- Webhooks de eventos
- Templates de mensajes (si se usan Message Templates de Meta)

**En la App:**
- Lógica de negocio (cuándo enviar, qué enviar)
- Persistencia de interacciones (`RequestInteraction`)
- Análisis de intents
- Historial completo de comunicación
- Scheduling de follow-ups

### 5.3. Uso de Sandbox vs Producción

**Estrategia propuesta:**

1. **Desarrollo:**
   - Usar Sandbox siempre
   - Registrar números de prueba en Twilio Console
   - Validar flujos completos con números de prueba

2. **Staging:**
   - Opción A: Continuar con Sandbox
   - Opción B: Usar cuenta de Twilio separada con Sandbox (si hay presupuesto)

3. **Producción:**
   - Migrar a WhatsApp Business API cuando esté aprobado
   - Mantener compatibilidad con ambos modos mediante configuración
   - Feature flag para habilitar/deshabilitar WhatsApp en producción

### 5.4. Riesgos y Limitaciones

**Riesgos técnicos:**

1. **Rate Limits de Twilio:**
   - Sandbox: Limitado a números registrados
   - Producción: Límites según plan de Twilio
   - **Mitigación**: Implementar rate limiting en la app, cola de mensajes

2. **Costo:**
   - WhatsApp Business API tiene costos por mensaje
   - **Mitigación**: Monitorear uso, optimizar frecuencia de follow-ups

3. **Disponibilidad de Twilio:**
   - Si Twilio está caído, no se pueden enviar mensajes
   - **Mitigación**: Retry logic, fallback a email, logging de errores

4. **Webhook Security:**
   - Webhooks pueden ser falsificados
   - **Mitigación**: Validar firma de Twilio en cada request

**Limitaciones funcionales:**

1. **NLP Simple:**
   - Detección de intents basada en keywords es limitada
   - **Mitigación**: Empezar simple, evolucionar a NLP más sofisticado después

2. **Idiomas:**
   - Inicialmente solo español
   - **Mitigación**: Templates parametrizables, i18n futuro

3. **Formato de mensajes:**
   - Twilio Sandbox tiene limitaciones de formato
   - **Mitigación**: Mensajes de texto plano inicialmente, evolucionar a rich media después

---

## 6. Estrategia de Follow-ups Automáticos

### 6.1. Cómo se Disparan

**Mecanismo: Cron Jobs con `@nestjs/schedule`**

Se propone crear dos jobs:

1. **`FollowUpSchedulerJob`** (ejecuta cada hora)
   - Busca Requests que necesitan follow-up
   - Crea `RequestInteraction` con `status: PENDING` y `scheduledFor` calculado
   - No envía mensajes directamente (eso lo hace el dispatcher)

2. **`WhatsAppDispatchJob`** (ejecuta cada minuto)
   - Busca `RequestInteraction` con `status: PENDING` y `scheduledFor <= now()`
   - Envía mensaje vía Twilio
   - Actualiza estado a `SENT`

**Ventajas de esta separación:**
- Scheduling y dispatch desacoplados
- Fácil de testear por separado
- Permite reintentos sin re-programar

### 6.2. Basado en Tiempo / Estado

**Reglas propuestas (configurables vía env vars):**

| Estado de Request | Tiempo sin actividad | Acción | Destinatario |
|-------------------|---------------------|--------|--------------|
| `ACCEPTED` | 3 días | Follow-up "¿Ya empezaste el trabajo?" | Provider |
| `ACCEPTED` | 7 días | Follow-up "Recordatorio: trabajo pendiente" | Provider |
| `IN_PROGRESS` | 5 días | Follow-up "¿Cómo va el trabajo?" | Provider |
| `IN_PROGRESS` | 10 días | Follow-up "¿Necesitás ayuda?" | Provider |
| `DONE` | 1 día | Follow-up "¿Podés dejar una reseña?" | Client |

**Cálculo de "tiempo sin actividad":**

- Última `RequestInteraction` de tipo `FOLLOW_UP` o `RESPONSE` con `respondedAt` no null
- Si no hay interacciones, usar `Request.updatedAt`
- Si `Request.status` cambió recientemente, resetear contador

### 6.3. Qué se Guarda para Automatizar

**En `RequestInteraction`:**
- `scheduledFor`: Cuándo se programó enviar
- `metadata`: JSON con información del trigger
  ```json
  {
    "trigger": "time_based",
    "daysSinceLastActivity": 3,
    "requestStatus": "ACCEPTED",
    "previousInteractionId": "uuid"
  }
  ```

**En `Request` (ya existe):**
- `updatedAt`: Última actualización (útil para calcular tiempo sin actividad)
- `status`: Estado actual (determina qué follow-ups aplicar)

**Índices de base de datos necesarios:**
- `request_interactions(request_id, created_at)` - Para buscar última interacción
- `request_interactions(status, scheduled_for)` - Para el dispatcher
- `request_interactions(twilio_message_sid)` - Para webhooks

### 6.4. Qué Queda Fuera por Ahora

**No se implementa inicialmente:**
- Follow-ups basados en ML (predicción de abandono)
- Personalización avanzada de mensajes según historial
- A/B testing de templates
- Follow-ups condicionales complejos (ej: "si cliente abrió la app pero no respondió")
- Integración con analytics externos
- Chatbot conversacional completo (solo respuestas estructuradas)

**Razón:**
- Mantener MVP simple y funcional
- Validar que el concepto funciona antes de agregar complejidad
- Estos features pueden agregarse en iteraciones futuras

---

## 7. Métricas y Eventos Futuros

### 7.1. Eventos de Dominio que Podrían Emitirse

**Eventos nuevos propuestos:**

1. **`RequestInteractionCreatedEvent`**
   ```typescript
   {
     interactionId: string;
     requestId: string;
     interactionType: 'FOLLOW_UP' | 'RESPONSE' | 'STATUS_UPDATE';
     direction: 'TO_CLIENT' | 'TO_PROVIDER';
     scheduledFor: Date;
   }
   ```
   **Uso futuro**: Analytics de frecuencia de follow-ups, costos de mensajería

2. **`RequestInteractionRespondedEvent`** (ya mencionado)
   ```typescript
   {
     interactionId: string;
     requestId: string;
     responseIntent: string;
     responseTime: number; // minutos entre sentAt y respondedAt
   }
   ```
   **Uso futuro**: Medir tiempo de respuesta, efectividad de follow-ups

3. **`RequestInteractionFailedEvent`**
   ```typescript
   {
     interactionId: string;
     requestId: string;
     error: string;
     retryCount: number;
   }
   ```
   **Uso futuro**: Alertas de fallos, análisis de problemas de entrega

**Eventos existentes que se aprovechan:**

- `RequestStatusChangedEvent` - Ya existe, se usa para crear `RequestInteraction` de tipo STATUS_UPDATE
- `RequestCreatedEvent` - Podría disparar primer follow-up después de X días

### 7.2. Métricas que Permitiría Recolectar

**Métricas de Engagement:**

1. **Tasa de respuesta a follow-ups:**
   - `(interacciones RESPONDED / interacciones SENT) * 100`
   - Segmentar por tipo de follow-up, estado de Request

2. **Tiempo promedio de respuesta:**
   - `AVG(respondedAt - sentAt)` por tipo de interacción
   - Identificar qué mensajes generan respuestas más rápidas

3. **Efectividad de follow-ups por estado:**
   - Qué estados de Request responden mejor a follow-ups
   - Optimizar timing y frecuencia

**Métricas de Negocio:**

1. **Conversión de follow-ups a cambios de estado:**
   - `COUNT(Requests que cambiaron estado después de follow-up) / COUNT(follow-ups enviados)`
   - Medir impacto en ciclo de vida de Requests

2. **Costo por Request completado:**
   - `SUM(costo de mensajes WhatsApp) / COUNT(Requests DONE)`
   - ROI del sistema de follow-ups

3. **Reducción de tiempo en estados:**
   - Comparar tiempo promedio en `ACCEPTED` antes/después de follow-ups
   - Validar que los follow-ups aceleran el proceso

**Métricas Técnicas:**

1. **Tasa de entrega exitosa:**
   - `(interacciones DELIVERED / interacciones SENT) * 100`
   - Monitorear salud de integración con Twilio

2. **Tasa de fallos:**
   - `(interacciones FAILED / total interacciones) * 100`
   - Alertas si supera umbral

### 7.3. Cómo Esto Habilita Reporting o ML Más Adelante

**Reporting:**

- Dashboard de seguimiento de Requests con timeline de interacciones
- Reportes de efectividad de follow-ups por especialista/cliente
- Análisis de patrones de comunicación (horarios de respuesta, días de la semana)

**Machine Learning (futuro):**

1. **Predicción de abandono:**
   - Entrenar modelo con features: tiempo en estado, número de follow-ups, tasa de respuesta histórica
   - Predecir qué Requests tienen alta probabilidad de abandonarse
   - Enviar follow-ups preventivos

2. **Optimización de timing:**
   - Analizar historial de respuestas por hora del día, día de la semana
   - Ajustar `scheduledFor` para maximizar probabilidad de respuesta

3. **Personalización de mensajes:**
   - A/B testing de templates
   - Aprender qué mensajes funcionan mejor para cada tipo de especialista/cliente

4. **Detección de intents mejorada:**
   - Reemplazar keyword matching por modelo de NLP
   - Clasificación más precisa de respuestas

**Arquitectura para habilitar ML:**

- Eventos de dominio ya emiten datos estructurados
- `RequestInteraction` almacena historial completo
- Fácil exportar datos a data warehouse o analytics platform
- Separación de concerns permite agregar ML sin tocar lógica de negocio existente

---

## 8. Riesgos y Decisiones Abiertas

### 8.1. Decisiones que Todavía No Están Cerradas

**1. Estructura de Templates de Mensajes**

**Opción A: Hardcoded en código**
- Pros: Simple, rápido de implementar
- Contras: Requiere deploy para cambiar mensajes, no escalable

**Opción B: Base de datos (`message_templates` table)**
- Pros: Cambios sin deploy, versionado posible
- Contras: Más complejo, requiere UI de administración

**Opción C: Archivo de configuración (JSON/YAML)**
- Pros: Balance entre simplicidad y flexibilidad
- Contras: Aún requiere deploy, pero más fácil de mantener

**Recomendación inicial**: Opción C (archivo JSON), evolucionar a Opción B si hay necesidad de cambios frecuentes.

**2. Estrategia de Detección de Intents**

**Opción A: Keyword matching simple**
- Pros: Rápido de implementar, sin dependencias externas
- Contras: Limitado, puede tener falsos positivos

**Opción B: Servicio externo de NLP (Dialogflow, Wit.ai)**
- Pros: Más preciso, maneja variaciones de lenguaje
- Contras: Costo adicional, latencia, dependencia externa

**Opción C: Modelo propio entrenado**
- Pros: Control total, puede optimizarse para dominio específico
- Contras: Requiere datos de entrenamiento, infraestructura ML

**Recomendación inicial**: Opción A para MVP, documentar migración futura a Opción B si se valida necesidad.

**3. Manejo de Múltiples Follow-ups Simultáneos**

**Problema**: ¿Qué pasa si un Request tiene múltiples follow-ups programados (ej: uno de 3 días y otro de 7 días)?

**Opción A: Enviar todos los que correspondan**
- Pros: Simple
- Contras: Puede saturar al destinatario, costo alto

**Opción B: Solo el más reciente, cancelar anteriores**
- Pros: Evita spam
- Contras: Puede perder información valiosa

**Opción C: Agrupar mensajes si hay múltiples pendientes**
- Pros: Balance entre información y no-spam
- Contras: Más complejo de implementar

**Recomendación inicial**: Opción B (solo el más reciente), con lógica que cancele follow-ups anteriores cuando se programa uno nuevo.

**4. Persistencia de Historial de Twilio**

**Pregunta**: ¿Guardamos todos los webhooks de Twilio o solo los relevantes?

**Opción A: Guardar todo en tabla separada (`twilio_webhook_logs`)**
- Pros: Auditoría completa, debugging fácil
- Contras: Más almacenamiento, puede crecer rápido

**Opción B: Solo guardar en `RequestInteraction` lo esencial**
- Pros: Simple, sin datos redundantes
- Contras: Menos información para debugging

**Recomendación inicial**: Opción A para desarrollo/staging, Opción B para producción con logging estructurado como alternativa.

### 8.2. Suposiciones

**Suposiciones técnicas:**

1. **Twilio SDK está disponible y estable**
   - Asumimos que `twilio` npm package funciona correctamente
   - Validar en pruebas de integración

2. **Webhooks de Twilio son confiables**
   - Asumimos que Twilio entrega webhooks de forma consistente
   - Implementar idempotencia para manejar duplicados

3. **Números de teléfono están normalizados**
   - Asumimos que `User.phone` y `Professional.whatsapp` están en formato E.164
   - Validar y normalizar en el servicio

**Suposiciones de negocio:**

1. **Usuarios quieren recibir follow-ups vía WhatsApp**
   - Validar con usuarios beta antes de producción
   - Implementar opt-out si es necesario

2. **Respuestas simples son suficientes para MVP**
   - Asumimos que keyword matching cubre 80% de casos
   - Los casos edge se manejan manualmente inicialmente

3. **Follow-ups mejoran la tasa de completación de Requests**
   - Hipótesis a validar con métricas después del lanzamiento

### 8.3. Qué Validar Antes de Producción

**Validaciones técnicas:**

1. **Integración con Twilio:**
   - [ ] Probar envío de mensajes en Sandbox
   - [ ] Probar recepción de webhooks (usar ngrok para desarrollo local)
   - [ ] Validar firma de webhooks
   - [ ] Probar manejo de errores (número inválido, cuenta suspendida, etc.)
   - [ ] Validar rate limits y comportamiento bajo carga

2. **Procesamiento de respuestas:**
   - [ ] Probar detección de intents con mensajes reales
   - [ ] Validar que transiciones de estado funcionan correctamente
   - [ ] Probar casos edge (mensajes vacíos, emojis, múltiples líneas)

3. **Scheduling:**
   - [ ] Validar que cron jobs se ejecutan correctamente
   - [ ] Probar que no se envían follow-ups duplicados
   - [ ] Validar cálculo de "tiempo sin actividad"

**Validaciones de negocio:**

1. **UX de mensajes:**
   - [ ] Revisar templates con usuarios beta
   - [ ] Validar que mensajes son claros y accionables
   - [ ] Probar flujo completo end-to-end con usuarios reales

2. **Frecuencia de follow-ups:**
   - [ ] Validar que no se perciben como spam
   - [ ] Ajustar timing según feedback

3. **Cobertura de casos:**
   - [ ] Probar con Requests en todos los estados
   - [ ] Validar con Requests directas y públicas
   - [ ] Probar con Professional y Company como providers

**Checklist de Go-Live:**

- [ ] Variables de entorno configuradas en producción
- [ ] Webhook URL configurada en Twilio Console
- [ ] Monitoreo y alertas configurados (logs, métricas)
- [ ] Documentación de operaciones (cómo debuggear, cómo deshabilitar)
- [ ] Feature flag para habilitar/deshabilitar sin deploy
- [ ] Plan de rollback si algo falla
- [ ] Comunicación a usuarios sobre nueva funcionalidad

---

## 9. Plan de Implementación por Etapas

### Etapa 1: Fundación (MVP Mínimo)

**Objetivo**: Probar concepto con flujo básico end-to-end

**Tareas:**
1. Crear schema de `RequestInteraction` en Prisma
2. Implementar `RequestInteraction` entity y repository
3. Crear `TwilioWhatsAppAdapter` básico (solo envío)
4. Crear `TwilioWebhookController` básico (solo recibe, no procesa)
5. Crear `RequestInteractionService` con método `sendMessage()`
6. Crear cron job `WhatsAppDispatchJob` que envía mensajes hardcoded
7. Probar envío y recepción en Sandbox

**Criterio de éxito**: Mensaje se envía y se recibe webhook correctamente

**Tiempo estimado**: 1-2 semanas

### Etapa 2: Follow-ups Automáticos

**Objetivo**: Implementar lógica de scheduling y envío automático

**Tareas:**
1. Implementar `FollowUpSchedulerJob` con reglas básicas
2. Crear templates de mensajes (archivo JSON)
3. Implementar personalización de mensajes
4. Agregar validaciones (teléfono verificado, estado de Request válido)
5. Implementar cancelación de follow-ups duplicados
6. Agregar logging y métricas básicas

**Criterio de éxito**: Follow-ups se envían automáticamente según reglas configuradas

**Tiempo estimado**: 1 semana

### Etapa 3: Procesamiento de Respuestas

**Objetivo**: Procesar respuestas y actualizar estado de Request

**Tareas:**
1. Implementar `DetectResponseIntentUseCase` (keyword matching)
2. Implementar `RequestInteractionService.processInboundMessage()`
3. Crear `RequestInteractionRespondedHandler`
4. Implementar lógica de actualización de estado basada en intents
5. Agregar confirmación de recepción vía WhatsApp
6. Manejar casos edge (intent desconocido, múltiples respuestas)

**Criterio de éxito**: Respuesta vía WhatsApp actualiza estado de Request correctamente

**Tiempo estimado**: 1-2 semanas

### Etapa 4: Robustez y Producción

**Objetivo**: Hacer el sistema robusto y listo para producción

**Tareas:**
1. Implementar retry logic para mensajes fallidos
2. Agregar validación de firma de Twilio en webhooks
3. Implementar rate limiting
4. Agregar feature flags
5. Crear dashboard básico de métricas (opcional)
6. Documentación completa
7. Tests de integración end-to-end
8. Pruebas de carga

**Criterio de éxito**: Sistema funciona de forma confiable en producción

**Tiempo estimado**: 1-2 semanas

### Etapa 5: Mejoras y Optimizaciones (Futuro)

**Objetivo**: Mejorar efectividad y experiencia

**Tareas:**
1. A/B testing de templates
2. Optimización de timing basada en datos
3. Mejora de detección de intents (NLP)
4. Personalización avanzada
5. Integración con analytics

**Tiempo estimado**: Iterativo, según necesidades

---

## 10. Consideraciones de Arquitectura

### 10.1. Integración con Módulo de Notificaciones Existente

El sistema de notificaciones ya existe y tiene soporte para `WHATSAPP` como canal (aunque no implementado). Se propone:

**Opción A: Usar NotificationService para envío de WhatsApp**
- Pros: Reutiliza infraestructura existente, consistencia
- Contras: `NotificationService` está diseñado para notificaciones, no para interacciones bidireccionales

**Opción B: Crear TwilioWhatsAppAdapter independiente**
- Pros: Separación de concerns, más flexible para interacciones
- Contras: Duplicación potencial de código

**Recomendación**: Opción B inicialmente, pero diseñar `TwilioWhatsAppAdapter` de forma que pueda ser reutilizado por `NotificationService` en el futuro. Esto permite evolucionar ambos sistemas independientemente.

### 10.2. Eventos de Dominio y Desacoplamiento

Los eventos de dominio permiten desacoplar:

- `RequestInteractionService` no necesita conocer detalles de cómo se actualiza `Request`
- `RequestService` no necesita conocer detalles de WhatsApp
- Handlers pueden agregarse/modificarse sin cambiar código existente

**Patrón propuesto:**
```
RequestInteractionService → Emite RequestInteractionRespondedEvent
                              ↓
                    RequestInteractionRespondedHandler (en Requests module)
                              ↓
                    RequestService.updateStatus()
                              ↓
                    Emite RequestStatusChangedEvent
                              ↓
                    Notification Handlers (en Notifications module)
```

### 10.3. Persistencia y Consistencia

**Transacciones:**
- Crear `RequestInteraction` y enviar mensaje deben ser atómicos
- Si falla el envío a Twilio, `RequestInteraction` debe quedar en estado `FAILED`
- Usar transacciones de Prisma cuando sea necesario

**Eventual Consistency:**
- Webhooks de Twilio pueden llegar fuera de orden
- Implementar idempotencia basada en `twilioMessageSid`
- Usar `updatedAt` para determinar orden si hay conflictos

### 10.4. Escalabilidad

**Consideraciones iniciales:**
- Cron jobs ejecutan en una sola instancia (usar `@nestjs/schedule` es suficiente)
- Si se escala horizontalmente, considerar distributed locks (ej: Redis) para evitar ejecuciones duplicadas

**Futuro:**
- Si el volumen crece, considerar queue-based approach (Bull/BullMQ)
- Mover scheduling a sistema externo (ej: Temporal, AWS EventBridge)

---

## 11. Estructura de Archivos Propuesta

```
specialist-be/src/requests/
├── domain/
│   ├── entities/
│   │   └── request-interaction.entity.ts (nuevo)
│   ├── repositories/
│   │   └── request-interaction.repository.ts (nuevo)
│   ├── ports/
│   │   └── twilio-whatsapp.port.ts (nuevo)
│   ├── value-objects/
│   │   ├── interaction-type.vo.ts (nuevo)
│   │   ├── interaction-status.vo.ts (nuevo)
│   │   ├── interaction-direction.vo.ts (nuevo)
│   │   └── response-intent.vo.ts (nuevo)
│   └── events/
│       ├── request-interaction-created.event.ts (nuevo)
│       ├── request-interaction-responded.event.ts (nuevo)
│       └── request-interaction-failed.event.ts (nuevo)
├── application/
│   ├── services/
│   │   ├── request-interaction.service.ts (nuevo)
│   │   └── request.service.ts (modificar: agregar handler)
│   ├── use-cases/
│   │   ├── schedule-follow-up.use-case.ts (nuevo)
│   │   ├── detect-response-intent.use-case.ts (nuevo)
│   │   └── update-request-from-interaction.use-case.ts (nuevo)
│   ├── jobs/
│   │   ├── follow-up-scheduler.job.ts (nuevo)
│   │   └── whatsapp-dispatch.job.ts (nuevo)
│   ├── handlers/
│   │   ├── request-status-changed.handler.ts (nuevo: crea STATUS_UPDATE)
│   │   └── request-interaction-responded.handler.ts (nuevo: actualiza Request)
│   └── dto/
│       ├── create-follow-up.dto.ts (nuevo)
│       ├── process-inbound-message.dto.ts (nuevo)
│       └── update-interaction-status.dto.ts (nuevo)
├── infrastructure/
│   ├── repositories/
│   │   └── prisma-request-interaction.repository.ts (nuevo)
│   ├── adapters/
│   │   └── twilio-whatsapp.adapter.ts (nuevo)
│   └── mappers/
│       └── request-interaction.prisma-mapper.ts (nuevo)
└── presentation/
    ├── controllers/
    │   └── twilio-webhook.controller.ts (nuevo)
    └── guards/
        └── twilio-webhook.guard.ts (nuevo)

specialist-be/src/shared/
└── infrastructure/
    └── messaging/
        └── message-templates.json (nuevo: templates de mensajes)
```

---

## 12. Próximos Pasos

### Inmediatos (Antes de Implementar)

1. **Revisar y aprobar este plan**
   - Validar decisiones arquitectónicas
   - Ajustar scope si es necesario
   - Confirmar recursos disponibles

2. **Configurar entorno de desarrollo**
   - Crear cuenta de Twilio Sandbox
   - Configurar webhook local con ngrok
   - Probar envío/recepción manual

3. **Definir templates de mensajes**
   - Escribir mensajes en español
   - Validar con usuarios beta
   - Definir estructura de JSON

### Implementación

Seguir etapas definidas en sección 9, comenzando por Etapa 1.

### Validación Continua

- Revisar métricas después de cada etapa
- Ajustar plan según feedback
- Documentar lecciones aprendidas

---

## Apéndices

### A. Referencias

- [Twilio WhatsApp API Documentation](https://www.twilio.com/docs/whatsapp)
- [NestJS Schedule Module](https://docs.nestjs.com/techniques/task-scheduling)
- [Domain-Driven Design Patterns](https://martinfowler.com/bliki/DomainDrivenDesign.html)

### B. Glosario

- **Aggregate**: Agregado en DDD, conjunto de entidades que se tratan como una unidad
- **Bounded Context**: Contexto delimitado en DDD, módulo con modelo de dominio propio
- **Follow-up**: Mensaje de seguimiento enviado automáticamente
- **Intent**: Intención detectada en un mensaje de texto (ej: CONFIRMED, CANCELLED)
- **Webhook**: Callback HTTP enviado por un servicio externo (Twilio) a nuestra API

### C. Notas de Diseño

- Este plan prioriza simplicidad y validación del concepto sobre optimización prematura
- Se deja espacio para evolucionar hacia soluciones más sofisticadas (ML, NLP) sin requerir refactor mayor
- La arquitectura DDD permite agregar features sin romper código existente

---

**Fin del documento**


