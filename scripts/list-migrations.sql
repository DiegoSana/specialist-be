-- List all recorded migrations (run with: npx prisma db execute --file scripts/list-migrations.sql)
-- Note: db execute may not print SELECT results; use psql or Prisma Studio to run this if needed.
SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at;
