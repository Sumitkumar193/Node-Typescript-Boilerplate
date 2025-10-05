#!/bin/sh

set -e  # Exit immediately if a command exits with a non-zero status

echo "Running Prisma migrate..."
npx prisma migrate deploy

echo "Seeding the database..."
npx prisma db seed

echo "Deployment completed successfully."

npm run start