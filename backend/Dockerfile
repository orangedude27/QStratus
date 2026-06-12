FROM docker.io/node:alpine

RUN apk add --no-cache curl

WORKDIR /app
COPY package.json package-lock.json .
RUN npm install

COPY --parents data/ lib/ routes/ socket/ server.ts tsconfig.json .

RUN npm run build

CMD ["npm", "start"]
