FROM node:22-alpine

WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node src ./src
COPY --chown=node:node swagger ./swagger
RUN mkdir -p /app/logs && chown node:node /app/logs

ENV NODE_ENV=production

USER node

EXPOSE 3000

CMD ["node", "src/server.js"]
