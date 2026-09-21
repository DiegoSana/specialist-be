# Sistema de Follow-up WhatsApp

Documentación completa del sistema de follow-up automático de solicitudes vía WhatsApp usando Twilio.

## ¿Cuándo se hace follow-up?

Fuente: `docs/EspecialistBRC — Estados del pedido.md` ("Follow-up por WhatsApp"). Dos tipos de mensaje:
**avisos** (`notice_*`, A1-A7: informan y llevan a la app, donde se hace la acción) y **preguntas**
(`question_*`, P1-P3: la respuesta libre puede mover el estado). Una "escalera" (ladder) es la secuencia
mensaje inicial + recordatorios que recibe **una** persona mientras el pedido está en **un** estado; máximo 3
mensajes por escalera. Los recordatorios reutilizan la misma plantilla anteponiendo
`Te escribimos de nuevo por "<pedido>".` (variable `{reminder}`, no hay plantillas extra). Definidas en
`src/requests/application/follow-up/follow-up-ladders.ts`; días = desde que el pedido entra al estado.

| Estado | Para | Mensajes (días) | Plantilla | Qué mueve el estado |
|--------|------|-----------------|-----------|---------------------|
| `SENT` | Especialista | 0, 2, 4 | `notice_request_sent` (A1) | Aceptar/rechazar, en la app |
| `PUBLISHED` con interesados | Cliente | 0, 2, 4 | `notice_interests_published` (A2) | Elegir, en la app |
| `CONTACT_RELEASED` | Ambos | 0 | `notice_contact_released` (A3) | - |
| `CONTACT_RELEASED` | Ambos, por separado | 2, 4, 6 | `question_agreement` (P1) | acuerdo -> `IN_PROGRESS`; no hubo acuerdo -> `NOT_COMPLETED` |
| `IN_PROGRESS` | Especialista | 7, 14, 21 | `question_progress` (P2) | terminó -> `FINISHED`; interrumpido -> `INTERRUPTED`; sigue -> sin cambio |
| `FINISHED` | Cliente | 0, 2, 4 | `question_satisfaction` (P3) | conforme -> `CLOSED`; objeta -> `UNDER_REVIEW` |
| `CLOSED` | Ambos | 0, 3 | `notice_request_closed` (A6) | Calificar, en la app |
| `CLOSED` automático (`statusReason=AUTO_CLOSED`) | Cliente | 0 | `notice_auto_closed` (A7) | - |
| `REJECTED` | Cliente | 0 | `notice_request_rejected` (A4) | Volver a publicar, en la app |
| `EXPIRED`, `NO_RESPONSE`, `NOT_COMPLETED`, `ABANDONED` | Cliente | 0 | `notice_no_agreement` (A5) | Volver a publicar, en la app |

`UNDER_REVIEW` no envía mensajes (lo maneja soporte).

`FollowUpSchedulerJob` corre cada hora (solo de 9 a 20 h, hora de Buenos Aires; ver
`WHATSAPP_FOLLOWUP_WINDOW_*`), programa cada mensaje y `WhatsAppDispatchJob` lo envía. Reglas por escalera:
el mensaje N solo sale cuando ya se enviaron exactamente N mensajes de esa escalera **en el estado actual**
(se cuenta en el ledger de `RequestInteraction` vía `metadata.ladder` + `metadata.requestStatus`, ignorando
los `FAILED`), hay como mucho un mensaje pendiente por destinatario y pasó >= 1 día desde el último mensaje a
esa persona en ese estado. Si el último mensaje de una pregunta queda sin respuesta alguna en todo el pedido,
se marca `AT_RISK`.

**Limitación conocida**: no existe un timestamp de "entrada al estado"; los "días desde que entra al estado"
se aproximan con `Request.updatedAt`. Cualquier otro `save` del pedido (ej. subir una foto) reinicia ese reloj
para los días, aunque el conteo de mensajes por estado no se reinicia (no hay reenvíos). Un historial de
estados (ver `TODO.md`) lo resolvería.

Respuestas: solo las plantillas `question_*` pueden cambiar el estado; una respuesta a un aviso nunca lo
cambia, y si la respuesta no es clara (`UNKNOWN`/`NEEDS_INFO`) el estado no cambia. El clasificador recibe la
plantilla a la que se responde (ver "Intención -> estado" abajo).

---

## Ruteo de mensajes entrantes: follow-up vs. soporte general

`TwilioWebhookController.handleInboundMessage` siempre llama a
`RequestInteractionService.processInboundMessage`, que intenta matchear el mensaje contra una
`RequestInteraction` de tipo `FOLLOW_UP` automática (`matchInboundMessage`, dos estrategias: por
`twilioMessageSid` exacto, o la más reciente enviada a ese teléfono dentro de
`WHATSAPP_REPLY_MATCH_WINDOW_DAYS` días - default 14, cubre la cadencia más larga de follow-up de
10 días más margen). El filtro `interactionType: FOLLOW_UP` es explícito en el query de
`RequestInteractionRepository.findMostRecentByPhone` - **nunca** matchea otro tipo de interacción,
ni siquiera si alguna vez existiera (`RESPONSE`/`STATUS_UPDATE` son código muerto hoy).

Si nada matchea (el usuario escribe espontáneamente, o responde fuera de la ventana) y
`SUPPORT_CONVERSATIONS_ENABLED=true`, el mensaje se enruta a
`SupportConversationService.receiveInboundMessage` (contexto `support`, ver
`src/support/CLAUDE.md`) en vez de descartarse en silencio - ese descarte silencioso era el bug
original que motivó separar este contexto. Con el flag en `false` (default), el comportamiento es
el de siempre: se loguea un warning y no se persiste nada. Deliberadamente **no** se hace nunca al
revés: una conversación de soporte nunca alimenta el clasificador de intención de `requests` ni
puede cambiar `Request.status` - por diseño, `support` no depende de los internals de `requests`.

---

## 🧪 Loop de testing local sin Twilio (admin conversations viewer)

Para probar todo el flujo de WhatsApp (mensajes salientes, respuestas entrantes, cambios de
estado disparados por la respuesta) sin gastar créditos de Twilio ni depender del Sandbox:

1. **Activar el adapter local**: `WHATSAPP_PROVIDER=local` (además de `NODE_ENV` distinto de
   `production`, o `WHATSAPP_DEV_MODE_ENABLED=true` como opt-in explícito cuando `NODE_ENV` es
   `production` - ver más abajo). Con esta combinación `isWhatsAppDevMode()` devuelve `true`.
   `WHATSAPP_PROVIDER` por defecto es `twilio` (ver `docs/guides/ENVIRONMENT_VARIABLES.md`); en
   `docker-compose.dev.yml` el default es `local` para que el loop local funcione out-of-the-box.

   **Deploy de testing en Fly.io (`main`, `NODE_ENV=production`):** mientras el proyecto no esté
   en producción real, `fly.toml` fija `WHATSAPP_PROVIDER=local` y `WHATSAPP_DEV_MODE_ENABLED=true`
   para ese mismo deploy, así el visor `/admin/whatsapp` (specialist-admin, contra la API en la
   nube) tiene las mismas herramientas de dev que en local - sin gastar Twilio y sin depender de
   que alguien tenga el backend corriendo localmente. Cuando se empiece a probar con WhatsApp
   real, sacar `WHATSAPP_DEV_MODE_ENABLED` de `fly.toml` y volver `WHATSAPP_PROVIDER` a `twilio`
   (o dejarlo sin setear, que es el default).
2. Con `WHATSAPP_PROVIDER=local`, `LocalWhatsAppAdapter` (`src/shared/infrastructure/messaging/local-whatsapp.adapter.ts`)
   reemplaza a `TwilioWhatsAppAdapter` detrás del mismo `WhatsAppMessagingPort`: `sendMessage`
   genera un id `local-<uuid>`, loguea el mensaje y no hace ninguna llamada de red;
   `getMessageStatus` siempre devuelve `delivered`. La elección se resuelve en
   `whatsapp-messaging.factory.ts`, igual que `email-sender.factory.ts` para `EMAIL_PROVIDER`. El
   puerto y sus adapters viven en `shared/` (promovidos desde `requests/`) para que el contexto
   `support` también pueda enviar WhatsApp sin depender de `requests` - ver la sección siguiente.
3. Usar el visor de conversaciones en `/admin/whatsapp` (consumido por specialist-admin):
   - `GET /admin/whatsapp/config` → `{ devMode, availableFollowUpRules? }` (los nombres de regla
     solo se listan en dev mode).
   - `GET /admin/whatsapp/conversations` → lista paginada de conversaciones (una fila por
     solicitud con al menos una interacción), con `search` opcional por título/cliente/proveedor.
   - `GET /admin/whatsapp/conversations/:requestId` → hilo completo de mensajes de esa solicitud.
   - `POST /admin/whatsapp/conversations/:requestId/trigger-followup` (body `{ ruleName }`, dev
     mode only) → dispara una regla de follow-up **ahora mismo**, sin esperar al cron horario ni
     backdatear la solicitud: valida que el estado actual de la solicitud (o, para la regla
     PUBLISHED-con-interesados, que tenga interesados) cumpla la condición de la regla, y que el
     destinatario tenga teléfono verificado; si no, responde 400 pidiendo cambiar el estado
     primero. A diferencia del cron, **no** aplica los guards de "ya hay un follow-up pendiente" ni
     "interacción hace menos de 1 día" (esos existen solo para que el cron automático no haga
     spam; esto es una acción humana explícita). Envía el mensaje inmediatamente (no espera al
     `WhatsAppDispatchJob` de cada minuto).
   - `POST /admin/whatsapp/conversations/:requestId/simulate-reply` (body `{ body }`, dev mode
     only) → simula la respuesta entrante del cliente/proveedor sobre el **último** mensaje
     enviado a esa solicitud, reusando el `twilioMessageSid` real (aunque sea uno `local-...`)
     para que `processInboundMessage` la matchee por SID exacto en vez de caer al matching más
     amplio por teléfono. Dispara la misma detección de intención y el mismo
     `RequestInteractionRespondedEvent` que una respuesta real de WhatsApp, así que también prueba
     los cambios de estado de la solicitud.
   - Las dos rutas `POST` viven en `AdminWhatsAppDevController`, registrado solo cuando
     `NODE_ENV !== 'production'`; en producción no existen (404 de Nest, no 403), y encima cada
     handler vuelve a chequear `isWhatsAppDevMode()` por las dudas.

Con esto se puede recrear el ciclo completo — solicitud asignada → follow-up disparado → cliente
"responde" → estado de la solicitud cambia — en segundos y sin ningún costo ni configuración de
Twilio/ngrok.

---

## 📚 Índice

### Guías Principales

1. **[SETUP.md](./SETUP.md)** - Configuración inicial completa
   - Configuración de Twilio Sandbox
   - Configuración de webhooks
   - Configuración de ngrok para desarrollo local
   - Variables de entorno necesarias

2. **[TESTING.md](./TESTING.md)** - Guía completa de testing
   - Testing manual con Twilio Sandbox
   - Testing de componentes individuales
   - Testing end-to-end completo
   - Scripts de testing disponibles
   - Troubleshooting común

### Scripts de Testing

Los scripts están organizados en subcarpetas según su propósito:

- **[`test/scripts/whatsapp/testing/`](../../../test/scripts/whatsapp/testing/)** - Scripts para ejecutar tests
- **[`test/scripts/whatsapp/debugging/`](../../../test/scripts/whatsapp/debugging/)** - Scripts para debugging
- **[`test/scripts/whatsapp/utilities/`](../../../test/scripts/whatsapp/utilities/)** - Scripts utilitarios

Ver el [README de scripts](../../../test/scripts/whatsapp/README.md) para más detalles.

---

## 🚀 Inicio Rápido

### 1. Configuración Inicial

```bash
# 1. Configurar variables de entorno en .env
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
# Enable follow-ups for local testing (disabled by default)
WHATSAPP_FOLLOWUP_ENABLED=true

# 2. Configurar ngrok (desarrollo local)
ngrok http 5000

# 3. Configurar webhooks en Twilio Console
# Ver SETUP.md para detalles
```

### 2. Testing Básico

```bash
# Ver estado del sistema
docker exec especialistas-api-dev npm run whatsapp:debug

# Ejecutar scheduler manualmente
docker exec especialistas-api-dev npm run whatsapp:test scheduler

# Ejecutar dispatch manualmente
docker exec especialistas-api-dev npm run whatsapp:test dispatch
```

### 3. Verificar Funcionamiento

```bash
# Monitorear logs
docker logs -f especialistas-api-dev | grep -i whatsapp

# Ver interactions creadas
docker exec especialistas-api-dev npm run whatsapp:resend list PENDING
```

---

## 📖 Documentación Detallada

- **[SETUP.md](./SETUP.md)** - Configuración paso a paso
- **[TESTING.md](./TESTING.md)** - Guías de testing y troubleshooting

---

## 🔗 Referencias Externas

- [Twilio WhatsApp Documentation](https://www.twilio.com/docs/whatsapp)
- [Twilio Sandbox Guide](https://www.twilio.com/docs/whatsapp/sandbox)
- [Twilio Webhook Security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)


