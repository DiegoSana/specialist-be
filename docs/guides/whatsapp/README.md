# Sistema de Follow-up WhatsApp

Documentación completa del sistema de follow-up automático de solicitudes vía WhatsApp usando Twilio.

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


