# Multi-stage Dockerfile for CFB Pick'em Backend
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./

# Copy all package manifests
COPY packages/backend/package.json packages/backend/
COPY packages/shared/package.json packages/shared/

# ================================
# Dependencies stage
# ================================
FROM base AS deps
RUN pnpm install --frozen-lockfile

# ================================
# Build stage
# ================================
FROM base AS build

# Copy dependencies from deps stage (shared has no node_modules - types only)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/backend/node_modules ./packages/backend/node_modules

# Copy source code
COPY packages/backend ./packages/backend
COPY packages/shared ./packages/shared

# Build the backend
WORKDIR /app/packages/backend
RUN pnpm build

# ================================
# Production stage
# ================================
FROM node:20-alpine AS production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files for production install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/backend/package.json packages/backend/
COPY packages/shared/package.json packages/shared/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built application (dist/backend/src/... due to monorepo rootDir computation)
COPY --from=build /app/packages/backend/dist ./packages/backend/dist

# Copy migration files (CRITICAL for production migrations)
COPY --from=build /app/packages/backend/drizzle ./packages/backend/drizzle

# Set working directory to backend
WORKDIR /app/packages/backend

# Expose port
EXPOSE 3000

# Run migrations then start the app
CMD ["pnpm", "start:prod"]
