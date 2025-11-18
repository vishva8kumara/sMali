FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY aggregator.js ./
COPY aggrHelper.js ./
COPY dbHelper.js ./
COPY run.sh ./

#CMD ["node", "aggregator.js"]
RUN chmod +x /run.sh
CMD ["/run.sh"]
