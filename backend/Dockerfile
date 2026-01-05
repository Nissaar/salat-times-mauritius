FROM node:20-alpine

WORKDIR /app
ENV NODE_OPTIONS=--no-network-family-autoselection
COPY package*.json ./

RUN npm install --verbose

COPY . .

EXPOSE 3000

USER node

CMD ["node", "src/server.js"]
