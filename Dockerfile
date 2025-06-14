# ----------- Stage 1: Builder -----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps: build tools, Python, OpenSSL (required by Prisma & bcrypt)
RUN apk add --no-cache \
  openssl \
  python3 \
  make \
  g++ \
  libc6-compat

# Install all node modules including dev
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build


# ----------- Stage 2: Production -----------
FROM node:20-alpine

WORKDIR /app

# Install only runtime deps
RUN apk add --no-cache openssl

# Copy production-only files
COPY package*.json ./
RUN npm install --production

# Copy built output & runtime files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/deploy.sh ./deploy.sh

RUN chmod +x deploy.sh

ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["./deploy.sh"]
