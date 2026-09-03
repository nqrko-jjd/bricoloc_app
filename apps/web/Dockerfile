# syntax=docker/dockerfile:1
# Contexte de build = racine du dépôt :  docker build -f apps/web/Dockerfile .

FROM node:22-bookworm-slim AS base
WORKDIR /repo

# ---------- build ----------
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# devDependencies incluses explicitement (typescript pour `next build`),
# quel que soit NODE_ENV.
RUN npm ci --include=dev
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace @bricoloc/shared

# `next build` DOIT tourner en production (sinon prerender /404 casse :
# « <Html> should not be imported outside of pages/_document »).
ENV NODE_ENV=production
# Le navigateur parle à l'API via le proxy same-origin /bricoloc-api -> pas d'URL publique.
ENV NEXT_PUBLIC_API_URL=""
# Rewrites resolus au runtime via API_URL ; valeur neutre au build.
ENV API_URL="http://api:4000"
RUN npm run build --workspace @bricoloc/web

# ---------- image finale (sortie standalone) ----------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /repo

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD curl -fsS http://localhost:3000/fr >/dev/null || exit 1

CMD ["node", "apps/web/server.js"]
