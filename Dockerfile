FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV TABULARIUM_ALLOW_BUILD_DATABASE_URL=1
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN groupadd --system nextjs && useradd --system --gid nextjs nextjs

COPY --from=builder --chown=nextjs:nextjs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nextjs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nextjs /app/.next ./.next
COPY --from=builder --chown=nextjs:nextjs /app/app ./app
COPY --from=builder --chown=nextjs:nextjs /app/components ./components
COPY --from=builder --chown=nextjs:nextjs /app/generated ./generated
COPY --from=builder --chown=nextjs:nextjs /app/lib ./lib
COPY --from=builder --chown=nextjs:nextjs /app/middleware.ts ./middleware.ts
COPY --from=builder --chown=nextjs:nextjs /app/next.config.mjs ./next.config.mjs
COPY --from=builder --chown=nextjs:nextjs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nextjs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nextjs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nextjs /app/public ./public

RUN mkdir -p /app/storage/uploads/invoices && chown -R nextjs:nextjs /app/storage
USER nextjs

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["npm", "run", "start"]
