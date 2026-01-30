# Scripts de Testing para WhatsApp Follow-up

Scripts útiles para testing manual del sistema de WhatsApp follow-up, organizados por categoría.

## 📁 Estructura

```
test/scripts/whatsapp/
├── testing/          # Scripts para ejecutar tests
├── debugging/        # Scripts para debugging
└── utilities/        # Scripts utilitarios
```

---

## 🧪 Scripts de Testing

### `test-whatsapp-followup.ts`

Script principal para ejecutar jobs y ver estado del sistema.

**Uso:**
```bash
# Ver estado general
docker exec especialistas-api-dev npm run whatsapp:test

# Ejecutar scheduler
docker exec especialistas-api-dev npm run whatsapp:test scheduler

# Ejecutar dispatch
docker exec especialistas-api-dev npm run whatsapp:test dispatch

# Ejecutar status checker
docker exec especialistas-api-dev npm run whatsapp:test status-checker
```

**Qué hace:**
- Verifica configuración de Twilio
- Ejecuta jobs manualmente
- Muestra estadísticas y estado del sistema

---

### `test-single-followup.ts`

Script para testear el flujo completo de follow-up para un request específico.

**Uso:**
```bash
# Test completo para un request
docker exec especialistas-api-dev npm run whatsapp:test-single <request-id>

# Con simulación de respuesta
docker exec especialistas-api-dev npm run whatsapp:test-single <request-id> --simulate-response
```

**Qué hace:**
- Prepara el request (ACCEPTED, updated_at hace 4 días)
- Ejecuta scheduler para crear follow-up
- Envía el mensaje
- Verifica estado en Twilio
- Opcionalmente simula respuesta del usuario

---

### `test-full-flow.ts`

Script para testing end-to-end completo del flujo.

**Uso:**
```bash
# Ejecutar dentro del contenedor
docker exec especialistas-api-dev npx ts-node test/scripts/whatsapp/testing/test-full-flow.ts
```

**Qué hace:**
- Prepara datos de prueba
- Ejecuta todos los jobs
- Verifica resultados
- Muestra resumen completo

---

## 🐛 Scripts de Debugging

### `debug-whatsapp.ts`

Script para debugging de configuración y mensajes de WhatsApp.

**Uso:**
```bash
# Ejecutar dentro del contenedor
docker exec especialistas-api-dev npm run whatsapp:debug
```

**Qué muestra:**
- Configuración de Twilio
- Mensajes enviados recientemente
- Números de teléfono en la base de datos
- Estado de las interactions

---

### `debug-event-handler.ts`

Script para debugging del event handler y procesamiento de eventos.

**Uso:**
```bash
# Ejecutar dentro del contenedor
docker exec especialistas-api-dev npx ts-node test/scripts/whatsapp/debugging/debug-event-handler.ts <interaction-id>
```

**Qué hace:**
- Verifica que el evento se procesó correctamente
- Muestra el estado del request antes y después
- Verifica que el handler se ejecutó

---

## 🛠️ Scripts Utilitarios

### `list-requests.ts`

Script para listar requests con información relevante para testing.

**Uso:**
```bash
# Ejecutar dentro del contenedor
docker exec especialistas-api-dev npx ts-node test/scripts/whatsapp/utilities/list-requests.ts
```

**Qué muestra:**
- Lista de requests con estado y fechas
- Información de provider y cliente
- Teléfonos configurados

---

### `resend-messages.ts`

Script para resetear y reenviar mensajes de WhatsApp.

**Uso:**
```bash
# Ver interactions por estado
docker exec especialistas-api-dev npm run whatsapp:resend list PENDING
docker exec especialistas-api-dev npm run whatsapp:resend list SENT
docker exec especialistas-api-dev npm run whatsapp:resend list FAILED

# Resetear y reenviar una interaction específica
docker exec especialistas-api-dev npm run whatsapp:resend reset <interaction-id>

# Resetear todas las fallidas
docker exec especialistas-api-dev npm run whatsapp:resend reset-all FAILED
```

**Qué hace:**
- Lista interactions por estado
- Resetea estado de interactions para reenvío
- Útil para testing y debugging

---

### `simulate-webhook.sh`

Script bash para simular webhooks de Twilio.

**Uso:**
```bash
# Simular status update (delivered)
./test/scripts/whatsapp/utilities/simulate-webhook.sh status SM123 delivered

# Simular status update (failed)
./test/scripts/whatsapp/utilities/simulate-webhook.sh status SM123 failed

# Simular mensaje entrante
./test/scripts/whatsapp/utilities/simulate-webhook.sh inbound SM456 "whatsapp:+5492944123456" "si confirmo"
```

**Parámetros:**
- `status` - Tipo de webhook (status update)
- `inbound` - Tipo de webhook (mensaje entrante)
- `SM123` - MessageSid
- `delivered` - Estado del mensaje (para status update)
- `whatsapp:+5492944123456` - Número de origen (para inbound)
- `"si confirmo"` - Cuerpo del mensaje (para inbound)

**Nota**: Este script debe ejecutarse desde el host (no dentro del contenedor), ya que usa `curl`.

---

## 📝 Scripts NPM

Los siguientes scripts están disponibles en `package.json`:

```json
{
  "whatsapp:test": "ts-node test/scripts/whatsapp/testing/test-whatsapp-followup.ts",
  "whatsapp:test-single": "ts-node test/scripts/whatsapp/testing/test-single-followup.ts",
  "whatsapp:debug": "ts-node test/scripts/whatsapp/debugging/debug-whatsapp.ts",
  "whatsapp:resend": "ts-node test/scripts/whatsapp/utilities/resend-messages.ts"
}
```

**Uso recomendado:**
```bash
# Ejecutar dentro del contenedor (RECOMENDADO)
docker exec especialistas-api-dev npm run whatsapp:test
docker exec especialistas-api-dev npm run whatsapp:test-single <request-id>
docker exec especialistas-api-dev npm run whatsapp:debug
docker exec especialistas-api-dev npm run whatsapp:resend list PENDING
```

---

## 🔗 Referencias

- [Guía de Testing](../../../../docs/guides/whatsapp/TESTING.md) - Guía completa de testing
- [Guía de Setup](../../../../docs/guides/whatsapp/SETUP.md) - Configuración inicial


