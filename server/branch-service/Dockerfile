# branch-service: docker build -t pharmacare/branch-service .
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

# Dependencies first, so this layer is cached between code changes
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
EXPOSE 4003
# Applies this service's migrations, then starts it
CMD ["sh", "-c", "node migrate.js && node index.js"]
