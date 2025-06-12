#!/bin/sh

set -e  # Exit immediately if a command exits with a non-zero status

echo "Starting deployment..."

echo "Installing dependencies..."

echo "Updating Prisma Client"
npm i @prisma/client@latest 

npx prisma migrate dev --name init

echo "Running Prisma migrate..."
npx prisma migrate deploy

echo "Generating Prisma client..."
npx prisma generate

echo "Seeding database..."
npx prisma db seed

echo "Deployment completed successfully."

exec npm run start
