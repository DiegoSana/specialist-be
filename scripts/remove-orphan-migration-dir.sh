#!/bin/sh
# Remove orphan migration folder that exists in the container but not in repo.
# Prisma fails with P3015 when it finds a migration folder without migration.sql or when names don't match DB.
set -e
cd "$(dirname "$0")/.."
ORPHAN="prisma/migrations/20260121143414_add_phone_email_verification"
if [ -d "$ORPHAN" ]; then
  echo "Removing orphan directory: $ORPHAN"
  rm -rf "$ORPHAN"
else
  echo "Directory $ORPHAN not found (nothing to remove)."
fi
