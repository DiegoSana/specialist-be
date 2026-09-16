# Sistema de Follow-up WhatsApp

Documentación completa del sistema de follow-up automático de solicitudes vía WhatsApp usando Twilio.

## ¿Cuándo se hace follow-up?

**Solo cuando la solicitud ya está asignada a un proveedor.** No hay follow-up para solicitudes públicas sin asignar (estado `PENDING`).

| Estado de la solicitud | Días sin actividad | Destinatario | Template |
|------------------------|---------------------|--------------|----------|
| `ACCEPTED` (asignada, aún no empezada) | 3 días | Proveedor | follow_up_3_days |
| `ACCEPTED` | 7 días | Proveedor | follow_up_7_days |
| `IN_PROGRESS` (trabajo en curso) | 5 días | Proveedor | follow_up_5_days_in_progress |
| `IN_PROGRESS` | 10 días | Proveedor | follow_up_10_days_in_progress |
| `DONE` (finalizada) | 1 día | Cliente | follow_up_review_1_day (pedir reseña) |
| `PENDING` pública con interesados y sin proveedor asignado | 3 días | Cliente | follow_up_pending_3_days_with_interests (elegir especialista) |

El job `FollowUpSchedulerJob` corre cada hora, busca solicitudes que cumplan estado + antigüedad, y programa un mensaje de follow-up (luego `WhatsAppDispatchJob` lo envía). No se programa follow-up si ya hay uno pendiente o si hubo interacción reciente (&lt; 1 día).

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
2. Con `WHATSAPP_PROVIDER=local`, `LocalWhatsAppAdapter` (`src/requests/infrastructure/adapters/local-whatsapp.adapter.ts`)
   reemplaza a `TwilioWhatsAppAdapter` detrás del mismo `WhatsAppMessagingPort`: `sendMessage`
   genera un id `local-<uuid>`, loguea el mensaje y no hace ninguna llamada de red;
   `getMessageStatus` siempre devuelve `delivered`. La elección se resuelve en
   `whatsapp-messaging.factory.ts`, igual que `email-sender.factory.ts` para `EMAIL_PROVIDER`.
3. Usar el visor de conversaciones en `/admin/whatsapp` (consumido por specialist-admin):
   - `GET /admin/whatsapp/config` → `{ devMode, availableFollowUpRules? }` (los nombres de regla
     solo se listan en dev mode).
   - `GET /admin/whatsapp/conversations` → lista paginada de conversaciones (una fila por
     solicitud con al menos una interacción), con `search` opcional por título/cliente/proveedor.
   - `GET /admin/whatsapp/conversations/:requestId` → hilo completo de mensajes de esa solicitud.
   - `POST /admin/whatsapp/conversations/:requestId/trigger-followup` (body `{ ruleName }`, dev
     mode only) → dispara una regla de follow-up **ahora mismo**, sin esperar al cron horario ni
     backdatear la solicitud: valida que el estado actual de la solicitud (o, para la regla
     PENDING-con-interesados, que tenga interesados) cumpla la condición de la regla, y que el
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


