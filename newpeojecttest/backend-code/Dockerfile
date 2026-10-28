FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=4000

WORKDIR /app

# Install production dependencies only.
# Copy the manifests first so this layer stays cached when only source changes.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Application source (server.js, routes, middleware, db/init.js, etc.).
COPY src ./src

# schema.sql is applied at startup by db/init.js. If it sits at the project root
# rather than inside src/, copy it as well. The glob lets the build succeed when
# the file is absent at the root; package.json always matches, so COPY never
# fails on an empty match.
COPY package.json schema.sq[l] ./

# Run as the unprivileged user shipped with the official Node image.
RUN chown -R node:node /app
USER node

EXPOSE 4000

# Runtime configuration (DATABASE_URL / PG* settings, JWT_SECRET, CORS origin, etc.)
# must be supplied by the environment at run time. No credentials are baked into the image.
CMD ["node", "src/server.js"]