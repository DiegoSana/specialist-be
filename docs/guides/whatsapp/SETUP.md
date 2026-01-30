# Configuración del Sistema de Follow-up WhatsApp

Guía completa para configurar el sistema de follow-up automático de solicitudes vía WhatsApp usando Twilio.

## 📋 Índice

1. [Prerequisitos](#prerequisitos)
2. [Configuración de Twilio](#configuración-de-twilio)
3. [Configuración de ngrok (Desarrollo Local)](#configuración-de-ngrok-desarrollo-local)
4. [Configuración de Webhooks](#configuración-de-webhooks)
5. [Variables de Entorno](#variables-de-entorno)
6. [Verificación](#verificación)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisitos

### 1. Cuenta de Twilio

1. Crear cuenta en [Twilio Console](https://console.twilio.com/)
2. Activar WhatsApp Sandbox (gratis para desarrollo)
3. Obtener credenciales:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_WHATSAPP_FROM` (formato: `whatsapp:+14155238886`)

### 2. Número de WhatsApp para Testing

En Twilio Sandbox, debes registrar tu número:
1. Envía el código "join" al número de Sandbox desde WhatsApp
2. Espera confirmación
3. Verifica que tu número aparezca en la lista de números permitidos

---

## Configuración de Twilio

### Paso 1: Acceder a WhatsApp Sandbox

1. Ve a [Twilio Console](https://console.twilio.com/)
2. Navega a **Messaging** → **Try it out** → **Send a WhatsApp message**
3. O directamente: [WhatsApp Sandbox](https://console.twilio.com/us1/develop/sms/sandbox)

### Paso 2: Configurar Webhook para Mensajes Entrantes

1. En la sección **"When a message comes in"**
2. Configura:
   - **URL**: `https://tu-url-ngrok.com/api/webhooks/twilio` (o tu dominio en producción)
   - **Method**: `POST`
3. Haz clic en **Save**

**Qué hace**: Cuando alguien responde "si" o cualquier mensaje a tu número de WhatsApp, Twilio enviará un POST a esta URL.

### Paso 3: Configurar Webhook para Status Updates

Esta URL recibe actualizaciones sobre el estado de los mensajes que envías (enviado, entregado, fallido, etc.).

#### Opción A: Configuración Global (Recomendado)

1. Ve a [Messaging Settings](https://console.twilio.com/us1/develop/sms/settings)
2. En la sección **"Status Callback URL"**, configura:
   - **URL**: `https://tu-url-ngrok.com/api/webhooks/twilio` (la misma que URL 1)
   - **Method**: `POST`
3. Esto aplicará a **todos** los mensajes enviados

#### Opción B: Configuración por Mensaje (Variable de Entorno)

Ya está implementado en el código. Solo necesitas configurar la variable de entorno:

```env
TWILIO_STATUS_CALLBACK_URL=https://tu-url-ngrok.com/api/webhooks/twilio
```

El adapter automáticamente agregará el `statusCallback` a cada mensaje enviado.

**Ventajas de Opción B:**
- ✅ Diferentes URLs por entorno sin cambiar Twilio Console
- ✅ Más control sobre qué mensajes reciben callbacks
- ✅ Fácil de cambiar sin acceder a Twilio Console

**Nota**: La Opción A (global) es más simple para la mayoría de casos, pero la Opción B es útil si necesitas flexibilidad.

---

## Configuración de ngrok (Desarrollo Local)

### ¿Por qué ngrok?

Para desarrollo local, necesitas exponer tu servidor local (`localhost:5000`) a internet para que Twilio pueda enviar webhooks. ngrok crea un túnel HTTPS público que apunta a tu servidor local.

### Paso 1: Crear Cuenta en ngrok

1. Ve a [ngrok Signup](https://dashboard.ngrok.com/signup)
2. Crea una cuenta gratuita (solo requiere email)
3. Verifica tu email

### Paso 2: Obtener Authtoken

1. Después de crear la cuenta, ve a [Get Started / Your Authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
2. Copia tu authtoken

### Paso 3: Configurar Authtoken

```bash
# Configurar el authtoken (solo una vez)
ngrok config add-authtoken TU_AUTHTOKEN_AQUI

# Verificar que funciona
ngrok version
```

### Paso 4: Instalar ngrok (si no lo tienes)

```bash
# macOS
brew install ngrok

# Linux
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar -xzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/

# Verificar instalación
ngrok version
```

### Paso 5: Verificar Puerto de la Aplicación

```bash
# Ver qué puerto usa tu aplicación
grep PORT docker-compose.dev.yml
# O verificar en los logs
docker logs especialistas-api-dev | grep "listening"
```

Por defecto, según tu configuración es **puerto 5000**.

### Paso 6: Iniciar ngrok

**Importante**: Como el contenedor usa `network_mode: host`, ngrok debe correrse **en el HOST** (no dentro del contenedor).

```bash
# En una terminal del HOST (no dentro del contenedor)
ngrok http 5000
```

**Salida esperada:**
```
ngrok

Session Status                online
Account                       tu-email@example.com
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok.io -> http://localhost:5000
```

### Paso 7: Copiar URL HTTPS

Del output anterior, copia la URL `https://abc123.ngrok.io` (tu URL será diferente).

**Nota**: Con cuenta gratuita, la URL cambia cada vez que reinicias ngrok. Para mantener la misma URL, deja ngrok corriendo o usa un plan pago con dominio reservado.

---

## Configuración de Webhooks

### URLs de Webhook

#### Desarrollo Local (con ngrok)

```
https://tu-url-ngrok.com/api/webhooks/twilio
```

#### Producción

```
https://tu-dominio.com/api/webhooks/twilio
```

**Requisitos:**
- ✅ Debe ser HTTPS (no HTTP)
- ✅ Debe ser accesible públicamente
- ✅ El endpoint debe aceptar POST requests

### Configurar en Twilio

**Ambas URLs deben apuntar al mismo endpoint:**

1. **WhatsApp Sandbox → Configure**
   - **When a message comes in**: `https://tu-url-ngrok.com/api/webhooks/twilio`
   - **Method**: `POST`

2. **Messaging Settings → Status Callback**
   - **Status Callback URL**: `https://tu-url-ngrok.com/api/webhooks/twilio`
   - **Status Callback Method**: `POST`

**El mismo endpoint maneja:**
- ✅ Mensajes entrantes (inbound messages)
- ✅ Actualizaciones de estado (status updates)

---

## Variables de Entorno

Agregar al `.env`:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# WhatsApp Follow-up Configuration
# IMPORTANT: Disabled by default. Set to 'true' to enable automatic follow-ups.
# Keep disabled on production servers until ready to deploy.
WHATSAPP_FOLLOWUP_ENABLED=false

# WhatsApp Status Check Configuration (optional)
# Checks message statuses in Twilio as a backup mechanism
WHATSAPP_STATUS_CHECK_ENABLED=false

# Webhook Configuration (Opcional - si usas Opción B)
TWILIO_STATUS_CALLBACK_URL=https://tu-url-ngrok.com/api/webhooks/twilio

# Webhook Security (Opcional pero recomendado para producción)
TWILIO_WEBHOOK_SECRET=your_auth_token_aqui  # Usa el mismo Auth Token
TWILIO_WEBHOOK_VALIDATE_SIGNATURE=true

# Rate Limiting (Opcional)
TWILIO_WEBHOOK_RATE_LIMIT_MAX=100
TWILIO_WEBHOOK_RATE_LIMIT_WINDOW_MS=60000
```

---

## Feature Flags (Control de Activación)

El sistema de follow-up está **deshabilitado por defecto** para evitar envíos automáticos no deseados en producción.

### Variables de Control

| Variable | Default | Descripción |
|----------|---------|-------------|
| `WHATSAPP_FOLLOWUP_ENABLED` | `false` | Habilita/deshabilita el sistema completo de follow-ups (scheduler + dispatch) |
| `WHATSAPP_STATUS_CHECK_ENABLED` | `false` | Habilita/deshabilita el job que verifica estados de mensajes en Twilio |

### Cuándo Habilitar

**✅ Desarrollo Local:**
```env
WHATSAPP_FOLLOWUP_ENABLED=true
WHATSAPP_STATUS_CHECK_ENABLED=true
```

**✅ Testing en Servidor (fly.io):**
```env
WHATSAPP_FOLLOWUP_ENABLED=false  # Mantener deshabilitado hasta estar listo
WHATSAPP_STATUS_CHECK_ENABLED=false
```

**✅ Producción:**
Solo habilitar cuando:
- ✅ Has probado exhaustivamente en desarrollo
- ✅ Los webhooks están configurados correctamente
- ✅ Tienes monitoreo y alertas configuradas
- ✅ Estás listo para manejar mensajes en tiempo real

### Qué Hace Cada Flag

- **`WHATSAPP_FOLLOWUP_ENABLED=true`**: 
  - ✅ `FollowUpSchedulerJob` ejecuta cada hora y crea follow-ups
  - ✅ `WhatsAppDispatchJob` ejecuta cada minuto y envía mensajes pendientes
  - ❌ Si está en `false`, ambos jobs se saltan silenciosamente

- **`WHATSAPP_STATUS_CHECK_ENABLED=true`**:
  - ✅ `MessageStatusCheckerJob` ejecuta cada 5 minutos y verifica estados en Twilio
  - ❌ Si está en `false`, el job se salta silenciosamente

**Nota:** Los webhooks de Twilio siempre funcionan independientemente de estos flags. Esto permite recibir respuestas incluso si los follow-ups automáticos están deshabilitados.

---

## Verificación

### 1. Verificar que ngrok está corriendo

```bash
ps aux | grep ngrok | grep -v grep
```

### 2. Obtener URL actual de ngrok

```bash
curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | head -1
```

O simplemente abre en tu navegador: `http://localhost:4040`

### 3. Verificar que el endpoint responde

```bash
curl -X POST http://localhost:5000/api/webhooks/twilio \
  -H "Content-Type: application/json" \
  -d '{"MessageSid":"test123","MessageStatus":"delivered"}'
```

Deberías ver logs en el contenedor:
```bash
docker logs -f especialistas-api-dev | grep -i webhook
```

### 4. Verificar configuración en Twilio

1. Ve a [Twilio Sandbox](https://console.twilio.com/us1/develop/sms/sandbox)
2. Verifica que **ambas URLs** estén configuradas correctamente
3. Verifica que tu número esté registrado en Sandbox

### 5. Test Completo

```bash
# Terminal 1: Monitorear logs
docker logs -f especialistas-api-dev | grep -i "webhook\|Received Twilio"

# Terminal 2: Enviar mensaje de prueba
docker exec especialistas-api-dev npm run whatsapp:test-single <request-id>

# WhatsApp: Responder "si" al número de Sandbox
```

Deberías ver:
```
Received Twilio webhook: MessageSid=SM..., Type=STATUS_UPDATE
Status update processed: MessageSid=SM..., Status=delivered
Received Twilio webhook: MessageSid=SM..., Type=INBOUND_MESSAGE
Processing inbound message: MessageSid=SM..., From=whatsapp:+5491161056636, Preview="si..."
```

---

## Troubleshooting

### Problema: No veo logs cuando respondo en WhatsApp

**Posibles causas:**

1. **URL 1 no está configurada correctamente**
   - Verifica que la URL sea exactamente: `https://tu-url-ngrok.com/api/webhooks/twilio`
   - Verifica que el método sea `POST`
   - Verifica que ngrok esté corriendo

2. **ngrok no está corriendo o cambió la URL**
   - Verifica que ngrok esté activo: `ps aux | grep ngrok`
   - Si reiniciaste ngrok, la URL cambió - actualiza ambas URLs en Twilio

3. **El número no está registrado en Sandbox**
   - En Twilio Sandbox, debes enviar el código "join" al número de Sandbox primero
   - Verifica que tu número esté en la lista de números permitidos

4. **El endpoint no está accesible**
   - Prueba acceder manualmente: `curl https://tu-url-ngrok.com/api/webhooks/twilio`
   - Debería retornar un error 405 (Method Not Allowed) si el endpoint existe pero no acepta GET

### Problema: No veo logs de status updates

**Posibles causas:**

1. **URL 2 no está configurada**
   - Verifica que "Status callback URL" esté configurada en Twilio Sandbox o Messaging Settings

2. **La variable TWILIO_STATUS_CALLBACK_URL no está configurada**
   - Opcional: Puedes configurar `TWILIO_STATUS_CALLBACK_URL` en `.env` para usar una URL diferente por mensaje
   - Si no está configurada, se usa la URL global de Twilio Console

### Problema: ngrok cambió la URL

**Solución:** Con cuenta gratuita, la URL cambia cada vez que reinicias ngrok. Opciones:

1. **Mantener ngrok corriendo** (más simple):
   ```bash
   # Dejar ngrok corriendo en una terminal
   ngrok http 5000
   # La URL se mantiene mientras ngrok esté activo
   ```

2. **Usar dominio reservado** (requiere plan pago de ngrok):
   ```bash
   ngrok http 5000 --domain=tu-dominio-reservado.ngrok.io
   ```

3. **Actualizar Twilio cada vez** (si reinicias ngrok):
   - Copiar nueva URL de ngrok
   - Actualizar en Twilio Console o variable de entorno

### Problema: Webhooks llegan pero no se procesan

**Verificar:**

1. **Logs de la aplicación:**
   ```bash
   docker logs especialistas-api-dev | grep -i "webhook\|twilio"
   ```

2. **Estado de las interactions:**
   ```bash
   docker exec especialistas-api-dev npm run whatsapp:resend list SENT
   ```

3. **Validación de firma:**
   - Si tienes `TWILIO_WEBHOOK_SECRET` configurado, verifica que sea correcto
   - En desarrollo, puedes dejar vacío para deshabilitar validación

### Problema: Solo recibo algunos webhooks

**Causas comunes:**

1. **Rate limiting**: Tu aplicación está rechazando muchos requests
2. **Timeout**: El webhook tarda mucho en responder
3. **Errores en el endpoint**: El endpoint retorna errores 5xx

**Solución:**

- Verifica logs de Twilio Console → Monitor → Logs → Webhooks
- Asegúrate de que el endpoint retorne `200 OK` rápidamente (< 5 segundos)

---

## Configuración Recomendada para Producción

### 1. Variables de Entorno

```env
# Webhook URL (debe ser HTTPS en producción)
TWILIO_WEBHOOK_URL=https://tu-dominio.com/api/webhooks/twilio

# Webhook Secret (para validar firma)
TWILIO_WEBHOOK_SECRET=tu_auth_token_aqui
TWILIO_WEBHOOK_VALIDATE_SIGNATURE=true
```

### 2. Configuración en Twilio

1. **Status Callback URL**: Configurado globalmente en Messaging Settings
2. **WhatsApp Inbound URL**: Configurado en WhatsApp Sandbox/Production
3. **Webhook Secret**: Configurado en tu aplicación (para validar firma)

### 3. Monitoreo

- Configurar alertas si hay muchos webhooks fallidos
- Revisar periódicamente los logs de webhooks en Twilio Console
- Monitorear el `MessageStatusCheckerJob` como backup

---

## Ejemplo de Configuración Completa

### Paso a Paso:

1. **Obtener URL pública:**
   ```bash
   # Desarrollo
   ngrok http 5000
   # Copiar URL: https://abc123.ngrok.io
   
   # Producción
   # Usar tu dominio: https://api.tu-dominio.com
   ```

2. **Configurar en Twilio Console:**
   - WhatsApp Sandbox → Configure → When a message comes in
   - URL: `https://abc123.ngrok.io/api/webhooks/twilio`
   - Method: `POST`
   
   - Messaging Settings → Status Callback
   - URL: `https://abc123.ngrok.io/api/webhooks/twilio`
   - Method: `POST`

3. **Configurar variables de entorno:**
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxx
   TWILIO_AUTH_TOKEN=xxxxx
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
   WHATSAPP_FOLLOWUP_ENABLED=true
   ```

4. **Verificar:**
   ```bash
   # Ver logs
   docker logs -f especialistas-api-dev
   
   # Enviar mensaje de prueba
   docker exec especialistas-api-dev npm run whatsapp:test-single <request-id>
   
   # Verificar que llegue el webhook
   # Deberías ver logs como:
   # "Received Twilio webhook: MessageSid=SM123..."
   ```

---

## Referencias

- [Twilio WhatsApp Documentation](https://www.twilio.com/docs/whatsapp)
- [Twilio Sandbox Guide](https://www.twilio.com/docs/whatsapp/sandbox)
- [Twilio Webhook Security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)
- [ngrok Documentation](https://ngrok.com/docs)

---

## Notas Importantes

1. **HTTPS es obligatorio** en producción (Twilio no acepta HTTP)
2. **El endpoint debe responder rápidamente** (< 5 segundos) o Twilio reintentará
3. **Los webhooks pueden llegar fuera de orden** - la aplicación maneja esto con idempotencia
4. **El status checker job es un backup** - no reemplaza los webhooks, solo los complementa
5. **Con cuenta gratuita de ngrok**, la URL cambia cada vez que reinicias - considera mantener ngrok corriendo o usar un plan pago


