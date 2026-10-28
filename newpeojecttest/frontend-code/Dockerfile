FROM node:20-alpine

WORKDIR /app

# Install dependencies first to leverage Docker layer caching
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy the rest of the application source
COPY . .

ENV NODE_ENV=development
ENV HOST=0.0.0.0
ENV PORT=5173

EXPOSE 5173

# Run the Vite dev server, bound to all interfaces so it is reachable from outside the container
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]