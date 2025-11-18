FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY server.js ./
COPY llm.js ./

CMD ["node", "server.js"]
