# Environment Variables Guide

This guide explains how to manage environment variables for the Specialist API, especially for Fly.io deployments.

## Fly.io Variable Management Strategy

Fly.io supports two ways to set environment variables:

### 1. Non-Sensitive Variables → `fly.toml` `[env]` section

**Variables that can be committed to git** (like configuration values, URLs, etc.):

- `NODE_ENV` - Environment mode
- `PORT` - Application port
- `CORS_ORIGINS` - Allowed CORS origins (comma-separated)

These are defined in `fly.toml` under the `[env]` section and are version-controlled.

### 2. Sensitive Variables → Fly.io Secrets

**Variables that should NEVER be committed** (API keys, passwords, tokens):

Set these using Fly.io CLI:
```bash
fly secrets set VARIABLE_NAME=value
```

Or set multiple at once:
```bash
fly secrets set \
  JWT_SECRET=your-secret \
  DATABASE_URL=postgresql://... \
  GOOGLE_CLIENT_SECRET=...
```

View current secrets:
```bash
fly secrets list
```

## Required Variables

### ⚠️ Sensitive (Set as Fly.io Secrets)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-super-secret-key` |
| `JWT_EXPIRES_IN` | JWT token expiration | `7d` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL | |
| `FACEBOOK_APP_ID` | Facebook OAuth app ID | |
| `FACEBOOK_APP_SECRET` | Facebook OAuth app secret | |
| `FACEBOOK_CALLBACK_URL` | Facebook OAuth callback URL | |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | |
| `TWILIO_VERIFY_SERVICE_SID` | Twilio verify service SID | |
| `TWILIO_STATUS_CALLBACK_URL` | Twilio webhook callback URL | |
| `TWILIO_WHATSAPP_FROM` | Twilio WhatsApp sender number | |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name (if using) | |
| `CLOUDINARY_API_KEY` | Cloudinary API key (if using) | |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret (if using) | |
| `NOTIFICATIONS_SMTP_HOST` | SMTP server host | `smtp.gmail.com` |
| `NOTIFICATIONS_SMTP_PORT` | SMTP server port | `587` |
| `NOTIFICATIONS_SMTP_USER` | SMTP username | |
| `NOTIFICATIONS_SMTP_PASS` | SMTP password | |
| `NOTIFICATIONS_SMTP_FROM` | SMTP sender email | |
| `MAILGUN_API_KEY` | Mailgun API key (if using Mailgun) | |
| `MAILGUN_DOMAIN` | Mailgun domain (if using Mailgun) | |
| `MAILGUN_FROM` | Mailgun sender email (if using Mailgun) | |

### ✅ Non-Sensitive (In `fly.toml`)

| Variable | Description | Current Value |
|----------|-------------|---------------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Application port | `8080` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000,http://localhost:3001,http://127.0.0.1:3001,https://specialist-admin.vercel.app,https://specialist-fe.vercel.app` |

### Optional Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `FRONTEND_URL` | Frontend URL for redirects | `http://localhost:3000` |
| `EMAIL_PROVIDER` | Email provider: `smtp` or `mailgun` | `smtp` |
| `WHATSAPP_FOLLOWUP_ENABLED` | Enable WhatsApp followup | `true` |
| `NOTIFICATIONS_DISPATCH_ENABLED` | Enable background notification processing | `true` |
| `NOTIFICATIONS_DISPATCH_BATCH_SIZE` | Batch size for notifications | `25` |
| `NOTIFICATIONS_DISPATCH_MAX_ATTEMPTS` | Max retry attempts | `5` |
| `NOTIFICATIONS_DISPATCH_RETRY_BASE_SECONDS` | Base retry delay | `60` |
| `NOTIFICATIONS_DISPATCH_RETRY_MAX_SECONDS` | Max retry delay | `3600` |
| `NOTIFICATIONS_RETENTION_DAYS` | Days to keep notifications | `90` |
| `MAILGUN_REGION` | Mailgun region: `us` or `eu` | `us` |

## Local Development

For local development, create a `.env` file based on `.docker-compose.env.example`:

```bash
cp .docker-compose.env.example .env
# Edit .env with your local values
```

**Important:** `.env` is gitignored and should never be committed.

## Fly.io Deployment Checklist

1. **Set all sensitive variables as secrets:**
   ```bash
   fly secrets set DATABASE_URL=postgresql://...
   fly secrets set JWT_SECRET=your-secret-key
   # ... etc
   ```

2. **Verify non-sensitive variables in `fly.toml`:**
   - Check `[env]` section has correct values
   - Update `CORS_ORIGINS` if needed

3. **Deploy:**
   ```bash
   fly deploy
   ```

4. **Verify secrets are set:**
   ```bash
   fly secrets list
   ```

## Best Practices

✅ **DO:**
- Commit non-sensitive configuration to `fly.toml` `[env]` section
- Use Fly.io secrets for all sensitive data
- Document all variables in this guide
- Use `.docker-compose.env.example` as a template for local development

❌ **DON'T:**
- Commit `.env` files to git
- Put sensitive values in `fly.toml`
- Hardcode secrets in code
- Share secrets in chat/email

## References

- [Fly.io Secrets Documentation](https://fly.io/docs/reference/secrets/)
- [Fly.io Configuration Reference](https://fly.io/docs/reference/configuration/)

