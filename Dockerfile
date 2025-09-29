# Multi-stage Dockerfile for NestJS Aptos Backend

# Stage 1: Build
FROM node:22.15.0 as build
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY --chown=node:node .npmrc ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code and configuration files
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:22.15.0 as production
WORKDIR /app

# Copy production dependencies from build stage
COPY --from=build /app/node_modules ./node_modules

# Copy built application from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Change ownership to non-root user
USER node

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]