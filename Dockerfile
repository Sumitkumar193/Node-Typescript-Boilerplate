# ---- builder ----
FROM node:24.10.0-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates \
 && apt-get clean && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN sed -i 's/\r$//' deploy.sh && chmod +x deploy.sh
RUN DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy npx prisma generate
RUN npm run build

# ---- runner ----
FROM node:24.10.0-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates \
 && apt-get clean && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ARG PORT=3000
ARG SOCKET_PORT=3001
ENV PORT=${PORT}
ENV SOCKET_PORT=${SOCKET_PORT}
COPY --chown=node:node --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=node:node --from=builder /app/deploy.sh ./deploy.sh
USER node
EXPOSE ${PORT} ${SOCKET_PORT}
ENTRYPOINT ["./deploy.sh"]