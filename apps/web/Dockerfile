FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH" \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS dependencies
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @datacurrent/web...

FROM dependencies AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY tsconfig.base.json ./
COPY apps/web apps/web
RUN pnpm --filter @datacurrent/web build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
RUN addgroup --system --gid 10001 datacurrent \
    && adduser --system --uid 10001 --ingroup datacurrent datacurrent
COPY --from=build --chown=datacurrent:datacurrent /app/apps/web/.next/standalone ./
COPY --from=build --chown=datacurrent:datacurrent /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=datacurrent:datacurrent /app/apps/web/public ./apps/web/public
USER datacurrent
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["node", "server.js"]
