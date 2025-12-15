#!/bin/sh

# Script para inicializar la base de datos
# Uso: docker-compose -f docker-compose.dev.yml exec app sh scripts/init-db.sh

echo "🔍 Verificando estado de Prisma..."

# Generar cliente de Prisma
echo "📦 Generando cliente de Prisma..."
npx prisma generate

# Verificar si hay migraciones
if [ ! -d "prisma/migrations" ] || [ -z "$(ls -A prisma/migrations)" ]; then
  echo "📝 No hay migraciones. Creando migración inicial..."
  npx prisma migrate dev --name init
else
  echo "✅ Migraciones encontradas. Aplicando migraciones..."
  npx prisma migrate deploy
fi

echo "✨ Base de datos inicializada correctamente!"

