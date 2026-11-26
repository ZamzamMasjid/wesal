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
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
# The static fallback notice shows these without touching the database, so they
# are inlined at build time (src/lib/venue-contact.ts). Set in fly.toml [build.args].
ARG NEXT_PUBLIC_VENUE_PHONE=""
ARG NEXT_PUBLIC_VENUE_WHATSAPP=""
ENV NEXT_PUBLIC_VENUE_PHONE=$NEXT_PUBLIC_VENUE_PHONE \
    NEXT_PUBLIC_VENUE_WHATSAPP=$NEXT_PUBLIC_VENUE_WHATSAPP
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm run build:migrate && npm run build:owner && npm run build:media && npm run build:venue

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
# One-off: creates the first owner (docs: DEPLOYMENT.md).
COPY --from=build /app/dist/create-owner.mjs ./dist/create-owner.mjs
# One-off: imports the venue photographs in assets/venue (docs: DEPLOYMENT.md).
COPY --from=build /app/dist/import-venue-media.mjs ./dist/import-venue-media.mjs
COPY --from=build /app/assets/venue ./assets/venue
COPY --from=build /app/scripts/venue-media.json ./scripts/venue-media.json
# One-off: seeds the sample occasions and weekly slot pattern.
COPY --from=build /app/dist/sync-venue-data.mjs ./dist/sync-venue-data.mjs
COPY --from=build /app/drizzle ./drizzle
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
