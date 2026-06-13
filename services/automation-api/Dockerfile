FROM node:22-slim

WORKDIR /app

COPY package.json ./
COPY outputs/generated-stream-pack ./outputs/generated-stream-pack
COPY outputs/schedule ./outputs/schedule
COPY outputs/monetization-kit ./outputs/monetization-kit
COPY outputs/shorts-kit ./outputs/shorts-kit
COPY services/automation-api ./services/automation-api

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "services/automation-api/server.mjs"]
