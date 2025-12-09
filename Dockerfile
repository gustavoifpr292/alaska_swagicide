FROM node:20-alpine

WORKDIR /app

COPY AQMel_API/package.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "AQMel_API/server.js"]