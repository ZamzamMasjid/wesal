# Production image for the `web` component (ADR-007). Built by `fly deploy`.
# Three stages: install, build, and a small runtime with only what runs.
# syntax=docker/dockerfile:1

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# The static fallback notice shows these without touching the database, so they
# are inlined at build time (src/lib/venue-contact.ts). Set in fly.toml [build.args].
ARG NEXT_PUBLIC_VENUE_PHONE=""
ARG NEXT_PUBLIC_VENUE_WHATSAPP=""
ENV NEXT_PUBLIC_VENUE_PHONE=$NEXT_PUBLIC_VENUE_PHONE \
    NEXT_PUBLIC_VENUE_WHATSAPP=$NEXT_PUBLIC_VENUE_WHATSAPP
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm run build:migrate

FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/data
RUN apk add --no-cache su-exec

# The Next.js standalone server, its static assets, and public files.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# The release command (ADR-021): a bundled migration runner plus the SQL it applies.
COPY --from=build /app/dist/migrate.mjs ./dist/migrate.mjs
COPY --from=build /app/drizzle ./drizzle
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
