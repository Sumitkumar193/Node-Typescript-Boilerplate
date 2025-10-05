# Use official Node.js 20 image
FROM node:20

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev dependencies for build)
RUN npm install

# Install global dependencies
RUN npm install -g pm2

# Copy source code
COPY . .

# Copy public assets
COPY public ./public

# Convert line endings and make deploy.sh executable (handles Windows line endings)
RUN sed -i 's/\r$//' deploy.sh && chmod +x deploy.sh

# Run Prisma generate
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Expose port (from .env or default 3000)
EXPOSE ${PORT}
EXPOSE ${SOCKET_PORT}

# Execute deploy.sh script
ENTRYPOINT ["./deploy.sh"]