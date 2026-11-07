# notification-service: docker build -t pharmacare/notification-service .
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

# Dependencies first, so this layer is cached between code changes
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
EXPOSE 4009
# No tables of its own: just start
CMD ["node", "index.js"]
