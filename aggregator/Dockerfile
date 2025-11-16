FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY aggregator.js ./
COPY aggrHelper.js ./
COPY dbHelper.js ./

CMD ["node", "aggregator.js"]
