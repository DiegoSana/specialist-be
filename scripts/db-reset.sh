#!/bin/bash

# Database Reset Script
# This script resets the database and seeds it with dummy data

echo "🔄 Resetting database..."

# Set DATABASE_URL for local execution
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/especialistas?schema=public"

# Navigate to project root
cd "$(dirname "$0")/.."

# Reset the database schema
echo "📦 Pushing schema..."
npx prisma db push --force-reset --skip-generate

# Generate Prisma client
echo "⚙️ Generating Prisma client..."
npx prisma generate

# Compile and run seed
echo "🌱 Compiling seed..."
npx tsc prisma/seed.ts --esModuleInterop --skipLibCheck --outDir prisma/dist

echo "🌱 Running seed..."
node prisma/dist/seed.js

echo ""
echo "✅ Database reset completed!"



