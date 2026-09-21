# Guía de Testing: Sistema de Follow-up WhatsApp

Guía completa para testear el sistema de follow-up automático de solicitudes vía WhatsApp.

## 📋 Índice

1. [Prerequisitos](#prerequisitos)
2. [Testing Rápido](#testing-rápido)
3. [Testing de un Request Específico](#testing-de-un-request-específico)
4. [Testing End-to-End Completo](#testing-end-to-end-completo)
5. [Testing de Componentes](#testing-de-componentes)
6. [Testing de Webhooks](#testing-de-webhooks)
7. [Testing de Jobs](#testing-de-jobs)
8. [Troubleshooting](#troubleshooting)
9. [Checklist de Testing](#checklist-de-testing)

---

## Prerequisitos

### 1. Configuración Completada

- ✅ Twilio Sandbox configurado (ver [SETUP.md](./SETUP.md))
- ✅ Webhooks configurados en Twilio
- ✅ ngrok corriendo (desarrollo local)
- ✅ Variables de entorno configuradas
- ✅ Número de WhatsApp registrado en Sandbox

### 2. Scripts Disponibles

Los scripts están organizados en:
- `test/scripts/whatsapp/testing/` - Scripts de testing
- `test/scripts/whatsapp/debugging/` - Scripts de debugging
- `test/scripts/whatsapp/utilities/` - Scripts utilitarios

Ver el [README de scripts](../../../test/scripts/whatsapp/README.md) para más detalles.

---

## Testing Rápido

### Ver Estado del Sistema

```bash
# Ver configuración y estado general
docker exec especialistas-api-dev npm run whatsapp:debug
```

Esto mostrará:
- Configuración de Twilio
- Mensajes enviados recientemente
- Números de teléfono en la base de datos
- Estado de las interactions

### Ejecutar Jobs Manualmente

```bash
# Ejecutar scheduler (crea follow-ups)
docker exec especialistas-api-dev npm run whatsapp:test scheduler

# Ejecutar dispatch (envía mensajes pendientes)
docker exec especialistas-api-dev npm run whatsapp:test dispatch

# Ejecutar status checker (verifica estado en Twilio)
docker exec especialistas-api-dev npm run whatsapp:test status-checker
```

### Ver Interactions

```bash
# Ver todas las interactions
docker exec especialistas-api-dev npm run whatsapp:resend list

# Ver por estado
docker exec especialistas-api-dev npm run whatsapp:resend list PENDING
docker exec especialistas-api-dev npm run whatsapp:resend list SENT
docker exec especialistas-api-dev npm run whatsapp:resend list DELIVERED
docker exec especialistas-api-dev npm run whatsapp:resend list FAILED
```

---

## Testing de un Request Específico

### Flujo Completo Automatizado

```bash
# Reemplaza <request-id> con el ID real de tu request
docker exec especialistas-api-dev npm run whatsapp:test-single <request-id>
```

Este comando:
- ✅ Prepara el request (CONTACT_RELEASED, updated_at hace 4 días)
- ✅ Ejecuta scheduler para crear follow-up
- ✅ Envía el mensaje
- ✅ Verifica estado en Twilio
- ✅ Muestra resumen completo

### Con Simulación de Respuesta

```bash
docker exec especialistas-api-dev npm run whatsapp:test-single <request-id> --simulate-response
```

Esto también simula que el usuario responde "si confirmo" y verifica que el Request se actualiza.

### Pasos Manuales

#### Paso 1: Obtener un Request ID

```bash
# Ver requests disponibles
docker exec especialistas-api-dev npx prisma studio
# O usar SQL directo
docker exec especialistas-api-dev npx prisma db execute --stdin <<< "SELECT id, title, status, provider_id FROM requests LIMIT 5;"
```

#### Paso 2: Verificar Requisitos del Request

El script verifica automáticamente, pero puedes verificar manualmente:

```sql
-- Verificar request
SELECT id, title, status, provider_id, updated_at 
FROM requests 
WHERE id = 'tu-request-id';

-- Verificar provider tiene teléfono verificado
SELECT sp.id, p.whatsapp, u.phone, u.phone_verified
FROM service_providers sp
LEFT JOIN professionals p ON p.id = sp.id
LEFT JOIN users u ON u.id = p.user_id
WHERE sp.id = 'provider-id-del-request';
```

**Requisitos:**
- ✅ Request debe tener `provider_id` asignado
- ✅ Provider debe tener teléfono verificado (`phone_verified = true`)
- ✅ Provider debe tener `whatsapp` o `phone` configurado

#### Paso 3: Preparar Request para Testing

```sql
-- Actualizar request a estado CONTACT_RELEASED hace 4 días
UPDATE requests 
SET status = 'CONTACT_RELEASED', updated_at = NOW() - INTERVAL '4 days'
WHERE id = 'tu-request-id';

-- Verificar que el usuario tenga teléfono verificado
UPDATE users 
SET phone = '+5492944123456', phone_verified = true
WHERE id = 'test-client-id';
```

#### Paso 4: Ejecutar Test

```bash
docker exec especialistas-api-dev npm run whatsapp:test-single <request-id>
```

#### Paso 5: Verificar Resultados

El script mostrará:
- ✅ Si el request fue preparado correctamente
- ✅ Si se creó la interaction de follow-up
- ✅ Si el mensaje se envió
- ✅ Estado del mensaje en Twilio
- ✅ Message SID para verificar en Twilio Console

#### Paso 6: Verificar en WhatsApp

1. Revisa tu WhatsApp
2. Deberías recibir el mensaje con el título del Request
3. El mensaje debería decir algo como: "Hola! 👋 Hace 3 días te asignamos la solicitud \"{title}\"..."

---

## Testing End-to-End Completo

### Checklist Pre-Testing

Antes de empezar, verifica:

- [ ] ngrok corriendo y configurado (`ngrok http 5000`)
- [ ] URL de ngrok configurada en Twilio Console o `.env`
- [ ] Variables de entorno de Twilio configuradas
- [ ] Aplicación corriendo (`docker-compose up` o similar)
- [ ] Números de teléfono registrados en Twilio Sandbox

### Paso 1: Verificar Configuración

```bash
# Ver estado del sistema
docker exec especialistas-api-dev npm run whatsapp:debug
```

### Paso 2: Preparar Datos de Prueba

#### Opción A: Usar datos existentes

```bash
# Ver interactions pendientes
docker exec especialistas-api-dev npm run whatsapp:resend list PENDING
```

#### Opción B: Crear interaction de prueba

```sql
-- Crear Request en estado CONTACT_RELEASED con updated_at hace 4 días
UPDATE requests 
SET status = 'CONTACT_RELEASED', updated_at = NOW() - INTERVAL '4 days'
WHERE id = 'tu-request-id';

-- Verificar teléfono del usuario
UPDATE users 
SET phone = '+5492944123456', phone_verified = true
WHERE id = 'tu-user-id';
```

### Paso 3: Ejecutar Scheduler

```bash
# Ejecutar scheduler para crear follow-ups
docker exec especialistas-api-dev npm run whatsapp:test scheduler
```

Deberías ver logs como:
```
[FollowUpSchedulerJob] Processing follow-up rules...
[FollowUpSchedulerJob] Rule follow_up_3_days: Scheduled 1 interactions
```

### Paso 4: Verificar que se Creó la Interaction

```bash
# Ver interactions pendientes
docker exec especialistas-api-dev npm run whatsapp:resend list PENDING
```

### Paso 5: Ejecutar Dispatch

```bash
# Ejecutar dispatch job
docker exec especialistas-api-dev npm run whatsapp:test dispatch
```

O ejecutar test completo:
```bash
docker exec especialistas-api-dev npm run whatsapp:test
```

### Paso 6: Monitorear Webhooks

En una terminal separada:

```bash
# Monitorear logs en tiempo real
docker logs -f especialistas-api-dev | grep -i "webhook\|Received Twilio\|status update\|inbound"
```

### Paso 7: Simular Webhooks (Opcional)

Si quieres testear sin esperar webhooks reales:

```bash
# Simular status update (delivered)
./test/scripts/whatsapp/utilities/simulate-webhook.sh status SM123 delivered

# Simular status update (failed)
./test/scripts/whatsapp/utilities/simulate-webhook.sh status SM123 failed

# Simular mensaje entrante
./test/scripts/whatsapp/utilities/simulate-webhook.sh inbound SM456 "whatsapp:+5492944123456" "si confirmo"
```

**Nota**: Reemplaza `SM123` con un `MessageSid` real de tus mensajes enviados.

### Paso 8: Verificar Estado Final

```bash
# Ver estado del sistema
docker exec especialistas-api-dev npm run whatsapp:debug

# O ver interactions específicas
docker exec especialistas-api-dev npm run whatsapp:resend list DELIVERED
docker exec especialistas-api-dev npm run whatsapp:resend list FAILED
```

---

## Testing de Componentes

### 1. Testing Unitario: DetectResponseIntentUseCase

```typescript
// test/requests/detect-response-intent.spec.ts
import { DetectResponseIntentUseCase } from '../../src/requests/application/use-cases/detect-response-intent.use-case';

describe('DetectResponseIntentUseCase', () => {
  let useCase: DetectResponseIntentUseCase;

  beforeEach(() => {
    useCase = new DetectResponseIntentUseCase();
  });

  it('should detect CONFIRMED intent', () => {
    expect(useCase.detectIntent('si confirmo')).toBe('CONFIRMED');
    expect(useCase.detectIntent('ok, acepto')).toBe('CONFIRMED');
  });

  it('should detect CANCELLED intent', () => {
    expect(useCase.detectIntent('cancelar')).toBe('CANCELLED');
    expect(useCase.detectIntent('no quiero')).toBe('CANCELLED');
  });

  it('should detect STARTED intent', () => {
    expect(useCase.detectIntent('empece')).toBe('STARTED');
    expect(useCase.detectIntent('ya comence')).toBe('STARTED');
  });

  it('should detect COMPLETED intent', () => {
    expect(useCase.detectIntent('termine')).toBe('COMPLETED');
    expect(useCase.detectIntent('listo finalizado')).toBe('COMPLETED');
  });

  it('should return UNKNOWN for unclear messages', () => {
    expect(useCase.detectIntent('hola como estas')).toBe('UNKNOWN');
  });
});
```

> **Nota (2026-09-17):** `DetectResponseIntentUseCase` ya no es el clasificador de respuestas en
> producción — pasó a ser el fallback determinístico detrás de `IntentDetectionPort`, usado
> directamente cuando `INTENT_CLASSIFIER_PROVIDER=local` (default) y como fallback si el
> clasificador LLM (`anthropic`) falla o se pasa del timeout. Los tests de arriba siguen vigentes
> tal cual (la clase no cambió), pero ver la sección siguiente para el clasificador completo.

### 2. Testing Unitario: IntentDetectionPort (clasificador LLM)

Puerto nuevo (`src/requests/domain/ports/intent-detection.port.ts`) con dos adapters y una
factory, mismo patrón que `WhatsAppMessagingPort`/`whatsapp-messaging.factory.ts`:

- `local-intent-detection.adapter.spec.ts`: wrapea `DetectResponseIntentUseCase` para
  `statusIntent`, siempre devuelve `viability: null`, `optOut: false`, `escalate: false`
  (sin LLM no hay forma de detectar esas señales).
- `anthropic-intent-detection.adapter.spec.ts`: `jest.mock('@anthropic-ai/sdk')` — nunca pega a
  la red real en `npm test`. Cubre el mapeo de una respuesta válida (tool use forzado), el wrap de
  errores del SDK en `Error` genérico, y la validación defensiva de la respuesta (statusIntent
  inválido, falta el bloque `tool_use`, `ANTHROPIC_API_KEY` no configurada).
- `intent-detection.factory.spec.ts`: invoca `useFactory` directo con un `ConfigService` mockeado
  (mismo estilo que `whatsapp-messaging.factory.spec.ts`) — confirma que `INTENT_CLASSIFIER_PROVIDER`
  sin setear, o con un valor no reconocido, **cae a `local`** (nunca al adapter real por default,
  al revés que `WHATSAPP_PROVIDER`).
- `request-interaction.service.spec.ts`: cubre el timeout/fallback (`Promise.race`), el downgrade
  a `UNKNOWN` por baja confianza, y las consecuencias de `optOut`/`escalate`/`viability` (opt-out
  del usuario, flags de atención para admin).

Para probar el clasificador real (`INTENT_CLASSIFIER_PROVIDER=anthropic`) contra la API real de
Anthropic — nunca en `npm test` — usar el loop local de WhatsApp (`WHATSAPP_PROVIDER=local`,
`simulate-reply` desde `/admin/whatsapp`) con `ANTHROPIC_API_KEY` configurada, y calibrar
`INTENT_CLASSIFIER_CONFIDENCE_THRESHOLD` con mensajes ambiguos reales antes de activarlo en un
entorno real.

### 3. Testing Unitario: RequestInteractionService

Ver ejemplos en el código fuente para testing de:
- Envío de mensajes
- Retry logic
- Procesamiento de mensajes entrantes
- Idempotencia

---

## Testing de Webhooks

### Verificar que el Endpoint Funciona

```bash
# Test manual del endpoint
curl -X POST http://localhost:5000/api/webhooks/twilio \
  -H "Content-Type: application/json" \
  -d '{
    "MessageSid": "SM123",
    "MessageStatus": "delivered"
  }'
```

### Ver Logs en Tiempo Real

```bash
# Ver logs del contenedor
docker logs -f especialistas-api-dev | grep -i "twilio\|webhook"

# O filtrar por el controller
docker logs -f especialistas-api-dev | grep -i "TwilioWebhookController"
```

### Ver Webhooks en Twilio Console

1. Ve a [Monitor → Logs → Messaging](https://console.twilio.com/us1/monitor/logs/messaging)
2. Busca mensajes enviados
3. Haz clic en un mensaje para ver:
   - Estado actual
   - Historial de webhooks enviados
   - Códigos de error (si hay)

### Ver Webhooks en ngrok (Desarrollo Local)

1. Abre http://localhost:4040 en tu navegador
2. Ve a la pestaña "Requests"
3. Verás todos los webhooks recibidos de Twilio

### Testing de Rate Limiting

```bash
# Usar curl o script para enviar múltiples requests
for i in {1..150}; do
  curl -X POST http://localhost:5000/api/webhooks/twilio \
    -H "Content-Type: application/json" \
    -d '{"MessageSid":"SM123","MessageStatus":"delivered"}'
done

# Debería recibir 429 después de 100 requests
```

### Testing de Idempotencia

```bash
# Enviar el mismo webhook múltiples veces
for i in {1..5}; do
  curl -X POST http://localhost:5000/api/webhooks/twilio \
    -H "Content-Type: application/json" \
    -d '{"MessageSid":"SM123","MessageStatus":"delivered"}'
done

# Verificar en logs que solo se procesó una vez
docker logs especialistas-api-dev | grep "SM123"
```

---

## Testing de Jobs

### FollowUpSchedulerJob

```bash
# Ejecutar manualmente
docker exec especialistas-api-dev npm run whatsapp:test scheduler
```

Verifica:
- ✅ Crea interactions para requests que cumplen las reglas
- ✅ No crea duplicados
- ✅ Respeta los tiempos configurados

### WhatsAppDispatchJob

```bash
# Ejecutar manualmente
docker exec especialistas-api-dev npm run whatsapp:test dispatch
```

Verifica:
- ✅ Envía mensajes pendientes
- ✅ Maneja errores correctamente
- ✅ Actualiza estado a SENT después de envío exitoso
- ✅ Implementa retry logic para errores transitorios

### MessageStatusCheckerJob

```bash
# Ejecutar manualmente
docker exec especialistas-api-dev npm run whatsapp:test status-checker
```

Verifica:
- ✅ Verifica estado de mensajes SENT en Twilio
- ✅ Actualiza estado a DELIVERED o FAILED según corresponda
- ✅ Maneja errores de API de Twilio

---

## Troubleshooting

### Problema: Mensajes se envían pero no llegan

**Verificar:**

1. **Número registrado en Sandbox:**
   - Ve a [Twilio Sandbox](https://console.twilio.com/us1/develop/sms/sandbox)
   - Verifica que el número esté en "Sandbox participants"
   - Si no está, envía `join <codigo>` desde WhatsApp

2. **Estado en Twilio Console:**
   - Ve a Monitor → Logs → Messaging
   - Busca el MessageSid
   - Revisa el código de error si hay

3. **Logs de la aplicación:**
   ```bash
   docker logs especialistas-api-dev | grep -i "twilio\|whatsapp"
   ```

### Problema: Webhooks no llegan

**Verificar:**

1. **ngrok está corriendo:**
   ```bash
   # Verificar que ngrok está activo
   curl http://localhost:4040/api/tunnels
   ```

2. **URL configurada correctamente:**
   - Verifica en Twilio Console que la URL sea correcta
   - Debe ser HTTPS (ngrok proporciona HTTPS)
   - Debe incluir `/api/webhooks/twilio`

3. **Logs de ngrok:**
   - Abre http://localhost:4040
   - Ve a "Requests" para ver webhooks recibidos

4. **Validación de firma:**
   - Si tienes `TWILIO_WEBHOOK_SECRET` configurado, verifica que sea correcto
   - En desarrollo, puedes dejarlo vacío para deshabilitar validación

### Problema: Webhooks llegan pero no se procesan

**Verificar:**

1. **Logs del controller:**
   ```bash
   docker logs especialistas-api-dev | grep "TwilioWebhookController"
   ```

2. **Estado de las interactions:**
   ```bash
   docker exec especialistas-api-dev npm run whatsapp:resend list SENT
   ```

3. **MessageSid correcto:**
   - Verifica que el `MessageSid` en el webhook coincida con uno en la base de datos

### Problema: Request status no se actualiza después de respuesta

**Verificar:**

1. **Logs del event handler:**
   ```bash
   docker logs especialistas-api-dev | grep "RequestInteractionRespondedHandler"
   ```

2. **Intent detectado:**
   ```bash
   docker logs especialistas-api-dev | grep "detected intent"
   ```

3. **Estado actual del request:**
   ```sql
   SELECT id, status, updated_at FROM requests WHERE id = 'request-id';
   ```

---

## Flujo Completo de Testing

### Escenario 1: Flujo Exitoso

```
1. Crear/Resetear interaction → PENDING
2. Ejecutar dispatch → SENT
3. Twilio envía mensaje → delivered (webhook)
4. Sistema procesa webhook → DELIVERED
5. Usuario responde → inbound message (webhook)
6. Sistema procesa respuesta → RESPONDED
7. Handler actualiza Request → Estado cambiado
```

### Escenario 2: Mensaje Fallido

```
1. Crear/Resetear interaction → PENDING
2. Ejecutar dispatch → SENT
3. Twilio rechaza mensaje → failed (webhook)
4. Sistema procesa webhook → FAILED
5. Retry automático (si aplica) → PENDING → SENT
```

### Escenario 3: Sin Webhook (Status Checker)

```
1. Crear/Resetear interaction → PENDING
2. Ejecutar dispatch → SENT
3. Webhook no llega (timeout/error)
4. MessageStatusCheckerJob (cada 5 min) → Verifica estado
5. Detecta error en Twilio → FAILED
```

---

## Checklist de Testing

Después del testing, verifica:

- [ ] Mensajes se enviaron correctamente (estado `SENT`)
- [ ] Webhooks de estado se recibieron (`delivered` o `failed`)
- [ ] Interactions se actualizaron correctamente
- [ ] Mensajes entrantes se procesan (si probaste)
- [ ] Errores se manejan correctamente
- [ ] Retry logic funciona para errores transitorios
- [ ] Idempotencia funciona (mismo webhook múltiples veces)
- [ ] Rate limiting funciona (si configurado)
- [ ] Request status se actualiza según respuestas
- [ ] Logs son claros y útiles para debugging

---

## Referencias

- [SETUP.md](./SETUP.md) - Configuración inicial
- [README de Scripts](../../../test/scripts/whatsapp/README.md) - Documentación de scripts
- [Twilio WhatsApp Documentation](https://www.twilio.com/docs/whatsapp)
- [Twilio Sandbox Guide](https://www.twilio.com/docs/whatsapp/sandbox)


