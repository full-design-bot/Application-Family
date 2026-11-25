# ══════════════════════════════════════════════════════════════
# Noesia Family — image de production (Next.js en mode standalone)
# Servie sur la plateforme Noesia derrière Caddy : voir
# docs/DEPLOIEMENT_NOESIA.md.
#
# Les variables NEXT_PUBLIC_* sont inscrites dans le code du
# navigateur AU MOMENT DU BUILD : elles sont passées en build args.
# Les secrets (SUPABASE_SECRET_KEY, VAPID_PRIVATE_KEY, CRON_SECRET)
# ne sont lus qu'à l'exécution : jamais dans l'image.
# ══════════════════════════════════════════════════════════════

# ── 1. Dépendances ──────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── 2. Build ────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── 3. Exécution ────────────────────────────────────────────────
FROM node:22-alpine AS run
# tini : pour que SIGTERM parvienne à Node (arrêt propre).
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
