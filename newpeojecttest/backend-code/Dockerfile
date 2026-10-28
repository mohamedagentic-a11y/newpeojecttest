FROM node:20-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Run as the non-root user provided by the node image
RUN chown -R node:node /usr/src/app
USER node

# Port is configurable via PORT env var; 3000 is the conventional default exposed here
EXPOSE 3000

CMD ["npm", "start"]