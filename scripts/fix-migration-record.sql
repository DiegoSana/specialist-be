-- Remove any migration record that does not match a migration folder in the repo.
-- (e.g. 20260121143414_add_phone_email_verification when we have 20260117000000_add_phone_email_verification)
DELETE FROM "_prisma_migrations"
WHERE migration_name LIKE '%add_phone_email_verification%'
  AND migration_name != '20260117000000_add_phone_email_verification';
