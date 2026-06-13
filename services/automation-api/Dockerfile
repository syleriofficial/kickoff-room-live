FROM node:22-slim

WORKDIR /app

COPY package.json ./
COPY outputs/generated-stream-pack ./outputs/generated-stream-pack
COPY services/automation-api ./services/automation-api

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "services/automation-api/server.mjs"]
