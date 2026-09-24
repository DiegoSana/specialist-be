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
| `DATABASE_URL` | Runtime PostgreSQL connection string. On Supabase, use the **transaction pooler** (port `6543`, `?pgbouncer=true`), not the direct connection - the app opens/reuses connections per request and the pooler handles that far better than raw Postgres. | `postgresql://user:pass@pooler-host:6543/db?pgbouncer=true` |
| `DIRECT_URL` | Direct/session PostgreSQL connection (port `5432`), used only by `prisma migrate deploy` (via `release_command` in `fly.toml`) and `prisma migrate dev`. pgBouncer's transaction mode doesn't support the prepared statements migrations need. | `postgresql://user:pass@direct-host:5432/db` |
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
| `ANTHROPIC_API_KEY` | Anthropic API key, used only when `INTENT_CLASSIFIER_PROVIDER=anthropic` (see below) | |

`EMAIL_PROVIDER=ethereal` needs none of the above - it dynamically provisions its own throwaway
SMTP credentials at runtime (see below).

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
| `EMAIL_PROVIDER` | Email provider: `smtp`, `mailgun`, or `ethereal` (dynamically-provisioned ethereal.email test account via `nodemailer.createTestAccount()` - no secrets needed; nothing is really delivered, each send's preview URL is returned via `GET /admin/notifications`. Pre-launch Fly.io testing deploy only, see `docs/guides/NOTIFICATIONS.md`) | `smtp` |
| `WHATSAPP_PROVIDER` | WhatsApp provider: `twilio` (real Twilio API) or `local` (no-network fake adapter for the admin conversations test loop, see `docs/guides/whatsapp/README.md`). Defaults to `twilio` so production never silently goes fake; set to `local` for dev. | `twilio` |
| `WHATSAPP_DEV_MODE_ENABLED` | Explicit opt-in that turns on the WhatsApp admin dev endpoints (simulate reply, force-trigger follow-up) even when `NODE_ENV=production`, as long as `WHATSAPP_PROVIDER=local` too. For a `NODE_ENV=production` deploy that is pre-launch/testing-only (e.g. the current Fly.io `main` deploy, see `docs/guides/whatsapp/README.md`) - never set on a deploy handling real users/real WhatsApp. Kept independent of `NODE_ENV` so it doesn't also flip other prod-only behavior (Swagger, etc.). | `false` |
| `WHATSAPP_FOLLOWUP_ENABLED` | Enable WhatsApp followup | `true` |
| `WHATSAPP_FOLLOWUP_WINDOW_START_HOUR` | First hour (inclusive, 0-23) in which `FollowUpSchedulerJob` may schedule follow-ups (daytime only, spec 9-20h). Not secret. | `9` |
| `WHATSAPP_FOLLOWUP_WINDOW_END_HOUR` | Hour (exclusive) after which no follow-ups are scheduled. | `20` |
| `WHATSAPP_FOLLOWUP_TIMEZONE` | IANA timezone used to evaluate the daytime window. | `America/Argentina/Buenos_Aires` |
| `REQUEST_EXPIRATION_ENABLED` | Enables `RequestExpirationJob` (Sistema actor: applies request timeouts hourly at :30). Off by default so deploys don't auto-close requests until the plazos are agreed. Not secret; `fly.toml [env]`. | `false` |
| `REQUEST_EXPIRY_DAYS_PUBLISHED` | Days a `PUBLISHED` (bolsa) request may sit without the client choosing before it becomes `EXPIRED`. | `6` |
| `REQUEST_EXPIRY_DAYS_SENT` | Days a `SENT` (direct) request may wait for the provider before it becomes `NO_RESPONSE`. | `6` |
| `REQUEST_EXPIRY_DAYS_CONTACT_RELEASED` | Days in `CONTACT_RELEASED` before `ABANDONED`. Assumption: the spec's reminders go out at 2/4/6 days, so 8 leaves margin after the last one. | `8` |
| `REQUEST_EXPIRY_DAYS_FINISHED` | Days a `FINISHED` request waits for the client's confirmation before the automatic close to `CLOSED`. | `7` |
| `INTENT_CLASSIFIER_PROVIDER` | WhatsApp reply classifier: `anthropic` (real LLM call, forced tool use) or `local` (deterministic keyword matching, no network, no `viability`/non-explicit `optOut` detection). Defaults to `local` - deliberately the **inverse** of `WHATSAPP_PROVIDER`'s "default real" rule, since defaulting to a paid third-party API on every inbound webhook in an unconfigured environment is a worse failure mode than degrading to keyword matching; production must opt in explicitly. | `local` |
| `ANTHROPIC_INTENT_MODEL` | Claude model id used for WhatsApp reply classification when `INTENT_CLASSIFIER_PROVIDER=anthropic`. | `claude-haiku-4-5-20251001` |
| `INTENT_CLASSIFIER_TIMEOUT_MS` | Hard timeout (ms) for the LLM classification call before falling back to keyword matching; the synchronous Twilio webhook must never hang on this. | `4000` (service-level `Promise.race`); the Anthropic SDK call itself uses a shorter internal timeout (`3500`ms) |
| `INTENT_CLASSIFIER_CONFIDENCE_THRESHOLD` | Below this confidence (0-1), the classifier's `statusIntent` is downgraded to `UNKNOWN` rather than risk a wrong `Request.status` transition. | `0.6` |
| `WHATSAPP_REPLY_MATCH_WINDOW_DAYS` | How many days back an inbound WhatsApp reply can match a pending automated `FOLLOW_UP` interaction (`RequestInteractionRepository.findMostRecentByPhone`). Covers the longest follow-up cadence (10 days) plus margin. | `14` |
| `SUPPORT_CONVERSATIONS_ENABLED` | Gate for the Support context fork in `RequestInteractionService.processInboundMessage`: when an inbound WhatsApp message doesn't match any pending automated follow-up, `true` routes it to `SupportConversationService.receiveInboundMessage` instead of the previous silent drop. Defaults to `false` for a safe, explicit rollout - flip it on once the admin panel screen exists. See `docs/guides/whatsapp/README.md`. | `false` |
| `NOTIFICATIONS_DISPATCH_ENABLED` | Enable background notification processing | `true` |
| `NOTIFICATIONS_DISPATCH_BATCH_SIZE` | Batch size for notifications | `25` |
| `NOTIFICATIONS_DISPATCH_MAX_ATTEMPTS` | Max retry attempts | `5` |
| `NOTIFICATIONS_DISPATCH_RETRY_BASE_SECONDS` | Base retry delay | `60` |
| `NOTIFICATIONS_DISPATCH_RETRY_MAX_SECONDS` | Max retry delay | `3600` |
| `NOTIFICATIONS_RETENTION_DAYS` | Days to keep notifications | `90` |

> Code defaults: `NOTIFICATIONS_DISPATCH_ENABLED=false`, `NOTIFICATIONS_DISPATCH_BATCH_SIZE=25`, `NOTIFICATIONS_DISPATCH_MAX_ATTEMPTS=5`, `NOTIFICATIONS_RETENTION_DAYS=90`. Production enables dispatch via `fly.toml` (`NOTIFICATIONS_DISPATCH_ENABLED = 'true'`). The JWT expiration variable is `JWT_EXPIRES_IN` (`JWT_EXPIRATION` is accepted as a legacy fallback).
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

