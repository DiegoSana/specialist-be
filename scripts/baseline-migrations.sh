#!/bin/sh
# Baseline: mark all existing migrations as applied (database already has their schema).
# Then deploy will only run the new migration (20260206000000_remove_profile_contact_and_active).
set -e
cd "$(dirname "$0")/.."

# Order: same as prisma/migrations (chronological by name)
MIGRATIONS=(
  "20250127000000_add_request_interactions"
  "20251215200251_init"
  "20251223030000_add_in_app_notifications"
  "20251223031000_add_notification_preferences"
  "20251223033000_add_notifications_and_deliveries"
  "20251223040000_notification_delivery_retry"
  "20251226150000_add_request_title"
  "20260113000000_add_service_provider"
  "20260115000000_decouple_request_interest_to_service_provider"
  "20260116000000_add_profile_status_states"
  "20260117000000_add_phone_email_verification"
)

for name in "${MIGRATIONS[@]}"; do
  echo "Marking as applied: $name"
  npx prisma migrate resolve --applied "$name" || true
done

echo "Deploying pending migrations..."
npx prisma migrate deploy
