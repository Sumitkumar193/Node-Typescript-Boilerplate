# Use official Node.js 20 image
FROM node:20

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./

# Install global dependencies
RUN npm install --production
RUN npm install --save-dev @types/bcryptjs @types/morgan @types/multer @types/jsonwebtoken

RUN npm install -g pm2

# Copy source code
COPY . .

# Run Prisma migrate before build
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Expose port (from .env or default 3000)
EXPOSE ${PORT}

# Start the app
# CMD ["npm", "run", "dev"]
CMD ["pm2-runtime", "dist/index.js"]
