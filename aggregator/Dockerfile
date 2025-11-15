FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY aggregator.js ./
COPY helper.js ./

CMD ["node", "aggregator.js"]
