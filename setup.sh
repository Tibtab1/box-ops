#!/usr/bin/env bash
# Quick-start : install deps, init DB, run seed.
set -e

echo "📦  Installing dependencies..."
npm install

echo "🗄️   Initializing database..."
npx prisma migrate dev --name init

echo "🌱  Seeding demo data..."
npm run db:seed

echo ""
echo "✅  Ready. Run 'npm run dev' and open http://localhost:3000"
