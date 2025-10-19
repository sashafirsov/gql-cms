# syntax=docker.io/docker/dockerfile:1

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# skip npm install as nx build would produce `dist/apps/admin-ui/.next/standalone/node_modules`
## Install dependencies based on the preferred package manager
#COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
#RUN \
#  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
#  elif [ -f package-lock.json ]; then npm ci; \
#  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
#  else echo "Lockfile not found." && exit 1; \
#  fi


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
RUN apk add --no-cache tree
#COPY --from=deps /app/node_modules ./node_modules
#COPY . .

# Copy all files from the standalone output
COPY dist/apps/admin-ui/.next/standalone ./
# Copy static files to the location where distDir expects them
COPY dist/apps/admin-ui/.next/static ./dist/apps/admin-ui/.next/static
# Copy public files
COPY dist/apps/admin-ui/public ./apps/admin-ui/public

RUN tree -L 5 /app


# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED=1

#RUN \
#  if [ -f yarn.lock ]; then yarn run build; \
#  elif [ -f package-lock.json ]; then npm run build; \
#  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
#  else echo "Lockfile not found." && exit 1; \
#  fi

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app
RUN apk add --no-cache tree

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app ./

RUN tree -L 5 .

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing

USER nextjs

EXPOSE 3000

ENV PORT=3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/admin-ui/server.js"]
